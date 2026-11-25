import { AdjustmentReason, AuditAction, InventoryDocumentStatus, InventoryTransactionType, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult, PaginationParams, toPlainJson } from '../master-data/master-data.utils';
import { CreateAdjustmentInput } from './inventory.types';
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

export class InventoryAdjustmentService {
  static async list(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; status?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryAdjustmentWhereInput = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.status) where.status = filters.status as InventoryDocumentStatus;
    if (params.search) {
      where.OR = [
        { adjustmentNumber: { contains: params.search, mode: 'insensitive' } },
        { notes: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryAdjustment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              inventoryItem: { select: { id: true, code: true, name: true } },
              uom: { select: { id: true, code: true, symbol: true } },
              batch: { select: { id: true, batchNumber: true } },
            },
          },
        },
      }),
      prisma.inventoryAdjustment.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getById(id: string, user: UserContext) {
    const adj = await prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
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
    if (!adj) throw new AppError('Inventory adjustment not found.', 404);
    await assertWarehouseAccess(user, adj.warehouseId, 'READ');
    return adj;
  }

  static async create(input: CreateAdjustmentInput, user: UserContext, meta: AuditMeta) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || !warehouse.isActive) throw new AppError('Active warehouse not found.', 404);

    const created = await prisma.$transaction(async tx => {
      const preparedLines: Prisma.InventoryAdjustmentLineCreateWithoutAdjustmentInput[] = [];

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
        }

        const delta = new Prisma.Decimal(line.quantityDelta);
        const absDelta = delta.abs();
        const { converted: absBase } = await convertQuantityDecimal(tx, absDelta, line.uomId, item.uomId);
        const baseDelta = delta.isNegative() ? absBase.neg() : absBase;

        const unitCost = line.unitCost ? new Prisma.Decimal(line.unitCost) : item.movingAverageCost;
        const totalCost = baseDelta.mul(unitCost).toDecimalPlaces(4);

        preparedLines.push({
          lineNumber: i + 1,
          inventoryItem: { connect: { id: item.id } },
          uom: { connect: { id: line.uomId } },
          quantityDelta: delta,
          baseQuantityDelta: baseDelta,
          unitCost,
          totalCost,
          ...(line.batchId ? { batch: { connect: { id: line.batchId } } } : {}),
          reasonNote: line.reasonNote ?? null,
        });
      }

      return tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber: generateDocNumber('ADJ'),
          warehouseId: input.warehouseId,
          status: InventoryDocumentStatus.DRAFT,
          adjustmentDate: input.adjustmentDate ? new Date(input.adjustmentDate) : new Date(),
          reason: input.reason as AdjustmentReason,
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
      entityType: 'InventoryAdjustment',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async submit(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryAdjustment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory adjustment not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status !== 'DRAFT') {
      throw new AppError(`Only DRAFT adjustments can be submitted (current status: ${existing.status}).`, 400);
    }

    const updated = await prisma.inventoryAdjustment.update({
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
      entityType: 'InventoryAdjustment',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Submitted inventory adjustment for approval',
    });

    return updated;
  }

  static async approve(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryAdjustment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory adjustment not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status !== 'SUBMITTED' && existing.status !== 'DRAFT') {
      throw new AppError(`Adjustment cannot be approved from status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryAdjustment.update({
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
      entityType: 'InventoryAdjustment',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async cancel(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryAdjustment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory adjustment not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status === 'POSTED' || existing.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel adjustment in status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryAdjustment.update({
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
      entityType: 'InventoryAdjustment',
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
    const effectiveKey = idempotencyKey || `POST-ADJ-${id}`;

    const existingByKey = await prisma.inventoryAdjustment.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: { lines: true, warehouse: true },
    });
    if (existingByKey && existingByKey.status === 'POSTED') {
      await assertWarehouseAccess(user, existingByKey.warehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const posted = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM inventory_adjustments WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Inventory adjustment not found.', 404);

      const adj = await tx.inventoryAdjustment.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, adj.warehouseId, 'READ_WRITE');

      if (adj.status === 'POSTED') {
        if (adj.idempotencyKey === effectiveKey) return adj;
        throw new AppError('Inventory adjustment has already been posted.', 409);
      }
      if (adj.status !== 'APPROVED') {
        throw new AppError(
          `Adjustment must be APPROVED before posting (current status: ${adj.status}).`,
          400,
        );
      }

      const lockedItems = await lockInventoryItems(
        tx,
        adj.lines.map(l => l.inventoryItemId),
      );

      const netDelta = adj.lines.reduce(
        (acc, l) => acc.add(l.baseQuantityDelta),
        ZERO,
      );

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: netDelta.gte(ZERO)
            ? InventoryTransactionType.ADJUSTMENT_IN
            : InventoryTransactionType.ADJUSTMENT_OUT,
          referenceType: 'ADJUSTMENT',
          referenceId: adj.id,
          referenceNumber: adj.adjustmentNumber,
          idempotencyKey: effectiveKey,
          warehouseId: adj.warehouseId,
          transactionDate: adj.adjustmentDate,
          postedById: user.userId,
          remarks: `Adjustment (${adj.reason}): ${adj.notes || adj.adjustmentNumber}`,
        },
      });

      for (const line of adj.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const baseDelta = new Prisma.Decimal(line.baseQuantityDelta);
        const bal = await lockOrCreateBalance(tx, adj.warehouseId, item.id, line.batchId);
        const onHand = new Prisma.Decimal(bal.quantity_on_hand);
        const reserved = new Prisma.Decimal(bal.quantity_reserved);
        const newOnHand = onHand.add(baseDelta);

        if (newOnHand.lt(ZERO) || newOnHand.lt(reserved)) {
          throw new AppError(
            `Adjustment would result in negative available stock for item ${item.code}. Current on-hand: ${onHand.toString()}, reserved: ${reserved.toString()}, delta: ${baseDelta.toString()}.`,
            400,
          );
        }

        let effectiveUnitCost =
          item.valuation_method === 'MWAC'
            ? new Prisma.Decimal(item.moving_average_cost)
            : new Prisma.Decimal(line.unitCost || bal.unit_cost);
        let mwacAfter: Prisma.Decimal | null =
          item.valuation_method === 'MWAC' ? new Prisma.Decimal(item.moving_average_cost) : null;

        // If positive MWAC adjustment with explicit cost > 0, recalculate MWAC
        if (item.valuation_method === 'MWAC' && baseDelta.gt(ZERO) && new Prisma.Decimal(line.unitCost).gt(ZERO)) {
          const allItemBalances = await tx.inventoryBalance.findMany({
            where: { inventoryItemId: item.id },
            select: { quantityOnHand: true },
          });
          const existingTotalQty = allItemBalances.reduce((acc, b) => acc.add(b.quantityOnHand), ZERO);
          const currentMwac = new Prisma.Decimal(item.moving_average_cost);
          const incomingVal = baseDelta.mul(line.unitCost);
          const newTotalQty = existingTotalQty.add(baseDelta);
          const newMwac = newTotalQty.gt(ZERO)
            ? existingTotalQty.mul(currentMwac).add(incomingVal).div(newTotalQty).toDecimalPlaces(4)
            : new Prisma.Decimal(line.unitCost);

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { movingAverageCost: newMwac },
          });
          item.moving_average_cost = newMwac.toString();
          mwacAfter = newMwac;
          effectiveUnitCost = newMwac;
        }

        const lineTotalCost = baseDelta.mul(effectiveUnitCost).toDecimalPlaces(4);
        const newTotalVal = newOnHand.mul(effectiveUnitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            quantityOnHand: newOnHand,
            unitCost: effectiveUnitCost,
            totalValue: newTotalVal,
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: invTx.id,
            lineNumber: line.lineNumber,
            inventoryItemId: item.id,
            batchId: line.batchId,
            uomId: line.uomId,
            quantity: line.quantityDelta,
            baseUomId: item.uom_id,
            baseQuantity: baseDelta,
            unitCost: effectiveUnitCost,
            totalCost: lineTotalCost,
            balanceAfter: newOnHand,
            mwacAfter,
          },
        });
      }

      return tx.inventoryAdjustment.update({
        where: { id: adj.id },
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
      entityType: 'InventoryAdjustment',
      entityId: posted.id,
      previousState: { status: 'APPROVED' },
      newState: { status: posted.status, adjustmentNumber: posted.adjustmentNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationEventsService.onInventoryAdjustmentPosted({
      id: posted.id,
      adjustmentNumber: posted.adjustmentNumber,
      warehouseId: posted.warehouseId,
      itemIds: posted.lines.map(l => l.inventoryItemId),
    });

    return posted;
  }
}
