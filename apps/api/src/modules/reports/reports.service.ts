import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { ProductionReportsService } from '../production/production-reports.service';
import { getFyDateBounds } from '../compliance/gst-compliance.service';
import { getAuthorizedWarehouseIds, UserContext } from '../inventory/inventory.utils';
import { AnalyticsFilter } from './reports.types';

const ZERO = new Prisma.Decimal(0);

function resolveDateRange(filter: AnalyticsFilter): { gte?: Date; lte?: Date } | undefined {
  if (filter.financialYear) {
    const fy = getFyDateBounds(filter.financialYear);
    if (fy) return { gte: fy.start, lte: fy.end };
  }
  if (filter.startDate || filter.endDate) {
    const range: { gte?: Date; lte?: Date } = {};
    if (filter.startDate) range.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
    if (filter.endDate) range.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    return range;
  }
  return undefined;
}

export class ReportsService {
  /**
   * 4.3.1 Executive Dashboard: Business KPIs + Operational KPIs from live database records.
   */
  static async getExecutiveDashboard(filter: AnalyticsFilter) {
    const dateRange = resolveDateRange(filter);

    const [
      issuedInvoicesAgg,
      salesOrderCount,
      pendingSoApprovals,
      pendingPlanApprovals,
      pendingWoApprovals,
      pendingStockAudits,
      activeWorkOrders,
      activeBatches,
      pendingInspections,
      delayedPlans,
      batchOutputs,
      finalizedCostingAgg,
      balances,
      expiringBatchesCount,
    ] = await Promise.all([
      prisma.salesInvoice.aggregate({
        where: {
          status: 'ISSUED',
          ...(dateRange ? { invoiceDate: dateRange } : {}),
          ...(filter.customerId ? { customerId: filter.customerId } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        _sum: { taxableAmount: true, grandTotal: true },
        _count: { id: true },
      }),
      prisma.salesOrder.count({
        where: {
          status: { not: 'CANCELLED' },
          ...(dateRange ? { orderDate: dateRange } : {}),
          ...(filter.customerId ? { customerId: filter.customerId } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
      }),
      prisma.salesOrder.count({ where: { status: 'SUBMITTED' } }),
      prisma.productionPlan.count({ where: { status: 'SUBMITTED' } }),
      prisma.workOrder.count({ where: { status: 'SUBMITTED' } }),
      prisma.stockAudit.count({ where: { status: 'SUBMITTED' } }),
      prisma.workOrder.count({
        where: { status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      }),
      prisma.productionBatch.count({
        where: { status: { in: ['CREATED', 'IN_PROGRESS', 'PAUSED'] } },
      }),
      prisma.qualityInspection.count({ where: { decision: 'PENDING' } }),
      prisma.productionPlan.count({
        where: {
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED'] },
          targetEndDate: { lt: new Date() },
        },
      }),
      prisma.productionBatch.aggregate({
        where: {
          status: 'COMPLETED',
          ...(dateRange ? { completedAt: dateRange } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        _sum: {
          actualGoodQuantity: true,
          rejectedQuantity: true,
          wastageQuantity: true,
        },
      }),
      prisma.productionBatchCosting.aggregate({
        where: {
          status: 'FINALIZED',
          ...(dateRange ? { finalizedAt: dateRange } : {}),
        },
        _sum: { totalActualCost: true },
      }),
      prisma.inventoryBalance.findMany({
        where: {
          quantityOnHand: { gt: 0 },
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        include: {
          inventoryItem: {
            select: { valuationMethod: true, movingAverageCost: true },
          },
          batch: { select: { unitCost: true } },
        },
      }),
      prisma.inventoryBatch.count({
        where: {
          expiryDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          balances: { some: { quantityOnHand: { gt: 0 } } },
        },
      }),
    ]);

    const lowStockThreshold = new Prisma.Decimal(50);
    let inventoryValue = ZERO;
    let lowStockCount = 0;
    for (const b of balances) {
      const unitCost =
        b.inventoryItem.valuationMethod === 'BATCH_ACTUAL' && b.batch
          ? b.batch.unitCost
          : b.inventoryItem.movingAverageCost;
      inventoryValue = inventoryValue.add(b.quantityOnHand.mul(unitCost));
      if (b.quantityOnHand.lte(lowStockThreshold)) {
        lowStockCount += 1;
      }
    }

    const goodQty = batchOutputs._sum.actualGoodQuantity || ZERO;
    const rejQty = batchOutputs._sum.rejectedQuantity || ZERO;
    const totalInspectedOutput = goodQty.add(rejQty);
    const qualityRejectionRate = totalInspectedOutput.gt(ZERO)
      ? rejQty.div(totalInspectedOutput).mul(100).toDecimalPlaces(2).toFixed(2)
      : '0.00';

    return {
      businessKpis: {
        issuedInvoiceValue: (issuedInvoicesAgg._sum.grandTotal || ZERO).toFixed(2),
        issuedTaxableSales: (issuedInvoicesAgg._sum.taxableAmount || ZERO).toFixed(2),
        issuedInvoiceCount: issuedInvoicesAgg._count.id,
        salesOrderCount,
        productionOutputQty: goodQty.toFixed(4),
        inventoryValue: inventoryValue.toFixed(2),
        finalizedProductionCost: (finalizedCostingAgg._sum.totalActualCost || ZERO).toFixed(2),
        qualityRejectionRatePercent: qualityRejectionRate,
        materialWastageQty: (batchOutputs._sum.wastageQuantity || ZERO).toFixed(4),
        pendingApprovalsCount:
          pendingSoApprovals + pendingPlanApprovals + pendingWoApprovals + pendingStockAudits,
      },
      operationalKpis: {
        activeWorkOrders,
        activeProductionBatches: activeBatches,
        pendingInspections,
        lowStockItemsCount: lowStockCount,
        expiringBatchesCount,
        delayedProductionPlans: delayedPlans,
      },
    };
  }

  /**
   * 4.3.2 Sales Analytics: Authoritative revenue from ISSUED SalesInvoices + order lifecycle breakdown.
   */
  static async getSalesAnalytics(filter: AnalyticsFilter) {
    const dateRange = resolveDateRange(filter);

    const [ordersByStatus, issuedInvoices] = await Promise.all([
      prisma.salesOrder.groupBy({
        by: ['status'],
        where: {
          ...(dateRange ? { orderDate: dateRange } : {}),
          ...(filter.customerId ? { customerId: filter.customerId } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      prisma.salesInvoice.findMany({
        where: {
          status: 'ISSUED',
          ...(dateRange ? { invoiceDate: dateRange } : {}),
          ...(filter.customerId ? { customerId: filter.customerId } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        include: {
          customer: { select: { id: true, code: true, legalName: true } },
          lines: {
            include: {
              productVariant: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  product: {
                    select: { id: true, name: true, category: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { invoiceDate: 'asc' },
      }),
    ]);

    const customerMap = new Map<
      string,
      { customerId: string; customerName: string; invoiceCount: number; revenue: Prisma.Decimal }
    >();
    const productMap = new Map<
      string,
      { productId: string; productName: string; categoryName: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }
    >();
    const monthlyMap = new Map<
      string,
      { month: string; invoiceCount: number; taxableRevenue: Prisma.Decimal; grandTotal: Prisma.Decimal }
    >();

    let totalRevenue = ZERO;
    for (const inv of issuedInvoices) {
      totalRevenue = totalRevenue.add(inv.taxableAmount);

      const cEntry = customerMap.get(inv.customerId) || {
        customerId: inv.customerId,
        customerName: inv.customer.legalName,
        invoiceCount: 0,
        revenue: ZERO,
      };
      cEntry.invoiceCount += 1;
      cEntry.revenue = cEntry.revenue.add(inv.taxableAmount);
      customerMap.set(inv.customerId, cEntry);

      const monthKey = inv.invoiceDate.toISOString().slice(0, 7);
      const mEntry = monthlyMap.get(monthKey) || {
        month: monthKey,
        invoiceCount: 0,
        taxableRevenue: ZERO,
        grandTotal: ZERO,
      };
      mEntry.invoiceCount += 1;
      mEntry.taxableRevenue = mEntry.taxableRevenue.add(inv.taxableAmount);
      mEntry.grandTotal = mEntry.grandTotal.add(inv.grandTotal);
      monthlyMap.set(monthKey, mEntry);

      for (const line of inv.lines) {
        const prod = line.productVariant.product;
        const pEntry = productMap.get(prod.id) || {
          productId: prod.id,
          productName: prod.name,
          categoryName: prod.category?.name || 'Uncategorized',
          quantity: ZERO,
          revenue: ZERO,
        };
        pEntry.quantity = pEntry.quantity.add(line.quantity);
        pEntry.revenue = pEntry.revenue.add(line.taxableAmount);
        productMap.set(prod.id, pEntry);
      }
    }

    return {
      revenueSourceNote:
        'Sales revenue reflects authoritative ISSUED SalesInvoices (orders are tracked separately by lifecycle status to prevent double-counting).',
      totalTaxableRevenue: totalRevenue.toFixed(2),
      issuedInvoiceCount: issuedInvoices.length,
      orderStatusBreakdown: ordersByStatus.map(o => ({
        status: o.status,
        orderCount: o._count.id,
        orderValue: (o._sum.totalAmount || ZERO).toFixed(2),
      })),
      salesByCustomer: Array.from(customerMap.values())
        .sort((a, b) => b.revenue.cmp(a.revenue))
        .map(c => ({ ...c, revenue: c.revenue.toFixed(2) })),
      salesByProduct: Array.from(productMap.values())
        .sort((a, b) => b.revenue.cmp(a.revenue))
        .map(p => ({
          ...p,
          quantity: p.quantity.toFixed(4),
          revenue: p.revenue.toFixed(2),
        })),
      monthlyTrend: Array.from(monthlyMap.values()).map(m => ({
        month: m.month,
        invoiceCount: m.invoiceCount,
        taxableRevenue: m.taxableRevenue.toFixed(2),
        grandTotal: m.grandTotal.toFixed(2),
      })),
    };
  }

  /**
   * 4.3.3 Inventory Analytics: Valuation, quality distribution, low-stock, expiring, and movement.
   */
  static async getInventoryAnalytics(filter: AnalyticsFilter, user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    const where: Prisma.InventoryBalanceWhereInput = {
      quantityOnHand: { gt: 0 },
    };
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filter.factoryId) {
      where.warehouse = { factoryId: filter.factoryId };
    }

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        inventoryItem: {
          select: {
            id: true,
            code: true,
            name: true,
            itemType: true,
            valuationMethod: true,
            movingAverageCost: true,
          },
        },
        batch: {
          select: { id: true, batchNumber: true, qualityStatus: true, expiryDate: true, unitCost: true },
        },
      },
    });

    const qualityMap = new Map<string, { qualityStatus: string; quantity: Prisma.Decimal; value: Prisma.Decimal; batchCount: number }>();
    const warehouseMap = new Map<string, { warehouseId: string; warehouseCode: string; warehouseName: string; value: Prisma.Decimal; itemCount: number }>();
    const lowStockItems: Array<{ itemCode: string; itemName: string; warehouseCode: string; onHand: string; reorderLevel: string }> = [];
    const expiringBatches: Array<{ batchNumber: string; itemName: string; warehouseCode: string; expiryDate: Date; onHand: string }> = [];

    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let totalValue = ZERO;

    for (const b of balances) {
      const unitCost =
        b.inventoryItem.valuationMethod === 'BATCH_ACTUAL' && b.batch
          ? b.batch.unitCost
          : b.inventoryItem.movingAverageCost;
      const lineValue = b.quantityOnHand.mul(unitCost).toDecimalPlaces(2);
      totalValue = totalValue.add(lineValue);

      const qStatus = b.batch?.qualityStatus || 'ACCEPTED';
      const qEntry = qualityMap.get(qStatus) || {
        qualityStatus: qStatus,
        quantity: ZERO,
        value: ZERO,
        batchCount: 0,
      };
      qEntry.quantity = qEntry.quantity.add(b.quantityOnHand);
      qEntry.value = qEntry.value.add(lineValue);
      qEntry.batchCount += 1;
      qualityMap.set(qStatus, qEntry);

      const wEntry = warehouseMap.get(b.warehouseId) || {
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        value: ZERO,
        itemCount: 0,
      };
      wEntry.value = wEntry.value.add(lineValue);
      wEntry.itemCount += 1;
      warehouseMap.set(b.warehouseId, wEntry);

      if (b.quantityOnHand.lte(new Prisma.Decimal(50))) {
        lowStockItems.push({
          itemCode: b.inventoryItem.code,
          itemName: b.inventoryItem.name,
          warehouseCode: b.warehouse.code,
          onHand: b.quantityOnHand.toFixed(4),
          reorderLevel: '50.0000',
        });
      }

      if (b.batch?.expiryDate && b.batch.expiryDate <= thirtyDaysOut) {
        expiringBatches.push({
          batchNumber: b.batch.batchNumber,
          itemName: b.inventoryItem.name,
          warehouseCode: b.warehouse.code,
          expiryDate: b.batch.expiryDate,
          onHand: b.quantityOnHand.toFixed(4),
        });
      }
    }

    return {
      totalInventoryValue: totalValue.toFixed(2),
      qualityDistribution: Array.from(qualityMap.values()).map(q => ({
        qualityStatus: q.qualityStatus,
        quantity: q.quantity.toFixed(4),
        value: q.value.toFixed(2),
        batchCount: q.batchCount,
      })),
      warehouseComparison: Array.from(warehouseMap.values()).map(w => ({
        ...w,
        value: w.value.toFixed(2),
      })),
      lowStockItems,
      expiringBatches,
    };
  }

  /**
   * 4.3.4 Production Analytics: Reuses Phase 3.7 ProductionReportsService directly.
   */
  static async getProductionAnalytics(filter: AnalyticsFilter) {
    const query = {
      startDate: filter.startDate,
      endDate: filter.endDate,
      warehouseId: filter.warehouseId,
      productId: filter.productId,
      page: 1,
      limit: 20,
      sortOrder: 'desc' as const,
    };

    const [dashboard, planVsActual] = await Promise.all([
      ProductionReportsService.getDashboard(query, false),
      ProductionReportsService.getPlanVsActualReport(query),
    ]);

    return {
      dashboard,
      planVsActual: planVsActual.items,
    };
  }

  /**
   * 4.3.5 Profitability & Business Performance:
   * Combines authoritative ISSUED SalesInvoice revenue with FINALIZED ProductionBatchCosting.
   * Explicitly labeled as Gross Margin / Estimated Contribution (NOT Net Profit).
   */
  static async getProfitabilityReport(filter: AnalyticsFilter) {
    const dateRange = resolveDateRange(filter);

    const [invoiceLines, finalizedCostings] = await Promise.all([
      prisma.salesInvoiceLine.findMany({
        where: {
          salesInvoice: {
            status: 'ISSUED',
            ...(dateRange ? { invoiceDate: dateRange } : {}),
            ...(filter.customerId ? { customerId: filter.customerId } : {}),
          },
          ...(filter.productId
            ? { productVariant: { productId: filter.productId } }
            : {}),
        },
        include: {
          productVariant: {
            select: {
              productId: true,
              product: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      prisma.productionBatchCosting.findMany({
        where: {
          status: 'FINALIZED',
          ...(dateRange ? { finalizedAt: dateRange } : {}),
        },
        include: {
          productionBatch: {
            select: {
              workOrder: {
                select: {
                  inventoryItem: {
                    select: {
                      id: true,
                      productVariant: { select: { productId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Build average finalized unit cost per productId
    const costByProduct = new Map<string, { totalCost: Prisma.Decimal; totalUnits: Prisma.Decimal }>();
    for (const c of finalizedCostings) {
      const prodId = c.productionBatch.workOrder.inventoryItem.productVariant?.productId;
      if (!prodId) continue;
      const entry = costByProduct.get(prodId) || { totalCost: ZERO, totalUnits: ZERO };
      entry.totalCost = entry.totalCost.add(c.totalActualCost);
      entry.totalUnits = entry.totalUnits.add(c.acceptedQuantity);
      costByProduct.set(prodId, entry);
    }

    const productMargins = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productName: string;
        soldQty: Prisma.Decimal;
        revenue: Prisma.Decimal;
        estimatedProductionCost: Prisma.Decimal;
        hasFinalizedCosting: boolean;
      }
    >();

    let totalRevenue = ZERO;
    let totalAttributedCost = ZERO;

    for (const line of invoiceLines) {
      const prod = line.productVariant.product;
      const pEntry = productMargins.get(prod.id) || {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        soldQty: ZERO,
        revenue: ZERO,
        estimatedProductionCost: ZERO,
        hasFinalizedCosting: false,
      };
      pEntry.soldQty = pEntry.soldQty.add(line.quantity);
      pEntry.revenue = pEntry.revenue.add(line.taxableAmount);
      totalRevenue = totalRevenue.add(line.taxableAmount);

      const costStats = costByProduct.get(prod.id);
      if (costStats && costStats.totalUnits.gt(ZERO)) {
        const avgUnitCost = costStats.totalCost.div(costStats.totalUnits);
        const lineCost = avgUnitCost.mul(line.quantity).toDecimalPlaces(2);
        pEntry.estimatedProductionCost = pEntry.estimatedProductionCost.add(lineCost);
        pEntry.hasFinalizedCosting = true;
        totalAttributedCost = totalAttributedCost.add(lineCost);
      }

      productMargins.set(prod.id, pEntry);
    }

    const grossMargin = totalRevenue.sub(totalAttributedCost);
    const grossMarginPercent = totalRevenue.gt(ZERO)
      ? grossMargin.div(totalRevenue).mul(100).toDecimalPlaces(2).toFixed(2)
      : '0.00';

    return {
      disclaimer:
        'Gross Margin / Estimated Contribution uses authoritative ISSUED SalesInvoices and FINALIZED ProductionBatchCosting only. Operating expenses and tax liabilities are excluded; this is NOT net profit.',
      summary: {
        revenue: totalRevenue.toFixed(2),
        productionCost: totalAttributedCost.toFixed(2),
        grossMargin: grossMargin.toFixed(2),
        grossMarginPercent,
      },
      products: Array.from(productMargins.values()).map(p => {
        const margin = p.revenue.sub(p.estimatedProductionCost);
        const marginPct = p.revenue.gt(ZERO)
          ? margin.div(p.revenue).mul(100).toDecimalPlaces(2).toFixed(2)
          : '0.00';
        return {
          productId: p.productId,
          productCode: p.productCode,
          productName: p.productName,
          soldQuantity: p.soldQty.toFixed(4),
          revenue: p.revenue.toFixed(2),
          productionCost: p.estimatedProductionCost.toFixed(2),
          grossMargin: margin.toFixed(2),
          grossMarginPercent: marginPct,
          hasFinalizedCosting: p.hasFinalizedCosting,
        };
      }),
    };
  }

  /**
   * 4.3.6 Factory Performance Dashboard enforcing warehouse access restrictions.
   */
  static async getFactoryPerformance(filter: AnalyticsFilter, user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    const factories = await prisma.factory.findMany({
      where: {
        isActive: true,
        ...(filter.factoryId ? { id: filter.factoryId } : {}),
      },
      include: {
        warehouses: {
          where: {
            isActive: true,
            ...(allowedWh ? { id: { in: allowedWh } } : {}),
          },
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const results = [];
    for (const fac of factories) {
      const whIds = fac.warehouses.map(w => w.id);
      if (whIds.length === 0) {
        results.push({
          factoryId: fac.id,
          factoryCode: fac.code,
          factoryName: fac.name,
          warehouseCount: 0,
          inventoryValue: '0.00',
          completedWorkOrders: 0,
          productionOutputQty: '0.0000',
          rejectedOutputQty: '0.0000',
        });
        continue;
      }

      const [balances, woCount, batchAgg] = await Promise.all([
        prisma.inventoryBalance.findMany({
          where: { warehouseId: { in: whIds }, quantityOnHand: { gt: 0 } },
          include: {
            inventoryItem: { select: { valuationMethod: true, movingAverageCost: true } },
            batch: { select: { unitCost: true } },
          },
        }),
        prisma.workOrder.count({
          where: { warehouseId: { in: whIds }, status: 'COMPLETED' },
        }),
        prisma.productionBatch.aggregate({
          where: { warehouseId: { in: whIds }, status: 'COMPLETED' },
          _sum: { actualGoodQuantity: true, rejectedQuantity: true },
        }),
      ]);

      let invVal = ZERO;
      for (const b of balances) {
        const uc =
          b.inventoryItem.valuationMethod === 'BATCH_ACTUAL' && b.batch
            ? b.batch.unitCost
            : b.inventoryItem.movingAverageCost;
        invVal = invVal.add(b.quantityOnHand.mul(uc));
      }

      results.push({
        factoryId: fac.id,
        factoryCode: fac.code,
        factoryName: fac.name,
        warehouseCount: whIds.length,
        inventoryValue: invVal.toFixed(2),
        completedWorkOrders: woCount,
        productionOutputQty: (batchAgg._sum.actualGoodQuantity || ZERO).toFixed(4),
        rejectedOutputQty: (batchAgg._sum.rejectedQuantity || ZERO).toFixed(4),
      });
    }

    return { items: results };
  }
}
