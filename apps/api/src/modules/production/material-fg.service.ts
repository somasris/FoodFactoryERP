import crypto from 'crypto';
import {
  AuditAction,
  InspectionDecision,
  InventoryDocumentStatus,
  InventoryTransactionType,
  Prisma,
  ProductionExecutionEntryType,
  QualityStatus,
  VarianceApprovalStatus,
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
import { ProductionCostingService } from './production-costing.service';
import {
  InspectQualityInput,
  ReturnMaterialsInput,
  VarianceApprovalInput,
} from './material-fg.types';

const HUNDRED = new Prisma.Decimal(100);
const DEFAULT_VARIANCE_THRESHOLD = new Prisma.Decimal('5.00');

async function getVarianceThreshold(): Promise<Prisma.Decimal> {
  const cfg = await prisma.systemConfig.findUnique({
    where: { key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT' },
  });
  if (!cfg || !cfg.value) return DEFAULT_VARIANCE_THRESHOLD;
  const parsed = Number(cfg.value);
  return Number.isFinite(parsed) && parsed >= 0
    ? new Prisma.Decimal(parsed).toDecimalPlaces(2)
    : DEFAULT_VARIANCE_THRESHOLD;
}

export class MaterialFgService {
  /**
   * Planned vs Actual material reconciliation for a ProductionBatch.
   * Avoids double-counting wastage by separating BOM standard qty from BOM scrap tolerance.
   * Formula:
   * - bomStandardQuantity = item.standardQuantity * (batch.plannedQuantity / bomVersion.expectedGoodOutput) * (100 / bomVersion.yieldPercentage)
   * - expectedWastage = bomStandardQuantity * (item.scrapTolerancePercent / 100)
   * - expectedTotalQuantity = bomStandardQuantity + expectedWastage
   * - netConsumedQuantity = actualConsumedQuantity - returnedQuantity
   * - quantityVariance = netConsumedQuantity - expectedTotalQuantity
   * - variancePercent = expectedTotalQuantity > 0 ? (quantityVariance / expectedTotalQuantity) * 100 : 0
   */
  static async getBatchReconciliation(batchId: string, user: UserContext) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        workOrder: { select: { id: true, workOrderNumber: true } },
        productVariant: { select: { id: true, sku: true, name: true } },
        uom: { select: { id: true, code: true, symbol: true } },
        bomVersion: {
          include: {
            items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
          },
        },
        consumptions: {
          include: {
            batch: { select: { id: true, batchNumber: true } },
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
        returns: {
          include: {
            batch: { select: { id: true, batchNumber: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            returnedBy: { select: { id: true, fullName: true, username: true } },
          },
          orderBy: { returnedAt: 'desc' },
        },
        varianceApprovals: {
          include: {
            approvedBy: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);
    await assertWarehouseAccess(user, batch.warehouseId, 'READ');

    const threshold = await getVarianceThreshold();
    const plannedQty = new Prisma.Decimal(batch.plannedQuantity);
    const expectedGoodOut = new Prisma.Decimal(batch.bomVersion.expectedGoodOutput);
    const yieldPct = new Prisma.Decimal(batch.bomVersion.yieldPercentage);
    const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

    const consumedMap = new Map<string, Prisma.Decimal>();
    for (const c of batch.consumptions) {
      consumedMap.set(
        c.inventoryItemId,
        (consumedMap.get(c.inventoryItemId) || ZERO).add(c.baseQuantity),
      );
    }

    const returnedMap = new Map<string, Prisma.Decimal>();
    for (const r of batch.returns) {
      returnedMap.set(
        r.inventoryItemId,
        (returnedMap.get(r.inventoryItemId) || ZERO).add(r.baseQuantity),
      );
    }

    const approvalMap = new Map(batch.varianceApprovals.map(a => [a.inventoryItemId, a]));

    const lines = [];
    for (const item of batch.bomVersion.items) {
      const scaledStd = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor).toDecimalPlaces(4);
      const { converted: bomStandardBase } = await convertQuantityDecimal(
        prisma,
        scaledStd,
        item.uomId,
        item.inventoryItem.uomId,
      );

      const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
      const expectedWastage = bomStandardBase.mul(scrapPct).div(HUNDRED).toDecimalPlaces(4);
      const expectedTotal = bomStandardBase.add(expectedWastage).toDecimalPlaces(4);

      const actualConsumed = (consumedMap.get(item.inventoryItemId) || ZERO).toDecimalPlaces(4);
      const returned = (returnedMap.get(item.inventoryItemId) || ZERO).toDecimalPlaces(4);
      const netConsumed = actualConsumed.sub(returned).toDecimalPlaces(4);
      const quantityVariance = netConsumed.sub(expectedTotal).toDecimalPlaces(4);
      const variancePercent = expectedTotal.gt(ZERO)
        ? quantityVariance.div(expectedTotal).mul(HUNDRED).toDecimalPlaces(2)
        : ZERO;

      const exceedsThreshold = variancePercent.gt(threshold);
      const approval = approvalMap.get(item.inventoryItemId) || null;

      lines.push({
        inventoryItemId: item.inventoryItemId,
        itemCode: item.inventoryItem.code,
        itemName: item.inventoryItem.name,
        uomId: item.inventoryItem.uomId,
        uomSymbol: item.inventoryItem.uom.symbol,
        bomStandardQuantity: bomStandardBase.toFixed(4),
        expectedWastage: expectedWastage.toFixed(4),
        expectedTotalQuantity: expectedTotal.toFixed(4),
        actualConsumedQuantity: actualConsumed.toFixed(4),
        returnedQuantity: returned.toFixed(4),
        netConsumedQuantity: netConsumed.toFixed(4),
        quantityVariance: quantityVariance.toFixed(4),
        variancePercent: variancePercent.toFixed(2),
        thresholdPercent: threshold.toFixed(2),
        exceedsThreshold,
        approval,
      });
    }

    const expectedOutputWastage = plannedQty
      .mul(batch.bomVersion.expectedWastagePercent)
      .div(HUNDRED)
      .toDecimalPlaces(4);
    const actualOutputWastage = new Prisma.Decimal(batch.rejectedQuantity)
      .add(batch.wastageQuantity)
      .toDecimalPlaces(4);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      workOrder: batch.workOrder,
      productVariant: batch.productVariant,
      uom: batch.uom,
      plannedQuantity: plannedQty.toFixed(4),
      actualGoodQuantity: new Prisma.Decimal(batch.actualGoodQuantity).toFixed(4),
      expectedOutputWastage: expectedOutputWastage.toFixed(4),
      actualOutputWastage: actualOutputWastage.toFixed(4),
      thresholdPercent: threshold.toFixed(2),
      lines,
      returns: batch.returns,
    };
  }

  static async getReconciliationDashboard(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const batches = await prisma.productionBatch.findMany({
      where: {
        ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
        status: { in: ['IN_PROGRESS', 'PAUSED', 'COMPLETED'] },
      },
      take: 25,
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    const recs = [];
    for (const b of batches) {
      recs.push(await this.getBatchReconciliation(b.id, user));
    }
    return recs;
  }

  static async returnMaterials(
    batchId: string,
    input: ReturnMaterialsInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = input.idempotencyKey || `PB-RET-${batchId}-${crypto.randomUUID()}`;

    if (input.idempotencyKey) {
      const existingTx = await prisma.inventoryTransaction.findUnique({
        where: { idempotencyKey: effectiveKey },
      });
      if (existingTx) {
        return this.getBatchReconciliation(batchId, user);
      }
    }

    await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_batches WHERE id = ${batchId} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production batch not found.', 404);

      const batch = await tx.productionBatch.findUniqueOrThrow({
        where: { id: batchId },
        include: { consumptions: true, returns: true },
      });

      if (!['CREATED', 'IN_PROGRESS', 'PAUSED'].includes(batch.status)) {
        throw new AppError(
          `Material returns are only allowed for CREATED, IN_PROGRESS, or PAUSED batches (current status: ${batch.status}).`,
          400,
        );
      }

      const lockedItems = await lockInventoryItems(
        tx,
        input.lines.map(l => l.inventoryItemId),
      );

      const byWarehouse = new Map<string, typeof input.lines>();
      for (const line of input.lines) {
        await assertWarehouseAccess(user, line.warehouseId, 'READ_WRITE');
        const arr = byWarehouse.get(line.warehouseId) || [];
        arr.push(line);
        byWarehouse.set(line.warehouseId, arr);
      }

      const now = new Date();

      for (const [warehouseId, whLines] of byWarehouse.entries()) {
        const txKey = byWarehouse.size === 1 ? effectiveKey : `${effectiveKey}-${warehouseId}`;
        const receiptNumber = generateDocNumber('RCP');

        const receipt = await tx.inventoryReceipt.create({
          data: {
            receiptNumber,
            warehouseId,
            receiptDate: now,
            status: InventoryDocumentStatus.POSTED,
            supplierRef: batch.batchNumber,
            notes: `Material return from production batch ${batch.batchNumber}`,
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
            transactionType: InventoryTransactionType.RECEIPT,
            referenceType: 'PRODUCTION_RETURN',
            referenceId: batch.id,
            referenceNumber: batch.batchNumber,
            idempotencyKey: txKey,
            warehouseId,
            transactionDate: now,
            postedById: user.userId,
            remarks: `Production material return from batch ${batch.batchNumber}`,
          },
        });

        let lineNo = 0;

        for (const line of whLines) {
          const item = lockedItems.get(line.inventoryItemId);
          if (!item) throw new AppError('Inventory item not found.', 404);

          if (line.batchId) {
            const rmBatch = await tx.inventoryBatch.findUnique({ where: { id: line.batchId } });
            if (!rmBatch || rmBatch.inventoryItemId !== item.id) {
              throw new AppError('Invalid material batch for return.', 400);
            }
            if (isBatchExpired(rmBatch.expiryDate, now)) {
              throw new AppError(
                `Material batch ${rmBatch.batchNumber} is expired and cannot be returned to active stock.`,
                400,
              );
            }
          }

          const reqQty = new Prisma.Decimal(line.quantity).toDecimalPlaces(4);
          const { converted: baseReturnQty } = await convertQuantityDecimal(
            tx,
            reqQty,
            line.uomId,
            item.uom_id,
          );

          // Validate return quantity against net consumed for this item (and batch if specified)
          const matchingConsumptions = batch.consumptions.filter(
            c =>
              c.inventoryItemId === item.id &&
              (!line.batchId || c.batchId === line.batchId),
          );
          const totalConsumedBase = matchingConsumptions.reduce(
            (acc, c) => acc.add(c.baseQuantity),
            ZERO,
          );
          const matchingReturns = batch.returns.filter(
            r =>
              r.inventoryItemId === item.id &&
              (!line.batchId || r.batchId === line.batchId),
          );
          const totalAlreadyReturned = matchingReturns.reduce(
            (acc, r) => acc.add(r.baseQuantity),
            ZERO,
          );
          const maxReturnable = totalConsumedBase.sub(totalAlreadyReturned);

          if (baseReturnQty.gt(maxReturnable)) {
            throw new AppError(
              `Return quantity (${baseReturnQty.toFixed(4)}) exceeds returnable consumed quantity (${maxReturnable.toFixed(4)}) for ${item.code}.`,
              400,
            );
          }

          const unitCostInBase =
            matchingConsumptions.length > 0
              ? new Prisma.Decimal(matchingConsumptions[0].unitCost)
              : new Prisma.Decimal(item.moving_average_cost || '0');
          const totalReturnCost = baseReturnQty.mul(unitCostInBase).toDecimalPlaces(4);

          let mwacAfter: Prisma.Decimal | null = null;
          let effectiveUnitCost = unitCostInBase;
          if (item.valuation_method === 'MWAC') {
            const allBals = await tx.inventoryBalance.findMany({
              where: { inventoryItemId: item.id },
              select: { quantityOnHand: true },
            });
            const existingTotal = allBals.reduce((acc, b) => acc.add(b.quantityOnHand), ZERO);
            const currMwac = new Prisma.Decimal(item.moving_average_cost);
            const newTotal = existingTotal.add(baseReturnQty);
            const newMwac = newTotal.gt(ZERO)
              ? existingTotal.mul(currMwac).add(totalReturnCost).div(newTotal).toDecimalPlaces(4)
              : unitCostInBase;
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: { movingAverageCost: newMwac },
            });
            mwacAfter = newMwac;
            effectiveUnitCost = newMwac;
          }

          const bal = await lockOrCreateBalance(tx, warehouseId, item.id, line.batchId ?? null);
          const newOnHand = new Prisma.Decimal(bal.quantity_on_hand).add(baseReturnQty);
          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: {
              quantityOnHand: newOnHand,
              unitCost: effectiveUnitCost,
              totalValue: newOnHand.mul(effectiveUnitCost).toDecimalPlaces(4),
              lastTransactionAt: now,
            },
          });

          lineNo += 1;
          await tx.inventoryReceiptLine.create({
            data: {
              receiptId: receipt.id,
              lineNumber: lineNo,
              inventoryItemId: item.id,
              batchId: line.batchId ?? null,
              uomId: line.uomId,
              quantity: reqQty,
              baseQuantity: baseReturnQty,
              unitCost: unitCostInBase,
              totalCost: totalReturnCost,
            },
          });

          await tx.inventoryTransactionLine.create({
            data: {
              transactionId: invTx.id,
              lineNumber: lineNo,
              inventoryItemId: item.id,
              batchId: line.batchId ?? null,
              uomId: line.uomId,
              quantity: reqQty,
              baseUomId: item.uom_id,
              baseQuantity: baseReturnQty,
              unitCost: unitCostInBase,
              totalCost: totalReturnCost,
              balanceAfter: newOnHand,
              mwacAfter,
            },
          });

          await tx.productionBatchReturn.create({
            data: {
              productionBatchId: batch.id,
              inventoryItemId: item.id,
              warehouseId,
              batchId: line.batchId ?? null,
              uomId: line.uomId,
              returnedQuantity: reqQty,
              baseQuantity: baseReturnQty,
              unitCost: unitCostInBase,
              totalCost: totalReturnCost,
              inventoryReceiptId: receipt.id,
              inventoryTransactionId: invTx.id,
              idempotencyKey:
                whLines.length === 1 && byWarehouse.size === 1 ? effectiveKey : null,
              reason: line.reason,
              returnedById: user.userId,
            },
          });

          await tx.productionExecutionEntry.create({
            data: {
              productionBatchId: batch.id,
              entryType: ProductionExecutionEntryType.MATERIAL_RETURN,
              reason: line.reason,
              notes: `Returned ${baseReturnQty.toFixed(4)} base units of ${item.code}`,
              recordedById: user.userId,
            },
          });
        }
      }

      await ProductionCostingService.recordPostFinalizationEventInTx(
        tx,
        batchId,
        `Material return recorded (${input.lines.length} line(s))`,
        user.userId,
      );
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.RECEIVE,
      entityType: 'ProductionBatch',
      entityId: batchId,
      newState: { returnedLines: input.lines.length, idempotencyKey: effectiveKey },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Returned unused/excess material from production batch',
    });

    return this.getBatchReconciliation(batchId, user);
  }

  static async releaseUnusedReservation(
    batchId: string,
    warehouseId: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    await prisma.$transaction(async tx => {
      const batch = await tx.productionBatch.findUnique({
        where: { id: batchId },
        include: { bomVersion: { include: { items: { include: { inventoryItem: true } } } } },
      });
      if (!batch) throw new AppError('Production batch not found.', 404);
      const targetWh = warehouseId || batch.warehouseId;
      await assertWarehouseAccess(user, targetWh, 'READ_WRITE');

      if (!batch.materialsReserved) return;

      const plannedQty = new Prisma.Decimal(batch.plannedQuantity);
      const expectedGoodOut = new Prisma.Decimal(batch.bomVersion.expectedGoodOutput);
      const yieldPct = new Prisma.Decimal(batch.bomVersion.yieldPercentage);
      const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

      const releaseItems = [];
      for (const item of batch.bomVersion.items) {
        const effQty = new Prisma.Decimal(item.standardQuantity)
          .mul(scaleFactor)
          .mul(HUNDRED.add(item.scrapTolerancePercent))
          .div(HUNDRED)
          .toDecimalPlaces(4);
        const { converted: baseQty } = await convertQuantityDecimal(
          tx,
          effQty,
          item.uomId,
          item.inventoryItem.uomId,
        );
        if (baseQty.gt(ZERO)) {
          releaseItems.push({ inventoryItemId: item.inventoryItemId, baseQuantity: baseQty });
        }
      }

      await InventoryReservationService.releaseReservedStockInTx(tx, targetWh, releaseItems);
      await tx.productionBatch.update({
        where: { id: batchId },
        data: { materialsReserved: false },
      });
      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: batchId,
          entryType: ProductionExecutionEntryType.MATERIAL_RESERVATION,
          notes: 'Released unused material reservations',
          recordedById: user.userId,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.RELEASE,
      entityType: 'ProductionBatch',
      entityId: batchId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Released unused material reservations for production batch',
    });

    return this.getBatchReconciliation(batchId, user);
  }

  static async approveVariance(
    batchId: string,
    input: VarianceApprovalInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const rec = await this.getBatchReconciliation(batchId, user);
    const line = rec.lines.find(l => l.inventoryItemId === input.inventoryItemId);
    if (!line) {
      throw new AppError('Material item is not part of this batch BOM.', 404);
    }

    const approval = await prisma.productionBatchVarianceApproval.upsert({
      where: {
        productionBatchId_inventoryItemId: {
          productionBatchId: batchId,
          inventoryItemId: input.inventoryItemId,
        },
      },
      update: {
        expectedQuantity: new Prisma.Decimal(line.expectedTotalQuantity),
        actualQuantity: new Prisma.Decimal(line.netConsumedQuantity),
        varianceQuantity: new Prisma.Decimal(line.quantityVariance),
        variancePercent: new Prisma.Decimal(line.variancePercent),
        thresholdPercent: new Prisma.Decimal(line.thresholdPercent),
        status: input.decision as VarianceApprovalStatus,
        reason: input.reason,
        approvedById: user.userId,
        approvedAt: new Date(),
      },
      create: {
        productionBatchId: batchId,
        inventoryItemId: input.inventoryItemId,
        expectedQuantity: new Prisma.Decimal(line.expectedTotalQuantity),
        actualQuantity: new Prisma.Decimal(line.netConsumedQuantity),
        varianceQuantity: new Prisma.Decimal(line.quantityVariance),
        variancePercent: new Prisma.Decimal(line.variancePercent),
        thresholdPercent: new Prisma.Decimal(line.thresholdPercent),
        status: input.decision as VarianceApprovalStatus,
        reason: input.reason,
        approvedById: user.userId,
        approvedAt: new Date(),
      },
      include: { approvedBy: { select: { id: true, fullName: true, username: true } } },
    });

    await prisma.productionExecutionEntry.create({
      data: {
        productionBatchId: batchId,
        entryType: ProductionExecutionEntryType.VARIANCE_APPROVAL,
        reason: input.reason,
        notes: `${input.decision} variance (${line.variancePercent}%) for ${line.itemCode}`,
        recordedById: user.userId,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: input.decision === 'APPROVED' ? AuditAction.APPROVE : AuditAction.REJECT,
      entityType: 'ProductionBatchVarianceApproval',
      entityId: approval.id,
      newState: toPlainJson({
        productionBatchId: batchId,
        inventoryItemId: input.inventoryItemId,
        status: approval.status,
        variancePercent: approval.variancePercent,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: input.reason,
    });

    return approval;
  }

  static async listQualityInspections(
    params: PaginationParams,
    user: UserContext,
    filters: { decision?: string; warehouseId?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.QualityInspectionWhereInput = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.decision) where.decision = filters.decision as InspectionDecision;
    if (params.search) {
      where.OR = [
        { inspectionNumber: { contains: params.search, mode: 'insensitive' } },
        { productionBatch: { batchNumber: { contains: params.search, mode: 'insensitive' } } },
        { inventoryBatch: { batchNumber: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.qualityInspection.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          productionBatch: {
            select: {
              id: true,
              batchNumber: true,
              productVariant: { select: { id: true, sku: true, name: true } },
              uom: { select: { id: true, code: true, symbol: true } },
            },
          },
          inventoryBatch: {
            select: {
              id: true,
              batchNumber: true,
              qualityStatus: true,
              manufacturingDate: true,
              expiryDate: true,
            },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          inspector: { select: { id: true, fullName: true, username: true } },
          releasedBy: { select: { id: true, fullName: true, username: true } },
        },
      }),
      prisma.qualityInspection.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async inspectQuality(
    inspectionId: string,
    input: InspectQualityInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM quality_inspections WHERE id = ${inspectionId} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Quality inspection not found.', 404);

      const qi = await tx.qualityInspection.findUniqueOrThrow({
        where: { id: inspectionId },
        include: { inventoryBatch: true, productionBatch: true },
      });
      await assertWarehouseAccess(user, qi.warehouseId, 'READ_WRITE');

      if (qi.decision !== 'PENDING') {
        throw new AppError(
          `Inspection decision already recorded (${qi.decision}). Duplicate inspection decisions are not allowed.`,
          400,
        );
      }

      const inspectedQty = new Prisma.Decimal(qi.inspectedQuantity);
      let goodQty = inspectedQty;
      let rejectedQty = ZERO;
      let nextQualityStatus: QualityStatus = QualityStatus.ACCEPTED;

      if (input.decision === 'ACCEPTED') {
        goodQty = inspectedQty;
        rejectedQty = ZERO;
        nextQualityStatus = QualityStatus.ACCEPTED;
      } else if (input.decision === 'QUARANTINED') {
        goodQty = ZERO;
        rejectedQty = ZERO;
        nextQualityStatus = QualityStatus.QUARANTINED;
      } else if (input.decision === 'REJECTED') {
        goodQty = ZERO;
        rejectedQty = inspectedQty;
        nextQualityStatus = QualityStatus.REJECTED;
      } else if (input.decision === 'PARTIALLY_ACCEPTED') {
        goodQty = new Prisma.Decimal(input.goodQuantity ?? '0').toDecimalPlaces(4);
        rejectedQty = new Prisma.Decimal(input.rejectedQuantity ?? '0').toDecimalPlaces(4);
        if (goodQty.lte(ZERO) || rejectedQty.lte(ZERO)) {
          throw new AppError(
            'PARTIALLY_ACCEPTED requires both goodQuantity > 0 and rejectedQuantity > 0.',
            400,
          );
        }
        if (!goodQty.add(rejectedQty).eq(inspectedQty)) {
          throw new AppError(
            `goodQuantity + rejectedQuantity (${goodQty.add(rejectedQty).toFixed(4)}) must equal inspectedQuantity (${inspectedQty.toFixed(4)}).`,
            400,
          );
        }
        nextQualityStatus = QualityStatus.ACCEPTED;

        // Split rejected quantity into a separate REJECTED inventory batch via ledger transactions
        const lockedItems = await lockInventoryItems(tx, [qi.inventoryBatch.inventoryItemId]);
        const fgItem = lockedItems.get(qi.inventoryBatch.inventoryItemId)!;
        const { converted: rejectedBaseQty } = await convertQuantityDecimal(
          tx,
          rejectedQty,
          qi.productionBatch.uomId,
          fgItem.uom_id,
        );

        const mainBal = await lockOrCreateBalance(
          tx,
          qi.warehouseId,
          fgItem.id,
          qi.inventoryBatchId,
        );
        const newMainOnHand = Prisma.Decimal.max(
          ZERO,
          new Prisma.Decimal(mainBal.quantity_on_hand).sub(rejectedBaseQty),
        );
        const unitCost = new Prisma.Decimal(mainBal.unit_cost);
        await tx.inventoryBalance.update({
          where: { id: mainBal.id },
          data: {
            quantityOnHand: newMainOnHand,
            totalValue: newMainOnHand.mul(unitCost).toDecimalPlaces(4),
            lastTransactionAt: new Date(),
          },
        });

        const rejBatch = await tx.inventoryBatch.upsert({
          where: {
            inventoryItemId_batchNumber: {
              inventoryItemId: fgItem.id,
              batchNumber: `${qi.inventoryBatch.batchNumber}-REJ`,
            },
          },
          update: { qualityStatus: QualityStatus.REJECTED },
          create: {
            inventoryItemId: fgItem.id,
            batchNumber: `${qi.inventoryBatch.batchNumber}-REJ`,
            manufacturingDate: qi.inventoryBatch.manufacturingDate,
            expiryDate: qi.inventoryBatch.expiryDate,
            unitCost: qi.inventoryBatch.unitCost,
            qualityStatus: QualityStatus.REJECTED,
            supplierBatchRef: qi.inventoryBatch.batchNumber,
            notes: `Rejected portion from inspection ${qi.inspectionNumber}`,
          },
        });

        const rejBal = await lockOrCreateBalance(tx, qi.warehouseId, fgItem.id, rejBatch.id);
        const newRejOnHand = new Prisma.Decimal(rejBal.quantity_on_hand).add(rejectedBaseQty);
        await tx.inventoryBalance.update({
          where: { id: rejBal.id },
          data: {
            quantityOnHand: newRejOnHand,
            unitCost,
            totalValue: newRejOnHand.mul(unitCost).toDecimalPlaces(4),
            lastTransactionAt: new Date(),
          },
        });

        const adjOutTx = await tx.inventoryTransaction.create({
          data: {
            transactionNumber: generateDocNumber('TXN'),
            transactionType: InventoryTransactionType.ADJUSTMENT_OUT,
            referenceType: 'QUALITY_INSPECTION',
            referenceId: qi.id,
            referenceNumber: qi.inspectionNumber,
            idempotencyKey: `QI-SPLIT-OUT-${qi.id}`,
            warehouseId: qi.warehouseId,
            postedById: user.userId,
            remarks: `Split rejected portion to ${rejBatch.batchNumber}`,
          },
        });
        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: adjOutTx.id,
            lineNumber: 1,
            inventoryItemId: fgItem.id,
            batchId: qi.inventoryBatchId,
            uomId: qi.productionBatch.uomId,
            quantity: rejectedQty.neg(),
            baseUomId: fgItem.uom_id,
            baseQuantity: rejectedBaseQty.neg(),
            unitCost,
            totalCost: rejectedBaseQty.mul(unitCost).neg().toDecimalPlaces(4),
            balanceAfter: newMainOnHand,
          },
        });

        const adjInTx = await tx.inventoryTransaction.create({
          data: {
            transactionNumber: generateDocNumber('TXN'),
            transactionType: InventoryTransactionType.ADJUSTMENT_IN,
            referenceType: 'QUALITY_INSPECTION',
            referenceId: qi.id,
            referenceNumber: qi.inspectionNumber,
            idempotencyKey: `QI-SPLIT-IN-${qi.id}`,
            warehouseId: qi.warehouseId,
            postedById: user.userId,
            remarks: `Received rejected portion into ${rejBatch.batchNumber}`,
          },
        });
        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: adjInTx.id,
            lineNumber: 1,
            inventoryItemId: fgItem.id,
            batchId: rejBatch.id,
            uomId: qi.productionBatch.uomId,
            quantity: rejectedQty,
            baseUomId: fgItem.uom_id,
            baseQuantity: rejectedBaseQty,
            unitCost,
            totalCost: rejectedBaseQty.mul(unitCost).toDecimalPlaces(4),
            balanceAfter: newRejOnHand,
          },
        });
      }

      await tx.inventoryBatch.update({
        where: { id: qi.inventoryBatchId },
        data: { qualityStatus: nextQualityStatus },
      });

      const saved = await tx.qualityInspection.update({
        where: { id: inspectionId },
        data: {
          decision: input.decision as InspectionDecision,
          goodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          defectCategory: input.defectCategory ?? null,
          notes: input.notes ?? null,
          evidenceRef: input.evidenceRef ?? null,
          inspectorId: user.userId,
          inspectedAt: new Date(),
        },
        include: {
          inventoryBatch: true,
          productionBatch: { select: { id: true, batchNumber: true } },
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: qi.productionBatchId,
          entryType: ProductionExecutionEntryType.QUALITY_INSPECTION,
          goodQuantity: goodQty,
          rejectedQuantity: rejectedQty,
          reason: input.defectCategory ?? null,
          notes: `Quality inspection ${qi.inspectionNumber}: ${input.decision}`,
          recordedById: user.userId,
        },
      });

      await ProductionCostingService.recordPostFinalizationEventInTx(
        tx,
        qi.productionBatchId,
        `Quality inspection ${qi.inspectionNumber} decided: ${input.decision} (good: ${goodQty.toFixed(4)}, rejected: ${rejectedQty.toFixed(4)})`,
        user.userId,
      );

      return saved;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'QualityInspection',
      entityId: inspectionId,
      newState: toPlainJson({
        decision: updated.decision,
        goodQuantity: updated.goodQuantity,
        rejectedQuantity: updated.rejectedQuantity,
      }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Quality inspection decision: ${updated.decision}`,
    });

    return updated;
  }

  static async releaseOrDispositionQuarantined(
    inspectionId: string,
    action: 'RELEASE' | 'REJECT',
    releaseNotes: string,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const updated = await prisma.$transaction(async tx => {
      const qi = await tx.qualityInspection.findUnique({
        where: { id: inspectionId },
        include: { inventoryBatch: true },
      });
      if (!qi) throw new AppError('Quality inspection not found.', 404);
      await assertWarehouseAccess(user, qi.warehouseId, 'READ_WRITE');

      if (qi.decision !== 'QUARANTINED') {
        throw new AppError(
          `Only QUARANTINED inspections can be released or dispositioned (current decision: ${qi.decision}).`,
          400,
        );
      }

      const nextDecision =
        action === 'RELEASE' ? InspectionDecision.ACCEPTED : InspectionDecision.REJECTED;
      const nextStatus =
        action === 'RELEASE' ? QualityStatus.ACCEPTED : QualityStatus.REJECTED;

      await tx.inventoryBatch.update({
        where: { id: qi.inventoryBatchId },
        data: { qualityStatus: nextStatus },
      });

      const saved = await tx.qualityInspection.update({
        where: { id: inspectionId },
        data: {
          decision: nextDecision,
          goodQuantity: action === 'RELEASE' ? qi.inspectedQuantity : ZERO,
          rejectedQuantity: action === 'REJECT' ? qi.inspectedQuantity : ZERO,
          releasedById: user.userId,
          releasedAt: new Date(),
          releaseNotes,
        },
        include: { inventoryBatch: true },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: qi.productionBatchId,
          entryType: ProductionExecutionEntryType.QUALITY_INSPECTION,
          reason: releaseNotes,
          notes: `Quarantine ${action === 'RELEASE' ? 'released to ACCEPTED' : 'dispositioned as REJECTED'}`,
          recordedById: user.userId,
        },
      });

      await ProductionCostingService.recordPostFinalizationEventInTx(
        tx,
        qi.productionBatchId,
        `Quarantine ${action === 'RELEASE' ? 'released to ACCEPTED' : 'dispositioned as REJECTED'} (${qi.inspectionNumber})`,
        user.userId,
      );

      return saved;
    });

    await AuditService.log({
      userId: meta.userId,
      action: action === 'RELEASE' ? AuditAction.RELEASE : AuditAction.REJECT,
      entityType: 'QualityInspection',
      entityId: inspectionId,
      newState: { decision: updated.decision, releaseNotes },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: releaseNotes,
    });

    return updated;
  }

  /**
   * Bidirectional recall & genealogy lookup by FG batch number or RM batch number.
   */
  static async recallLookup(batchNumber: string, user: UserContext) {
    const clean = batchNumber.trim();
    if (!clean) throw new AppError('batchNumber is required.', 400);

    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    const matchingInvBatches = await prisma.inventoryBatch.findMany({
      where: { batchNumber: { contains: clean, mode: 'insensitive' } },
      include: {
        inventoryItem: { select: { id: true, code: true, name: true, itemType: true } },
        producedFromBatches: {
          where: allowedWh ? { warehouseId: { in: allowedWh } } : {},
          include: {
            workOrder: { select: { id: true, workOrderNumber: true, productionPlanId: true } },
            qualityInspection: true,
            consumptions: {
              include: {
                inventoryItem: { select: { id: true, code: true, name: true } },
                batch: { select: { id: true, batchNumber: true, expiryDate: true } },
              },
            },
          },
        },
        consumedInBatches: {
          where: allowedWh ? { warehouseId: { in: allowedWh } } : {},
          include: {
            productionBatch: {
              include: {
                workOrder: { select: { id: true, workOrderNumber: true } },
                finishedGoodsBatch: {
                  select: {
                    id: true,
                    batchNumber: true,
                    qualityStatus: true,
                    manufacturingDate: true,
                    expiryDate: true,
                  },
                },
                qualityInspection: true,
              },
            },
          },
        },
        transactionLines: {
          where: {
            transaction: {
              referenceType: 'SALES_ORDER_FULFILLMENT',
              ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
            },
          },
          include: {
            transaction: {
              select: {
                id: true,
                transactionNumber: true,
                referenceId: true,
                referenceNumber: true,
                transactionDate: true,
              },
            },
          },
        },
      },
    });

    return {
      query: clean,
      matches: matchingInvBatches,
    };
  }
}
