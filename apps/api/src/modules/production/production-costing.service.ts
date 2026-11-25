import {
  AuditAction,
  CostEntryApprovalStatus,
  InventoryTransactionType,
  OverheadAllocationMethod,
  OverheadCostType,
  Prisma,
  ProductionCostEntryType,
  ProductionCostingStatus,
  ProductionExecutionEntryType,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult } from '../master-data/master-data.utils';
import {
  convertQuantityDecimal,
  generateDocNumber,
  lockInventoryItems,
  lockOrCreateBalance,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';

const HUNDRED = new Prisma.Decimal(100);

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface MaterialCostLineSummary {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomSymbol: string;
  consumedQuantity: string;
  returnedQuantity: string;
  netQuantity: string;
  grossCost: string;
  returnCost: string;
  netCost: string;
  costSource: string;
  batches: Array<{
    batchId: string | null;
    batchNumber: string | null;
    consumedQty: string;
    returnedQty: string;
    unitCost: string;
    netCost: string;
    inventoryIssueId: string | null;
    inventoryTransactionId: string | null;
  }>;
}

export class ProductionCostingService {
  /**
   * Computes overhead allocated amount using explicit Prisma.Decimal formulas.
   */
  static computeOverheadAmount(
    method: OverheadAllocationMethod,
    rateOrAmount: Prisma.Decimal,
    basis: {
      goodQuantity: Prisma.Decimal;
      netMaterialCost: Prisma.Decimal;
      approvedLabourHours: Prisma.Decimal;
    },
  ): { basisValue: Prisma.Decimal; allocatedAmount: Prisma.Decimal } {
    switch (method) {
      case OverheadAllocationMethod.PER_BATCH: {
        const basisValue = new Prisma.Decimal(1);
        return {
          basisValue,
          allocatedAmount: rateOrAmount.toDecimalPlaces(4),
        };
      }
      case OverheadAllocationMethod.PER_UNIT: {
        const basisValue = basis.goodQuantity;
        return {
          basisValue,
          allocatedAmount: rateOrAmount.mul(basisValue).toDecimalPlaces(4),
        };
      }
      case OverheadAllocationMethod.PERCENT_OF_MATERIAL: {
        const basisValue = basis.netMaterialCost;
        return {
          basisValue,
          allocatedAmount: basisValue.mul(rateOrAmount).div(HUNDRED).toDecimalPlaces(4),
        };
      }
      case OverheadAllocationMethod.PER_LABOUR_HOUR: {
        const basisValue = basis.approvedLabourHours;
        return {
          basisValue,
          allocatedAmount: rateOrAmount.mul(basisValue).toDecimalPlaces(4),
        };
      }
    }
  }

  /**
   * Computes variance amount (Actual - Standard) and percentage safely without division by zero.
   */
  static computeVariance(
    actual: Prisma.Decimal,
    standard: Prisma.Decimal,
  ): { amount: Prisma.Decimal; percent: Prisma.Decimal } {
    const amount = actual.sub(standard).toDecimalPlaces(4);
    const percent = standard.gt(ZERO)
      ? amount.div(standard).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;
    return { amount, percent };
  }

  /**
   * Ensures a ProductionBatchCosting record exists for a given batch.
   */
  private static async ensureCostingInTx(tx: Prisma.TransactionClient, batchId: string) {
    const batch = await tx.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        bomVersion: {
          include: {
            items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
            overheads: true,
          },
        },
        consumptions: {
          include: {
            inventoryItem: { include: { uom: true } },
            batch: { select: { id: true, batchNumber: true } },
          },
        },
        returns: {
          include: {
            inventoryItem: { include: { uom: true } },
            batch: { select: { id: true, batchNumber: true } },
          },
        },
        qualityInspection: true,
        costing: true,
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);
    if (batch.status === 'CANCELLED') {
      throw new AppError('Cannot maintain costing for a cancelled production batch.', 400);
    }

    let costing = batch.costing;
    if (!costing) {
      costing = await tx.productionBatchCosting.create({
        data: {
          productionBatchId: batch.id,
          status: ProductionCostingStatus.DRAFT,
          plannedQuantity: batch.plannedQuantity,
          actualGoodQuantity: batch.actualGoodQuantity,
          rejectedQuantity: batch.rejectedQuantity,
          wastageQuantity: batch.wastageQuantity,
        },
      });
    }

    return { batch, costing };
  }

  /**
   * Aggregates historical material consumptions and returns, preserving batch traceability
   * and reconciling with posted InventoryTransactionLines.
   */
  static async buildMaterialBreakdown(
    db: DbClient,
    batchId: string,
  ): Promise<{
    grossMaterialCost: Prisma.Decimal;
    materialReturnCost: Prisma.Decimal;
    netMaterialCost: Prisma.Decimal;
    rawMaterialCost: Prisma.Decimal;
    packagingMaterialCost: Prisma.Decimal;
    ledgerIssueTotal: Prisma.Decimal;
    ledgerReturnTotal: Prisma.Decimal;
    isLedgerReconciled: boolean;
    lines: MaterialCostLineSummary[];
  }> {
    const [consumptions, returns, issueTxs, returnTxs] = await Promise.all([
      db.productionBatchConsumption.findMany({
        where: { productionBatchId: batchId },
        include: {
          inventoryItem: { include: { uom: true } },
          batch: { select: { id: true, batchNumber: true } },
        },
        orderBy: { consumedAt: 'asc' },
      }),
      db.productionBatchReturn.findMany({
        where: { productionBatchId: batchId },
        include: {
          inventoryItem: { include: { uom: true } },
          batch: { select: { id: true, batchNumber: true } },
        },
        orderBy: { returnedAt: 'asc' },
      }),
      db.inventoryTransaction.findMany({
        where: { referenceType: 'PRODUCTION_BATCH', referenceId: batchId, transactionType: 'ISSUE' },
        include: { lines: true },
      }),
      db.inventoryTransaction.findMany({
        where: { referenceType: 'PRODUCTION_RETURN', referenceId: batchId, transactionType: 'RECEIPT' },
        include: { lines: true },
      }),
    ]);

    const itemMap = new Map<
      string,
      {
        inventoryItemId: string;
        itemCode: string;
        itemName: string;
        itemType: string;
        baseUomSymbol: string;
        consumedQty: Prisma.Decimal;
        returnedQty: Prisma.Decimal;
        grossCost: Prisma.Decimal;
        returnCost: Prisma.Decimal;
        batches: Map<
          string,
          {
            batchId: string | null;
            batchNumber: string | null;
            consumedQty: Prisma.Decimal;
            returnedQty: Prisma.Decimal;
            unitCost: Prisma.Decimal;
            grossCost: Prisma.Decimal;
            returnCost: Prisma.Decimal;
            inventoryIssueId: string | null;
            inventoryTransactionId: string | null;
          }
        >;
      }
    >();

    let grossMaterialCost = ZERO;
    let materialReturnCost = ZERO;
    let rawGross = ZERO;
    let pkgGross = ZERO;
    let rawReturn = ZERO;
    let pkgReturn = ZERO;

    for (const c of consumptions) {
      const qty = new Prisma.Decimal(c.baseQuantity);
      const cost = new Prisma.Decimal(c.totalCost);
      grossMaterialCost = grossMaterialCost.add(cost);
      if (c.inventoryItem.itemType === 'PACKAGING') {
        pkgGross = pkgGross.add(cost);
      } else {
        rawGross = rawGross.add(cost);
      }

      let entry = itemMap.get(c.inventoryItemId);
      if (!entry) {
        entry = {
          inventoryItemId: c.inventoryItemId,
          itemCode: c.inventoryItem.code,
          itemName: c.inventoryItem.name,
          itemType: c.inventoryItem.itemType,
          baseUomSymbol: c.inventoryItem.uom.symbol,
          consumedQty: ZERO,
          returnedQty: ZERO,
          grossCost: ZERO,
          returnCost: ZERO,
          batches: new Map(),
        };
        itemMap.set(c.inventoryItemId, entry);
      }
      entry.consumedQty = entry.consumedQty.add(qty);
      entry.grossCost = entry.grossCost.add(cost);

      const bKey = c.batchId ?? 'NO_BATCH';
      const existingB = entry.batches.get(bKey) ?? {
        batchId: c.batchId,
        batchNumber: c.batch?.batchNumber ?? null,
        consumedQty: ZERO,
        returnedQty: ZERO,
        unitCost: new Prisma.Decimal(c.unitCost),
        grossCost: ZERO,
        returnCost: ZERO,
        inventoryIssueId: c.inventoryIssueId,
        inventoryTransactionId: c.inventoryTransactionId,
      };
      existingB.consumedQty = existingB.consumedQty.add(qty);
      existingB.grossCost = existingB.grossCost.add(cost);
      entry.batches.set(bKey, existingB);
    }

    for (const r of returns) {
      const qty = new Prisma.Decimal(r.baseQuantity);
      const cost = new Prisma.Decimal(r.totalCost);
      materialReturnCost = materialReturnCost.add(cost);
      if (r.inventoryItem.itemType === 'PACKAGING') {
        pkgReturn = pkgReturn.add(cost);
      } else {
        rawReturn = rawReturn.add(cost);
      }

      let entry = itemMap.get(r.inventoryItemId);
      if (!entry) {
        entry = {
          inventoryItemId: r.inventoryItemId,
          itemCode: r.inventoryItem.code,
          itemName: r.inventoryItem.name,
          itemType: r.inventoryItem.itemType,
          baseUomSymbol: r.inventoryItem.uom.symbol,
          consumedQty: ZERO,
          returnedQty: ZERO,
          grossCost: ZERO,
          returnCost: ZERO,
          batches: new Map(),
        };
        itemMap.set(r.inventoryItemId, entry);
      }
      entry.returnedQty = entry.returnedQty.add(qty);
      entry.returnCost = entry.returnCost.add(cost);

      const bKey = r.batchId ?? 'NO_BATCH';
      const existingB = entry.batches.get(bKey) ?? {
        batchId: r.batchId,
        batchNumber: r.batch?.batchNumber ?? null,
        consumedQty: ZERO,
        returnedQty: ZERO,
        unitCost: new Prisma.Decimal(r.unitCost),
        grossCost: ZERO,
        returnCost: ZERO,
        inventoryIssueId: null,
        inventoryTransactionId: r.inventoryTransactionId,
      };
      existingB.returnedQty = existingB.returnedQty.add(qty);
      existingB.returnCost = existingB.returnCost.add(cost);
      entry.batches.set(bKey, existingB);
    }

    let ledgerIssueTotal = ZERO;
    for (const txDoc of issueTxs) {
      for (const l of txDoc.lines) {
        ledgerIssueTotal = ledgerIssueTotal.add(new Prisma.Decimal(l.totalCost).abs());
      }
    }
    let ledgerReturnTotal = ZERO;
    for (const txDoc of returnTxs) {
      for (const l of txDoc.lines) {
        ledgerReturnTotal = ledgerReturnTotal.add(new Prisma.Decimal(l.totalCost).abs());
      }
    }

    const isLedgerReconciled =
      ledgerIssueTotal.sub(grossMaterialCost).abs().lte(new Prisma.Decimal('0.05')) &&
      ledgerReturnTotal.sub(materialReturnCost).abs().lte(new Prisma.Decimal('0.05'));

    const lines: MaterialCostLineSummary[] = Array.from(itemMap.values()).map(entry => ({
      inventoryItemId: entry.inventoryItemId,
      itemCode: entry.itemCode,
      itemName: entry.itemName,
      itemType: entry.itemType,
      baseUomSymbol: entry.baseUomSymbol,
      consumedQuantity: entry.consumedQty.toFixed(4),
      returnedQuantity: entry.returnedQty.toFixed(4),
      netQuantity: entry.consumedQty.sub(entry.returnedQty).toFixed(4),
      grossCost: entry.grossCost.toFixed(4),
      returnCost: entry.returnCost.toFixed(4),
      netCost: entry.grossCost.sub(entry.returnCost).toFixed(4),
      costSource: 'HISTORICAL_INVENTORY_TRANSACTION',
      batches: Array.from(entry.batches.values()).map(b => ({
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        consumedQty: b.consumedQty.toFixed(4),
        returnedQty: b.returnedQty.toFixed(4),
        unitCost: b.unitCost.toFixed(4),
        netCost: b.grossCost.sub(b.returnCost).toFixed(4),
        inventoryIssueId: b.inventoryIssueId,
        inventoryTransactionId: b.inventoryTransactionId,
      })),
    }));

    return {
      grossMaterialCost: grossMaterialCost.toDecimalPlaces(4),
      materialReturnCost: materialReturnCost.toDecimalPlaces(4),
      netMaterialCost: grossMaterialCost.sub(materialReturnCost).toDecimalPlaces(4),
      rawMaterialCost: rawGross.sub(rawReturn).toDecimalPlaces(4),
      packagingMaterialCost: pkgGross.sub(pkgReturn).toDecimalPlaces(4),
      ledgerIssueTotal: ledgerIssueTotal.toDecimalPlaces(4),
      ledgerReturnTotal: ledgerReturnTotal.toDecimalPlaces(4),
      isLedgerReconciled,
      lines,
    };
  }

  /**
   * Computes standard batch costs from the locked BOMVersion.
   */
  private static async computeStandardCosts(
    tx: Prisma.TransactionClient,
    bomVersion: {
      expectedGoodOutput: Prisma.Decimal;
      items: Array<{
        inventoryItemId: string;
        standardQuantity: Prisma.Decimal;
        scrapTolerancePercent: Prisma.Decimal;
        uomId: string;
        inventoryItem: { uomId: string; movingAverageCost: Prisma.Decimal };
      }>;
      overheads: Array<{
        id: string;
        costType: OverheadCostType;
        description: string;
        standardAmount: Prisma.Decimal;
      }>;
    },
    targetQty: Prisma.Decimal,
  ) {
    const baseOutput = new Prisma.Decimal(bomVersion.expectedGoodOutput);
    const scaleFactor = baseOutput.gt(ZERO) ? targetQty.div(baseOutput) : new Prisma.Decimal(1);

    let standardMaterialCost = ZERO;
    for (const item of bomVersion.items) {
      const scaledQty = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor);
      const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
      const effectiveQty = scaledQty.mul(HUNDRED.add(scrapPct)).div(HUNDRED);
      const { converted: effectiveBaseQty } = await convertQuantityDecimal(
        tx,
        effectiveQty,
        item.uomId,
        item.inventoryItem.uomId,
      );
      const unitMwac = new Prisma.Decimal(item.inventoryItem.movingAverageCost);
      standardMaterialCost = standardMaterialCost.add(effectiveBaseQty.mul(unitMwac));
    }

    let standardLabourCost = ZERO;
    let standardOverheadCost = ZERO;
    for (const oh of bomVersion.overheads) {
      const scaled = new Prisma.Decimal(oh.standardAmount).mul(scaleFactor).toDecimalPlaces(4);
      if (oh.costType === OverheadCostType.LABOUR) {
        standardLabourCost = standardLabourCost.add(scaled);
      } else {
        standardOverheadCost = standardOverheadCost.add(scaled);
      }
    }

    standardMaterialCost = standardMaterialCost.toDecimalPlaces(4);
    standardLabourCost = standardLabourCost.toDecimalPlaces(4);
    standardOverheadCost = standardOverheadCost.toDecimalPlaces(4);
    const standardTotalCost = standardMaterialCost
      .add(standardLabourCost)
      .add(standardOverheadCost)
      .toDecimalPlaces(4);

    return {
      scaleFactor,
      standardMaterialCost,
      standardLabourCost,
      standardOverheadCost,
      standardTotalCost,
    };
  }

  /**
   * Recalculates a batch's costing in DRAFT or CALCULATED state (blocks FINALIZED).
   */
  static async calculateBatchCosting(
    batchId: string,
    input: { includeBomOverheads?: boolean; notes?: string },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM production_batches WHERE id = ${batchId} FOR UPDATE`;
      const { batch, costing } = await this.ensureCostingInTx(tx, batchId);

      if (costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError(
          'Finalized costing records are immutable and cannot be recalculated.',
          400,
        );
      }

      const material = await this.buildMaterialBreakdown(tx, batch.id);

      const goodQty = new Prisma.Decimal(batch.actualGoodQuantity);
      const qi = batch.qualityInspection;
      let acceptedQuantity = goodQty;
      let rejectedQty = new Prisma.Decimal(batch.rejectedQuantity);
      if (qi) {
        if (qi.decision === 'PARTIALLY_ACCEPTED') {
          acceptedQuantity = new Prisma.Decimal(qi.goodQuantity);
          rejectedQty = rejectedQty.add(qi.rejectedQuantity);
        } else if (qi.decision === 'REJECTED') {
          acceptedQuantity = ZERO;
          rejectedQty = rejectedQty.add(qi.inspectedQuantity);
        } else if (qi.decision === 'ACCEPTED') {
          acceptedQuantity = goodQty;
        }
      }
      const wastageQty = new Prisma.Decimal(batch.wastageQuantity);

      const standardBasisQty = goodQty.gt(ZERO) ? goodQty : new Prisma.Decimal(batch.plannedQuantity);
      const std = await this.computeStandardCosts(tx, batch.bomVersion, standardBasisQty);

      // Import BOM overheads once if requested and not yet imported (prevent double-counting)
      if (input.includeBomOverheads !== false) {
        for (const oh of batch.bomVersion.overheads) {
          const existingOh = await tx.productionOverheadAllocation.findUnique({
            where: {
              productionBatchId_bomOverheadId: {
                productionBatchId: batch.id,
                bomOverheadId: oh.id,
              },
            },
          });
          if (!existingOh) {
            const scaledAmt = new Prisma.Decimal(oh.standardAmount)
              .mul(std.scaleFactor)
              .toDecimalPlaces(4);
            await tx.productionOverheadAllocation.create({
              data: {
                productionBatchCostingId: costing.id,
                productionBatchId: batch.id,
                bomOverheadId: oh.id,
                costType: oh.costType,
                description: oh.description,
                allocationMethod: OverheadAllocationMethod.PER_BATCH,
                basisValue: new Prisma.Decimal(1),
                rateOrAmount: scaledAmt,
                allocatedAmount: scaledAmt,
                isFromBom: true,
                recordedById: user.userId,
              },
            });
          }
        }
      }

      const costEntries = await tx.productionCostEntry.findMany({
        where: { productionBatchCostingId: costing.id, approvalStatus: CostEntryApprovalStatus.APPROVED },
      });

      let actualLabourCost = ZERO;
      let actualMachineCost = ZERO;
      let otherDirectCost = ZERO;
      let approvedLabourHours = ZERO;

      for (const entry of costEntries) {
        const amt = new Prisma.Decimal(entry.totalAmount);
        if (entry.entryType === ProductionCostEntryType.DIRECT_LABOUR) {
          actualLabourCost = actualLabourCost.add(amt);
          approvedLabourHours = approvedLabourHours.add(entry.quantityOrHours);
        } else if (entry.entryType === ProductionCostEntryType.MACHINE_COST) {
          actualMachineCost = actualMachineCost.add(amt);
        } else {
          otherDirectCost = otherDirectCost.add(amt);
        }
      }

      // Re-evaluate dynamic overhead allocations (PER_UNIT, PERCENT_OF_MATERIAL, PER_LABOUR_HOUR)
      const overheadRows = await tx.productionOverheadAllocation.findMany({
        where: { productionBatchCostingId: costing.id },
      });

      let actualOverheadCost = ZERO;
      for (const oh of overheadRows) {
        const { basisValue, allocatedAmount } = this.computeOverheadAmount(
          oh.allocationMethod,
          new Prisma.Decimal(oh.rateOrAmount),
          {
            goodQuantity: goodQty,
            netMaterialCost: material.netMaterialCost,
            approvedLabourHours,
          },
        );
        if (
          !basisValue.eq(oh.basisValue) ||
          !allocatedAmount.eq(oh.allocatedAmount)
        ) {
          await tx.productionOverheadAllocation.update({
            where: { id: oh.id },
            data: { basisValue, allocatedAmount },
          });
        }
        actualOverheadCost = actualOverheadCost.add(allocatedAmount);
      }

      actualLabourCost = actualLabourCost.toDecimalPlaces(4);
      actualMachineCost = actualMachineCost.toDecimalPlaces(4);
      otherDirectCost = otherDirectCost.toDecimalPlaces(4);
      actualOverheadCost = actualOverheadCost.toDecimalPlaces(4);

      const totalActualCost = material.netMaterialCost
        .add(actualLabourCost)
        .add(actualMachineCost)
        .add(otherDirectCost)
        .add(actualOverheadCost)
        .toDecimalPlaces(4);

      const totalProducedInput = acceptedQuantity.add(rejectedQty).add(wastageQty);
      const wastageAndRejectionCost = totalProducedInput.gt(ZERO)
        ? totalActualCost
            .mul(rejectedQty.add(wastageQty))
            .div(totalProducedInput)
            .toDecimalPlaces(4)
        : ZERO;

      const goodOutputCost = totalActualCost.sub(wastageAndRejectionCost).toDecimalPlaces(4);
      const costPerAcceptedUnit = acceptedQuantity.gt(ZERO)
        ? goodOutputCost.div(acceptedQuantity).toDecimalPlaces(4)
        : ZERO;

      const matVar = this.computeVariance(material.netMaterialCost, std.standardMaterialCost);
      const labVar = this.computeVariance(actualLabourCost, std.standardLabourCost);
      const combinedActualOh = actualMachineCost.add(otherDirectCost).add(actualOverheadCost);
      const ohVar = this.computeVariance(combinedActualOh, std.standardOverheadCost);
      const totVar = this.computeVariance(totalActualCost, std.standardTotalCost);

      const now = new Date();
      const updated = await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: {
          status: ProductionCostingStatus.CALCULATED,
          plannedQuantity: batch.plannedQuantity,
          actualGoodQuantity: goodQty,
          acceptedQuantity,
          rejectedQuantity: rejectedQty,
          wastageQuantity: wastageQty,
          standardMaterialCost: std.standardMaterialCost,
          standardLabourCost: std.standardLabourCost,
          standardOverheadCost: std.standardOverheadCost,
          standardTotalCost: std.standardTotalCost,
          grossMaterialCost: material.grossMaterialCost,
          materialReturnCost: material.materialReturnCost,
          netMaterialCost: material.netMaterialCost,
          rawMaterialCost: material.rawMaterialCost,
          packagingMaterialCost: material.packagingMaterialCost,
          actualLabourCost,
          actualMachineCost,
          otherDirectCost,
          actualOverheadCost,
          wastageAndRejectionCost,
          totalActualCost,
          goodOutputCost,
          costPerAcceptedUnit,
          materialVarianceAmount: matVar.amount,
          materialVariancePercent: matVar.percent,
          labourVarianceAmount: labVar.amount,
          labourVariancePercent: labVar.percent,
          overheadVarianceAmount: ohVar.amount,
          overheadVariancePercent: ohVar.percent,
          totalVarianceAmount: totVar.amount,
          totalVariancePercent: totVar.percent,
          calculatedAt: now,
          calculatedById: user.userId,
        },
      });

      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: costing.status,
          toStatus: ProductionCostingStatus.CALCULATED,
          action: 'CALCULATE',
          changedById: user.userId,
          notes: input.notes ?? 'Calculated batch production costing',
          snapshot: {
            netMaterialCost: updated.netMaterialCost.toString(),
            actualLabourCost: updated.actualLabourCost.toString(),
            actualMachineCost: updated.actualMachineCost.toString(),
            actualOverheadCost: updated.actualOverheadCost.toString(),
            totalActualCost: updated.totalActualCost.toString(),
            costPerAcceptedUnit: updated.costPerAcceptedUnit.toString(),
          },
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: batch.id,
          entryType: ProductionExecutionEntryType.COSTING_CALCULATION,
          notes: `Costing calculated: Total ${updated.totalActualCost.toFixed(2)}, Unit ${updated.costPerAcceptedUnit.toFixed(4)}`,
          recordedById: user.userId,
        },
      });

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.UPDATE,
        entityType: 'ProductionBatchCosting',
        entityId: costing.id,
        newState: {
          status: ProductionCostingStatus.CALCULATED,
          totalActualCost: updated.totalActualCost.toString(),
          costPerAcceptedUnit: updated.costPerAcceptedUnit.toString(),
        },
        ...auditMeta,
      });

      return updated;
    });
  }

  /**
   * Adds a direct labour, machine, or other direct production cost entry.
   */
  static async addCostEntry(
    batchId: string,
    input: {
      entryType: 'DIRECT_LABOUR' | 'MACHINE_COST' | 'OTHER_DIRECT_EXPENSE';
      description: string;
      quantityOrHours: string;
      rate: string;
      reference?: string;
      notes?: string;
    },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const { batch, costing } = await this.ensureCostingInTx(tx, batchId);
      if (costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Cannot add cost entries to a finalized costing record.', 400);
      }

      const qtyOrHours = new Prisma.Decimal(input.quantityOrHours);
      const rate = new Prisma.Decimal(input.rate);
      const totalAmount = qtyOrHours.mul(rate).toDecimalPlaces(4);

      const canAutoApprove =
        user.roles.includes('OWNER') ||
        user.roles.includes('ADMIN');

      const approvalStatus = canAutoApprove
        ? CostEntryApprovalStatus.APPROVED
        : CostEntryApprovalStatus.PENDING;

      const entry = await tx.productionCostEntry.create({
        data: {
          productionBatchCostingId: costing.id,
          productionBatchId: batch.id,
          entryType: input.entryType as ProductionCostEntryType,
          description: input.description,
          quantityOrHours: qtyOrHours,
          rate,
          totalAmount,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          approvalStatus,
          recordedById: user.userId,
          approvedById: canAutoApprove ? user.userId : null,
          approvedAt: canAutoApprove ? new Date() : null,
        },
      });

      if (costing.status !== ProductionCostingStatus.DRAFT) {
        await tx.productionBatchCosting.update({
          where: { id: costing.id },
          data: { status: ProductionCostingStatus.DRAFT },
        });
        await tx.productionCostingHistory.create({
          data: {
            productionBatchCostingId: costing.id,
            fromStatus: costing.status,
            toStatus: ProductionCostingStatus.DRAFT,
            action: 'COST_ENTRY_ADDED',
            changedById: user.userId,
            notes: `Added ${input.entryType} entry (${totalAmount.toFixed(2)}); moved to DRAFT for recalculation.`,
          },
        });
      }

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: batch.id,
          entryType: ProductionExecutionEntryType.COST_ENTRY,
          notes: `${input.entryType}: ${input.description} (${totalAmount.toFixed(2)})`,
          recordedById: user.userId,
        },
      });

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.CREATE,
        entityType: 'ProductionCostEntry',
        entityId: entry.id,
        newState: {
          productionBatchId: batch.id,
          entryType: entry.entryType,
          totalAmount: entry.totalAmount.toString(),
          approvalStatus: entry.approvalStatus,
        },
        ...auditMeta,
      });

      return entry;
    });
  }

  /**
   * Approves or rejects a pending cost entry (OWNER / ADMIN).
   */
  static async reviewCostEntry(
    entryId: string,
    input: { decision: 'APPROVED' | 'REJECTED'; notes?: string },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const entry = await tx.productionCostEntry.findUnique({
        where: { id: entryId },
        include: { costing: true },
      });
      if (!entry) throw new AppError('Cost entry not found.', 404);
      if (entry.costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Cannot modify cost entries on a finalized costing record.', 400);
      }

      const updated = await tx.productionCostEntry.update({
        where: { id: entryId },
        data: {
          approvalStatus: input.decision as CostEntryApprovalStatus,
          approvedById: user.userId,
          approvedAt: new Date(),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });

      if (entry.costing.status !== ProductionCostingStatus.DRAFT) {
        await tx.productionBatchCosting.update({
          where: { id: entry.costing.id },
          data: { status: ProductionCostingStatus.DRAFT },
        });
      }

      await AuditService.log({
        userId: user.userId,
        action: input.decision === 'APPROVED' ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: 'ProductionCostEntry',
        entityId: entry.id,
        newState: { approvalStatus: updated.approvalStatus },
        ...auditMeta,
      });

      return updated;
    });
  }

  /**
   * Deletes a non-finalized cost entry.
   */
  static async deleteCostEntry(entryId: string, user: UserContext, auditMeta: AuditMeta) {
    return prisma.$transaction(async tx => {
      const entry = await tx.productionCostEntry.findUnique({
        where: { id: entryId },
        include: { costing: true },
      });
      if (!entry) throw new AppError('Cost entry not found.', 404);
      if (entry.costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Cannot delete cost entries from a finalized costing record.', 400);
      }

      await tx.productionCostEntry.delete({ where: { id: entryId } });
      if (entry.costing.status !== ProductionCostingStatus.DRAFT) {
        await tx.productionBatchCosting.update({
          where: { id: entry.costing.id },
          data: { status: ProductionCostingStatus.DRAFT },
        });
      }

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.DELETE,
        entityType: 'ProductionCostEntry',
        entityId: entryId,
        previousState: {
          entryType: entry.entryType,
          totalAmount: entry.totalAmount.toString(),
        },
        ...auditMeta,
      });

      return { deleted: true, id: entryId };
    });
  }

  /**
   * Adds a manual overhead allocation rule to a batch costing.
   */
  static async addOverheadAllocation(
    batchId: string,
    input: {
      costType: 'LABOUR' | 'UTILITY' | 'MACHINE_DEPRECIATION' | 'DIRECT_OVERHEAD';
      description: string;
      allocationMethod: 'PER_BATCH' | 'PER_UNIT' | 'PERCENT_OF_MATERIAL' | 'PER_LABOUR_HOUR';
      rateOrAmount: string;
    },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const { batch, costing } = await this.ensureCostingInTx(tx, batchId);
      if (costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Cannot add overhead allocations to a finalized costing record.', 400);
      }

      const material = await this.buildMaterialBreakdown(tx, batch.id);
      const labourEntries = await tx.productionCostEntry.findMany({
        where: {
          productionBatchCostingId: costing.id,
          entryType: ProductionCostEntryType.DIRECT_LABOUR,
          approvalStatus: CostEntryApprovalStatus.APPROVED,
        },
      });
      const approvedLabourHours = labourEntries.reduce(
        (acc, e) => acc.add(e.quantityOrHours),
        ZERO,
      );

      const rateOrAmount = new Prisma.Decimal(input.rateOrAmount);
      const { basisValue, allocatedAmount } = this.computeOverheadAmount(
        input.allocationMethod as OverheadAllocationMethod,
        rateOrAmount,
        {
          goodQuantity: new Prisma.Decimal(batch.actualGoodQuantity),
          netMaterialCost: material.netMaterialCost,
          approvedLabourHours,
        },
      );

      const allocation = await tx.productionOverheadAllocation.create({
        data: {
          productionBatchCostingId: costing.id,
          productionBatchId: batch.id,
          bomOverheadId: null,
          costType: input.costType as OverheadCostType,
          description: input.description,
          allocationMethod: input.allocationMethod as OverheadAllocationMethod,
          basisValue,
          rateOrAmount,
          allocatedAmount,
          isFromBom: false,
          recordedById: user.userId,
        },
      });

      if (costing.status !== ProductionCostingStatus.DRAFT) {
        await tx.productionBatchCosting.update({
          where: { id: costing.id },
          data: { status: ProductionCostingStatus.DRAFT },
        });
      }

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.CREATE,
        entityType: 'ProductionOverheadAllocation',
        entityId: allocation.id,
        newState: {
          productionBatchId: batch.id,
          allocationMethod: allocation.allocationMethod,
          allocatedAmount: allocation.allocatedAmount.toString(),
        },
        ...auditMeta,
      });

      return allocation;
    });
  }

  static async deleteOverheadAllocation(
    allocationId: string,
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const allocation = await tx.productionOverheadAllocation.findUnique({
        where: { id: allocationId },
        include: { costing: true },
      });
      if (!allocation) throw new AppError('Overhead allocation not found.', 404);
      if (allocation.costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Cannot delete overhead allocations from a finalized costing record.', 400);
      }

      await tx.productionOverheadAllocation.delete({ where: { id: allocationId } });
      if (allocation.costing.status !== ProductionCostingStatus.DRAFT) {
        await tx.productionBatchCosting.update({
          where: { id: allocation.costing.id },
          data: { status: ProductionCostingStatus.DRAFT },
        });
      }

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.DELETE,
        entityType: 'ProductionOverheadAllocation',
        entityId: allocationId,
        previousState: { allocatedAmount: allocation.allocatedAmount.toString() },
        ...auditMeta,
      });

      return { deleted: true, id: allocationId };
    });
  }

  /**
   * Transitions costing from CALCULATED -> REVIEWED.
   */
  static async reviewBatchCosting(
    batchId: string,
    input: { notes?: string },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const costing = await tx.productionBatchCosting.findUnique({
        where: { productionBatchId: batchId },
      });
      if (!costing) throw new AppError('Batch costing has not been calculated yet.', 404);
      if (costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Costing is already finalized.', 400);
      }
      if (costing.status !== ProductionCostingStatus.CALCULATED) {
        throw new AppError(
          `Costing must be in CALCULATED status before review (current: ${costing.status}).`,
          400,
        );
      }

      const pendingEntries = await tx.productionCostEntry.count({
        where: {
          productionBatchCostingId: costing.id,
          approvalStatus: CostEntryApprovalStatus.PENDING,
        },
      });
      if (pendingEntries > 0) {
        throw new AppError(
          `Cannot review costing while ${pendingEntries} cost entry(ies) are still PENDING approval.`,
          400,
        );
      }

      const updated = await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: {
          status: ProductionCostingStatus.REVIEWED,
          reviewedAt: new Date(),
          reviewedById: user.userId,
          reviewNotes: input.notes ?? null,
        },
      });

      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: ProductionCostingStatus.CALCULATED,
          toStatus: ProductionCostingStatus.REVIEWED,
          action: 'REVIEW',
          changedById: user.userId,
          notes: input.notes ?? 'Reviewed batch costing',
        },
      });

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.APPROVE,
        entityType: 'ProductionBatchCosting',
        entityId: costing.id,
        newState: { status: ProductionCostingStatus.REVIEWED },
        ...auditMeta,
      });

      return updated;
    });
  }

  /**
   * Finalizes batch costing (REVIEWED -> FINALIZED) and integrates actual unit cost
   * into finished-goods InventoryBatch & MWAC valuation idempotently.
   */
  static async finalizeBatchCosting(
    batchId: string,
    input: { idempotencyKey?: string; notes?: string },
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM production_batches WHERE id = ${batchId} FOR UPDATE`;
      const costingRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text FROM production_batch_costings WHERE production_batch_id = ${batchId} FOR UPDATE
      `;
      if (costingRows.length === 0) {
        throw new AppError('Batch costing has not been calculated yet.', 404);
      }

      const costing = await tx.productionBatchCosting.findUniqueOrThrow({
        where: { id: costingRows[0].id },
        include: {
          productionBatch: {
            include: { qualityInspection: true },
          },
        },
      });

      if (
        input.idempotencyKey &&
        costing.finalizationIdempotencyKey === input.idempotencyKey
      ) {
        return costing;
      }

      if (costing.status === ProductionCostingStatus.FINALIZED) {
        throw new AppError('Batch costing is already finalized.', 400);
      }
      if (costing.status !== ProductionCostingStatus.REVIEWED) {
        throw new AppError(
          `Batch costing must be REVIEWED before finalization (current: ${costing.status}).`,
          400,
        );
      }

      const batch = costing.productionBatch;
      if (batch.status !== 'COMPLETED') {
        throw new AppError('Production batch must be COMPLETED before costing can be finalized.', 400);
      }

      const acceptedQty = new Prisma.Decimal(costing.acceptedQuantity);
      const targetUnitCost = new Prisma.Decimal(costing.costPerAcceptedUnit);
      let fgValuationAdjustmentTxId: string | null = costing.fgValuationAdjustmentTxId;
      let fgValuationApplied = costing.fgValuationApplied;
      let fgValuationUnitCost: Prisma.Decimal | null = costing.fgValuationUnitCost;
      let fgValuationAppliedAt: Date | null = costing.fgValuationAppliedAt;

      if (
        !costing.fgValuationApplied &&
        batch.finishedGoodsBatchId &&
        acceptedQty.gt(ZERO)
      ) {
        const lockedItems = await lockInventoryItems(tx, [batch.inventoryItemId]);
        const fgItem = lockedItems.get(batch.inventoryItemId);
        if (!fgItem) throw new AppError('Finished goods inventory item not found.', 404);

        const fgBatch = await tx.inventoryBatch.findUnique({
          where: { id: batch.finishedGoodsBatchId },
        });
        if (fgBatch) {
          const prevUnitCost = new Prisma.Decimal(fgBatch.unitCost);
          const costDeltaPerUnit = targetUnitCost.sub(prevUnitCost);

          await tx.inventoryBatch.update({
            where: { id: fgBatch.id },
            data: { unitCost: targetUnitCost },
          });

          const bal = await lockOrCreateBalance(tx, batch.warehouseId, fgItem.id, fgBatch.id);
          const onHand = new Prisma.Decimal(bal.quantity_on_hand);

          let effectiveBalUnitCost = targetUnitCost;
          let mwacAfter: Prisma.Decimal | null = null;

          if (fgItem.valuation_method === 'MWAC' && onHand.gt(ZERO) && !costDeltaPerUnit.isZero()) {
            const allBals = await tx.inventoryBalance.findMany({
              where: { inventoryItemId: fgItem.id },
              select: { quantityOnHand: true },
            });
            const totalStockQty = allBals.reduce((acc, b) => acc.add(b.quantityOnHand), ZERO);
            const currentMwac = new Prisma.Decimal(fgItem.moving_average_cost);
            const totalAdjustmentValue = onHand.mul(costDeltaPerUnit).toDecimalPlaces(4);
            const newMwac = totalStockQty.gt(ZERO)
              ? Prisma.Decimal.max(
                  ZERO,
                  totalStockQty.mul(currentMwac).add(totalAdjustmentValue).div(totalStockQty),
                ).toDecimalPlaces(4)
              : targetUnitCost;

            await tx.inventoryItem.update({
              where: { id: fgItem.id },
              data: { movingAverageCost: newMwac },
            });
            mwacAfter = newMwac;
            effectiveBalUnitCost = newMwac;
          }

          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: {
              unitCost: effectiveBalUnitCost,
              totalValue: onHand.mul(effectiveBalUnitCost).toDecimalPlaces(4),
              lastTransactionAt: new Date(),
            },
          });

          const valDeltaTotal = onHand.mul(costDeltaPerUnit).toDecimalPlaces(4);
          const adjTx = await tx.inventoryTransaction.create({
            data: {
              transactionNumber: generateDocNumber('TXN'),
              transactionType: valDeltaTotal.gte(ZERO)
                ? InventoryTransactionType.ADJUSTMENT_IN
                : InventoryTransactionType.ADJUSTMENT_OUT,
              referenceType: 'PRODUCTION_COSTING',
              referenceId: costing.id,
              referenceNumber: batch.batchNumber,
              idempotencyKey: `COST-FG-${costing.id}`,
              warehouseId: batch.warehouseId,
              postedById: user.userId,
              remarks: `FG cost revaluation on costing finalization (${prevUnitCost.toFixed(4)} -> ${targetUnitCost.toFixed(4)})`,
            },
          });

          await tx.inventoryTransactionLine.create({
            data: {
              transactionId: adjTx.id,
              lineNumber: 1,
              inventoryItemId: fgItem.id,
              batchId: fgBatch.id,
              uomId: batch.uomId,
              quantity: ZERO,
              baseUomId: fgItem.uom_id,
              baseQuantity: ZERO,
              unitCost: targetUnitCost,
              totalCost: valDeltaTotal,
              balanceAfter: onHand,
              mwacAfter,
            },
          });

          fgValuationAdjustmentTxId = adjTx.id;
        }

        fgValuationApplied = true;
        fgValuationUnitCost = targetUnitCost;
        fgValuationAppliedAt = new Date();
      }

      const now = new Date();
      const finalized = await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: {
          status: ProductionCostingStatus.FINALIZED,
          finalizedAt: now,
          finalizedById: user.userId,
          finalizationIdempotencyKey: input.idempotencyKey ?? `FINALIZE-${costing.id}`,
          fgValuationApplied,
          fgValuationUnitCost,
          fgValuationAdjustmentTxId,
          fgValuationAppliedAt,
        },
      });

      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: ProductionCostingStatus.REVIEWED,
          toStatus: ProductionCostingStatus.FINALIZED,
          action: 'FINALIZE',
          changedById: user.userId,
          notes: input.notes ?? 'Finalized batch costing and applied FG valuation',
          snapshot: {
            costPerAcceptedUnit: finalized.costPerAcceptedUnit.toString(),
            totalActualCost: finalized.totalActualCost.toString(),
            fgValuationApplied,
          },
        },
      });

      await tx.productionExecutionEntry.create({
        data: {
          productionBatchId: batch.id,
          entryType: ProductionExecutionEntryType.COSTING_FINALIZATION,
          notes: `Costing finalized: Unit cost ${finalized.costPerAcceptedUnit.toFixed(4)}`,
          recordedById: user.userId,
        },
      });

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.POST,
        entityType: 'ProductionBatchCosting',
        entityId: costing.id,
        newState: {
          status: ProductionCostingStatus.FINALIZED,
          costPerAcceptedUnit: finalized.costPerAcceptedUnit.toString(),
          fgValuationApplied,
        },
        ...auditMeta,
      });

      await NotificationEventsService.onProductionCostingFinalized({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        variancePercent: Number(finalized.totalVariancePercent ?? 0),
      });

      return finalized;
    });
  }

  /**
   * Records a post-finalization correction note without mutating finalized cost figures.
   */
  static async addPostFinalizationNote(
    batchId: string,
    note: string,
    user: UserContext,
    auditMeta: AuditMeta,
  ) {
    return prisma.$transaction(async tx => {
      const costing = await tx.productionBatchCosting.findUnique({
        where: { productionBatchId: batchId },
      });
      if (!costing) throw new AppError('Batch costing not found.', 404);
      if (costing.status !== ProductionCostingStatus.FINALIZED) {
        throw new AppError('Post-finalization notes only apply to FINALIZED costings.', 400);
      }

      const updatedNote = costing.postFinalizationAdjustmentNote
        ? `${costing.postFinalizationAdjustmentNote}\n[${new Date().toISOString()}] ${note}`
        : `[${new Date().toISOString()}] ${note}`;

      const updated = await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: { postFinalizationAdjustmentNote: updatedNote },
      });

      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: ProductionCostingStatus.FINALIZED,
          toStatus: ProductionCostingStatus.FINALIZED,
          action: 'POST_FINALIZATION_NOTE',
          changedById: user.userId,
          notes: note,
        },
      });

      await AuditService.log({
        userId: user.userId,
        action: AuditAction.UPDATE,
        entityType: 'ProductionBatchCosting',
        entityId: costing.id,
        newState: { postFinalizationAdjustmentNote: note },
        ...auditMeta,
      });

      return updated;
    });
  }

  /**
   * Hook called when material returns or quality decisions occur after costing finalization.
   */
  static async recordPostFinalizationEventInTx(
    tx: Prisma.TransactionClient,
    batchId: string,
    eventNote: string,
    userId: string,
  ) {
    const costing = await tx.productionBatchCosting.findUnique({
      where: { productionBatchId: batchId },
    });
    if (!costing) return;

    if (costing.status === ProductionCostingStatus.FINALIZED) {
      const updatedNote = costing.postFinalizationAdjustmentNote
        ? `${costing.postFinalizationAdjustmentNote}\n[${new Date().toISOString()}] ${eventNote}`
        : `[${new Date().toISOString()}] ${eventNote}`;

      await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: { postFinalizationAdjustmentNote: updatedNote },
      });
      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: ProductionCostingStatus.FINALIZED,
          toStatus: ProductionCostingStatus.FINALIZED,
          action: 'POST_FINALIZATION_EVENT',
          changedById: userId,
          notes: eventNote,
        },
      });
    } else if (costing.status !== ProductionCostingStatus.DRAFT) {
      await tx.productionBatchCosting.update({
        where: { id: costing.id },
        data: { status: ProductionCostingStatus.DRAFT },
      });
      await tx.productionCostingHistory.create({
        data: {
          productionBatchCostingId: costing.id,
          fromStatus: costing.status,
          toStatus: ProductionCostingStatus.DRAFT,
          action: 'SOURCE_CHANGED',
          changedById: userId,
          notes: `${eventNote} — costing moved to DRAFT for recalculation.`,
        },
      });
    }
  }

  static async getDashboard() {
    const [costings, totalBatches, pendingApprovals] = await Promise.all([
      prisma.productionBatchCosting.findMany({
        include: {
          productionBatch: {
            select: {
              id: true,
              batchNumber: true,
              status: true,
              productVariant: { select: { name: true, sku: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.productionBatch.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.productionCostEntry.count({
        where: { approvalStatus: CostEntryApprovalStatus.PENDING },
      }),
    ]);

    let totalActualCost = ZERO;
    let totalStandardCost = ZERO;
    let totalVarianceAmount = ZERO;
    let totalWastageCost = ZERO;
    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      CALCULATED: 0,
      REVIEWED: 0,
      FINALIZED: 0,
    };

    for (const c of costings) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      if (c.status !== ProductionCostingStatus.DRAFT) {
        totalActualCost = totalActualCost.add(c.totalActualCost);
        totalStandardCost = totalStandardCost.add(c.standardTotalCost);
        totalVarianceAmount = totalVarianceAmount.add(c.totalVarianceAmount);
        totalWastageCost = totalWastageCost.add(c.wastageAndRejectionCost);
      }
    }

    const totalVariancePercent = totalStandardCost.gt(ZERO)
      ? totalVarianceAmount.div(totalStandardCost).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;

    return {
      totalBatches,
      costedBatchesCount: costings.length,
      pendingCostEntryApprovals: pendingApprovals,
      statusCounts,
      totalStandardCost: totalStandardCost.toFixed(2),
      totalActualCost: totalActualCost.toFixed(2),
      totalVarianceAmount: totalVarianceAmount.toFixed(2),
      totalVariancePercent: totalVariancePercent.toFixed(2),
      totalWastageCost: totalWastageCost.toFixed(2),
      recentCostings: costings.slice(0, 10),
    };
  }

  static async listBatchCostings(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    workOrderId?: string;
    productVariantId?: string;
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ProductionBatchWhereInput = {
      status: { not: 'CANCELLED' },
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(query.status
        ? { costing: { is: { status: query.status as ProductionCostingStatus } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { batchNumber: { contains: query.search, mode: 'insensitive' } },
              { productVariant: { name: { contains: query.search, mode: 'insensitive' } } },
              { workOrder: { workOrderNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workOrder: { select: { id: true, workOrderNumber: true } },
          productVariant: { select: { id: true, sku: true, name: true } },
          uom: { select: { id: true, code: true, symbol: true } },
          costing: true,
        },
      }),
      prisma.productionBatch.count({ where }),
    ]);

    return paginatedResult(rows, total, query.page, query.limit);
  }

  static async getBatchCostingDetail(batchId: string) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        workOrder: { select: { id: true, workOrderNumber: true, status: true } },
        product: { select: { id: true, name: true, code: true } },
        productVariant: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        uom: { select: { id: true, code: true, symbol: true } },
        bom: { select: { id: true, code: true, name: true } },
        bomVersion: {
          include: { overheads: true },
        },
        qualityInspection: true,
        finishedGoodsBatch: {
          select: { id: true, batchNumber: true, unitCost: true, qualityStatus: true },
        },
        costing: {
          include: {
            calculatedBy: { select: { id: true, fullName: true, username: true } },
            reviewedBy: { select: { id: true, fullName: true, username: true } },
            finalizedBy: { select: { id: true, fullName: true, username: true } },
            costEntries: {
              include: {
                recordedBy: { select: { id: true, fullName: true, username: true } },
                approvedBy: { select: { id: true, fullName: true, username: true } },
              },
              orderBy: { recordedAt: 'desc' },
            },
            overheadAllocations: {
              include: {
                recordedBy: { select: { id: true, fullName: true, username: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            history: {
              include: {
                changedBy: { select: { id: true, fullName: true, username: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);

    const materialBreakdown = await this.buildMaterialBreakdown(prisma, batch.id);

    return {
      batch,
      costing: batch.costing,
      materialBreakdown,
    };
  }

  static async getVarianceReport(query: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    productVariantId?: string;
  }) {
    const where: Prisma.ProductionBatchCostingWhereInput = {
      ...(query.status
        ? { status: query.status as ProductionCostingStatus }
        : { status: { not: ProductionCostingStatus.DRAFT } }),
      ...(query.productVariantId
        ? { productionBatch: { productVariantId: query.productVariantId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            calculatedAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.productionBatchCosting.findMany({
      where,
      include: {
        productionBatch: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
            completedAt: true,
            productVariant: { select: { id: true, sku: true, name: true } },
            uom: { select: { symbol: true } },
          },
        },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    let sumStandard = ZERO;
    let sumActual = ZERO;
    let sumMaterialVar = ZERO;
    let sumLabourVar = ZERO;
    let sumOverheadVar = ZERO;
    let sumTotalVar = ZERO;

    for (const r of rows) {
      sumStandard = sumStandard.add(r.standardTotalCost);
      sumActual = sumActual.add(r.totalActualCost);
      sumMaterialVar = sumMaterialVar.add(r.materialVarianceAmount);
      sumLabourVar = sumLabourVar.add(r.labourVarianceAmount);
      sumOverheadVar = sumOverheadVar.add(r.overheadVarianceAmount);
      sumTotalVar = sumTotalVar.add(r.totalVarianceAmount);
    }

    return {
      summary: {
        batchCount: rows.length,
        standardTotalCost: sumStandard.toFixed(2),
        actualTotalCost: sumActual.toFixed(2),
        materialVarianceAmount: sumMaterialVar.toFixed(2),
        labourVarianceAmount: sumLabourVar.toFixed(2),
        overheadVarianceAmount: sumOverheadVar.toFixed(2),
        totalVarianceAmount: sumTotalVar.toFixed(2),
        totalVariancePercent: sumStandard.gt(ZERO)
          ? sumTotalVar.div(sumStandard).mul(HUNDRED).toDecimalPlaces(2).toFixed(2)
          : '0.00',
      },
      rows,
    };
  }
}
