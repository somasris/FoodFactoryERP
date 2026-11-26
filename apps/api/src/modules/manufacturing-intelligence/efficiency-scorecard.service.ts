import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { getAuthorizedWarehouseIds, UserContext, ZERO } from '../inventory/inventory.utils';
import { resolveReportDateRange } from '../production/production-reports.service';
import { EfficiencyScorecardQuery } from './mi.types';

const HUNDRED = new Prisma.Decimal(100);

export class EfficiencyScorecardService {
  /**
   * Transparent Production Efficiency Scorecard using Prisma.Decimal arithmetic.
   * - Never combines incompatible UOMs (groups quantity metrics by UOM code).
   * - Handles zero planned quantity and zero output safely (returns null percentages).
   * - Separates COMPLETED, IN_PROGRESS/PAUSED, and CANCELLED batches.
   * - Reports exact record counts included in each calculation.
   */
  static async getScorecard(user: UserContext, query: EfficiencyScorecardQuery) {
    const dateWindow = resolveReportDateRange(query);
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    const batchWhere: Prisma.ProductionBatchWhereInput = {
      createdAt: { gte: dateWindow.fromDate, lte: dateWindow.toDate },
      ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.factoryId ? { warehouse: { factoryId: query.factoryId } } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };

    const woWhere: Prisma.WorkOrderWhereInput = {
      createdAt: { gte: dateWindow.fromDate, lte: dateWindow.toDate },
      ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.factoryId ? { warehouse: { factoryId: query.factoryId } } : {}),
      ...(query.productId ? { productVariant: { productId: query.productId } } : {}),
    };

    const [batches, workOrders] = await Promise.all([
      prisma.productionBatch.findMany({
        where: batchWhere,
        include: {
          uom: { select: { code: true, symbol: true } },
          product: { select: { id: true, code: true, name: true } },
          costing: {
            select: {
              status: true,
              materialVarianceAmount: true,
              totalVarianceAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workOrder.findMany({
        where: woWhere,
        select: { id: true, status: true },
      }),
    ]);

    const statusCounts = {
      COMPLETED: 0,
      IN_PROGRESS: 0,
      CANCELLED: 0,
      CREATED: 0,
    };

    let completionHoursSum = 0;
    let completionTimeRecordCount = 0;

    let costedBatchCount = 0;
    let totalMaterialCostVariance = ZERO;
    let totalProductionCostVariance = ZERO;

    const uomBuckets = new Map<
      string,
      {
        uomCode: string;
        uomSymbol: string;
        completedBatchCount: number;
        plannedQuantity: Prisma.Decimal;
        actualGoodQuantity: Prisma.Decimal;
        rejectedQuantity: Prisma.Decimal;
        wastageQuantity: Prisma.Decimal;
      }
    >();

    for (const b of batches) {
      if (b.status === 'COMPLETED') statusCounts.COMPLETED += 1;
      else if (b.status === 'IN_PROGRESS' || b.status === 'PAUSED') statusCounts.IN_PROGRESS += 1;
      else if (b.status === 'CANCELLED') statusCounts.CANCELLED += 1;
      else statusCounts.CREATED += 1;

      if (b.status === 'COMPLETED') {
        const key = b.uom.code;
        const bucket = uomBuckets.get(key) ?? {
          uomCode: b.uom.code,
          uomSymbol: b.uom.symbol,
          completedBatchCount: 0,
          plannedQuantity: ZERO,
          actualGoodQuantity: ZERO,
          rejectedQuantity: ZERO,
          wastageQuantity: ZERO,
        };
        bucket.completedBatchCount += 1;
        bucket.plannedQuantity = bucket.plannedQuantity.add(b.plannedQuantity);
        bucket.actualGoodQuantity = bucket.actualGoodQuantity.add(b.actualGoodQuantity);
        bucket.rejectedQuantity = bucket.rejectedQuantity.add(b.rejectedQuantity);
        bucket.wastageQuantity = bucket.wastageQuantity.add(b.wastageQuantity);
        uomBuckets.set(key, bucket);

        if (b.startedAt && b.completedAt && b.completedAt >= b.startedAt) {
          completionHoursSum += (b.completedAt.getTime() - b.startedAt.getTime()) / 3_600_000;
          completionTimeRecordCount += 1;
        }
      }

      if (b.costing) {
        costedBatchCount += 1;
        totalMaterialCostVariance = totalMaterialCostVariance.add(b.costing.materialVarianceAmount);
        totalProductionCostVariance = totalProductionCostVariance.add(b.costing.totalVarianceAmount);
      }
    }

    const quantityMetricsByUom = Array.from(uomBuckets.values()).map(bucket => {
      const yieldPct = bucket.plannedQuantity.gt(ZERO)
        ? bucket.actualGoodQuantity.div(bucket.plannedQuantity).mul(HUNDRED).toFixed(2)
        : null;
      const wastagePct = bucket.plannedQuantity.gt(ZERO)
        ? bucket.wastageQuantity.div(bucket.plannedQuantity).mul(HUNDRED).toFixed(2)
        : null;
      const totalProduced = bucket.actualGoodQuantity.add(bucket.rejectedQuantity);
      const rejectionPct = totalProduced.gt(ZERO)
        ? bucket.rejectedQuantity.div(totalProduced).mul(HUNDRED).toFixed(2)
        : null;

      return {
        uomCode: bucket.uomCode,
        uomSymbol: bucket.uomSymbol,
        completedBatchCount: bucket.completedBatchCount,
        plannedQuantity: bucket.plannedQuantity.toFixed(4),
        actualGoodQuantity: bucket.actualGoodQuantity.toFixed(4),
        rejectedQuantity: bucket.rejectedQuantity.toFixed(4),
        wastageQuantity: bucket.wastageQuantity.toFixed(4),
        yieldPercentage: yieldPct,
        wastagePercentage: wastagePct,
        rejectionPercentage: rejectionPct,
      };
    });

    const nonCancelledWo = workOrders.filter(w => w.status !== 'CANCELLED');
    const completedWo = nonCancelledWo.filter(w => w.status === 'COMPLETED');
    const workOrderCompletionRate =
      nonCancelledWo.length > 0
        ? new Prisma.Decimal(completedWo.length)
            .div(new Prisma.Decimal(nonCancelledWo.length))
            .mul(HUNDRED)
            .toFixed(2)
        : null;

    return {
      dateRange: {
        period: dateWindow.period,
        fromDate: dateWindow.fromDate.toISOString(),
        toDate: dateWindow.toDate.toISOString(),
      },
      recordCounts: {
        totalBatches: batches.length,
        ...statusCounts,
        completionTimeRecordCount,
        costedBatchCount,
        totalWorkOrders: nonCancelledWo.length,
        completedWorkOrders: completedWo.length,
      },
      quantityMetricsByUom,
      performance: {
        avgBatchCompletionHours:
          completionTimeRecordCount > 0
            ? (completionHoursSum / completionTimeRecordCount).toFixed(2)
            : null,
        workOrderCompletionRatePercent: workOrderCompletionRate,
        totalMaterialCostVariance: totalMaterialCostVariance.toFixed(2),
        totalProductionCostVariance: totalProductionCostVariance.toFixed(2),
      },
      sourceBatches: batches.slice(0, 25).map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        status: b.status,
        productName: b.product.name,
        plannedQuantity: b.plannedQuantity.toString(),
        actualGoodQuantity: b.actualGoodQuantity.toString(),
        uomSymbol: b.uom.symbol,
        actualYieldPercent: b.actualYieldPercent.toString(),
        completedAt: b.completedAt,
      })),
    };
  }
}
