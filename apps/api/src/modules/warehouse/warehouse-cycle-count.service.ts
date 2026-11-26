import {
  AbcClass,
  AuditAction,
  CycleCountFrequency,
  CycleCountPlanStatus,
  Prisma,
  StockAuditStatus,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';

function computeNextRunDate(from: Date, frequency: CycleCountFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'ANNUAL':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export class WarehouseCycleCountService {
  static async listPlans(filters: { warehouseId?: string; status?: CycleCountPlanStatus }, user: UserContext) {
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.cycleCountPlan.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: [{ nextRunDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async createPlan(
    input: {
      name: string;
      warehouseId: string;
      abcClass?: AbcClass | null;
      frequency: CycleCountFrequency;
      isBlindCount?: boolean;
      binId?: string | null;
      assignedToId?: string | null;
      nextRunDate: string;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    if (input.binId) {
      const bin = await prisma.warehouseBin.findUnique({ where: { id: input.binId } });
      if (!bin || bin.warehouseId !== input.warehouseId) {
        throw new AppError('Specified bin does not belong to the warehouse.', 400);
      }
    }

    const plan = await prisma.cycleCountPlan.create({
      data: {
        planNumber: generateDocNumber('CCP'),
        name: input.name,
        warehouseId: input.warehouseId,
        abcClass: input.abcClass ?? null,
        frequency: input.frequency,
        isBlindCount: Boolean(input.isBlindCount),
        binId: input.binId ?? null,
        assignedToId: input.assignedToId ?? null,
        nextRunDate: new Date(input.nextRunDate),
        createdById: user.userId,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'CycleCountPlan',
      entityId: plan.id,
      newState: { planNumber: plan.planNumber, frequency: plan.frequency },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return plan;
  }

  static async updatePlanStatus(
    id: string,
    status: CycleCountPlanStatus,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.cycleCountPlan.findUnique({ where: { id } });
    if (!existing) throw new AppError('Cycle count plan not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    const updated = await prisma.cycleCountPlan.update({
      where: { id },
      data: { status },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'CycleCountPlan',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Generate an official StockAudit session from a CycleCountPlan (or bin-specific snapshot).
   * Extends existing StockAudit without creating a parallel stock correction system.
   */
  static async generateCycleCountAudit(planId: string, user: UserContext, meta: AuditMeta) {
    const plan = await prisma.cycleCountPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError('Cycle count plan not found.', 404);
    await assertWarehouseAccess(user, plan.warehouseId, 'READ_WRITE');

    // Pull bin allocations if binId is set, else pull warehouse InventoryBalances
    const linesData: Array<{
      lineNumber: number;
      inventoryItemId: string;
      batchId: string | null;
      uomId: string;
      binId: string | null;
      expectedBaseQuantity: Prisma.Decimal;
      countedBaseQuantity: Prisma.Decimal;
      varianceBaseQuantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      varianceValue: Prisma.Decimal;
    }> = [];

    if (plan.binId) {
      const allocs = await prisma.binStockAllocation.findMany({
        where: { warehouseId: plan.warehouseId, binId: plan.binId, quantity: { gt: 0 } },
        include: {
          inventoryItem: { select: { id: true, uomId: true, movingAverageCost: true } },
          batch: { select: { unitCost: true } },
        },
      });
      allocs.forEach((a, idx) => {
        const unitCost = a.batch?.unitCost ?? a.inventoryItem.movingAverageCost;
        linesData.push({
          lineNumber: idx + 1,
          inventoryItemId: a.inventoryItemId,
          batchId: a.batchId,
          uomId: a.inventoryItem.uomId,
          binId: a.binId,
          expectedBaseQuantity: new Prisma.Decimal(a.quantity),
          countedBaseQuantity: new Prisma.Decimal(a.quantity),
          varianceBaseQuantity: ZERO,
          unitCost: new Prisma.Decimal(unitCost),
          varianceValue: ZERO,
        });
      });
    } else {
      const balances = await prisma.inventoryBalance.findMany({
        where: { warehouseId: plan.warehouseId, quantityOnHand: { gt: 0 } },
        include: { inventoryItem: { select: { id: true, uomId: true } } },
        orderBy: { totalValue: 'desc' },
      });

      // ABC segmentation by value if abcClass is configured
      let selected = balances;
      if (plan.abcClass && balances.length > 0) {
        const total = balances.length;
        const aCut = Math.max(1, Math.ceil(total * 0.2));
        const bCut = Math.max(aCut, Math.ceil(total * 0.5));
        if (plan.abcClass === 'A') selected = balances.slice(0, aCut);
        else if (plan.abcClass === 'B') selected = balances.slice(aCut, bCut);
        else selected = balances.slice(bCut);
      }

      selected.forEach((b, idx) => {
        linesData.push({
          lineNumber: idx + 1,
          inventoryItemId: b.inventoryItemId,
          batchId: b.batchId,
          uomId: b.inventoryItem.uomId,
          binId: null,
          expectedBaseQuantity: new Prisma.Decimal(b.quantityOnHand),
          countedBaseQuantity: new Prisma.Decimal(b.quantityOnHand),
          varianceBaseQuantity: ZERO,
          unitCost: new Prisma.Decimal(b.unitCost),
          varianceValue: ZERO,
        });
      });
    }

    if (linesData.length === 0) {
      throw new AppError('No active stock lines found for this cycle count scope.', 400);
    }

    const audit = await prisma.$transaction(async tx => {
      const created = await tx.stockAudit.create({
        data: {
          auditNumber: generateDocNumber('CC'),
          warehouseId: plan.warehouseId,
          status: StockAuditStatus.DRAFT,
          notes: `Cycle count generated from plan ${plan.planNumber} (${plan.name})`,
          cycleCountPlanId: plan.id,
          binId: plan.binId,
          isBlindCount: plan.isBlindCount,
          assignedToId: plan.assignedToId,
          createdById: user.userId,
          lines: { create: linesData },
        },
        include: { lines: true },
      });

      await tx.cycleCountPlan.update({
        where: { id: plan.id },
        data: {
          lastRunDate: new Date(),
          nextRunDate: computeNextRunDate(new Date(), plan.frequency),
        },
      });

      return created;
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'StockAudit',
      entityId: audit.id,
      newState: { auditNumber: audit.auditNumber, cycleCountPlanId: plan.id, isBlindCount: plan.isBlindCount },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Mask expected quantities if blind count while in DRAFT
    if (audit.isBlindCount) {
      return {
        ...audit,
        lines: audit.lines.map(l => ({ ...l, expectedBaseQuantity: null, varianceBaseQuantity: null })),
      };
    }
    return audit;
  }

  /**
   * Record first count or recount on an existing DRAFT StockAudit.
   */
  static async recordCount(
    auditId: string,
    input: {
      isRecount: boolean;
      lines: Array<{ lineId: string; countedQuantity: string; investigationNotes?: string }>;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: { lines: true },
    });
    if (!audit) throw new AppError('Stock audit not found.', 404);
    await assertWarehouseAccess(user, audit.warehouseId, 'READ_WRITE');

    if (audit.status !== 'DRAFT') {
      throw new AppError(`Counts can only be recorded on DRAFT audits (current: ${audit.status}).`, 400);
    }

    const lineMap = new Map(audit.lines.map(l => [l.id, l]));

    const updated = await prisma.$transaction(async tx => {
      for (const item of input.lines) {
        const line = lineMap.get(item.lineId);
        if (!line) throw new AppError(`Audit line ${item.lineId} not found.`, 404);

        const counted = new Prisma.Decimal(item.countedQuantity);
        const variance = counted.sub(line.expectedBaseQuantity);
        const varianceVal = variance.mul(line.unitCost).toDecimalPlaces(2);

        await tx.stockAuditLine.update({
          where: { id: line.id },
          data: {
            ...(input.isRecount
              ? {
                  recountQuantity: counted,
                  recountById: user.userId,
                  recountedAt: new Date(),
                }
              : {
                  firstCountQuantity: counted,
                }),
            countedBaseQuantity: counted,
            varianceBaseQuantity: variance,
            varianceValue: varianceVal,
            ...(item.investigationNotes ? { investigationNotes: item.investigationNotes } : {}),
          },
        });
      }

      if (input.isRecount) {
        await tx.stockAudit.update({
          where: { id: auditId },
          data: { recountRequired: false },
        });
      }

      return tx.stockAudit.findUniqueOrThrow({
        where: { id: auditId },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'StockAudit',
      entityId: auditId,
      remarks: input.isRecount ? 'Cycle recount recorded' : 'Cycle first count recorded',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async investigateVariance(
    auditId: string,
    input: { lineId: string; investigationNotes: string; recountRequired: boolean },
    user: UserContext,
  ) {
    const audit = await prisma.stockAudit.findUnique({ where: { id: auditId } });
    if (!audit) throw new AppError('Stock audit not found.', 404);
    await assertWarehouseAccess(user, audit.warehouseId, 'READ_WRITE');

    await prisma.$transaction(async tx => {
      await tx.stockAuditLine.update({
        where: { id: input.lineId },
        data: { investigationNotes: input.investigationNotes },
      });
      if (input.recountRequired) {
        await tx.stockAudit.update({
          where: { id: auditId },
          data: { recountRequired: true },
        });
      }
    });

    return prisma.stockAudit.findUniqueOrThrow({
      where: { id: auditId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
  }

  // ---------------------------------------------------------------------------
  // WAREHOUSE ANALYTICS (100% DB-BACKED)
  // ---------------------------------------------------------------------------

  static async getWarehouseAnalytics(warehouseId: string, user: UserContext) {
    await assertWarehouseAccess(user, warehouseId, 'READ');

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [bins, allocations, movements7d, movements30d, audits] = await Promise.all([
      prisma.warehouseBin.findMany({
        where: { warehouseId },
        include: { allocations: { where: { quantity: { gt: 0 } } } },
      }),
      prisma.binStockAllocation.findMany({
        where: { warehouseId, quantity: { gt: 0 } },
        include: {
          bin: { select: { id: true, code: true, name: true } },
          inventoryItem: { select: { id: true, code: true, name: true, movingAverageCost: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true, unitCost: true } },
        },
      }),
      prisma.binMovement.groupBy({
        by: ['movementType'],
        where: { warehouseId, createdAt: { gte: last7Days } },
        _count: true,
      }),
      prisma.binMovement.groupBy({
        by: ['movementType'],
        where: { warehouseId, createdAt: { gte: last30Days } },
        _count: true,
      }),
      prisma.stockAudit.findMany({
        where: { warehouseId },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    const activeBins = bins.filter(b => b.isActive);
    const emptyBins = activeBins.filter(b => b.allocations.length === 0);
    let totalCapacity = ZERO;
    let totalUsed = ZERO;

    for (const b of activeBins) {
      totalCapacity = totalCapacity.add(b.capacityQuantity);
      for (const a of b.allocations) {
        totalUsed = totalUsed.add(a.quantity);
      }
    }

    const utilizationPercent = totalCapacity.gt(0)
      ? Number(totalUsed.div(totalCapacity).mul(100).toFixed(1))
      : 0;

    const stockByLocationMap = new Map<
      string,
      { binId: string; binCode: string; quantity: Prisma.Decimal; value: Prisma.Decimal }
    >();
    const expiryRiskByLocation: Array<{
      binId: string;
      binCode: string;
      itemCode: string;
      batchNumber: string;
      expiryDate: Date;
      quantity: string;
    }> = [];

    for (const a of allocations) {
      const unitCost = a.batch?.unitCost ?? a.inventoryItem.movingAverageCost;
      const val = new Prisma.Decimal(a.quantity).mul(unitCost);
      const existing = stockByLocationMap.get(a.binId) ?? {
        binId: a.binId,
        binCode: a.bin.code,
        quantity: ZERO,
        value: ZERO,
      };
      existing.quantity = existing.quantity.add(a.quantity);
      existing.value = existing.value.add(val);
      stockByLocationMap.set(a.binId, existing);

      if (a.batch?.expiryDate && a.batch.expiryDate <= in30Days) {
        expiryRiskByLocation.push({
          binId: a.binId,
          binCode: a.bin.code,
          itemCode: a.inventoryItem.code,
          batchNumber: a.batch.batchNumber,
          expiryDate: a.batch.expiryDate,
          quantity: a.quantity.toString(),
        });
      }
    }

    let totalAuditLines = 0;
    let accurateAuditLines = 0;
    let totalVarianceValue = ZERO;

    for (const audit of audits) {
      for (const line of audit.lines) {
        totalAuditLines += 1;
        if (new Prisma.Decimal(line.varianceBaseQuantity).isZero()) {
          accurateAuditLines += 1;
        }
        totalVarianceValue = totalVarianceValue.add(line.varianceValue);
      }
    }

    const pickingAccuracyPercent =
      totalAuditLines > 0 ? Number(((accurateAuditLines / totalAuditLines) * 100).toFixed(1)) : 100;

    return {
      warehouseId,
      locationUtilization: {
        totalBins: bins.length,
        activeBins: activeBins.length,
        occupiedBins: activeBins.length - emptyBins.length,
        emptyBinsCount: emptyBins.length,
        totalCapacity: totalCapacity.toString(),
        totalUsed: totalUsed.toString(),
        utilizationPercent,
      },
      emptyBins: emptyBins.map(b => ({ id: b.id, code: b.code, name: b.name, locationType: b.locationType })),
      stockByLocation: Array.from(stockByLocationMap.values()).map(s => ({
        binId: s.binId,
        binCode: s.binCode,
        quantity: s.quantity.toString(),
        value: s.value.toFixed(2),
      })),
      batchLocationDistributionCount: allocations.filter(a => a.batchId !== null).length,
      pickingAccuracyPercent,
      cycleCountVariance: {
        auditsCount: audits.length,
        totalLines: totalAuditLines,
        accurateLines: accurateAuditLines,
        netVarianceValue: totalVarianceValue.toFixed(2),
      },
      expiryRiskByLocation,
      movementVolume: {
        last7Days: movements7d.map(m => ({ type: m.movementType, count: m._count })),
        last30Days: movements30d.map(m => ({ type: m.movementType, count: m._count })),
      },
    };
  }
}
