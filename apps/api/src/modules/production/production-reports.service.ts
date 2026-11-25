import {
  InspectionDecision,
  Prisma,
  ProductionBatchStatus,
  ProductionCostingStatus,
  ProductionPlanStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { paginatedResult } from '../master-data/master-data.utils';
import { ZERO } from '../inventory/inventory.utils';
import { getIndianFinancialYear } from '../sales/sales-invoice.service';
import { BaseReportQuery, TrendsQuery } from './production-reports.types';

const HUNDRED = new Prisma.Decimal(100);

export interface DateRangeWindow {
  period: string;
  financialYear: string;
  fromDate: Date;
  toDate: Date;
}

/**
 * Resolves consistent date range boundaries including Indian FY (April 1 - March 31).
 */
export function resolveReportDateRange(query: {
  period?: string;
  fromDate?: string;
  toDate?: string;
}): DateRangeWindow {
  const now = new Date();
  const period = query.period || (query.fromDate || query.toDate ? 'custom' : 'month');
  const fy = getIndianFinancialYear(now);

  let fromDate: Date;
  let toDate: Date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  if (period === 'custom' || query.fromDate || query.toDate) {
    fromDate = query.fromDate
      ? new Date(`${query.fromDate}T00:00:00.000Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    if (query.toDate) {
      toDate = new Date(`${query.toDate}T23:59:59.999Z`);
    }
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new AppError('Invalid fromDate or toDate filter.', 400);
    }
    if (fromDate > toDate) {
      throw new AppError('fromDate cannot be after toDate.', 400);
    }
    return { period: 'custom', financialYear: getIndianFinancialYear(fromDate), fromDate, toDate };
  }

  switch (period) {
    case 'today': {
      fromDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
      );
      break;
    }
    case 'week': {
      const day = now.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      fromDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0),
      );
      break;
    }
    case 'fy': {
      const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      fromDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
      toDate = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999));
      break;
    }
    case 'month':
    default: {
      fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      break;
    }
  }

  return { period, financialYear: fy, fromDate, toDate };
}

function getAcceptedQtyForBatch(batch: {
  status: ProductionBatchStatus;
  actualGoodQuantity: Prisma.Decimal;
  rejectedQuantity: Prisma.Decimal;
  qualityInspection?: {
    decision: InspectionDecision;
    goodQuantity: Prisma.Decimal;
    rejectedQuantity: Prisma.Decimal;
    inspectedQuantity: Prisma.Decimal;
  } | null;
}): { accepted: Prisma.Decimal; rejected: Prisma.Decimal } {
  const good = new Prisma.Decimal(batch.actualGoodQuantity);
  let rejected = new Prisma.Decimal(batch.rejectedQuantity);
  const qi = batch.qualityInspection;

  if (!qi) {
    return { accepted: good, rejected };
  }
  if (qi.decision === InspectionDecision.ACCEPTED) {
    return { accepted: good, rejected };
  }
  if (qi.decision === InspectionDecision.PARTIALLY_ACCEPTED) {
    return {
      accepted: new Prisma.Decimal(qi.goodQuantity),
      rejected: rejected.add(qi.rejectedQuantity),
    };
  }
  if (qi.decision === InspectionDecision.REJECTED) {
    return {
      accepted: ZERO,
      rejected: rejected.add(qi.inspectedQuantity),
    };
  }
  // PENDING or QUARANTINED are not accepted available stock
  return { accepted: ZERO, rejected };
}

function buildVariantFilter(query: BaseReportQuery): Prisma.ProductVariantWhereInput | undefined {
  if (!query.productId && !query.productCategoryId) return undefined;
  return {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.productCategoryId
      ? { product: { is: { categoryId: query.productCategoryId } } }
      : {}),
  };
}

function sortRows<T>(rows: T[], sortOrder: 'asc' | 'desc', getter: (row: T) => string | number): T[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb)) * dir;
  });
}

export class ProductionReportsService {
  /**
   * 1. Production Analytics Dashboard KPIs.
   */
  static async getDashboard(query: BaseReportQuery, includeCosting: boolean) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const planWhere: Prisma.ProductionPlanWhereInput = {
      planDate: { gte: range.fromDate, lte: range.toDate },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId || variantWhere
        ? {
            items: {
              some: {
                ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
                ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
              },
            },
          }
        : {}),
    };

    const woWhere: Prisma.WorkOrderWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
    };

    const batchWhere: Prisma.ProductionBatchWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
    };

    const [plans, workOrders, batches] = await Promise.all([
      prisma.productionPlan.findMany({
        where: planWhere,
        select: { id: true, status: true },
      }),
      prisma.workOrder.findMany({
        where: woWhere,
        select: { id: true, status: true },
      }),
      prisma.productionBatch.findMany({
        where: batchWhere,
        include: {
          qualityInspection: {
            select: {
              decision: true,
              goodQuantity: true,
              rejectedQuantity: true,
              inspectedQuantity: true,
            },
          },
          consumptions: { select: { baseQuantity: true } },
          returns: { select: { baseQuantity: true } },
          costing: includeCosting
            ? {
                select: {
                  status: true,
                  totalActualCost: true,
                  totalVarianceAmount: true,
                  acceptedQuantity: true,
                  goodOutputCost: true,
                },
              }
            : false,
        },
      }),
    ]);

    const totalPlans = plans.length;
    const pendingPlans = plans.filter(p =>
      ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(p.status),
    ).length;

    const totalWorkOrders = workOrders.length;
    const activeWorkOrders = workOrders.filter(w =>
      ['RELEASED', 'IN_PROGRESS'].includes(w.status),
    ).length;
    const completedWorkOrders = workOrders.filter(w => w.status === 'COMPLETED').length;

    const nonCancelledBatches = batches.filter(b => b.status !== ProductionBatchStatus.CANCELLED);
    const totalBatches = batches.length;
    const inProgressBatches = batches.filter(b =>
      ['IN_PROGRESS', 'PAUSED'].includes(b.status),
    ).length;
    const completedBatches = batches.filter(b => b.status === ProductionBatchStatus.COMPLETED).length;

    let plannedQty = ZERO;
    let actualProducedQty = ZERO;
    let acceptedFgQty = ZERO;
    let rejectedQty = ZERO;
    let wastageQty = ZERO;
    let totalNetMaterialQty = ZERO;

    let totalActualCost = ZERO;
    let totalCostVariance = ZERO;
    let finalizedCostedAcceptedQty = ZERO;
    let finalizedGoodOutputCost = ZERO;

    for (const b of nonCancelledBatches) {
      plannedQty = plannedQty.add(b.plannedQuantity);
      actualProducedQty = actualProducedQty.add(b.actualGoodQuantity);
      wastageQty = wastageQty.add(b.wastageQuantity);

      const q = getAcceptedQtyForBatch(b);
      acceptedFgQty = acceptedFgQty.add(q.accepted);
      rejectedQty = rejectedQty.add(q.rejected);

      const consumed = b.consumptions.reduce((acc, c) => acc.add(c.baseQuantity), ZERO);
      const returned = b.returns.reduce((acc, r) => acc.add(r.baseQuantity), ZERO);
      totalNetMaterialQty = totalNetMaterialQty.add(consumed.sub(returned));

      if (includeCosting && b.costing && b.costing.status !== ProductionCostingStatus.DRAFT) {
        totalActualCost = totalActualCost.add(b.costing.totalActualCost);
        totalCostVariance = totalCostVariance.add(b.costing.totalVarianceAmount);
        if (b.costing.status === ProductionCostingStatus.FINALIZED) {
          finalizedCostedAcceptedQty = finalizedCostedAcceptedQty.add(b.costing.acceptedQuantity);
          finalizedGoodOutputCost = finalizedGoodOutputCost.add(b.costing.goodOutputCost);
        }
      }
    }

    const totalOutputPlusLoss = actualProducedQty.add(rejectedQty).add(wastageQty);
    const overallYieldPercent = totalOutputPlusLoss.gt(ZERO)
      ? actualProducedQty.div(totalOutputPlusLoss).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;
    const materialWastagePercent = totalOutputPlusLoss.gt(ZERO)
      ? wastageQty.div(totalOutputPlusLoss).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;

    const avgCostPerAcceptedUnit = finalizedCostedAcceptedQty.gt(ZERO)
      ? finalizedGoodOutputCost.div(finalizedCostedAcceptedQty).toDecimalPlaces(4)
      : acceptedFgQty.gt(ZERO) && totalActualCost.gt(ZERO)
        ? totalActualCost.div(acceptedFgQty).toDecimalPlaces(4)
        : ZERO;

    return {
      dateRange: {
        period: range.period,
        financialYear: range.financialYear,
        fromDate: range.fromDate.toISOString(),
        toDate: range.toDate.toISOString(),
      },
      kpis: {
        totalProductionPlans: totalPlans,
        pendingProductionPlans: pendingPlans,
        totalWorkOrders,
        activeWorkOrders,
        completedWorkOrders,
        totalProductionBatches: totalBatches,
        batchesInProgress: inProgressBatches,
        completedBatches,
        plannedProductionQuantity: plannedQty.toFixed(4),
        actualProducedQuantity: actualProducedQty.toFixed(4),
        acceptedFinishedGoodsQuantity: acceptedFgQty.toFixed(4),
        rejectedQuantity: rejectedQty.toFixed(4),
        overallYieldPercentage: overallYieldPercent.toFixed(2),
        materialWastagePercentage: materialWastagePercent.toFixed(2),
        costAccess: includeCosting,
        totalActualProductionCost: includeCosting ? totalActualCost.toFixed(2) : null,
        averageCostPerAcceptedUnit: includeCosting ? avgCostPerAcceptedUnit.toFixed(4) : null,
        productionCostVariance: includeCosting ? totalCostVariance.toFixed(2) : null,
      },
    };
  }

  /**
   * 2. Production Plan vs Actual Report.
   */
  static async getPlanVsActualReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const where: Prisma.ProductionPlanWhereInput = {
      planDate: { gte: range.fromDate, lte: range.toDate },
      ...(query.productionPlanId ? { id: query.productionPlanId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status as ProductionPlanStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { planNumber: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.productVariantId || variantWhere
        ? {
            items: {
              some: {
                ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
                ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
              },
            },
          }
        : {}),
    };

    const plans = await prisma.productionPlan.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            productVariant: {
              include: { product: { select: { id: true, code: true, name: true } } },
            },
            uom: { select: { symbol: true } },
          },
        },
        workOrders: {
          include: {
            productionBatches: {
              include: {
                qualityInspection: {
                  select: {
                    decision: true,
                    goodQuantity: true,
                    rejectedQuantity: true,
                    inspectedQuantity: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { planDate: 'desc' },
    });

    const rows = [];
    const productSummaryMap = new Map<
      string,
      {
        productVariantId: string;
        sku: string;
        productName: string;
        plannedQuantity: Prisma.Decimal;
        actualProducedQuantity: Prisma.Decimal;
        acceptedQuantity: Prisma.Decimal;
      }
    >();

    for (const plan of plans) {
      for (const item of plan.items) {
        if (query.productVariantId && item.productVariantId !== query.productVariantId) continue;
        if (query.productId && item.productVariant.productId !== query.productId) continue;

        const matchingWos = plan.workOrders.filter(
          w => w.productionPlanItemId === item.id && w.status !== WorkOrderStatus.CANCELLED,
        );
        const allBatches = matchingWos.flatMap(w =>
          w.productionBatches.filter(b => b.status !== ProductionBatchStatus.CANCELLED),
        );

        let actualProduced = ZERO;
        let acceptedQty = ZERO;
        let rejectedQty = ZERO;
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        for (const b of allBatches) {
          actualProduced = actualProduced.add(b.actualGoodQuantity);
          const q = getAcceptedQtyForBatch(b);
          acceptedQty = acceptedQty.add(q.accepted);
          rejectedQty = rejectedQty.add(q.rejected);
          if (b.startedAt && (!startDate || b.startedAt < startDate)) startDate = b.startedAt;
          if (b.completedAt && (!endDate || b.completedAt > endDate)) endDate = b.completedAt;
        }

        const planned = new Prisma.Decimal(item.plannedQuantity);
        const remaining = Prisma.Decimal.max(ZERO, planned.sub(actualProduced));
        const completionPercent = planned.gt(ZERO)
          ? actualProduced.div(planned).mul(HUNDRED).toDecimalPlaces(2)
          : ZERO;

        let varianceClassification: 'ON_TARGET' | 'UNDERPRODUCED' | 'OVERPRODUCED' | 'CANCELLED' =
          'ON_TARGET';
        if (plan.status === ProductionPlanStatus.CANCELLED) {
          varianceClassification = 'CANCELLED';
        } else if (actualProduced.lt(planned)) {
          varianceClassification = 'UNDERPRODUCED';
        } else if (actualProduced.gt(planned)) {
          varianceClassification = 'OVERPRODUCED';
        }

        rows.push({
          planId: plan.id,
          planNumber: plan.planNumber,
          planName: plan.name,
          planDate: plan.planDate.toISOString(),
          planStatus: plan.status,
          warehouseName: plan.warehouse.name,
          productId: item.productVariant.product.id,
          productName: item.productVariant.product.name,
          productVariantId: item.productVariantId,
          sku: item.productVariant.sku,
          variantName: item.productVariant.name,
          uomSymbol: item.uom.symbol,
          plannedQuantity: planned.toFixed(4),
          workOrderedQuantity: new Prisma.Decimal(item.workOrderedQuantity).toFixed(4),
          actualProducedQuantity: actualProduced.toFixed(4),
          acceptedQuantity: acceptedQty.toFixed(4),
          rejectedQuantity: rejectedQty.toFixed(4),
          remainingQuantity: remaining.toFixed(4),
          completionPercent: completionPercent.toFixed(2),
          varianceClassification,
          startedAt: startDate ? startDate.toISOString() : null,
          completedAt: endDate ? endDate.toISOString() : null,
        });

        const pSum = productSummaryMap.get(item.productVariantId) ?? {
          productVariantId: item.productVariantId,
          sku: item.productVariant.sku,
          productName: `${item.productVariant.product.name} (${item.productVariant.name})`,
          plannedQuantity: ZERO,
          actualProducedQuantity: ZERO,
          acceptedQuantity: ZERO,
        };
        if (plan.status !== ProductionPlanStatus.CANCELLED) {
          pSum.plannedQuantity = pSum.plannedQuantity.add(planned);
          pSum.actualProducedQuantity = pSum.actualProducedQuantity.add(actualProduced);
          pSum.acceptedQuantity = pSum.acceptedQuantity.add(acceptedQty);
        }
        productSummaryMap.set(item.productVariantId, pSum);
      }
    }

    const sorted = sortRows(rows, query.sortOrder, r => {
      if (query.sortBy === 'completionPercent') return Number(r.completionPercent);
      if (query.sortBy === 'plannedQuantity') return Number(r.plannedQuantity);
      return r.planDate;
    });

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    const paged = sorted.slice(skip, skip + query.limit);

    return {
      ...paginatedResult(paged, total, query.page, query.limit),
      productSummary: Array.from(productSummaryMap.values()).map(p => ({
        ...p,
        plannedQuantity: p.plannedQuantity.toFixed(4),
        actualProducedQuantity: p.actualProducedQuantity.toFixed(4),
        acceptedQuantity: p.acceptedQuantity.toFixed(4),
      })),
    };
  }

  /**
   * 3. Work Order Performance Report.
   */
  static async getWorkOrderPerformanceReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const where: Prisma.WorkOrderWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.workOrderId ? { id: query.workOrderId } : {}),
      ...(query.productionPlanId ? { productionPlanId: query.productionPlanId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(query.status ? { status: query.status as WorkOrderStatus } : {}),
      ...(query.priority ? { priority: query.priority as WorkOrderPriority } : {}),
      ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
      ...(query.search
        ? {
            OR: [
              { workOrderNumber: { contains: query.search, mode: 'insensitive' } },
              { productionPlan: { planNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const wos = await prisma.workOrder.findMany({
      where,
      include: {
        productionPlan: { select: { id: true, planNumber: true } },
        productVariant: { include: { product: { select: { name: true } } } },
        warehouse: { select: { id: true, name: true } },
        uom: { select: { symbol: true } },
        productionBatches: {
          select: { id: true, status: true, startedAt: true, completedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const rows = wos.map(wo => {
      const startDates = wo.productionBatches
        .map(b => b.startedAt)
        .filter((d): d is Date => Boolean(d));
      const endDates = wo.productionBatches
        .map(b => b.completedAt)
        .filter((d): d is Date => Boolean(d));

      const actualStart =
        startDates.length > 0 ? new Date(Math.min(...startDates.map(d => d.getTime()))) : wo.releasedAt;
      const actualEnd =
        wo.status === WorkOrderStatus.COMPLETED && endDates.length > 0
          ? new Date(Math.max(...endDates.map(d => d.getTime())))
          : null;

      const durationHours =
        actualStart && actualEnd
          ? new Prisma.Decimal(actualEnd.getTime() - actualStart.getTime())
              .div(1000 * 60 * 60)
              .toDecimalPlaces(2)
          : null;

      const isTerminal =
        wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED;
      const isOverdue = Boolean(wo.plannedEndDate && !isTerminal && wo.plannedEndDate < now);

      let delayDays = 0;
      if (wo.plannedEndDate) {
        if (wo.status === WorkOrderStatus.COMPLETED && actualEnd && actualEnd > wo.plannedEndDate) {
          delayDays = Math.ceil(
            (actualEnd.getTime() - wo.plannedEndDate.getTime()) / (1000 * 60 * 60 * 24),
          );
        } else if (isOverdue) {
          delayDays = Math.ceil(
            (now.getTime() - wo.plannedEndDate.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
      }

      return {
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        productionPlanNumber: wo.productionPlan.planNumber,
        productName: `${wo.productVariant.product.name} (${wo.productVariant.name})`,
        sku: wo.productVariant.sku,
        warehouseName: wo.warehouse.name,
        uomSymbol: wo.uom.symbol,
        plannedQuantity: new Prisma.Decimal(wo.plannedQuantity).toFixed(4),
        allocatedBatchQuantity: new Prisma.Decimal(wo.allocatedBatchQuantity).toFixed(4),
        actualGoodQuantity: new Prisma.Decimal(wo.actualGoodQuantity).toFixed(4),
        scrapQuantity: new Prisma.Decimal(wo.actualScrapQuantity).toFixed(4),
        status: wo.status,
        priority: wo.priority,
        plannedStartDate: wo.plannedStartDate ? wo.plannedStartDate.toISOString() : null,
        plannedEndDate: wo.plannedEndDate ? wo.plannedEndDate.toISOString() : null,
        executionDurationHours: durationHours ? durationHours.toFixed(2) : null,
        delayDays,
        isOverdue,
        batchCount: wo.productionBatches.length,
      };
    });

    const sorted = sortRows(rows, query.sortOrder, r => {
      if (query.sortBy === 'delayDays') return r.delayDays;
      if (query.sortBy === 'plannedQuantity') return Number(r.plannedQuantity);
      return r.workOrderNumber;
    });

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    return {
      ...paginatedResult(sorted.slice(skip, skip + query.limit), total, query.page, query.limit),
      summary: {
        totalWorkOrders: rows.length,
        overdueWorkOrders: rows.filter(r => r.isOverdue).length,
        delayedWorkOrders: rows.filter(r => r.delayDays > 0).length,
      },
    };
  }

  /**
   * 4. Batch Production & Yield Report (uses locked historical BOMVersion expectations).
   */
  static async getBatchYieldReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const where: Prisma.ProductionBatchWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.productionBatchId ? { id: query.productionBatchId } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      ...(query.status ? { status: query.status as ProductionBatchStatus } : {}),
      ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
      ...(query.search
        ? {
            OR: [
              { batchNumber: { contains: query.search, mode: 'insensitive' } },
              { workOrder: { workOrderNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const batches = await prisma.productionBatch.findMany({
      where,
      include: {
        workOrder: { select: { workOrderNumber: true } },
        productVariant: { include: { product: { select: { name: true } } } },
        bomVersion: {
          select: { versionNumber: true, yieldPercentage: true, expectedWastagePercent: true },
        },
        uom: { select: { symbol: true } },
        qualityInspection: {
          select: {
            decision: true,
            goodQuantity: true,
            rejectedQuantity: true,
            inspectedQuantity: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = batches.map(b => {
      const q = getAcceptedQtyForBatch(b);
      const actualYield = new Prisma.Decimal(b.actualYieldPercent);
      const expectedYield = new Prisma.Decimal(b.bomVersion.yieldPercentage);
      const yieldVariance = actualYield.sub(expectedYield).toDecimalPlaces(2);
      const durationHours =
        b.startedAt && b.completedAt
          ? new Prisma.Decimal(b.completedAt.getTime() - b.startedAt.getTime())
              .div(1000 * 60 * 60)
              .toDecimalPlaces(2)
              .toFixed(2)
          : null;

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        workOrderNumber: b.workOrder.workOrderNumber,
        productName: `${b.productVariant.product.name} (${b.productVariant.name})`,
        sku: b.productVariant.sku,
        bomVersionNumber: b.bomVersion.versionNumber,
        uomSymbol: b.uom.symbol,
        plannedQuantity: new Prisma.Decimal(b.plannedQuantity).toFixed(4),
        actualOutputQuantity: new Prisma.Decimal(b.actualGoodQuantity).toFixed(4),
        acceptedQuantity: q.accepted.toFixed(4),
        rejectedQuantity: q.rejected.toFixed(4),
        scrapQuantity: new Prisma.Decimal(b.wastageQuantity).toFixed(4),
        actualYieldPercent: actualYield.toFixed(2),
        expectedYieldPercent: expectedYield.toFixed(2),
        yieldVariancePercent: yieldVariance.toFixed(2),
        isLowYield: b.status === ProductionBatchStatus.COMPLETED && yieldVariance.lt(new Prisma.Decimal('-5')),
        productionDurationHours: durationHours,
        status: b.status,
        expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
      };
    });

    const sorted = sortRows(rows, query.sortOrder, r => {
      if (query.sortBy === 'actualYieldPercent') return Number(r.actualYieldPercent);
      return r.batchNumber;
    });

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    return {
      ...paginatedResult(sorted.slice(skip, skip + query.limit), total, query.page, query.limit),
      lowYieldBatchesCount: rows.filter(r => r.isLowYield).length,
    };
  }

  /**
   * 5. Material Consumption & Wastage Analysis (read-only, no double-counting scrap tolerance).
   */
  static async getMaterialConsumptionReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const consumptions = await prisma.productionBatchConsumption.findMany({
      where: {
        consumedAt: { gte: range.fromDate, lte: range.toDate },
        ...(query.productionBatchId ? { productionBatchId: query.productionBatchId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productVariantId || variantWhere
          ? {
              productionBatch: {
                ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
                ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { inventoryItem: { code: { contains: query.search, mode: 'insensitive' } } },
                { inventoryItem: { name: { contains: query.search, mode: 'insensitive' } } },
                { productionBatch: { batchNumber: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        inventoryItem: { include: { uom: { select: { symbol: true } } } },
        warehouse: { select: { name: true } },
        batch: { select: { batchNumber: true } },
        productionBatch: {
          include: {
            productVariant: { include: { product: { select: { name: true } } } },
            bomVersion: { include: { items: true } },
            returns: true,
          },
        },
      },
      orderBy: { consumedAt: 'desc' },
    });

    const grouped = new Map<
      string,
      {
        key: string;
        productionBatchId: string;
        batchNumber: string;
        productName: string;
        inventoryItemId: string;
        itemCode: string;
        itemName: string;
        itemType: string;
        uomSymbol: string;
        warehouseName: string;
        sourceBatches: Set<string>;
        bomPlannedQty: Prisma.Decimal;
        expectedWastageQty: Prisma.Decimal;
        consumedQty: Prisma.Decimal;
        returnedQty: Prisma.Decimal;
        grossCost: Prisma.Decimal;
        returnCost: Prisma.Decimal;
      }
    >();

    for (const c of consumptions) {
      const key = `${c.productionBatchId}:${c.inventoryItemId}`;
      let entry = grouped.get(key);
      if (!entry) {
        const bomItem = c.productionBatch.bomVersion.items.find(
          bi => bi.inventoryItemId === c.inventoryItemId,
        );
        const planned = new Prisma.Decimal(c.plannedQuantity);
        const scrapTol = bomItem ? new Prisma.Decimal(bomItem.scrapTolerancePercent) : ZERO;
        const expectedWastage = planned.mul(scrapTol).div(HUNDRED).toDecimalPlaces(4);

        const matchingReturns = c.productionBatch.returns.filter(
          r => r.inventoryItemId === c.inventoryItemId,
        );
        const retQty = matchingReturns.reduce((acc, r) => acc.add(r.baseQuantity), ZERO);
        const retCost = matchingReturns.reduce((acc, r) => acc.add(r.totalCost), ZERO);

        entry = {
          key,
          productionBatchId: c.productionBatchId,
          batchNumber: c.productionBatch.batchNumber,
          productName: `${c.productionBatch.productVariant.product.name} (${c.productionBatch.productVariant.name})`,
          inventoryItemId: c.inventoryItemId,
          itemCode: c.inventoryItem.code,
          itemName: c.inventoryItem.name,
          itemType: c.inventoryItem.itemType,
          uomSymbol: c.inventoryItem.uom.symbol,
          warehouseName: c.warehouse.name,
          sourceBatches: new Set<string>(),
          bomPlannedQty: planned,
          expectedWastageQty: expectedWastage,
          consumedQty: ZERO,
          returnedQty: retQty,
          grossCost: ZERO,
          returnCost: retCost,
        };
        grouped.set(key, entry);
      }
      entry.consumedQty = entry.consumedQty.add(c.baseQuantity);
      entry.grossCost = entry.grossCost.add(c.totalCost);
      if (c.batch?.batchNumber) entry.sourceBatches.add(c.batch.batchNumber);
    }

    const rows = Array.from(grouped.values()).map(e => {
      const netConsumption = e.consumedQty.sub(e.returnedQty);
      const variance = netConsumption.sub(e.bomPlannedQty);
      const actualWastage = Prisma.Decimal.max(ZERO, variance);
      const wastagePercent = e.bomPlannedQty.gt(ZERO)
        ? actualWastage.div(e.bomPlannedQty).mul(HUNDRED).toDecimalPlaces(2)
        : ZERO;
      const netCost = e.grossCost.sub(e.returnCost);

      return {
        productionBatchId: e.productionBatchId,
        batchNumber: e.batchNumber,
        productName: e.productName,
        inventoryItemId: e.inventoryItemId,
        itemCode: e.itemCode,
        itemName: e.itemName,
        itemType: e.itemType,
        uomSymbol: e.uomSymbol,
        warehouseName: e.warehouseName,
        sourceBatchNumbers: Array.from(e.sourceBatches).join(', ') || '-',
        bomPlannedQuantity: e.bomPlannedQty.toFixed(4),
        actualConsumedQuantity: e.consumedQty.toFixed(4),
        returnedQuantity: e.returnedQty.toFixed(4),
        netConsumption: netConsumption.toFixed(4),
        expectedWastage: e.expectedWastageQty.toFixed(4),
        actualWastage: actualWastage.toFixed(4),
        consumptionVariance: variance.toFixed(4),
        wastagePercent: wastagePercent.toFixed(2),
        materialCost: netCost.toFixed(4),
      };
    });

    const sorted = sortRows(rows, query.sortOrder, r => {
      if (query.sortBy === 'wastagePercent') return Number(r.wastagePercent);
      if (query.sortBy === 'materialCost') return Number(r.materialCost);
      return r.batchNumber;
    });

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    return {
      ...paginatedResult(sorted.slice(skip, skip + query.limit), total, query.page, query.limit),
      highestWastageMaterials: [...rows]
        .sort((a, b) => Number(b.wastagePercent) - Number(a.wastagePercent))
        .slice(0, 5),
    };
  }

  /**
   * 6. Finished Goods & Quality Analytics Report.
   */
  static async getQualityReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const where: Prisma.QualityInspectionWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productionBatchId ? { productionBatchId: query.productionBatchId } : {}),
      ...(query.status ? { decision: query.status as InspectionDecision } : {}),
      ...(query.productVariantId || variantWhere
        ? {
            productionBatch: {
              ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
              ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { inspectionNumber: { contains: query.search, mode: 'insensitive' } },
              { productionBatch: { batchNumber: { contains: query.search, mode: 'insensitive' } } },
              { inventoryBatch: { batchNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const inspections = await prisma.qualityInspection.findMany({
      where,
      include: {
        productionBatch: {
          include: {
            productVariant: { include: { product: { select: { name: true } } } },
            uom: { select: { symbol: true } },
          },
        },
        inventoryBatch: {
          select: {
            batchNumber: true,
            qualityStatus: true,
            manufacturingDate: true,
            expiryDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalInspected = ZERO;
    let totalAccepted = ZERO;
    let totalRejected = ZERO;
    let totalQuarantined = ZERO;
    let totalPending = ZERO;

    const rows = inspections.map(qi => {
      const inspected = new Prisma.Decimal(qi.inspectedQuantity);
      let accepted = ZERO;
      let rejected = ZERO;
      let quarantined = ZERO;
      let pending = ZERO;

      if (qi.decision === InspectionDecision.ACCEPTED) {
        accepted = inspected;
      } else if (qi.decision === InspectionDecision.PARTIALLY_ACCEPTED) {
        accepted = new Prisma.Decimal(qi.goodQuantity);
        rejected = new Prisma.Decimal(qi.rejectedQuantity);
      } else if (qi.decision === InspectionDecision.REJECTED) {
        rejected = inspected;
      } else if (qi.decision === InspectionDecision.QUARANTINED) {
        quarantined = inspected;
      } else {
        pending = inspected;
      }

      totalInspected = totalInspected.add(inspected);
      totalAccepted = totalAccepted.add(accepted);
      totalRejected = totalRejected.add(rejected);
      totalQuarantined = totalQuarantined.add(quarantined);
      totalPending = totalPending.add(pending);

      return {
        id: qi.id,
        inspectionNumber: qi.inspectionNumber,
        productionBatchNumber: qi.productionBatch.batchNumber,
        inventoryBatchNumber: qi.inventoryBatch.batchNumber,
        productName: `${qi.productionBatch.productVariant.product.name} (${qi.productionBatch.productVariant.name})`,
        uomSymbol: qi.productionBatch.uom.symbol,
        decision: qi.decision,
        qualityStatus: qi.inventoryBatch.qualityStatus,
        inspectedQuantity: inspected.toFixed(4),
        acceptedQuantity: accepted.toFixed(4),
        rejectedQuantity: rejected.toFixed(4),
        quarantinedQuantity: quarantined.toFixed(4),
        pendingQuantity: pending.toFixed(4),
        defectCategory: qi.defectCategory ?? null,
        manufacturingDate: qi.inventoryBatch.manufacturingDate
          ? qi.inventoryBatch.manufacturingDate.toISOString()
          : null,
        expiryDate: qi.inventoryBatch.expiryDate
          ? qi.inventoryBatch.expiryDate.toISOString()
          : null,
      };
    });

    const acceptanceRate = totalInspected.gt(ZERO)
      ? totalAccepted.div(totalInspected).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;
    const rejectionRate = totalInspected.gt(ZERO)
      ? totalRejected.div(totalInspected).mul(HUNDRED).toDecimalPlaces(2)
      : ZERO;

    const total = rows.length;
    const skip = (query.page - 1) * query.limit;
    return {
      ...paginatedResult(rows.slice(skip, skip + query.limit), total, query.page, query.limit),
      summary: {
        totalInspectedQuantity: totalInspected.toFixed(4),
        acceptedQuantity: totalAccepted.toFixed(4),
        rejectedQuantity: totalRejected.toFixed(4),
        quarantinedQuantity: totalQuarantined.toFixed(4),
        pendingInspectionQuantity: totalPending.toFixed(4),
        acceptanceRatePercent: acceptanceRate.toFixed(2),
        rejectionRatePercent: rejectionRate.toFixed(2),
      },
    };
  }

  /**
   * 7. Production Cost & Variance Analytics Report (Phase 3.6 integration).
   */
  static async getCostingReport(query: BaseReportQuery) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const where: Prisma.ProductionBatchCostingWhereInput = {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      ...(query.status ? { status: query.status as ProductionCostingStatus } : {}),
      ...(query.productionBatchId ? { productionBatchId: query.productionBatchId } : {}),
      ...(query.warehouseId || query.productVariantId || variantWhere || query.search
        ? {
            productionBatch: {
              ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
              ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
              ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
              ...(query.search
                ? { batchNumber: { contains: query.search, mode: 'insensitive' } }
                : {}),
            },
          }
        : {}),
    };

    const costings = await prisma.productionBatchCosting.findMany({
      where,
      include: {
        productionBatch: {
          include: {
            productVariant: { include: { product: { select: { name: true } } } },
            uom: { select: { symbol: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let finalizedTotalActual = ZERO;
    let finalizedTotalStandard = ZERO;
    let nonFinalizedTotalActual = ZERO;
    const statusBreakdown: Record<string, { count: number; totalActualCost: Prisma.Decimal }> = {
      DRAFT: { count: 0, totalActualCost: ZERO },
      CALCULATED: { count: 0, totalActualCost: ZERO },
      REVIEWED: { count: 0, totalActualCost: ZERO },
      FINALIZED: { count: 0, totalActualCost: ZERO },
    };

    const rows = costings.map(c => {
      const bucket = statusBreakdown[c.status];
      if (bucket) {
        bucket.count += 1;
        bucket.totalActualCost = bucket.totalActualCost.add(c.totalActualCost);
      }
      if (c.status === ProductionCostingStatus.FINALIZED) {
        finalizedTotalActual = finalizedTotalActual.add(c.totalActualCost);
        finalizedTotalStandard = finalizedTotalStandard.add(c.standardTotalCost);
      } else {
        nonFinalizedTotalActual = nonFinalizedTotalActual.add(c.totalActualCost);
      }

      return {
        id: c.id,
        productionBatchId: c.productionBatchId,
        batchNumber: c.productionBatch.batchNumber,
        productName: `${c.productionBatch.productVariant.product.name} (${c.productionBatch.productVariant.name})`,
        uomSymbol: c.productionBatch.uom.symbol,
        status: c.status,
        isFinalized: c.status === ProductionCostingStatus.FINALIZED,
        standardMaterialCost: new Prisma.Decimal(c.standardMaterialCost).toFixed(2),
        actualMaterialCost: new Prisma.Decimal(c.netMaterialCost).toFixed(2),
        labourCost: new Prisma.Decimal(c.actualLabourCost).toFixed(2),
        machineCost: new Prisma.Decimal(c.actualMachineCost).toFixed(2),
        directExpenses: new Prisma.Decimal(c.otherDirectCost).toFixed(2),
        overheadCost: new Prisma.Decimal(c.actualOverheadCost).toFixed(2),
        standardTotalCost: new Prisma.Decimal(c.standardTotalCost).toFixed(2),
        totalActualCost: new Prisma.Decimal(c.totalActualCost).toFixed(2),
        costVariance: new Prisma.Decimal(c.totalVarianceAmount).toFixed(2),
        costVariancePercent: new Prisma.Decimal(c.totalVariancePercent).toFixed(2),
        acceptedGoodQuantity: new Prisma.Decimal(c.acceptedQuantity).toFixed(4),
        costPerAcceptedUnit: new Prisma.Decimal(c.costPerAcceptedUnit).toFixed(4),
        wastageAndRejectionCost: new Prisma.Decimal(c.wastageAndRejectionCost).toFixed(2),
      };
    });

    const sorted = sortRows(rows, query.sortOrder, r => {
      if (query.sortBy === 'costVariance') return Number(r.costVariance);
      if (query.sortBy === 'totalActualCost') return Number(r.totalActualCost);
      return r.batchNumber;
    });

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    return {
      ...paginatedResult(sorted.slice(skip, skip + query.limit), total, query.page, query.limit),
      summary: {
        finalizedStandardCost: finalizedTotalStandard.toFixed(2),
        finalizedActualCost: finalizedTotalActual.toFixed(2),
        finalizedVarianceAmount: finalizedTotalActual.sub(finalizedTotalStandard).toFixed(2),
        provisionalNonFinalizedCost: nonFinalizedTotalActual.toFixed(2),
        byStatus: Object.fromEntries(
          Object.entries(statusBreakdown).map(([k, v]) => [
            k,
            { count: v.count, totalActualCost: v.totalActualCost.toFixed(2) },
          ]),
        ),
      },
      highestVarianceBatches: [...rows]
        .sort((a, b) => Math.abs(Number(b.costVariance)) - Math.abs(Number(a.costVariance)))
        .slice(0, 5),
    };
  }

  /**
   * 8. Production Trend Analytics (daily / weekly / monthly).
   */
  static async getTrends(query: TrendsQuery, includeCosting: boolean) {
    const range = resolveReportDateRange(query);
    const variantWhere = buildVariantFilter(query);

    const batches = await prisma.productionBatch.findMany({
      where: {
        createdAt: { gte: range.fromDate, lte: range.toDate },
        status: { not: ProductionBatchStatus.CANCELLED },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
        ...(variantWhere ? { productVariant: { is: variantWhere } } : {}),
      },
      include: {
        costing: includeCosting
          ? { select: { status: true, totalActualCost: true } }
          : false,
      },
      orderBy: { createdAt: 'asc' },
    });

    const bucketKey = (d: Date): string => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      if (query.granularity === 'monthly') return `${y}-${m}`;
      if (query.granularity === 'weekly') {
        const dt = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
        const wd = dt.getUTCDay();
        const diff = wd === 0 ? 6 : wd - 1;
        dt.setUTCDate(dt.getUTCDate() - diff);
        return dt.toISOString().slice(0, 10);
      }
      return `${y}-${m}-${day}`;
    };

    const buckets = new Map<
      string,
      {
        period: string;
        plannedQuantity: Prisma.Decimal;
        actualQuantity: Prisma.Decimal;
        rejectedQuantity: Prisma.Decimal;
        wastageQuantity: Prisma.Decimal;
        completedBatches: number;
        totalCost: Prisma.Decimal;
      }
    >();

    for (const b of batches) {
      const key = bucketKey(b.createdAt);
      const entry = buckets.get(key) ?? {
        period: key,
        plannedQuantity: ZERO,
        actualQuantity: ZERO,
        rejectedQuantity: ZERO,
        wastageQuantity: ZERO,
        completedBatches: 0,
        totalCost: ZERO,
      };
      entry.plannedQuantity = entry.plannedQuantity.add(b.plannedQuantity);
      entry.actualQuantity = entry.actualQuantity.add(b.actualGoodQuantity);
      entry.rejectedQuantity = entry.rejectedQuantity.add(b.rejectedQuantity);
      entry.wastageQuantity = entry.wastageQuantity.add(b.wastageQuantity);
      if (b.status === ProductionBatchStatus.COMPLETED) entry.completedBatches += 1;
      if (includeCosting && b.costing && b.costing.status !== ProductionCostingStatus.DRAFT) {
        entry.totalCost = entry.totalCost.add(b.costing.totalActualCost);
      }
      buckets.set(key, entry);
    }

    return {
      granularity: query.granularity,
      series: Array.from(buckets.values()).map(b => {
        const denom = b.actualQuantity.add(b.rejectedQuantity).add(b.wastageQuantity);
        const yieldPct = denom.gt(ZERO)
          ? b.actualQuantity.div(denom).mul(HUNDRED).toDecimalPlaces(2)
          : ZERO;
        const wastagePct = denom.gt(ZERO)
          ? b.wastageQuantity.div(denom).mul(HUNDRED).toDecimalPlaces(2)
          : ZERO;
        return {
          period: b.period,
          plannedQuantity: b.plannedQuantity.toFixed(4),
          actualQuantity: b.actualQuantity.toFixed(4),
          rejectedQuantity: b.rejectedQuantity.toFixed(4),
          wastageQuantity: b.wastageQuantity.toFixed(4),
          yieldPercent: yieldPct.toFixed(2),
          wastagePercent: wastagePct.toFixed(2),
          completedBatches: b.completedBatches,
          totalCost: includeCosting ? b.totalCost.toFixed(2) : null,
        };
      }),
    };
  }
}
