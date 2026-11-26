import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import {
  assertWarehouseAccess,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';

export interface FactoryPulseFilters {
  factoryId?: string;
  warehouseId?: string;
  status?: string;
}

export class FactoryPulseService {
  static async getPulse(user: UserContext, filters: FactoryPulseFilters = {}) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    let scopedWarehouseIds: string[] | undefined = allowedWh ?? undefined;
    if (filters.factoryId) {
      const factoryWhs = await prisma.warehouse.findMany({
        where: { factoryId: filters.factoryId, isActive: true },
        select: { id: true },
      });
      const factoryWhIds = factoryWhs.map(w => w.id);
      scopedWarehouseIds = scopedWarehouseIds
        ? scopedWarehouseIds.filter(id => factoryWhIds.includes(id))
        : factoryWhIds;
    }
    if (filters.warehouseId) {
      scopedWarehouseIds = [filters.warehouseId];
    }

    const whFilter = scopedWarehouseIds ? { warehouseId: { in: scopedWarehouseIds } } : {};
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryHorizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [
      factories,
      warehouses,
      activeBatches,
      completedTodayCount,
      runningWorkOrdersCount,
      delayedWorkOrders,
      pendingInspections,
      quarantinedBatchesCount,
      rejectedBatchesCount,
      expiringBatches,
      balances,
      activePlanReqs,
    ] = await Promise.all([
      prisma.factory.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.warehouse.findMany({
        where: {
          isActive: true,
          ...(scopedWarehouseIds ? { id: { in: scopedWarehouseIds } } : {}),
        },
        select: { id: true, code: true, name: true, factoryId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.productionBatch.findMany({
        where: {
          ...whFilter,
          ...(filters.status
            ? { status: filters.status as never }
            : { status: { in: ['CREATED', 'IN_PROGRESS', 'PAUSED'] } }),
        },
        take: 15,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, code: true, name: true } },
          workOrder: { select: { id: true, workOrderNumber: true } },
          warehouse: {
            select: {
              id: true,
              name: true,
              factory: { select: { id: true, name: true } },
            },
          },
          uom: { select: { symbol: true } },
        },
      }),
      prisma.productionBatch.count({
        where: {
          ...whFilter,
          status: 'COMPLETED',
          completedAt: { gte: startOfToday },
        },
      }),
      prisma.workOrder.count({
        where: {
          ...whFilter,
          status: { in: ['RELEASED', 'IN_PROGRESS'] },
        },
      }),
      prisma.workOrder.findMany({
        where: {
          ...whFilter,
          status: { in: ['APPROVED', 'RELEASED', 'IN_PROGRESS'] },
          plannedEndDate: { lt: now },
        },
        take: 10,
        orderBy: { plannedEndDate: 'asc' },
        select: {
          id: true,
          workOrderNumber: true,
          plannedEndDate: true,
          status: true,
          productVariant: { select: { name: true } },
        },
      }),
      prisma.qualityInspection.findMany({
        where: {
          decision: 'PENDING',
          ...(scopedWarehouseIds ? { productionBatch: { warehouseId: { in: scopedWarehouseIds } } } : {}),
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          inspectionNumber: true,
          decision: true,
          createdAt: true,
          productionBatch: { select: { id: true, batchNumber: true } },
        },
      }),
      prisma.inventoryBatch.count({
        where: {
          qualityStatus: 'QUARANTINED',
          ...(scopedWarehouseIds ? { balances: { some: { warehouseId: { in: scopedWarehouseIds } } } } : {}),
        },
      }),
      prisma.inventoryBatch.count({
        where: {
          qualityStatus: 'REJECTED',
          ...(scopedWarehouseIds ? { balances: { some: { warehouseId: { in: scopedWarehouseIds } } } } : {}),
        },
      }),
      prisma.inventoryBatch.findMany({
        where: {
          expiryDate: { lte: expiryHorizon },
          qualityStatus: { in: ['ACCEPTED', 'PENDING_INSPECTION'] },
          ...(scopedWarehouseIds
            ? { balances: { some: { warehouseId: { in: scopedWarehouseIds }, quantityOnHand: { gt: 0 } } } }
            : { balances: { some: { quantityOnHand: { gt: 0 } } } }),
        },
        take: 8,
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
          inventoryItem: { select: { code: true, name: true } },
        },
      }),
      prisma.inventoryBalance.findMany({
        where: {
          ...whFilter,
          inventoryItem: { itemType: { in: ['RAW_MATERIAL', 'PACKAGING'] }, isActive: true },
        },
        select: {
          inventoryItemId: true,
          quantityOnHand: true,
          quantityReserved: true,
          inventoryItem: {
            select: {
              id: true,
              code: true,
              name: true,
              rawMaterial: { select: { minStockAlert: true } },
              uom: { select: { symbol: true } },
            },
          },
        },
      }),
      prisma.productionPlanMaterialRequirement.findMany({
        where: {
          productionPlan: {
            ...whFilter,
            status: { in: ['APPROVED', 'RELEASED'] },
          },
        },
        select: {
          inventoryItemId: true,
          requiredBaseQuantity: true,
        },
      }),
    ]);

    // Aggregate planned vs actual output across active batches
    let plannedQtyTotal = ZERO;
    let actualGoodQtyTotal = ZERO;
    const productionActivity = activeBatches.map(b => {
      const planned = new Prisma.Decimal(b.plannedQuantity);
      const actual = new Prisma.Decimal(b.actualGoodQuantity);
      plannedQtyTotal = plannedQtyTotal.add(planned);
      actualGoodQtyTotal = actualGoodQtyTotal.add(actual);

      const canComputeProgress =
        planned.gt(ZERO) &&
        (b.status === 'IN_PROGRESS' || b.status === 'PAUSED' || b.status === 'COMPLETED');
      const progressPercent = canComputeProgress
        ? Math.min(100, Number(actual.div(planned).mul(100).toFixed(1)))
        : null;

      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        productName: b.product.name,
        productCode: b.product.code,
        workOrderId: b.workOrder.id,
        workOrderNumber: b.workOrder.workOrderNumber,
        warehouseName: b.warehouse.name,
        factoryName: b.warehouse.factory?.name ?? 'Default Factory',
        status: b.status,
        plannedQuantity: planned.toFixed(2),
        actualGoodQuantity: actual.toFixed(2),
        uomSymbol: b.uom.symbol,
        progressPercent,
        updatedAt: b.updatedAt.toISOString(),
      };
    });

    // Aggregate material readiness (never treat reserved stock as available)
    const reqByItem = new Map<string, Prisma.Decimal>();
    for (const r of activePlanReqs) {
      const prev = reqByItem.get(r.inventoryItemId) ?? ZERO;
      reqByItem.set(r.inventoryItemId, prev.add(new Prisma.Decimal(r.requiredBaseQuantity)));
    }

    const matMap = new Map<
      string,
      {
        itemId: string;
        code: string;
        name: string;
        uomSymbol: string;
        physicalStock: Prisma.Decimal;
        reservedStock: Prisma.Decimal;
        reorderLevel: Prisma.Decimal;
      }
    >();
    for (const bal of balances) {
      const cur = matMap.get(bal.inventoryItemId) ?? {
        itemId: bal.inventoryItemId,
        code: bal.inventoryItem.code,
        name: bal.inventoryItem.name,
        uomSymbol: bal.inventoryItem.uom.symbol,
        physicalStock: ZERO,
        reservedStock: ZERO,
        reorderLevel: new Prisma.Decimal(bal.inventoryItem.rawMaterial?.minStockAlert ?? 0),
      };
      cur.physicalStock = cur.physicalStock.add(new Prisma.Decimal(bal.quantityOnHand));
      cur.reservedStock = cur.reservedStock.add(new Prisma.Decimal(bal.quantityReserved));
      matMap.set(bal.inventoryItemId, cur);
    }

    const materialReadiness = Array.from(matMap.values())
      .map(m => {
        const availableStock = Prisma.Decimal.max(ZERO, m.physicalStock.sub(m.reservedStock));
        const requiredStock = reqByItem.get(m.itemId) ?? ZERO;
        const shortageQuantity = Prisma.Decimal.max(ZERO, requiredStock.sub(availableStock));
        const belowReorder = m.reorderLevel.gt(ZERO) && availableStock.lt(m.reorderLevel);
        return {
          itemId: m.itemId,
          code: m.code,
          name: m.name,
          uomSymbol: m.uomSymbol,
          physicalStock: m.physicalStock.toFixed(2),
          reservedStock: m.reservedStock.toFixed(2),
          availableStock: availableStock.toFixed(2),
          requiredStock: requiredStock.toFixed(2),
          shortageQuantity: shortageQuantity.toFixed(2),
          belowReorder,
        };
      })
      .filter(m => Number(m.shortageQuantity) > 0 || m.belowReorder)
      .sort((a, b) => Number(b.shortageQuantity) - Number(a.shortageQuantity))
      .slice(0, 12);

    // Attention Required items
    const attentionRequired: Array<{
      id: string;
      severity: 'CRITICAL' | 'WARNING';
      type: string;
      title: string;
      detail: string;
      navigationPath: string;
    }> = [
      ...delayedWorkOrders.map(wo => ({
        id: `wo-${wo.id}`,
        severity: 'CRITICAL' as const,
        type: 'DELAYED_WORK_ORDER',
        title: `Delayed Work Order: ${wo.workOrderNumber}`,
        detail: `${wo.productVariant?.name ?? 'Product'} • Due ${wo.plannedEndDate ? wo.plannedEndDate.toLocaleDateString() : 'N/A'}`,
        navigationPath: `/production/work-orders/${wo.id}`,
      })),
      ...materialReadiness
        .filter(m => Number(m.shortageQuantity) > 0)
        .slice(0, 5)
        .map(m => ({
          id: `mat-${m.itemId}`,
          severity: 'CRITICAL' as const,
          type: 'MATERIAL_SHORTAGE',
          title: `Material Shortage: ${m.name} (${m.code})`,
          detail: `Short by ${m.shortageQuantity} ${m.uomSymbol} (Available: ${m.availableStock})`,
          navigationPath: '/production/planning',
        })),
      ...pendingInspections.slice(0, 5).map(qi => ({
        id: `qi-${qi.id}`,
        severity: 'WARNING' as const,
        type: 'PENDING_INSPECTION',
        title: `Quality Inspection Pending: ${qi.inspectionNumber}`,
        detail: `Batch ${qi.productionBatch?.batchNumber ?? ''}`,
        navigationPath: '/production/quality',
      })),
      ...expiringBatches.slice(0, 5).map(eb => ({
        id: `exp-${eb.id}`,
        severity: 'WARNING' as const,
        type: 'EXPIRING_BATCH',
        title: `Expiring Batch: ${eb.batchNumber}`,
        detail: `${eb.inventoryItem.name} • Exp ${eb.expiryDate ? eb.expiryDate.toLocaleDateString() : 'N/A'}`,
        navigationPath: '/inventory/batches',
      })),
    ];

    return {
      generatedAt: now.toISOString(),
      filters: {
        factoryId: filters.factoryId ?? null,
        warehouseId: filters.warehouseId ?? null,
        status: filters.status ?? null,
      },
      scopes: {
        factories,
        warehouses,
      },
      overview: {
        activeBatchesCount: activeBatches.length,
        runningWorkOrdersCount,
        completedTodayCount,
        delayedWorkOrdersCount: delayedWorkOrders.length,
        plannedQtyTotal: plannedQtyTotal.toFixed(2),
        actualGoodQtyTotal: actualGoodQtyTotal.toFixed(2),
      },
      productionActivity,
      materialReadiness,
      qualityMonitoring: {
        pendingInspectionsCount: pendingInspections.length,
        quarantinedBatchesCount,
        rejectedBatchesCount,
        recentInspections: pendingInspections.map(qi => ({
          id: qi.id,
          inspectionNumber: qi.inspectionNumber,
          decision: qi.decision,
          batchNumber: qi.productionBatch?.batchNumber ?? '—',
          createdAt: qi.createdAt.toISOString(),
        })),
      },
      attentionRequired,
    };
  }
}
