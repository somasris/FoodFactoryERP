import { AuditAction, InventoryTransactionType, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult, PaginationParams } from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  isBatchExpired,
  lockInventoryItems,
  lockOrCreateBalance,
  UserContext,
  ZERO,
} from './inventory.utils';

export class InventoryLedgerService {
  static async getDashboardSummary(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const whWhere: Prisma.InventoryBalanceWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};
    const docWhWhere = allowedWh ? { warehouseId: { in: allowedWh } } : {};
    const transferWhWhere = allowedWh
      ? { OR: [{ sourceWarehouseId: { in: allowedWh } }, { destinationWarehouseId: { in: allowedWh } }] }
      : {};

    const today = new Date();
    const soon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      balances,
      expiringBatchesCount,
      expiredBatchesCount,
      pendingReceipts,
      pendingIssues,
      inTransitTransfers,
      pendingAdjustments,
      recentTransactions,
    ] = await Promise.all([
      prisma.inventoryBalance.findMany({
        where: { ...whWhere, quantityOnHand: { gt: 0 } },
        select: {
          warehouseId: true,
          inventoryItemId: true,
          quantityOnHand: true,
          quantityReserved: true,
          totalValue: true,
        },
      }),
      prisma.inventoryBatch.count({
        where: {
          expiryDate: { gte: today, lte: soon },
          balances: { some: { ...whWhere, quantityOnHand: { gt: 0 } } },
        },
      }),
      prisma.inventoryBatch.count({
        where: {
          expiryDate: { lt: today },
          balances: { some: { ...whWhere, quantityOnHand: { gt: 0 } } },
        },
      }),
      prisma.inventoryReceipt.count({
        where: { ...docWhWhere, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      }),
      prisma.inventoryIssue.count({
        where: { ...docWhWhere, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      }),
      prisma.inventoryTransfer.count({
        where: { ...transferWhWhere, status: 'IN_TRANSIT' },
      }),
      prisma.inventoryAdjustment.count({
        where: { ...docWhWhere, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      }),
      prisma.inventoryTransaction.findMany({
        where: docWhWhere,
        take: 8,
        orderBy: { transactionDate: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          postedBy: { select: { id: true, fullName: true, username: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    let totalStockValue = ZERO;
    const distinctItems = new Set<string>();
    const distinctWarehouses = new Set<string>();
    for (const b of balances) {
      totalStockValue = totalStockValue.add(b.totalValue);
      distinctItems.add(b.inventoryItemId);
      distinctWarehouses.add(b.warehouseId);
    }

    return {
      totalStockValue: totalStockValue.toDecimalPlaces(2).toString(),
      activeSkuCount: distinctItems.size,
      activeWarehouseCount: distinctWarehouses.size,
      balanceRowCount: balances.length,
      expiringSoonCount: expiringBatchesCount,
      expiredStockCount: expiredBatchesCount,
      pendingDocuments: {
        receipts: pendingReceipts,
        issues: pendingIssues,
        inTransitTransfers,
        adjustments: pendingAdjustments,
      },
      recentTransactions,
    };
  }

  static async listBalances(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; inventoryItemId?: string; itemType?: string; includeZero?: boolean },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryBalanceWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }

    if (filters.inventoryItemId) {
      where.inventoryItemId = filters.inventoryItemId;
    }
    if (!filters.includeZero) {
      where.quantityOnHand = { gt: 0 };
    }
    if (filters.itemType) {
      where.inventoryItem = { is: { itemType: filters.itemType as Prisma.EnumItemTypeFilter['equals'] } };
    }
    if (params.search) {
      where.OR = [
        { inventoryItem: { code: { contains: params.search, mode: 'insensitive' } } },
        { inventoryItem: { name: { contains: params.search, mode: 'insensitive' } } },
        { warehouse: { code: { contains: params.search, mode: 'insensitive' } } },
        { batch: { batchNumber: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.inventoryBalance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ warehouse: { code: 'asc' } }, { inventoryItem: { code: 'asc' } }, { createdAt: 'asc' }],
        include: {
          warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
          inventoryItem: {
            select: {
              id: true,
              code: true,
              name: true,
              itemType: true,
              valuationMethod: true,
              movingAverageCost: true,
              uom: { select: { id: true, code: true, symbol: true } },
            },
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              manufacturingDate: true,
              expiryDate: true,
              receivedDate: true,
              unitCost: true,
            },
          },
        },
      }),
      prisma.inventoryBalance.count({ where }),
    ]);

    const items = rows.map(row => {
      const available = new Prisma.Decimal(row.quantityOnHand).sub(row.quantityReserved);
      return {
        ...row,
        availableQuantity: available.toDecimalPlaces(4).toString(),
        isExpired: row.batch ? isBatchExpired(row.batch.expiryDate) : false,
      };
    });

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async listBatches(
    params: PaginationParams,
    user: UserContext,
    filters: { inventoryItemId?: string; expiryStatus?: string; warehouseId?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const today = new Date();
    const soon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const where: Prisma.InventoryBatchWhereInput = {};
    if (filters.inventoryItemId) where.inventoryItemId = filters.inventoryItemId;
    if (params.search) {
      where.OR = [
        { batchNumber: { contains: params.search, mode: 'insensitive' } },
        { supplierBatchRef: { contains: params.search, mode: 'insensitive' } },
        { inventoryItem: { code: { contains: params.search, mode: 'insensitive' } } },
        { inventoryItem: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.expiryStatus === 'EXPIRED') {
      where.expiryDate = { lt: today };
    } else if (filters.expiryStatus === 'EXPIRING_SOON') {
      where.expiryDate = { gte: today, lte: soon };
    } else if (filters.expiryStatus === 'VALID') {
      where.OR = [{ expiryDate: null }, { expiryDate: { gt: soon } }];
    }

    const balanceWhere: Prisma.InventoryBalanceWhereInput = {};
    if (filters.warehouseId) {
      balanceWhere.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      balanceWhere.warehouseId = { in: allowedWh };
    }

    const [rows, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
        include: {
          inventoryItem: {
            select: {
              id: true,
              code: true,
              name: true,
              itemType: true,
              uom: { select: { id: true, code: true, symbol: true } },
            },
          },
          balances: {
            where: balanceWhere,
            include: { warehouse: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    const items = rows.map(b => {
      const totalOnHand = b.balances.reduce(
        (acc, bal) => acc.add(bal.quantityOnHand),
        ZERO,
      );
      let expiryState: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY' = 'NO_EXPIRY';
      if (b.expiryDate) {
        if (isBatchExpired(b.expiryDate, today)) expiryState = 'EXPIRED';
        else if (b.expiryDate.getTime() <= soon.getTime()) expiryState = 'EXPIRING_SOON';
        else expiryState = 'VALID';
      }
      return {
        ...b,
        totalOnHand: totalOnHand.toDecimalPlaces(4).toString(),
        expiryState,
      };
    });

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async listValuation(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; itemType?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryItemWhereInput = { isActive: true };
    if (filters.itemType) {
      where.itemType = filters.itemType as Prisma.EnumItemTypeFilter['equals'];
    }
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const balanceWhere: Prisma.InventoryBalanceWhereInput = {};
    if (filters.warehouseId) {
      balanceWhere.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      balanceWhere.warehouseId = { in: allowedWh };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { code: 'asc' },
        include: {
          uom: { select: { id: true, code: true, symbol: true } },
          balances: {
            where: balanceWhere,
            select: {
              warehouseId: true,
              quantityOnHand: true,
              quantityReserved: true,
              unitCost: true,
              totalValue: true,
              warehouse: { select: { code: true, name: true } },
            },
          },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const enriched = items.map(item => {
      let totalQty = ZERO;
      let totalVal = ZERO;
      for (const b of item.balances) {
        totalQty = totalQty.add(b.quantityOnHand);
        totalVal = totalVal.add(b.totalValue);
      }
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        itemType: item.itemType,
        valuationMethod: item.valuationMethod,
        movingAverageCost: item.movingAverageCost,
        uom: item.uom,
        totalQuantityOnHand: totalQty.toDecimalPlaces(4).toString(),
        totalStockValue: totalVal.toDecimalPlaces(4).toString(),
      };
    });

    return paginatedResult(enriched, total, params.page, params.limit);
  }

  static async getValuationHistory(inventoryItemId: string, params: PaginationParams) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { uom: true },
    });
    if (!item) throw new AppError('Inventory item not found.', 404);

    const [lines, total] = await Promise.all([
      prisma.inventoryTransactionLine.findMany({
        where: { inventoryItemId },
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              transactionNumber: true,
              transactionType: true,
              referenceType: true,
              referenceNumber: true,
              transactionDate: true,
              warehouse: { select: { code: true, name: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true } },
        },
      }),
      prisma.inventoryTransactionLine.count({ where: { inventoryItemId } }),
    ]);

    return {
      item,
      history: paginatedResult(lines, total, params.page, params.limit),
    };
  }

  static async listTransactions(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; transactionType?: string; inventoryItemId?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryTransactionWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }
    if (filters.transactionType) {
      where.transactionType = filters.transactionType as InventoryTransactionType;
    }
    if (filters.inventoryItemId) {
      where.lines = { some: { inventoryItemId: filters.inventoryItemId } };
    }
    if (params.search) {
      where.OR = [
        { transactionNumber: { contains: params.search, mode: 'insensitive' } },
        { referenceNumber: { contains: params.search, mode: 'insensitive' } },
        { remarks: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { transactionDate: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          postedBy: { select: { id: true, fullName: true, username: true } },
          reversedTransaction: { select: { id: true, transactionNumber: true } },
          reversalOf: { select: { id: true, transactionNumber: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              inventoryItem: { select: { id: true, code: true, name: true } },
              batch: { select: { id: true, batchNumber: true } },
              uom: { select: { id: true, code: true, symbol: true } },
              baseUom: { select: { id: true, code: true, symbol: true } },
            },
          },
        },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getTransactionById(id: string, user: UserContext) {
    const tx = await prisma.inventoryTransaction.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        postedBy: { select: { id: true, fullName: true, username: true } },
        reversedTransaction: { select: { id: true, transactionNumber: true } },
        reversalOf: { select: { id: true, transactionNumber: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, valuationMethod: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            uom: { select: { id: true, code: true, symbol: true } },
            baseUom: { select: { id: true, code: true, symbol: true } },
          },
        },
      },
    });
    if (!tx) throw new AppError('Inventory transaction not found.', 404);
    await assertWarehouseAccess(user, tx.warehouseId, 'READ');
    return tx;
  }

  /**
   * Reverse a posted immutable inventory transaction by creating a compensating REVERSAL ledger entry.
   * Never mutates the original posted transaction.
   */
  static async reverseTransaction(
    transactionId: string,
    reason: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `REVERSE-${transactionId}`;

    const existingIdempotent = await prisma.inventoryTransaction.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: { lines: true },
    });
    if (existingIdempotent) {
      await assertWarehouseAccess(user, existingIdempotent.warehouseId, 'READ_WRITE');
      return existingIdempotent;
    }

    const reversal = await prisma.$transaction(async tx => {
      const lockedTxRows = await tx.$queryRaw<{ id: string; warehouse_id: string; transaction_type: string }[]>`
        SELECT id, warehouse_id, transaction_type
        FROM inventory_transactions
        WHERE id = ${transactionId}
        FOR UPDATE
      `;
      if (lockedTxRows.length === 0) {
        throw new AppError('Inventory transaction not found.', 404);
      }

      const orig = await tx.inventoryTransaction.findUniqueOrThrow({
        where: { id: transactionId },
        include: {
          lines: { orderBy: { lineNumber: 'asc' } },
          reversalOf: { select: { id: true } },
        },
      });

      await assertWarehouseAccess(user, orig.warehouseId, 'READ_WRITE');

      if (orig.transactionType === 'REVERSAL') {
        throw new AppError('A reversal transaction cannot be reversed.', 400);
      }
      if (orig.reversalOf) {
        throw new AppError('This transaction has already been reversed.', 409);
      }

      const itemIds = orig.lines.map(l => l.inventoryItemId);
      const lockedItems = await lockInventoryItems(tx, itemIds);

      const reversalTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('REV'),
          transactionType: InventoryTransactionType.REVERSAL,
          referenceType: 'REVERSAL',
          referenceId: orig.id,
          referenceNumber: orig.transactionNumber,
          idempotencyKey: effectiveKey,
          warehouseId: orig.warehouseId,
          reversedTransactionId: orig.id,
          postedById: user.userId,
          remarks: `Reversal of ${orig.transactionNumber}: ${reason}`,
        },
      });

      for (const line of orig.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const revQty = new Prisma.Decimal(line.quantity).neg();
        const revBaseQty = new Prisma.Decimal(line.baseQuantity).neg();
        const lineUnitCost = new Prisma.Decimal(line.unitCost);
        const revTotalCost = revBaseQty.mul(lineUnitCost).toDecimalPlaces(4);

        const bal = await lockOrCreateBalance(tx, orig.warehouseId, line.inventoryItemId, line.batchId);
        const currentOnHand = new Prisma.Decimal(bal.quantity_on_hand);
        const currentReserved = new Prisma.Decimal(bal.quantity_reserved);
        const newOnHand = currentOnHand.add(revBaseQty);

        if (newOnHand.lt(ZERO) || newOnHand.lt(currentReserved)) {
          throw new AppError(
            `Cannot reverse transaction ${orig.transactionNumber}: insufficient stock remaining in warehouse for item ${item.code}.`,
            400,
          );
        }

        let mwacAfter: Prisma.Decimal | null = null;
        if (item.valuation_method === 'MWAC') {
          const allBalances = await tx.inventoryBalance.findMany({
            where: { inventoryItemId: item.id },
            select: { quantityOnHand: true },
          });
          const totalItemQtyBefore = allBalances.reduce(
            (acc, b) => acc.add(b.quantityOnHand),
            ZERO,
          );
          const totalItemQtyAfter = totalItemQtyBefore.add(revBaseQty);
          const currentMwac = new Prisma.Decimal(item.moving_average_cost);

          if (totalItemQtyAfter.gt(ZERO)) {
            const currentTotalVal = totalItemQtyBefore.mul(currentMwac);
            const newTotalVal = currentTotalVal.add(revTotalCost);
            mwacAfter = newTotalVal.gt(ZERO)
              ? newTotalVal.div(totalItemQtyAfter).toDecimalPlaces(4)
              : ZERO;
          } else {
            mwacAfter = ZERO;
          }

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { movingAverageCost: mwacAfter },
          });
          item.moving_average_cost = mwacAfter.toString();
        }

        const effectiveUnitCost = mwacAfter ?? lineUnitCost;
        const newBalanceTotalVal = newOnHand.mul(effectiveUnitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            quantityOnHand: newOnHand,
            unitCost: effectiveUnitCost,
            totalValue: newBalanceTotalVal,
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: reversalTx.id,
            lineNumber: line.lineNumber,
            inventoryItemId: line.inventoryItemId,
            batchId: line.batchId,
            uomId: line.uomId,
            quantity: revQty,
            baseUomId: line.baseUomId,
            baseQuantity: revBaseQty,
            unitCost: lineUnitCost,
            totalCost: revTotalCost,
            balanceAfter: newOnHand,
            mwacAfter,
          },
        });
      }

      return tx.inventoryTransaction.findUniqueOrThrow({
        where: { id: reversalTx.id },
        include: { lines: true },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.REVERSE,
      entityType: 'InventoryTransaction',
      entityId: reversal.id,
      previousState: { reversedTransactionId: transactionId },
      newState: { transactionNumber: reversal.transactionNumber, reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Reversed transaction ${transactionId}: ${reason}`,
    });

    return reversal;
  }
}
