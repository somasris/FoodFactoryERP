import crypto from 'crypto';
import {
  AuditAction,
  InventoryDocumentStatus,
  InventoryTransactionType,
  PickingStrategy,
  Prisma,
  ProductionBatchStatus,
  ProductionExecutionEntryType,
  QualityStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import {
  AuditMeta,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data/master-data.utils';
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
} from '../inventory/inventory.utils';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';
import { getIndianFinancialYear } from '../sales/sales-invoice.service';
import {
  CompleteBatchInput,
  ConsumeMaterialsInput,
  CreateBatchInput,
  RecordOutputInput,
} from './production-batch.types';

const HUNDRED = new Prisma.Decimal(100);

const BATCH_INCLUDE = {
  workOrder: {
    select: {
      id: true,
      workOrderNumber: true,
      status: true,
      plannedQuantity: true,
      allocatedBatchQuantity: true,
      actualGoodQuantity: true,
      actualScrapQuantity: true,
    },
  },
  product: { select: { id: true, code: true, name: true } },
  productVariant: { select: { id: true, sku: true, name: true } },
  bom: { select: { id: true, code: true, name: true } },
  bomVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      expectedGoodOutput: true,
      yieldPercentage: true,
      expectedWastagePercent: true,
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  uom: { select: { id: true, code: true, symbol: true } },
  operator: { select: { id: true, fullName: true, username: true } },
  finishedGoodsBatch: {
    select: {
      id: true,
      batchNumber: true,
      manufacturingDate: true,
      expiryDate: true,
      unitCost: true,
      qualityStatus: true,
    },
  },
  qualityInspection: {
    select: {
      id: true,
      inspectionNumber: true,
      decision: true,
      goodQuantity: true,
      rejectedQuantity: true,
      inspectedAt: true,
      releasedAt: true,
    },
  },
};

interface LockedCandidateBalance {
  id: string;
  batch_id: string | null;
  quantity_on_hand: string;
  quantity_reserved: string;
  unit_cost: string;
  expiry_date: Date | null;
  received_date: Date | null;
  batch_unit_cost: string | null;
  created_at: Date;
}

async function generateBatchNumberInTx(
  tx: Prisma.TransactionClient,
  refDate: Date,
): Promise<{ batchNumber: string; financialYear: string }> {
  const prefixCfg = await tx.systemConfig.findUnique({ where: { key: 'PRODUCTION_BATCH_PREFIX' } });
  const prefix = (prefixCfg?.value || 'PB').trim().toUpperCase().slice(0, 15) || 'PB';
  const financialYear = getIndianFinancialYear(refDate);
  const newId = crypto.randomUUID();

  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO production_batch_number_sequences (id, prefix, financial_year, last_number, updated_at)
    VALUES (${newId}, ${prefix}, ${financialYear}, 1, NOW())
    ON CONFLICT (prefix, financial_year)
    DO UPDATE SET last_number = production_batch_number_sequences.last_number + 1, updated_at = NOW()
    RETURNING last_number
  `;

  const seq = rows[0].last_number;
  return {
    batchNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

/**
 * Yield (%) = (Good Quantity / (Good + Rejected + Wastage)) * 100 when total output > 0.
 * Completion (%) = min(100, (Good Quantity / Planned Batch Quantity) * 100).
 */
function calculateYieldAndCompletion(
  plannedQty: Prisma.Decimal,
  goodQty: Prisma.Decimal,
  rejectedQty: Prisma.Decimal,
  wastageQty: Prisma.Decimal,
) {
  const totalOutput = goodQty.add(rejectedQty).add(wastageQty);
  const actualYieldPercent = totalOutput.gt(ZERO)
    ? goodQty.div(totalOutput).mul(HUNDRED).toDecimalPlaces(2)
    : ZERO;
  const completionPercent = plannedQty.gt(ZERO)
    ? Prisma.Decimal.min(HUNDRED, goodQty.div(plannedQty).mul(HUNDRED).toDecimalPlaces(2))
    : ZERO;
  return { actualYieldPercent, completionPercent, totalOutput };
}

export class ProductionBatchService {
  static async getDashboardSummary(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const where: Prisma.ProductionBatchWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};

    const [
      totalBatches,
      createdCount,
      inProgressCount,
      pausedCount,
      completedCount,
      cancelledCount,
      releasedWorkOrdersCount,
      recentBatches,
    ] = await Promise.all([
      prisma.productionBatch.count({ where }),
      prisma.productionBatch.count({ where: { ...where, status: 'CREATED' } }),
      prisma.productionBatch.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.productionBatch.count({ where: { ...where, status: 'PAUSED' } }),
      prisma.productionBatch.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.productionBatch.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.workOrder.count({
        where: {
          ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
          status: { in: ['RELEASED', 'IN_PROGRESS'] },
        },
      }),
      prisma.productionBatch.findMany({
        where,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: BATCH_INCLUDE,
      }),
    ]);

    return {
      totalBatches,
      createdCount,
      inProgressCount,
      pausedCount,
      completedCount,
      cancelledCount,
      releasedWorkOrdersCount,
      recentBatches,
    };
  }

  static async listBatches(
    params: PaginationParams,
    user: UserContext,
    filters: { status?: string; workOrderId?: string; warehouseId?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.ProductionBatchWhereInput = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.status) where.status = filters.status as ProductionBatchStatus;
    if (filters.workOrderId) where.workOrderId = filters.workOrderId;

    if (params.search) {
      where.OR = [
        { batchNumber: { contains: params.search, mode: 'insensitive' } },
        { workOrder: { workOrderNumber: { contains: params.search, mode: 'insensitive' } } },
        { productVariant: { sku: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: BATCH_INCLUDE,
      }),
      prisma.productionBatch.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getBatchById(id: string, user: UserContext) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        ...BATCH_INCLUDE,
        consumptions: {
          orderBy: { consumedAt: 'desc' },
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, itemType: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            uom: { select: { id: true, code: true, symbol: true } },
            consumedBy: { select: { id: true, fullName: true, username: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
        executionEntries: {
          orderBy: { createdAt: 'desc' },
          include: { recordedBy: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);
    await assertWarehouseAccess(user, batch.warehouseId, 'READ');

    const expectedMaterials = await this.getExpectedMaterialsForBatch(batch.id);
    return { ...batch, expectedMaterials };
  }

  static async getExpectedMaterialsForBatch(batchId: string) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        bomVersion: {
          include: {
            items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
          },
        },
        consumptions: true,
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);

    const plannedQty = new Prisma.Decimal(batch.plannedQuantity);
    const expectedGoodOut = new Prisma.Decimal(batch.bomVersion.expectedGoodOutput);
    const yieldPct = new Prisma.Decimal(batch.bomVersion.yieldPercentage);
    const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

    const consumedMap = new Map<string, Prisma.Decimal>();
    for (const c of batch.consumptions) {
      const prev = consumedMap.get(c.inventoryItemId) || ZERO;
      consumedMap.set(c.inventoryItemId, prev.add(c.baseQuantity));
    }

    const lines = [];
    for (const item of batch.bomVersion.items) {
      const scaledQty = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor);
      const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
      const effectiveQty = scaledQty.mul(HUNDRED.add(scrapPct)).div(HUNDRED).toDecimalPlaces(4);

      const { converted: expectedBaseQty } = await convertQuantityDecimal(
        prisma,
        effectiveQty,
        item.uomId,
        item.inventoryItem.uomId,
      );

      const consumedBaseQty = (consumedMap.get(item.inventoryItemId) || ZERO).toDecimalPlaces(4);
      const remainingToConsume = Prisma.Decimal.max(ZERO, expectedBaseQty.sub(consumedBaseQty));

      lines.push({
        bomItemId: item.id,
        inventoryItemId: item.inventoryItemId,
        itemCode: item.inventoryItem.code,
        itemName: item.inventoryItem.name,
        itemType: item.itemType,
        uomId: item.inventoryItem.uomId,
        uomCode: item.inventoryItem.uom.code,
        uomSymbol: item.inventoryItem.uom.symbol,
        expectedQuantity: expectedBaseQty.toFixed(4),
        consumedQuantity: consumedBaseQty.toFixed(4),
        remainingQuantity: remainingToConsume.toFixed(4),
      });
    }

    return lines;
  }

  static async createBatch(input: CreateBatchInput, user: UserContext, meta: AuditMeta) {
    if (input.idempotencyKey) {
      const existing = await prisma.productionBatch.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: BATCH_INCLUDE,
      });
      if (existing) {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return existing;
      }
    }

    const mfgDate = input.manufacturingDate ? new Date(input.manufacturingDate) : null;
    const expDate = input.expiryDate ? new Date(input.expiryDate) : null;
    if (mfgDate && expDate && expDate <= mfgDate) {
      throw new AppError('expiryDate must be after manufacturingDate.', 400);
    }

    const created = await prisma.$transaction(async tx => {
      const lockedWo = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM work_orders WHERE id = ${input.workOrderId} FOR UPDATE
      `;
      if (lockedWo.length === 0) throw new AppError('Work order not found.', 404);

      const wo = await tx.workOrder.findUniqueOrThrow({
        where: { id: input.workOrderId },
        include: { productVariant: { select: { productId: true } } },
      });

      await assertWarehouseAccess(user, wo.warehouseId, 'READ_WRITE');

      if (wo.status !== 'RELEASED' && wo.status !== 'IN_PROGRESS') {
        throw new AppError(
          `Production batches can only be created from RELEASED or IN_PROGRESS work orders (current status: ${wo.status}).`,
          400,
        );
      }

      const remaining = new Prisma.Decimal(wo.plannedQuantity).sub(wo.allocatedBatchQuantity);
      if (remaining.lte(ZERO)) {
        throw new AppError('No remaining unallocated quantity on this work order.', 400);
      }

      const batchQty = input.plannedQuantity
        ? new Prisma.Decimal(input.plannedQuantity).toDecimalPlaces(4)
        : remaining;

      if (batchQty.gt(remaining)) {
        throw new AppError(
          `Batch planned quantity (${batchQty.toFixed(4)}) exceeds remaining work order quantity (${remaining.toFixed(4)}).`,
          400,
        );
      }

      const { batchNumber, financialYear } = await generateBatchNumberInTx(tx, new Date());

      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          allocatedBatchQuantity: new Prisma.Decimal(wo.allocatedBatchQuantity).add(batchQty),
        },
      });

      const batch = await tx.productionBatch.create({
        data: {
          batchNumber,
          financialYear,
          workOrderId: wo.id,
          productId: wo.productVariant.productId,
          productVariantId: wo.productVariantId,
          inventoryItemId: wo.inventoryItemId,
          bomId: wo.bomId,
          bomVersionId: wo.bomVersionId,
          warehouseId: wo.warehouseId,
          uomId: wo.uomId,
          plannedQuantity: batchQty,
          status: ProductionBatchStatus.CREATED,
          operatorId: input.operatorId || user.userId,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: ProductionBatchStatus.CREATED,
              changedById: user.userId,
              reason: 'Production batch created from work order',
            },
          },
          executionEntries: {
            create: {
              entryType: ProductionExecutionEntryType.STATUS_CHANGE,
              notes: `Batch ${batchNumber} created for ${batchQty.toFixed(4)}`,
              recordedById: user.userId,
            },
          },
        },
        include: BATCH_INCLUDE,
      });

      return batch;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'ProductionBatch',
      entityId: created.id,
      newState: toPlainJson({
        batchNumber: created.batchNumber,
        workOrderId: created.workOrderId,
        plannedQuantity: created.plannedQuantity,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async startBatch(id: string, user: UserContext, meta: AuditMeta) {
    const result = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({ where: { id } });
      await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

      if (batch.status !== 'CREATED') {
        throw new AppError(`Cannot start batch from status ${batch.status}.`, 400);
      }

      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: batch.workOrderId } });
      if (wo.status === 'RELEASED') {
        await tx.workOrder.update({
          where: { id: wo.id },
          data: { status: WorkOrderStatus.IN_PROGRESS },
        });
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: wo.id,
            fromStatus: WorkOrderStatus.RELEASED,
            toStatus: WorkOrderStatus.IN_PROGRESS,
            changedById: user.userId,
            reason: `Started batch ${batch.batchNumber}`,
          },
        });
      }

      const updated = await tx.productionBatch.update({
        where: { id },
        data: {
          status: ProductionBatchStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
        include: BATCH_INCLUDE,
      });

      await tx.productionBatchStatusHistory.create({
        data: {
          productionBatchId: id,
          fromStatus: batch.status,
          toStatus: ProductionBatchStatus.IN_PROGRESS,
          changedById: user.userId,
          reason: 'Batch execution started',
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.STATUS_CHANGE,
          notes: 'Batch execution started',
          recordedById: user.userId,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionBatch',
      entityId: id,
      previousState: { status: 'CREATED' },
      newState: { status: 'IN_PROGRESS' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Started production batch execution',
    });

    return result;
  }

  static async pauseBatch(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    const result = await prisma.$transaction(async tx => {
      const batch = await tx.productionBatch.findUnique({ where: { id } });
      if (!batch) throw new AppError('Production batch not found.', 404);
      await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

      if (batch.status !== 'IN_PROGRESS') {
        throw new AppError(`Cannot pause batch from status ${batch.status}.`, 400);
      }

      const updated = await tx.productionBatch.update({
        where: { id },
        data: {
          status: ProductionBatchStatus.PAUSED,
          pausedAt: new Date(),
        },
        include: BATCH_INCLUDE,
      });

      await tx.productionBatchStatusHistory.create({
        data: {
          productionBatchId: id,
          fromStatus: ProductionBatchStatus.IN_PROGRESS,
          toStatus: ProductionBatchStatus.PAUSED,
          changedById: user.userId,
          reason,
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.STATUS_CHANGE,
          reason,
          notes: 'Batch execution paused',
          recordedById: user.userId,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionBatch',
      entityId: id,
      previousState: { status: 'IN_PROGRESS' },
      newState: { status: 'PAUSED' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return result;
  }

  static async resumeBatch(id: string, user: UserContext, meta: AuditMeta) {
    const result = await prisma.$transaction(async tx => {
      const batch = await tx.productionBatch.findUnique({ where: { id } });
      if (!batch) throw new AppError('Production batch not found.', 404);
      await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

      if (batch.status !== 'PAUSED') {
        throw new AppError(`Cannot resume batch from status ${batch.status}.`, 400);
      }

      const updated = await tx.productionBatch.update({
        where: { id },
        data: { status: ProductionBatchStatus.IN_PROGRESS },
        include: BATCH_INCLUDE,
      });

      await tx.productionBatchStatusHistory.create({
        data: {
          productionBatchId: id,
          fromStatus: ProductionBatchStatus.PAUSED,
          toStatus: ProductionBatchStatus.IN_PROGRESS,
          changedById: user.userId,
          reason: 'Batch execution resumed',
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.STATUS_CHANGE,
          notes: 'Batch execution resumed',
          recordedById: user.userId,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionBatch',
      entityId: id,
      previousState: { status: 'PAUSED' },
      newState: { status: 'IN_PROGRESS' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Resumed production batch execution',
    });

    return result;
  }

  static async reserveMaterials(
    id: string,
    warehouseId: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const result = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({
        where: { id },
        include: {
          bomVersion: {
            include: { items: { include: { inventoryItem: true } } },
          },
        },
      });

      const targetWhId = warehouseId || batch.warehouseId;
      await assertWarehouseAccess(user, targetWhId, 'READ_WRITE');

      if (!['CREATED', 'IN_PROGRESS', 'PAUSED'].includes(batch.status)) {
        throw new AppError(`Cannot reserve materials for batch in status ${batch.status}.`, 400);
      }
      if (batch.materialsReserved) {
        return tx.productionBatch.findUniqueOrThrow({ where: { id }, include: BATCH_INCLUDE });
      }

      const plannedQty = new Prisma.Decimal(batch.plannedQuantity);
      const expectedGoodOut = new Prisma.Decimal(batch.bomVersion.expectedGoodOutput);
      const yieldPct = new Prisma.Decimal(batch.bomVersion.yieldPercentage);
      const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

      const reserveItems = [];
      for (const item of batch.bomVersion.items) {
        const scaledQty = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor);
        const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
        const effQty = scaledQty.mul(HUNDRED.add(scrapPct)).div(HUNDRED).toDecimalPlaces(4);
        const { converted: baseQty } = await convertQuantityDecimal(
          tx,
          effQty,
          item.uomId,
          item.inventoryItem.uomId,
        );
        if (baseQty.gt(ZERO)) {
          reserveItems.push({ inventoryItemId: item.inventoryItemId, baseQuantity: baseQty });
        }
      }

      await InventoryReservationService.reserveStockInTx(tx, targetWhId, reserveItems);

      const updated = await tx.productionBatch.update({
        where: { id },
        data: { materialsReserved: true },
        include: BATCH_INCLUDE,
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.MATERIAL_RESERVATION,
          notes: `Reserved BOM materials in warehouse`,
          recordedById: user.userId,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.RESERVE,
      entityType: 'ProductionBatch',
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Reserved materials for production batch',
    });

    return result;
  }

  static async consumeMaterials(
    id: string,
    input: ConsumeMaterialsInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = input.idempotencyKey || `PB-CONS-${id}-${crypto.randomUUID()}`;

    if (input.idempotencyKey) {
      const existingTx = await prisma.inventoryTransaction.findUnique({
        where: { idempotencyKey: effectiveKey },
      });
      if (existingTx) {
        return this.getBatchById(id, user);
      }
    }

    await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({
        where: { id },
        include: { bomVersion: { include: { items: true } } },
      });

      if (batch.status !== 'IN_PROGRESS' && batch.status !== 'PAUSED') {
        throw new AppError(
          `Material consumption can only be recorded for IN_PROGRESS or PAUSED batches (current status: ${batch.status}).`,
          400,
        );
      }

      const bomItemMap = new Map(batch.bomVersion.items.map(bi => [bi.inventoryItemId, bi]));
      const plannedQty = new Prisma.Decimal(batch.plannedQuantity);
      const expectedGoodOut = new Prisma.Decimal(batch.bomVersion.expectedGoodOutput);
      const yieldPct = new Prisma.Decimal(batch.bomVersion.yieldPercentage);
      const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

      const lockedItems = await lockInventoryItems(
        tx,
        input.lines.map(l => l.inventoryItemId),
      );

      // Group lines by warehouseId so each warehouse gets a clean InventoryIssue + InventoryTransaction
      const byWarehouse = new Map<string, typeof input.lines>();
      for (const line of input.lines) {
        await assertWarehouseAccess(user, line.warehouseId, 'READ_WRITE');
        if (!bomItemMap.has(line.inventoryItemId)) {
          throw new AppError(
            `Material ${line.inventoryItemId} is not part of locked BOM version.`,
            400,
          );
        }
        const arr = byWarehouse.get(line.warehouseId) || [];
        arr.push(line);
        byWarehouse.set(line.warehouseId, arr);
      }

      const now = new Date();

      for (const [warehouseId, whLines] of byWarehouse.entries()) {
        const issueNumber = generateDocNumber('ISS');
        const txKey = byWarehouse.size === 1 ? effectiveKey : `${effectiveKey}-${warehouseId}`;

        const invIssue = await tx.inventoryIssue.create({
          data: {
            issueNumber,
            warehouseId,
            issueDate: now,
            status: InventoryDocumentStatus.POSTED,
            pickingStrategy: PickingStrategy.FEFO,
            departmentRef: batch.batchNumber,
            purpose: `Production consumption for ${batch.batchNumber}`,
            idempotencyKey: txKey,
            createdById: user.userId,
            submittedById: user.userId,
            submittedAt: now,
            approvedById: user.userId,
            approvedAt: now,
            postedById: user.userId,
            postedAt: now,
          },
        });

        const invTx = await tx.inventoryTransaction.create({
          data: {
            transactionNumber: generateDocNumber('TXN'),
            transactionType: InventoryTransactionType.ISSUE,
            referenceType: 'PRODUCTION_BATCH',
            referenceId: batch.id,
            referenceNumber: batch.batchNumber,
            idempotencyKey: txKey,
            warehouseId,
            transactionDate: now,
            postedById: user.userId,
            remarks: `Production material consumption for ${batch.batchNumber}`,
          },
        });

        let issueLineNo = 0;
        let txLineNo = 0;

        for (const line of whLines) {
          const item = lockedItems.get(line.inventoryItemId);
          if (!item) throw new AppError('Inventory item not found.', 404);

          if (line.batchId) {
            const b = await tx.inventoryBatch.findUnique({ where: { id: line.batchId } });
            if (!b || b.inventoryItemId !== item.id) {
              throw new AppError('Invalid inventory batch for selected material.', 400);
            }
            if (b.qualityStatus !== QualityStatus.ACCEPTED) {
              throw new AppError(
                `Batch ${b.batchNumber} has quality status ${b.qualityStatus} and cannot be consumed.`,
                400,
              );
            }
            if (isBatchExpired(b.expiryDate, now)) {
              throw new AppError(`Batch ${b.batchNumber} is expired and cannot be consumed.`, 400);
            }
          }

          const reqQty = new Prisma.Decimal(line.quantity).toDecimalPlaces(4);
          const { converted: neededBaseQty } = await convertQuantityDecimal(
            tx,
            reqQty,
            line.uomId,
            item.uom_id,
          );

          const candidates = line.batchId
            ? await tx.$queryRaw<LockedCandidateBalance[]>`
                SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
                       ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
                FROM inventory_balances b
                LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
                WHERE b.warehouse_id = ${warehouseId}
                  AND b.inventory_item_id = ${item.id}
                  AND b.batch_id = ${line.batchId}
                  AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
                FOR UPDATE OF b
              `
            : await tx.$queryRaw<LockedCandidateBalance[]>`
                SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
                       ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
                FROM inventory_balances b
                LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
                WHERE b.warehouse_id = ${warehouseId}
                  AND b.inventory_item_id = ${item.id}
                  AND b.quantity_on_hand > 0
                  AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
                FOR UPDATE OF b
              `;

          const validCandidates = candidates.filter(c => !isBatchExpired(c.expiry_date, now));
          validCandidates.sort((a, b) => {
            const expA = a.expiry_date ? a.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
            const expB = b.expiry_date ? b.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
            if (expA !== expB) return expA - expB;
            const recA = a.received_date ? a.received_date.getTime() : a.created_at.getTime();
            const recB = b.received_date ? b.received_date.getTime() : b.created_at.getTime();
            return recA - recB;
          });

          let remainingToPick = neededBaseQty;
          let totalLineCost = ZERO;
          const bomItem = bomItemMap.get(item.id)!;
          const plannedItemQty = new Prisma.Decimal(bomItem.standardQuantity)
            .mul(scaleFactor)
            .mul(HUNDRED.add(bomItem.scrapTolerancePercent))
            .div(HUNDRED)
            .toDecimalPlaces(4);

          for (const cand of validCandidates) {
            if (remainingToPick.lte(ZERO)) break;
            const onHand = new Prisma.Decimal(cand.quantity_on_hand);
            const reserved = new Prisma.Decimal(cand.quantity_reserved);
            // If batch reserved materials, it may consume from reserved + unreserved; otherwise only unreserved
            const eligible = batch.materialsReserved
              ? onHand
              : Prisma.Decimal.max(ZERO, onHand.sub(reserved));
            if (eligible.lte(ZERO)) continue;

            const pickQty = eligible.gte(remainingToPick) ? remainingToPick : eligible;
            const newOnHand = onHand.sub(pickQty);
            const releaseFromRes = batch.materialsReserved
              ? Prisma.Decimal.min(reserved, pickQty)
              : ZERO;
            const newReserved = reserved.sub(releaseFromRes);

            const outwardUnitCost =
              item.valuation_method === 'MWAC'
                ? new Prisma.Decimal(item.moving_average_cost)
                : new Prisma.Decimal(cand.unit_cost || cand.batch_unit_cost || '0');
            const pickCost = pickQty.mul(outwardUnitCost).toDecimalPlaces(4);
            totalLineCost = totalLineCost.add(pickCost);
            const newTotalVal = newOnHand.mul(outwardUnitCost).toDecimalPlaces(4);

            await tx.inventoryBalance.update({
              where: { id: cand.id },
              data: {
                quantityOnHand: newOnHand,
                quantityReserved: newReserved,
                totalValue: newTotalVal,
                lastTransactionAt: now,
              },
            });

            txLineNo += 1;
            await tx.inventoryTransactionLine.create({
              data: {
                transactionId: invTx.id,
                lineNumber: txLineNo,
                inventoryItemId: item.id,
                batchId: cand.batch_id,
                uomId: line.uomId,
                quantity: pickQty.neg(),
                baseUomId: item.uom_id,
                baseQuantity: pickQty.neg(),
                unitCost: outwardUnitCost,
                totalCost: pickCost.neg(),
                balanceAfter: newOnHand,
                mwacAfter:
                  item.valuation_method === 'MWAC'
                    ? new Prisma.Decimal(item.moving_average_cost)
                    : null,
              },
            });

            await tx.productionBatchConsumption.create({
              data: {
                productionBatchId: batch.id,
                inventoryItemId: item.id,
                warehouseId,
                batchId: cand.batch_id,
                uomId: line.uomId,
                plannedQuantity: plannedItemQty,
                consumedQuantity: pickQty,
                baseQuantity: pickQty,
                unitCost: outwardUnitCost,
                totalCost: pickCost,
                inventoryIssueId: invIssue.id,
                inventoryTransactionId: invTx.id,
                idempotencyKey:
                  validCandidates.length === 1 && whLines.length === 1 && byWarehouse.size === 1
                    ? effectiveKey
                    : null,
                consumedById: user.userId,
                notes: line.notes ?? null,
              },
            });

            remainingToPick = remainingToPick.sub(pickQty);
          }

          if (remainingToPick.gt(ZERO)) {
            throw new AppError(
              `Insufficient available non-expired stock for ${item.code} (${item.name}). Short by ${remainingToPick.toFixed(4)}.`,
              400,
            );
          }

          issueLineNo += 1;
          const avgCost = neededBaseQty.gt(ZERO)
            ? totalLineCost.div(neededBaseQty).toDecimalPlaces(4)
            : ZERO;
          await tx.inventoryIssueLine.create({
            data: {
              issueId: invIssue.id,
              lineNumber: issueLineNo,
              inventoryItemId: item.id,
              batchId: line.batchId ?? null,
              uomId: line.uomId,
              requestedQuantity: reqQty,
              baseQuantity: neededBaseQty,
              unitCost: avgCost,
              totalCost: totalLineCost,
            },
          });

          await tx.productionExecutionEntry.create({
            data: {
              productionBatchId: batch.id,
              entryType: ProductionExecutionEntryType.MATERIAL_CONSUMPTION,
              notes: `Consumed ${neededBaseQty.toFixed(4)} base units of ${item.code}`,
              recordedById: user.userId,
            },
          });
        }
      }
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.ISSUE,
      entityType: 'ProductionBatch',
      entityId: id,
      newState: { linesCount: input.lines.length, idempotencyKey: effectiveKey },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Recorded raw material consumption for production batch',
    });

    return this.getBatchById(id, user);
  }

  static async recordOutput(
    id: string,
    input: RecordOutputInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({ where: { id } });
      await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

      if (batch.status !== 'IN_PROGRESS' && batch.status !== 'PAUSED') {
        throw new AppError(
          `Output can only be recorded for IN_PROGRESS or PAUSED batches (current status: ${batch.status}).`,
          400,
        );
      }

      const goodQty = new Prisma.Decimal(input.goodQuantity).toDecimalPlaces(4);
      const rejectedQty = new Prisma.Decimal(input.rejectedQuantity ?? '0').toDecimalPlaces(4);
      const wastageQty = new Prisma.Decimal(input.wastageQuantity ?? '0').toDecimalPlaces(4);
      const plannedQty = new Prisma.Decimal(batch.plannedQuantity);

      const { actualYieldPercent, completionPercent, totalOutput } = calculateYieldAndCompletion(
        plannedQty,
        goodQty,
        rejectedQty,
        wastageQty,
      );

      if (totalOutput.gt(plannedQty)) {
        throw new AppError(
          `Total output (${totalOutput.toFixed(4)}) cannot exceed batch planned quantity (${plannedQty.toFixed(4)}).`,
          400,
        );
      }

      if (rejectedQty.add(wastageQty).gt(ZERO) && (!input.wastageReason || input.wastageReason.trim().length < 3)) {
        throw new AppError('Reason is required when recording rejected or wastage quantities.', 400);
      }

      const res = await tx.productionBatch.update({
        where: { id },
        data: {
          actualGoodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          wastageQuantity: wastageQty,
          actualYieldPercent,
          completionPercent,
          ...(input.wastageReason !== undefined ? { wastageReason: input.wastageReason } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: BATCH_INCLUDE,
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.OUTPUT_UPDATE,
          goodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          wastageQuantity: wastageQty,
          reason: input.wastageReason ?? null,
          notes: input.notes ?? null,
          recordedById: user.userId,
        },
      });

      return res;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionBatch',
      entityId: id,
      newState: toPlainJson({
        actualGoodQuantity: updated.actualGoodQuantity,
        rejectedQuantity: updated.rejectedQuantity,
        wastageQuantity: updated.wastageQuantity,
        actualYieldPercent: updated.actualYieldPercent,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Recorded production output & wastage',
    });

    return updated;
  }

  static async completeBatch(
    id: string,
    input: CompleteBatchInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = input.idempotencyKey || `PB-COMP-${id}`;

    if (input.idempotencyKey) {
      const existing = await prisma.productionBatch.findUnique({
        where: { completionIdempotencyKey: effectiveKey },
      });
      if (existing && existing.status === 'COMPLETED') {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return this.getBatchById(existing.id, user);
      }
    }

    await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({
        where: { id },
        include: { consumptions: true },
      });

      const targetWhId = input.targetWarehouseId || batch.warehouseId;
      await assertWarehouseAccess(user, targetWhId, 'READ_WRITE');

      if (batch.status === 'COMPLETED') {
        if (batch.completionIdempotencyKey === effectiveKey) {
          return;
        }
        throw new AppError('Production batch is already completed.', 409);
      }
      if (batch.status !== 'IN_PROGRESS' && batch.status !== 'PAUSED') {
        throw new AppError(
          `Batch must be IN_PROGRESS or PAUSED to complete (current status: ${batch.status}).`,
          400,
        );
      }
      if (batch.finishedGoodsTransactionId) {
        throw new AppError('Finished goods have already been received for this batch.', 409);
      }

      const goodQty = input.goodQuantity
        ? new Prisma.Decimal(input.goodQuantity).toDecimalPlaces(4)
        : new Prisma.Decimal(batch.actualGoodQuantity);
      const rejectedQty = input.rejectedQuantity !== undefined
        ? new Prisma.Decimal(input.rejectedQuantity).toDecimalPlaces(4)
        : new Prisma.Decimal(batch.rejectedQuantity);
      const wastageQty = input.wastageQuantity !== undefined
        ? new Prisma.Decimal(input.wastageQuantity).toDecimalPlaces(4)
        : new Prisma.Decimal(batch.wastageQuantity);
      const plannedQty = new Prisma.Decimal(batch.plannedQuantity);

      if (goodQty.lte(ZERO)) {
        throw new AppError('Actual good quantity must be greater than zero to complete a batch.', 400);
      }

      const { actualYieldPercent, completionPercent, totalOutput } = calculateYieldAndCompletion(
        plannedQty,
        goodQty,
        rejectedQty,
        wastageQty,
      );
      if (totalOutput.gt(plannedQty)) {
        throw new AppError(
          `Total output (${totalOutput.toFixed(4)}) cannot exceed batch planned quantity (${plannedQty.toFixed(4)}).`,
          400,
        );
      }

      const mfgDate = input.manufacturingDate
        ? new Date(input.manufacturingDate)
        : batch.manufacturingDate || new Date();
      const variant = await tx.productVariant.findUnique({
        where: { id: batch.productVariantId },
        select: { shelfLifeDays: true },
      });
      let expDate = input.expiryDate ? new Date(input.expiryDate) : batch.expiryDate;
      if (!expDate && variant?.shelfLifeDays && variant.shelfLifeDays > 0) {
        expDate = new Date(mfgDate.getTime() + variant.shelfLifeDays * 24 * 60 * 60 * 1000);
      }
      if (expDate && expDate <= mfgDate) {
        throw new AppError('expiryDate must be after manufacturingDate.', 400);
      }

      const lockedItems = await lockInventoryItems(tx, [batch.inventoryItemId]);
      const fgItem = lockedItems.get(batch.inventoryItemId);
      if (!fgItem) throw new AppError('Finished goods inventory item not found.', 404);

      const { converted: baseGoodQty } = await convertQuantityDecimal(
        tx,
        goodQty,
        batch.uomId,
        fgItem.uom_id,
      );

      const totalConsumedCost = batch.consumptions.reduce(
        (acc, c) => acc.add(c.totalCost),
        ZERO,
      );
      const unitCostInBase =
        totalConsumedCost.gt(ZERO) && baseGoodQty.gt(ZERO)
          ? totalConsumedCost.div(baseGoodQty).toDecimalPlaces(4)
          : new Prisma.Decimal(fgItem.moving_average_cost || '0');
      const totalReceiptCost = baseGoodQty.mul(unitCostInBase).toDecimalPlaces(4);

      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: batch.workOrderId } });
      const now = new Date();

      const fgBatch = await tx.inventoryBatch.upsert({
        where: {
          inventoryItemId_batchNumber: {
            inventoryItemId: fgItem.id,
            batchNumber: batch.batchNumber,
          },
        },
        update: {
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          unitCost: unitCostInBase,
          qualityStatus: QualityStatus.PENDING_INSPECTION,
        },
        create: {
          inventoryItemId: fgItem.id,
          batchNumber: batch.batchNumber,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          receivedDate: now,
          unitCost: unitCostInBase,
          qualityStatus: QualityStatus.PENDING_INSPECTION,
          supplierBatchRef: wo.workOrderNumber,
          notes: `Produced from Work Order ${wo.workOrderNumber}`,
        },
      });

      const qiNumber = generateDocNumber('QI');
      await tx.qualityInspection.create({
        data: {
          inspectionNumber: qiNumber,
          productionBatchId: batch.id,
          inventoryBatchId: fgBatch.id,
          warehouseId: targetWhId,
          inspectedQuantity: goodQty,
          goodQuantity: ZERO,
          rejectedQuantity: ZERO,
          decision: 'PENDING',
        },
      });

      const receiptNumber = generateDocNumber('RCP');
      const receipt = await tx.inventoryReceipt.create({
        data: {
          receiptNumber,
          warehouseId: targetWhId,
          receiptDate: now,
          status: InventoryDocumentStatus.POSTED,
          supplierRef: batch.batchNumber,
          notes: `Finished goods receipt from production batch ${batch.batchNumber}`,
          idempotencyKey: `PB-FG-${effectiveKey}`,
          createdById: user.userId,
          submittedById: user.userId,
          submittedAt: now,
          approvedById: user.userId,
          approvedAt: now,
          postedById: user.userId,
          postedAt: now,
          lines: {
            create: {
              lineNumber: 1,
              inventoryItemId: fgItem.id,
              batchId: fgBatch.id,
              batchNumber: fgBatch.batchNumber,
              manufacturingDate: mfgDate,
              expiryDate: expDate,
              uomId: batch.uomId,
              quantity: goodQty,
              baseQuantity: baseGoodQty,
              unitCost: unitCostInBase,
              totalCost: totalReceiptCost,
            },
          },
        },
      });

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: InventoryTransactionType.RECEIPT,
          referenceType: 'PRODUCTION_BATCH',
          referenceId: batch.id,
          referenceNumber: batch.batchNumber,
          idempotencyKey: `PB-FG-${effectiveKey}`,
          warehouseId: targetWhId,
          transactionDate: now,
          postedById: user.userId,
          remarks: `Finished goods receipt for batch ${batch.batchNumber}`,
        },
      });

      let mwacAfter: Prisma.Decimal | null = null;
      let effectiveUnitCost = unitCostInBase;
      if (fgItem.valuation_method === 'MWAC') {
        const allBalances = await tx.inventoryBalance.findMany({
          where: { inventoryItemId: fgItem.id },
          select: { quantityOnHand: true },
        });
        const existingTotalQty = allBalances.reduce(
          (acc, b) => acc.add(b.quantityOnHand),
          ZERO,
        );
        const currentMwac = new Prisma.Decimal(fgItem.moving_average_cost);
        const existingVal = existingTotalQty.mul(currentMwac);
        const newTotalQty = existingTotalQty.add(baseGoodQty);
        const newMwac = newTotalQty.gt(ZERO)
          ? existingVal.add(totalReceiptCost).div(newTotalQty).toDecimalPlaces(4)
          : unitCostInBase;

        await tx.inventoryItem.update({
          where: { id: fgItem.id },
          data: { movingAverageCost: newMwac },
        });
        mwacAfter = newMwac;
        effectiveUnitCost = newMwac;
      }

      const bal = await lockOrCreateBalance(tx, targetWhId, fgItem.id, fgBatch.id);
      const newOnHand = new Prisma.Decimal(bal.quantity_on_hand).add(baseGoodQty);
      const newTotalVal = newOnHand.mul(effectiveUnitCost).toDecimalPlaces(4);

      await tx.inventoryBalance.update({
        where: { id: bal.id },
        data: {
          quantityOnHand: newOnHand,
          unitCost: effectiveUnitCost,
          totalValue: newTotalVal,
          lastTransactionAt: now,
        },
      });

      await tx.inventoryTransactionLine.create({
        data: {
          transactionId: invTx.id,
          lineNumber: 1,
          inventoryItemId: fgItem.id,
          batchId: fgBatch.id,
          uomId: batch.uomId,
          quantity: goodQty,
          baseUomId: fgItem.uom_id,
          baseQuantity: baseGoodQty,
          unitCost: unitCostInBase,
          totalCost: totalReceiptCost,
          balanceAfter: newOnHand,
          mwacAfter,
        },
      });

      await tx.productionBatch.update({
        where: { id },
        data: {
          status: ProductionBatchStatus.COMPLETED,
          actualGoodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          wastageQuantity: wastageQty,
          actualYieldPercent,
          completionPercent,
          ...(input.wastageReason !== undefined ? { wastageReason: input.wastageReason } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          completedAt: now,
          finishedGoodsBatchId: fgBatch.id,
          finishedGoodsReceiptId: receipt.id,
          finishedGoodsTransactionId: invTx.id,
          completionIdempotencyKey: effectiveKey,
        },
      });

      await tx.productionBatchStatusHistory.create({
        data: {
          productionBatchId: id,
          fromStatus: batch.status,
          toStatus: ProductionBatchStatus.COMPLETED,
          changedById: user.userId,
          reason: `Completed with ${goodQty.toFixed(4)} good units (yield ${actualYieldPercent.toFixed(2)}%)`,
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.STATUS_CHANGE,
          goodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          wastageQuantity: wastageQty,
          notes: `Completed batch; received into FG batch ${fgBatch.batchNumber}`,
          recordedById: user.userId,
        },
      });

      // Update WorkOrder completion quantities & auto-complete if fully batched and all open batches closed
      const newWoGood = new Prisma.Decimal(wo.actualGoodQuantity).add(goodQty);
      const newWoScrap = new Prisma.Decimal(wo.actualScrapQuantity).add(rejectedQty).add(wastageQty);
      const openBatchesCount = await tx.productionBatch.count({
        where: {
          workOrderId: wo.id,
          status: { in: ['CREATED', 'IN_PROGRESS', 'PAUSED'] },
        },
      });
      const fullyAllocated = new Prisma.Decimal(wo.allocatedBatchQuantity).gte(wo.plannedQuantity);
      const shouldCompleteWo = fullyAllocated && openBatchesCount === 0;

      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          actualGoodQuantity: newWoGood,
          actualScrapQuantity: newWoScrap,
          ...(shouldCompleteWo ? { status: WorkOrderStatus.COMPLETED } : {}),
        },
      });

      if (shouldCompleteWo && wo.status !== WorkOrderStatus.COMPLETED) {
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: wo.id,
            fromStatus: wo.status,
            toStatus: WorkOrderStatus.COMPLETED,
            changedById: user.userId,
            reason: `All work order batches completed (final batch: ${batch.batchNumber})`,
          },
        });
      }
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.RECEIVE,
      entityType: 'ProductionBatch',
      entityId: id,
      newState: { status: 'COMPLETED', idempotencyKey: effectiveKey },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Completed production batch and received finished goods',
    });

    return this.getBatchById(id, user);
  }

  static async cancelBatch(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    const result = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({ where: { id } });
      await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

      if (!['CREATED', 'IN_PROGRESS', 'PAUSED'].includes(batch.status)) {
        throw new AppError(`Cannot cancel batch in status ${batch.status}.`, 400);
      }

      await tx.$queryRaw`
        SELECT id FROM work_orders WHERE id = ${batch.workOrderId} FOR UPDATE
      `;
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: batch.workOrderId } });
      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          allocatedBatchQuantity: Prisma.Decimal.max(
            ZERO,
            new Prisma.Decimal(wo.allocatedBatchQuantity).sub(batch.plannedQuantity),
          ),
        },
      });

      const updated = await tx.productionBatch.update({
        where: { id },
        data: {
          status: ProductionBatchStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: BATCH_INCLUDE,
      });

      await tx.productionBatchStatusHistory.create({
        data: {
          productionBatchId: id,
          fromStatus: batch.status,
          toStatus: ProductionBatchStatus.CANCELLED,
          changedById: user.userId,
          reason,
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: id,
          entryType: ProductionExecutionEntryType.STATUS_CHANGE,
          reason,
          notes: 'Production batch cancelled',
          recordedById: user.userId,
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'ProductionBatch',
      entityId: id,
      newState: { status: 'CANCELLED', reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return result;
  }
}
