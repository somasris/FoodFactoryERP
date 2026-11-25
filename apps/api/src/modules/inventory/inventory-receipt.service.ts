import { AuditAction, InventoryDocumentStatus, InventoryTransactionType, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult, PaginationParams, toPlainJson } from '../master-data/master-data.utils';
import { CreateReceiptInput } from './inventory.types';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  lockInventoryItems,
  lockOrCreateBalance,
  UserContext,
  ZERO,
} from './inventory.utils';

export class InventoryReceiptService {
  static async list(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; status?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryReceiptWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }
    if (filters.status) {
      where.status = filters.status as InventoryDocumentStatus;
    }
    if (params.search) {
      where.OR = [
        { receiptNumber: { contains: params.search, mode: 'insensitive' } },
        { supplierRef: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryReceipt.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              inventoryItem: { select: { id: true, code: true, name: true, itemType: true } },
              uom: { select: { id: true, code: true, symbol: true } },
            },
          },
        },
      }),
      prisma.inventoryReceipt.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getById(id: string, user: UserContext) {
    const receipt = await prisma.inventoryReceipt.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            inventoryItem: {
              select: { id: true, code: true, name: true, itemType: true, valuationMethod: true, uomId: true },
            },
            uom: { select: { id: true, code: true, symbol: true } },
            batch: true,
          },
        },
      },
    });
    if (!receipt) throw new AppError('Inventory receipt not found.', 404);
    await assertWarehouseAccess(user, receipt.warehouseId, 'READ');
    return receipt;
  }

  static async create(input: CreateReceiptInput, user: UserContext, meta: AuditMeta) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || !warehouse.isActive) {
      throw new AppError('Active warehouse not found.', 404);
    }

    const created = await prisma.$transaction(async tx => {
      const preparedLines: Prisma.InventoryReceiptLineCreateWithoutReceiptInput[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
        if (!item || !item.isActive) {
          throw new AppError(`Active inventory item not found for line ${i + 1}.`, 404);
        }

        if (line.manufacturingDate && line.expiryDate) {
          if (new Date(line.expiryDate) <= new Date(line.manufacturingDate)) {
            throw new AppError(`Line ${i + 1}: expiryDate must be after manufacturingDate.`, 400);
          }
        }

        const qty = new Prisma.Decimal(line.quantity);
        const unitCost = new Prisma.Decimal(line.unitCost);
        const { converted: baseQty } = await convertQuantityDecimal(tx, qty, line.uomId, item.uomId);
        const totalCost = qty.mul(unitCost).toDecimalPlaces(4);

        preparedLines.push({
          lineNumber: i + 1,
          inventoryItem: { connect: { id: item.id } },
          uom: { connect: { id: line.uomId } },
          quantity: qty,
          baseQuantity: baseQty,
          unitCost,
          totalCost,
          batchNumber: line.batchNumber ?? null,
          manufacturingDate: line.manufacturingDate ? new Date(line.manufacturingDate) : null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          notes: line.notes ?? null,
        });
      }

      return tx.inventoryReceipt.create({
        data: {
          receiptNumber: generateDocNumber('RCP'),
          warehouseId: input.warehouseId,
          status: InventoryDocumentStatus.DRAFT,
          receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
          supplierRef: input.supplierRef ?? null,
          notes: input.notes ?? null,
          createdById: user.userId,
          lines: { create: preparedLines },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'InventoryReceipt',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async submit(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryReceipt.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory receipt not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT') {
      throw new AppError(`Only DRAFT receipts can be submitted (current status: ${existing.status}).`, 400);
    }

    const updated = await prisma.inventoryReceipt.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.SUBMITTED,
        submittedById: user.userId,
        submittedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'InventoryReceipt',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Submitted inventory receipt for approval',
    });

    return updated;
  }

  static async approve(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryReceipt.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory receipt not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED' && existing.status !== 'DRAFT') {
      throw new AppError(`Receipt cannot be approved from status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryReceipt.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.APPROVED,
        approvedById: user.userId,
        approvedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.APPROVE,
      entityType: 'InventoryReceipt',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async cancel(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryReceipt.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory receipt not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status === 'POSTED' || existing.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel receipt in status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryReceipt.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.CANCELLED,
        cancelledById: user.userId,
        cancelledAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'InventoryReceipt',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async post(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `POST-RCP-${id}`;

    // Idempotency fast-path
    const existingByKey = await prisma.inventoryReceipt.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: { lines: true, warehouse: true },
    });
    if (existingByKey && existingByKey.status === 'POSTED') {
      await assertWarehouseAccess(user, existingByKey.warehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const posted = await prisma.$transaction(async tx => {
      const lockedDoc = await tx.$queryRaw<{ id: string; status: string; warehouse_id: string }[]>`
        SELECT id, status, warehouse_id FROM inventory_receipts WHERE id = ${id} FOR UPDATE
      `;
      if (lockedDoc.length === 0) {
        throw new AppError('Inventory receipt not found.', 404);
      }

      const receipt = await tx.inventoryReceipt.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, receipt.warehouseId, 'READ_WRITE');

      if (receipt.status === 'POSTED') {
        if (receipt.idempotencyKey === effectiveKey) {
          return receipt;
        }
        throw new AppError('Inventory receipt has already been posted.', 409);
      }
      if (receipt.status !== 'APPROVED') {
        throw new AppError(
          `Receipt must be APPROVED before posting (current status: ${receipt.status}).`,
          400,
        );
      }

      const itemIds = receipt.lines.map(l => l.inventoryItemId);
      const lockedItems = await lockInventoryItems(tx, itemIds);

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: InventoryTransactionType.RECEIPT,
          referenceType: 'RECEIPT',
          referenceId: receipt.id,
          referenceNumber: receipt.receiptNumber,
          idempotencyKey: effectiveKey,
          warehouseId: receipt.warehouseId,
          transactionDate: receipt.receiptDate,
          postedById: user.userId,
          remarks: receipt.notes || `Posted receipt ${receipt.receiptNumber}`,
        },
      });

      for (const line of receipt.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const baseQty = new Prisma.Decimal(line.baseQuantity);
        const lineTotalCost = new Prisma.Decimal(line.totalCost);
        const unitCostInBase = baseQty.gt(ZERO)
          ? lineTotalCost.div(baseQty).toDecimalPlaces(4)
          : ZERO;

        let batchId: string | null = line.batchId;
        if (!batchId && (line.batchNumber || line.expiryDate || line.manufacturingDate)) {
          const batchNum = line.batchNumber || `${receipt.receiptNumber}-L${line.lineNumber}`;
          const batch = await tx.inventoryBatch.upsert({
            where: {
              inventoryItemId_batchNumber: {
                inventoryItemId: item.id,
                batchNumber: batchNum,
              },
            },
            update: {
              ...(line.manufacturingDate ? { manufacturingDate: line.manufacturingDate } : {}),
              ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
            },
            create: {
              inventoryItemId: item.id,
              batchNumber: batchNum,
              manufacturingDate: line.manufacturingDate,
              expiryDate: line.expiryDate,
              receivedDate: receipt.receiptDate,
              unitCost: unitCostInBase,
              supplierBatchRef: receipt.supplierRef,
            },
          });
          batchId = batch.id;
          await tx.inventoryReceiptLine.update({
            where: { id: line.id },
            data: { batchId: batch.id, batchNumber: batchNum },
          });
        }

        // Compute existing total stock for MWAC before updating balance
        let mwacAfter: Prisma.Decimal | null = null;
        let effectiveUnitCost = unitCostInBase;

        if (item.valuation_method === 'MWAC') {
          const allItemBalances = await tx.inventoryBalance.findMany({
            where: { inventoryItemId: item.id },
            select: { quantityOnHand: true },
          });
          const existingTotalQty = allItemBalances.reduce(
            (acc, b) => acc.add(b.quantityOnHand),
            ZERO,
          );
          const currentMwac = new Prisma.Decimal(item.moving_average_cost);
          const existingValue = existingTotalQty.mul(currentMwac);
          const newTotalQty = existingTotalQty.add(baseQty);
          const newMwac = newTotalQty.gt(ZERO)
            ? existingValue.add(lineTotalCost).div(newTotalQty).toDecimalPlaces(4)
            : unitCostInBase;

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { movingAverageCost: newMwac },
          });
          item.moving_average_cost = newMwac.toString();
          mwacAfter = newMwac;
          effectiveUnitCost = newMwac;
        }

        const bal = await lockOrCreateBalance(tx, receipt.warehouseId, item.id, batchId);
        const newOnHand = new Prisma.Decimal(bal.quantity_on_hand).add(baseQty);
        const newTotalValue = newOnHand.mul(effectiveUnitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            quantityOnHand: newOnHand,
            unitCost: effectiveUnitCost,
            totalValue: newTotalValue,
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: invTx.id,
            lineNumber: line.lineNumber,
            inventoryItemId: item.id,
            batchId,
            uomId: line.uomId,
            quantity: line.quantity,
            baseUomId: item.uom_id,
            baseQuantity: baseQty,
            unitCost: unitCostInBase,
            totalCost: lineTotalCost,
            balanceAfter: newOnHand,
            mwacAfter,
          },
        });
      }

      return tx.inventoryReceipt.update({
        where: { id: receipt.id },
        data: {
          status: InventoryDocumentStatus.POSTED,
          postedById: user.userId,
          postedAt: new Date(),
          idempotencyKey: effectiveKey,
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.POST,
      entityType: 'InventoryReceipt',
      entityId: posted.id,
      previousState: { status: 'APPROVED' },
      newState: { status: posted.status, receiptNumber: posted.receiptNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return posted;
  }
}
