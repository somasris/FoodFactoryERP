import { AuditAction, InventoryTransactionType, Prisma, TransferDocumentStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult, PaginationParams, toPlainJson } from '../master-data/master-data.utils';
import { CreateTransferInput } from './inventory.types';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  isBatchExpired,
  lockInventoryItems,
  lockOrCreateBalance,
  UserContext,
  ZERO,
} from './inventory.utils';

export class InventoryTransferService {
  static async list(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; status?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryTransferWhereInput = {};
    if (filters.warehouseId) {
      where.OR = [
        { sourceWarehouseId: filters.warehouseId },
        { destinationWarehouseId: filters.warehouseId },
      ];
    } else if (allowedWh) {
      where.OR = [
        { sourceWarehouseId: { in: allowedWh } },
        { destinationWarehouseId: { in: allowedWh } },
      ];
    }
    if (filters.status) {
      where.status = filters.status as TransferDocumentStatus;
    }
    if (params.search) {
      where.AND = [
        {
          OR: [
            { transferNumber: { contains: params.search, mode: 'insensitive' } },
            { notes: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryTransfer.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              inventoryItem: { select: { id: true, code: true, name: true } },
              uom: { select: { id: true, code: true, symbol: true } },
              batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            },
          },
        },
      }),
      prisma.inventoryTransfer.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getById(id: string, user: UserContext) {
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, valuationMethod: true } },
            uom: { select: { id: true, code: true, symbol: true } },
            batch: true,
          },
        },
      },
    });
    if (!transfer) throw new AppError('Warehouse transfer not found.', 404);

    // User must have READ access to either source or destination warehouse
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (
      allowedWh &&
      !allowedWh.includes(transfer.sourceWarehouseId) &&
      !allowedWh.includes(transfer.destinationWarehouseId)
    ) {
      throw new AppError('Access denied: You are not authorized for either warehouse in this transfer.', 403);
    }

    return transfer;
  }

  static async create(input: CreateTransferInput, user: UserContext, meta: AuditMeta) {
    await assertWarehouseAccess(user, input.sourceWarehouseId, 'READ_WRITE');

    const [srcWh, dstWh] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: input.sourceWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: input.destinationWarehouseId } }),
    ]);
    if (!srcWh || !srcWh.isActive) throw new AppError('Active source warehouse not found.', 404);
    if (!dstWh || !dstWh.isActive) throw new AppError('Active destination warehouse not found.', 404);

    const created = await prisma.$transaction(async tx => {
      const preparedLines: Prisma.InventoryTransferLineCreateWithoutTransferInput[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
        if (!item || !item.isActive) {
          throw new AppError(`Active inventory item not found for line ${i + 1}.`, 404);
        }

        if (line.batchId) {
          const batch = await tx.inventoryBatch.findUnique({ where: { id: line.batchId } });
          if (!batch || batch.inventoryItemId !== item.id) {
            throw new AppError(`Line ${i + 1}: Invalid batch for inventory item.`, 400);
          }
          if (isBatchExpired(batch.expiryDate)) {
            throw new AppError(`Line ${i + 1}: Batch ${batch.batchNumber} is expired.`, 400);
          }
        }

        const qty = new Prisma.Decimal(line.quantity);
        const { converted: baseQty } = await convertQuantityDecimal(tx, qty, line.uomId, item.uomId);

        preparedLines.push({
          lineNumber: i + 1,
          inventoryItem: { connect: { id: item.id } },
          uom: { connect: { id: line.uomId } },
          quantity: qty,
          baseQuantity: baseQty,
          ...(line.batchId ? { batch: { connect: { id: line.batchId } } } : {}),
          notes: line.notes ?? null,
        });
      }

      return tx.inventoryTransfer.create({
        data: {
          transferNumber: generateDocNumber('TRF'),
          sourceWarehouseId: input.sourceWarehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          status: TransferDocumentStatus.DRAFT,
          transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          notes: input.notes ?? null,
          createdById: user.userId,
          lines: { create: preparedLines },
        },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'InventoryTransfer',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async approve(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryTransfer.findUnique({ where: { id } });
    if (!existing) throw new AppError('Warehouse transfer not found.', 404);
    await assertWarehouseAccess(user, existing.sourceWarehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT') {
      throw new AppError(`Only DRAFT transfers can be approved (current status: ${existing.status}).`, 400);
    }

    const updated = await prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: TransferDocumentStatus.APPROVED,
        approvedById: user.userId,
        approvedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.APPROVE,
      entityType: 'InventoryTransfer',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async cancel(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryTransfer.findUnique({ where: { id } });
    if (!existing) throw new AppError('Warehouse transfer not found.', 404);
    await assertWarehouseAccess(user, existing.sourceWarehouseId, 'READ_WRITE');

    if (existing.status === 'IN_TRANSIT' || existing.status === 'RECEIVED' || existing.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel transfer in status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: TransferDocumentStatus.CANCELLED,
        cancelledById: user.userId,
        cancelledAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'InventoryTransfer',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Dispatch transfer: deducts stock from sourceWarehouseId and transitions APPROVED -> IN_TRANSIT.
   */
  static async dispatch(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `DISPATCH-TRF-${id}`;

    const existingByKey = await prisma.inventoryTransfer.findUnique({
      where: { dispatchIdempotencyKey: effectiveKey },
      include: { lines: true, sourceWarehouse: true, destinationWarehouse: true },
    });
    if (existingByKey && (existingByKey.status === 'IN_TRANSIT' || existingByKey.status === 'RECEIVED')) {
      await assertWarehouseAccess(user, existingByKey.sourceWarehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const dispatched = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM inventory_transfers WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Warehouse transfer not found.', 404);

      const transfer = await tx.inventoryTransfer.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, transfer.sourceWarehouseId, 'READ_WRITE');

      if (transfer.status === 'IN_TRANSIT' || transfer.status === 'RECEIVED') {
        if (transfer.dispatchIdempotencyKey === effectiveKey) return transfer;
        throw new AppError('Transfer has already been dispatched.', 409);
      }
      if (transfer.status !== 'APPROVED') {
        throw new AppError(
          `Transfer must be APPROVED before dispatch (current status: ${transfer.status}).`,
          400,
        );
      }

      const lockedItems = await lockInventoryItems(
        tx,
        transfer.lines.map(l => l.inventoryItemId),
      );

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: InventoryTransactionType.TRANSFER_OUT,
          referenceType: 'TRANSFER_DISPATCH',
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          idempotencyKey: effectiveKey,
          warehouseId: transfer.sourceWarehouseId,
          transactionDate: new Date(),
          postedById: user.userId,
          remarks: `Transfer dispatch ${transfer.transferNumber} to destination warehouse`,
        },
      });

      for (const line of transfer.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const baseQty = new Prisma.Decimal(line.baseQuantity);
        const bal = await lockOrCreateBalance(tx, transfer.sourceWarehouseId, item.id, line.batchId);
        const onHand = new Prisma.Decimal(bal.quantity_on_hand);
        const reserved = new Prisma.Decimal(bal.quantity_reserved);
        const available = onHand.sub(reserved);

        if (available.lt(baseQty)) {
          throw new AppError(
            `Insufficient available stock in source warehouse for item ${item.code}. Available: ${available.toString()}, Required: ${baseQty.toString()}.`,
            400,
          );
        }

        const unitCost =
          item.valuation_method === 'MWAC'
            ? new Prisma.Decimal(item.moving_average_cost)
            : new Prisma.Decimal(bal.unit_cost);
        const totalCost = baseQty.mul(unitCost).toDecimalPlaces(4);
        const newOnHand = onHand.sub(baseQty);
        const newTotalVal = newOnHand.mul(unitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            quantityOnHand: newOnHand,
            totalValue: newTotalVal,
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransferLine.update({
          where: { id: line.id },
          data: {
            dispatchedBaseQuantity: baseQty,
            unitCost,
            totalCost,
          },
        });

        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: invTx.id,
            lineNumber: line.lineNumber,
            inventoryItemId: item.id,
            batchId: line.batchId,
            uomId: line.uomId,
            quantity: new Prisma.Decimal(line.quantity).neg(),
            baseUomId: item.uom_id,
            baseQuantity: baseQty.neg(),
            unitCost,
            totalCost: totalCost.neg(),
            balanceAfter: newOnHand,
            mwacAfter:
              item.valuation_method === 'MWAC'
                ? new Prisma.Decimal(item.moving_average_cost)
                : null,
          },
        });
      }

      return tx.inventoryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferDocumentStatus.IN_TRANSIT,
          dispatchedById: user.userId,
          dispatchedAt: new Date(),
          dispatchIdempotencyKey: effectiveKey,
        },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.DISPATCH,
      entityType: 'InventoryTransfer',
      entityId: dispatched.id,
      previousState: { status: 'APPROVED' },
      newState: { status: dispatched.status, transferNumber: dispatched.transferNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return dispatched;
  }

  /**
   * Receive transfer: credits destinationWarehouseId preserving batch identity and quantity reconciliation.
   * Transitions IN_TRANSIT -> RECEIVED.
   */
  static async receive(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `RECEIVE-TRF-${id}`;

    const existingByKey = await prisma.inventoryTransfer.findUnique({
      where: { receiveIdempotencyKey: effectiveKey },
      include: { lines: true, sourceWarehouse: true, destinationWarehouse: true },
    });
    if (existingByKey && existingByKey.status === 'RECEIVED') {
      await assertWarehouseAccess(user, existingByKey.destinationWarehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const received = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM inventory_transfers WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Warehouse transfer not found.', 404);

      const transfer = await tx.inventoryTransfer.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, transfer.destinationWarehouseId, 'READ_WRITE');

      if (transfer.status === 'RECEIVED') {
        if (transfer.receiveIdempotencyKey === effectiveKey) return transfer;
        throw new AppError('Transfer has already been received.', 409);
      }
      if (transfer.status !== 'IN_TRANSIT') {
        throw new AppError(
          `Transfer must be IN_TRANSIT before receiving (current status: ${transfer.status}).`,
          400,
        );
      }

      const lockedItems = await lockInventoryItems(
        tx,
        transfer.lines.map(l => l.inventoryItemId),
      );

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: InventoryTransactionType.TRANSFER_IN,
          referenceType: 'TRANSFER_RECEIVE',
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          idempotencyKey: effectiveKey,
          warehouseId: transfer.destinationWarehouseId,
          transactionDate: new Date(),
          postedById: user.userId,
          remarks: `Transfer receipt ${transfer.transferNumber} from source warehouse`,
        },
      });

      for (const line of transfer.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const dispatchedQty = new Prisma.Decimal(line.dispatchedBaseQuantity);
        if (dispatchedQty.lte(ZERO)) {
          throw new AppError(`Line ${line.lineNumber}: Dispatched quantity reconciliation failed.`, 400);
        }

        const unitCost = new Prisma.Decimal(line.unitCost);
        const totalCost = new Prisma.Decimal(line.totalCost);

        const bal = await lockOrCreateBalance(tx, transfer.destinationWarehouseId, item.id, line.batchId);
        const newOnHand = new Prisma.Decimal(bal.quantity_on_hand).add(dispatchedQty);
        const newTotalVal = newOnHand.mul(unitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            quantityOnHand: newOnHand,
            unitCost,
            totalValue: newTotalVal,
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransferLine.update({
          where: { id: line.id },
          data: {
            receivedBaseQuantity: dispatchedQty,
          },
        });

        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: invTx.id,
            lineNumber: line.lineNumber,
            inventoryItemId: item.id,
            batchId: line.batchId,
            uomId: line.uomId,
            quantity: line.quantity,
            baseUomId: item.uom_id,
            baseQuantity: dispatchedQty,
            unitCost,
            totalCost,
            balanceAfter: newOnHand,
            mwacAfter:
              item.valuation_method === 'MWAC'
                ? new Prisma.Decimal(item.moving_average_cost)
                : null,
          },
        });
      }

      return tx.inventoryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferDocumentStatus.RECEIVED,
          receivedById: user.userId,
          receivedAt: new Date(),
          receiveIdempotencyKey: effectiveKey,
        },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.RECEIVE,
      entityType: 'InventoryTransfer',
      entityId: received.id,
      previousState: { status: 'IN_TRANSIT' },
      newState: { status: received.status, transferNumber: received.transferNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return received;
  }
}
