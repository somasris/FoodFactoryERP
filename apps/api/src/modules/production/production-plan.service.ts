import { AuditAction, Prisma, ProductionPlanStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
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
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { buildDateRangeFilter } from '../sales/sales.utils';
import {
  CreateProductionPlanInput,
  UpdateProductionPlanInput,
} from './production-plan.types';

const HUNDRED = new Prisma.Decimal(100);

const PLAN_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true } },
  items: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      productVariant: {
        select: {
          id: true,
          sku: true,
          name: true,
          uomId: true,
          product: { select: { id: true, code: true, name: true } },
        },
      },
      bom: { select: { id: true, code: true, name: true } },
      bomVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
          expectedGoodOutput: true,
          yieldPercentage: true,
          expectedWastagePercent: true,
        },
      },
      uom: { select: { id: true, code: true, symbol: true } },
      demandSources: {
        include: {
          salesOrder: { select: { id: true, orderNumber: true, orderDate: true, status: true } },
        },
      },
    },
  },
  materialRequirements: {
    include: {
      inventoryItem: {
        select: {
          id: true,
          code: true,
          name: true,
          itemType: true,
          uom: { select: { id: true, code: true, symbol: true } },
        },
      },
    },
  },
};

export class ProductionPlanService {
  /**
   * Read-only non-expired FG available stock (onHand - reserved) for an inventory item in a warehouse.
   */
  private static async getAvailableFgStockInTx(
    tx: Prisma.TransactionClient,
    inventoryItemId: string,
    warehouseId: string,
    refDate: Date,
  ): Promise<Prisma.Decimal> {
    const balances = await tx.inventoryBalance.findMany({
      where: { inventoryItemId, warehouseId },
      include: { batch: { select: { expiryDate: true, qualityStatus: true } } },
    });

    let total = ZERO;
    for (const b of balances) {
      if (b.batch && b.batch.qualityStatus !== 'ACCEPTED') continue;
      if (b.batch && isBatchExpired(b.batch.expiryDate, refDate)) continue;
      const avail = new Prisma.Decimal(b.quantityOnHand).sub(b.quantityReserved);
      if (avail.gt(ZERO)) total = total.add(avail);
    }
    return total.toDecimalPlaces(4);
  }

  /**
   * Read-only multi-warehouse material availability summary for an inventory item.
   */
  private static async getMaterialAvailabilityAcrossWarehouses(
    tx: Prisma.TransactionClient,
    inventoryItemId: string,
    allowedWarehouseIds: string[] | null,
    refDate: Date,
  ) {
    const balances = await tx.inventoryBalance.findMany({
      where: {
        inventoryItemId,
        ...(allowedWarehouseIds ? { warehouseId: { in: allowedWarehouseIds } } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true, qualityStatus: true } },
      },
    });

    let onHand = ZERO;
    let reserved = ZERO;
    const warehouseBreakdown: Array<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      batchNumber: string | null;
      expiryDate: string | null;
      onHand: string;
      reserved: string;
      netAvailable: string;
    }> = [];

    for (const b of balances) {
      if (b.batch && b.batch.qualityStatus !== 'ACCEPTED') continue;
      if (b.batch && isBatchExpired(b.batch.expiryDate, refDate)) continue;
      const bOnHand = new Prisma.Decimal(b.quantityOnHand);
      const bRes = new Prisma.Decimal(b.quantityReserved);
      const bNet = Prisma.Decimal.max(ZERO, bOnHand.sub(bRes));
      onHand = onHand.add(bOnHand);
      reserved = reserved.add(bRes);

      if (bOnHand.gt(ZERO) || bRes.gt(ZERO)) {
        warehouseBreakdown.push({
          warehouseId: b.warehouse.id,
          warehouseCode: b.warehouse.code,
          warehouseName: b.warehouse.name,
          batchNumber: b.batch?.batchNumber ?? null,
          expiryDate: b.batch?.expiryDate ? b.batch.expiryDate.toISOString().slice(0, 10) : null,
          onHand: bOnHand.toFixed(4),
          reserved: bRes.toFixed(4),
          netAvailable: bNet.toFixed(4),
        });
      }
    }

    const netAvailable = Prisma.Decimal.max(ZERO, onHand.sub(reserved));
    return { onHand, reserved, netAvailable, warehouseBreakdown };
  }

  /**
   * Find the single active, effective BOM version for a product variant on refDate.
   */
  private static async resolveActiveBomVersion(
    tx: Prisma.TransactionClient,
    productVariantId: string,
    refDate: Date,
  ) {
    const normalizedDate = new Date(`${refDate.toISOString().slice(0, 10)}T00:00:00.000Z`);

    const bom = await tx.bOM.findFirst({
      where: { productVariantId, isActive: true },
      include: {
        versions: {
          where: {
            status: 'ACTIVE',
            effectiveFrom: { lte: normalizedDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: normalizedDate } }],
          },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            outputUom: true,
            items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
            overheads: true,
          },
        },
      },
    });

    if (!bom || bom.versions.length === 0) {
      throw new AppError(
        `No active, effective BOM version found for product variant ${productVariantId}.`,
        400,
      );
    }

    return { bom, version: bom.versions[0] };
  }

  /**
   * Generate demand summary from CONFIRMED / PARTIALLY_FULFILLED sales orders.
   */
  static async getDemandSummary(
    user: UserContext,
    filters: { warehouseId?: string; fromDate?: string; toDate?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.SalesOrderWhereInput = {
      status: { in: ['CONFIRMED', 'PARTIALLY_FULFILLED'] },
    };
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.orderDate = dateFilter;

    const orders = await prisma.salesOrder.findMany({
      where,
      orderBy: { orderDate: 'asc' },
      include: {
        customer: { select: { id: true, code: true, legalName: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            productVariant: {
              select: {
                id: true,
                sku: true,
                name: true,
                uomId: true,
                product: { select: { id: true, code: true, name: true } },
              },
            },
            inventoryItem: {
              select: { id: true, code: true, name: true, uomId: true },
            },
            uom: { select: { id: true, code: true, symbol: true } },
            productionDemandLinks: {
              where: {
                productionPlanItem: {
                  productionPlan: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
                },
              },
              select: { allocatedBaseQuantity: true },
            },
          },
        },
      },
    });

    const refDate = new Date();
    const orderDemandLines = [];
    const variantAgg = new Map<
      string,
      {
        productVariantId: string;
        sku: string;
        productName: string;
        inventoryItemId: string;
        warehouseId: string;
        warehouseCode: string;
        uomId: string;
        uomSymbol: string;
        totalUnplannedDemand: Prisma.Decimal;
        sources: Array<{
          salesOrderId: string;
          orderNumber: string;
          salesOrderLineId: string;
          unplannedQuantity: string;
        }>;
      }
    >();

    for (const order of orders) {
      for (const line of order.lines) {
        const remainingBase = Prisma.Decimal.max(
          ZERO,
          new Prisma.Decimal(line.baseQuantity).sub(line.fulfilledBaseQuantity),
        );
        const alreadyPlanned = line.productionDemandLinks.reduce(
          (acc, d) => acc.add(d.allocatedBaseQuantity),
          ZERO,
        );
        const unplanned = Prisma.Decimal.max(ZERO, remainingBase.sub(alreadyPlanned));
        if (unplanned.lte(ZERO)) continue;

        orderDemandLines.push({
          salesOrderId: order.id,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          customerName: order.customer.legalName,
          warehouseId: order.warehouse.id,
          warehouseCode: order.warehouse.code,
          salesOrderLineId: line.id,
          productVariantId: line.productVariantId,
          sku: line.productVariant.sku,
          productName: `${line.productVariant.product.name} - ${line.productVariant.name}`,
          uomId: line.inventoryItem.uomId,
          uomSymbol: line.uom.symbol,
          remainingOrderQuantity: remainingBase.toFixed(4),
          alreadyPlannedQuantity: alreadyPlanned.toFixed(4),
          unplannedQuantity: unplanned.toFixed(4),
        });

        const key = `${line.productVariantId}::${order.warehouseId}`;
        const existing = variantAgg.get(key) ?? {
          productVariantId: line.productVariantId,
          sku: line.productVariant.sku,
          productName: `${line.productVariant.product.name} - ${line.productVariant.name}`,
          inventoryItemId: line.inventoryItemId,
          warehouseId: order.warehouse.id,
          warehouseCode: order.warehouse.code,
          uomId: line.inventoryItem.uomId,
          uomSymbol: line.uom.symbol,
          totalUnplannedDemand: ZERO,
          sources: [],
        };
        existing.totalUnplannedDemand = existing.totalUnplannedDemand.add(unplanned);
        existing.sources.push({
          salesOrderId: order.id,
          orderNumber: order.orderNumber,
          salesOrderLineId: line.id,
          unplannedQuantity: unplanned.toFixed(4),
        });
        variantAgg.set(key, existing);
      }
    }

    const productSummary = [];
    for (const agg of variantAgg.values()) {
      const availFg = await this.getAvailableFgStockInTx(
        prisma,
        agg.inventoryItemId,
        agg.warehouseId,
        refDate,
      );
      const netReq = Prisma.Decimal.max(ZERO, agg.totalUnplannedDemand.sub(availFg));

      let activeBom: { bomCode: string; versionNumber: number } | null = null;
      try {
        const resolved = await this.resolveActiveBomVersion(prisma, agg.productVariantId, refDate);
        activeBom = { bomCode: resolved.bom.code, versionNumber: resolved.version.versionNumber };
      } catch {
        activeBom = null;
      }

      productSummary.push({
        productVariantId: agg.productVariantId,
        sku: agg.sku,
        productName: agg.productName,
        warehouseId: agg.warehouseId,
        warehouseCode: agg.warehouseCode,
        uomSymbol: agg.uomSymbol,
        grossDemandQuantity: agg.totalUnplannedDemand.toFixed(4),
        availableFgQuantity: availFg.toFixed(4),
        netRequirementQuantity: netReq.toFixed(4),
        activeBom,
        sources: agg.sources,
      });
    }

    return { orderDemandLines, productSummary };
  }

  static async getDashboardSummary(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const where: Prisma.ProductionPlanWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};

    const [
      totalPlans,
      draftPlans,
      submittedPlans,
      approvedPlans,
      releasedPlans,
      cancelledPlans,
      shortagePlanRows,
      recentPlans,
    ] = await Promise.all([
      prisma.productionPlan.count({ where }),
      prisma.productionPlan.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.productionPlan.count({ where: { ...where, status: 'SUBMITTED' } }),
      prisma.productionPlan.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.productionPlan.count({ where: { ...where, status: 'RELEASED' } }),
      prisma.productionPlan.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.productionPlanMaterialRequirement.findMany({
        where: {
          shortageQuantity: { gt: ZERO },
          productionPlan: { ...where, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        },
        select: { productionPlanId: true },
        distinct: ['productionPlanId'],
      }),
      prisma.productionPlan.findMany({
        where,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      totalPlans,
      draftPlans,
      submittedPlans,
      approvedPlans,
      releasedPlans,
      cancelledPlans,
      plansWithShortages: shortagePlanRows.length,
      recentPlans,
    };
  }

  static async listPlans(
    params: PaginationParams,
    user: UserContext,
    filters: { status?: string; warehouseId?: string; fromDate?: string; toDate?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.ProductionPlanWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }
    if (filters.status) where.status = filters.status as ProductionPlanStatus;
    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.planDate = dateFilter;
    if (params.search) {
      where.OR = [
        { planNumber: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true, materialRequirements: true } },
        },
      }),
      prisma.productionPlan.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getPlanById(id: string, user: UserContext) {
    const plan = await prisma.productionPlan.findUnique({
      where: { id },
      include: {
        ...PLAN_INCLUDE,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!plan) throw new AppError('Production plan not found.', 404);
    await assertWarehouseAccess(user, plan.warehouseId, 'READ');
    return plan;
  }

  static async getPlanMaterialAvailability(id: string, user: UserContext) {
    const plan = await prisma.productionPlan.findUnique({
      where: { id },
      include: {
        materialRequirements: {
          include: {
            inventoryItem: { include: { uom: true } },
          },
        },
      },
    });
    if (!plan) throw new AppError('Production plan not found.', 404);
    await assertWarehouseAccess(user, plan.warehouseId, 'READ');

    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const refDate = new Date();
    const results = [];

    for (const req of plan.materialRequirements) {
      const avail = await this.getMaterialAvailabilityAcrossWarehouses(
        prisma,
        req.inventoryItemId,
        allowedWh,
        refDate,
      );
      const required = new Prisma.Decimal(req.requiredBaseQuantity);
      const shortage = Prisma.Decimal.max(ZERO, required.sub(avail.netAvailable));
      results.push({
        inventoryItemId: req.inventoryItemId,
        itemCode: req.inventoryItem.code,
        itemName: req.inventoryItem.name,
        itemType: req.itemType,
        uomSymbol: req.inventoryItem.uom.symbol,
        requiredBaseQuantity: required.toFixed(4),
        availableQuantity: avail.onHand.toFixed(4),
        reservedQuantity: avail.reserved.toFixed(4),
        netAvailableQuantity: avail.netAvailable.toFixed(4),
        shortageQuantity: shortage.toFixed(4),
        warehouses: avail.warehouseBreakdown,
      });
    }

    return results;
  }

  private static async buildPlanItemsAndMaterials(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    planDate: Date,
    items: CreateProductionPlanInput['items'],
    user: UserContext,
    excludePlanId?: string,
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    // Lock all referenced sales orders to prevent concurrent double-allocation of demand
    const orderIds = Array.from(
      new Set(items.flatMap(i => (i.demandSources || []).map(d => d.salesOrderId))),
    );
    if (orderIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM sales_orders WHERE id = ANY(${orderIds}::text[]) FOR UPDATE
      `;
    }

    const preparedItems: Array<{
      lineNumber: number;
      productVariantId: string;
      inventoryItemId: string;
      bomId: string;
      bomVersionId: string;
      uomId: string;
      demandQuantity: Prisma.Decimal;
      availableFgQuantity: Prisma.Decimal;
      existingPlannedQuantity: Prisma.Decimal;
      netRequirementQuantity: Prisma.Decimal;
      plannedQuantity: Prisma.Decimal;
      yieldPercentage: Prisma.Decimal;
      expectedWastagePercent: Prisma.Decimal;
      estimatedMaterialCost: Prisma.Decimal;
      estimatedOverheadCost: Prisma.Decimal;
      estimatedTotalCost: Prisma.Decimal;
      demandSources: Array<{
        salesOrderId: string;
        salesOrderLineId: string;
        allocatedBaseQuantity: Prisma.Decimal;
      }>;
      materials: Array<{
        inventoryItemId: string;
        itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
        requiredBaseQuantity: Prisma.Decimal;
        availableQuantity: Prisma.Decimal;
        reservedQuantity: Prisma.Decimal;
        netAvailableQuantity: Prisma.Decimal;
        shortageQuantity: Prisma.Decimal;
        unitMwacCost: Prisma.Decimal;
        estimatedCost: Prisma.Decimal;
      }>;
    }> = [];

    for (let idx = 0; idx < items.length; idx++) {
      const itemInput = items[idx];
      const variant = await tx.productVariant.findUnique({
        where: { id: itemInput.productVariantId },
        include: { inventoryItem: true },
      });
      if (!variant || !variant.isActive || !variant.inventoryItem || !variant.inventoryItem.isActive) {
        throw new AppError(
          `Active product variant with inventory item not found for line ${idx + 1}.`,
          400,
        );
      }

      const { bom, version } = await this.resolveActiveBomVersion(tx, variant.id, planDate);

      let demandQty = itemInput.manualDemandQuantity
        ? new Prisma.Decimal(itemInput.manualDemandQuantity)
        : ZERO;
      const demandSources: Array<{
        salesOrderId: string;
        salesOrderLineId: string;
        allocatedBaseQuantity: Prisma.Decimal;
      }> = [];

      for (const ds of itemInput.demandSources || []) {
        const soLine = await tx.salesOrderLine.findUnique({
          where: { id: ds.salesOrderLineId },
          include: {
            salesOrder: true,
            productionDemandLinks: {
              where: {
                productionPlanItem: {
                  productionPlan: {
                    status: { notIn: ['CANCELLED', 'REJECTED'] },
                    ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
                  },
                },
              },
            },
          },
        });
        if (!soLine || soLine.salesOrderId !== ds.salesOrderId) {
          throw new AppError('Referenced sales order line not found.', 404);
        }
        if (
          soLine.salesOrder.status !== 'CONFIRMED' &&
          soLine.salesOrder.status !== 'PARTIALLY_FULFILLED'
        ) {
          throw new AppError(
            `Sales order ${soLine.salesOrder.orderNumber} is not eligible for planning (status: ${soLine.salesOrder.status}).`,
            400,
          );
        }
        if (soLine.productVariantId !== variant.id) {
          throw new AppError('Sales order line product variant mismatch.', 400);
        }

        const remainingOrderBase = Prisma.Decimal.max(
          ZERO,
          new Prisma.Decimal(soLine.baseQuantity).sub(soLine.fulfilledBaseQuantity),
        );
        const alreadyPlanned = soLine.productionDemandLinks.reduce(
          (acc, l) => acc.add(l.allocatedBaseQuantity),
          ZERO,
        );
        const unplanned = Prisma.Decimal.max(ZERO, remainingOrderBase.sub(alreadyPlanned));
        const allocQty = new Prisma.Decimal(ds.allocatedQuantity);
        if (allocQty.gt(unplanned)) {
          throw new AppError(
            `Allocated demand (${allocQty.toString()}) exceeds remaining unplanned demand (${unplanned.toString()}) for order ${soLine.salesOrder.orderNumber}.`,
            400,
          );
        }

        demandQty = demandQty.add(allocQty);
        demandSources.push({
          salesOrderId: ds.salesOrderId,
          salesOrderLineId: ds.salesOrderLineId,
          allocatedBaseQuantity: allocQty,
        });
      }

      if (demandQty.lte(ZERO) && !itemInput.plannedQuantity) {
        throw new AppError(`Line ${idx + 1}: Either demand or planned quantity is required.`, 400);
      }

      const availableFg = await this.getAvailableFgStockInTx(
        tx,
        variant.inventoryItem.id,
        warehouseId,
        planDate,
      );

      const netRequirement = Prisma.Decimal.max(ZERO, demandQty.sub(availableFg));
      let plannedQty = itemInput.plannedQuantity
        ? new Prisma.Decimal(itemInput.plannedQuantity)
        : netRequirement;

      if (itemInput.minBatchQuantity) {
        const minBatch = new Prisma.Decimal(itemInput.minBatchQuantity);
        if (plannedQty.gt(ZERO) && plannedQty.lt(minBatch)) {
          plannedQty = minBatch;
        }
      }

      if (plannedQty.lte(ZERO)) {
        throw new AppError(
          `Line ${idx + 1} (${variant.sku}): Net production requirement is 0 after deducting available finished goods (${availableFg.toString()}).`,
          400,
        );
      }

      // BOM Explosion using yieldPercentage, expectedWastagePercent, scrapTolerancePercent & UOM conversion
      const expectedGoodOut = new Prisma.Decimal(version.expectedGoodOutput);
      const yieldPct = new Prisma.Decimal(version.yieldPercentage);
      const wastagePct = new Prisma.Decimal(version.expectedWastagePercent);
      const yieldAdjustment = HUNDRED.div(yieldPct);
      const scaleFactor = plannedQty.div(expectedGoodOut).mul(yieldAdjustment);

      let estMatCost = ZERO;
      const materials = [];

      for (const bomItem of version.items) {
        const scaledRecipeQty = new Prisma.Decimal(bomItem.standardQuantity).mul(scaleFactor);
        const scrapPct = new Prisma.Decimal(bomItem.scrapTolerancePercent);
        const effectiveRecipeQty = scaledRecipeQty
          .mul(HUNDRED.add(scrapPct))
          .div(HUNDRED)
          .toDecimalPlaces(4);

        const { converted: requiredBase } = await convertQuantityDecimal(
          tx,
          effectiveRecipeQty,
          bomItem.uomId,
          bomItem.inventoryItem.uomId,
        );

        const avail = await this.getMaterialAvailabilityAcrossWarehouses(
          tx,
          bomItem.inventoryItemId,
          allowedWh,
          planDate,
        );
        const shortage = Prisma.Decimal.max(ZERO, requiredBase.sub(avail.netAvailable));
        const unitCost = new Prisma.Decimal(bomItem.inventoryItem.movingAverageCost);
        const lineCost = requiredBase.mul(unitCost).toDecimalPlaces(2);
        estMatCost = estMatCost.add(lineCost);

        materials.push({
          inventoryItemId: bomItem.inventoryItemId,
          itemType: bomItem.itemType,
          requiredBaseQuantity: requiredBase,
          availableQuantity: avail.onHand,
          reservedQuantity: avail.reserved,
          netAvailableQuantity: avail.netAvailable,
          shortageQuantity: shortage,
          unitMwacCost: unitCost,
          estimatedCost: lineCost,
        });
      }

      let estOhCost = ZERO;
      for (const oh of version.overheads) {
        estOhCost = estOhCost.add(new Prisma.Decimal(oh.standardAmount).mul(scaleFactor));
      }
      estOhCost = estOhCost.toDecimalPlaces(2);
      const estTotalCost = estMatCost.add(estOhCost).toDecimalPlaces(2);

      preparedItems.push({
        lineNumber: idx + 1,
        productVariantId: variant.id,
        inventoryItemId: variant.inventoryItem.id,
        bomId: bom.id,
        bomVersionId: version.id,
        uomId: variant.inventoryItem.uomId,
        demandQuantity: demandQty.toDecimalPlaces(4),
        availableFgQuantity: availableFg,
        existingPlannedQuantity: ZERO,
        netRequirementQuantity: netRequirement,
        plannedQuantity: plannedQty.toDecimalPlaces(4),
        yieldPercentage: yieldPct,
        expectedWastagePercent: wastagePct,
        estimatedMaterialCost: estMatCost.toDecimalPlaces(2),
        estimatedOverheadCost: estOhCost,
        estimatedTotalCost: estTotalCost,
        demandSources,
        materials,
      });
    }

    return preparedItems;
  }

  static async createPlan(
    input: CreateProductionPlanInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    if (input.idempotencyKey) {
      const existing = await prisma.productionPlan.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: PLAN_INCLUDE,
      });
      if (existing) return existing;
    }

    const wh = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!wh || !wh.isActive) throw new AppError('Active warehouse not found.', 404);

    const planDate = input.planDate ? new Date(input.planDate) : new Date();

    const created = await prisma.$transaction(async tx => {
      const prepared = await this.buildPlanItemsAndMaterials(
        tx,
        wh.id,
        planDate,
        input.items,
        user,
      );

      const plan = await tx.productionPlan.create({
        data: {
          planNumber: generateDocNumber('PP'),
          name: input.name ?? null,
          warehouseId: wh.id,
          planDate,
          targetStartDate: input.targetStartDate ? new Date(input.targetStartDate) : null,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
          status: ProductionPlanStatus.DRAFT,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: ProductionPlanStatus.DRAFT,
              changedById: user.userId,
              reason: 'Production plan created',
            },
          },
        },
      });

      for (const item of prepared) {
        const planItem = await tx.productionPlanItem.create({
          data: {
            productionPlanId: plan.id,
            lineNumber: item.lineNumber,
            productVariantId: item.productVariantId,
            inventoryItemId: item.inventoryItemId,
            bomId: item.bomId,
            bomVersionId: item.bomVersionId,
            uomId: item.uomId,
            demandQuantity: item.demandQuantity,
            availableFgQuantity: item.availableFgQuantity,
            existingPlannedQuantity: item.existingPlannedQuantity,
            netRequirementQuantity: item.netRequirementQuantity,
            plannedQuantity: item.plannedQuantity,
            yieldPercentage: item.yieldPercentage,
            expectedWastagePercent: item.expectedWastagePercent,
            estimatedMaterialCost: item.estimatedMaterialCost,
            estimatedOverheadCost: item.estimatedOverheadCost,
            estimatedTotalCost: item.estimatedTotalCost,
            demandSources:
              item.demandSources.length > 0 ? { create: item.demandSources } : undefined,
          },
        });

        if (item.materials.length > 0) {
          await tx.productionPlanMaterialRequirement.createMany({
            data: item.materials.map(m => ({
              productionPlanId: plan.id,
              productionPlanItemId: planItem.id,
              ...m,
            })),
          });
        }
      }

      return tx.productionPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: PLAN_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'ProductionPlan',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async updateDraftPlan(
    id: string,
    input: UpdateProductionPlanInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.productionPlan.findUnique({ where: { id } });
    if (!existing) throw new AppError('Production plan not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError(
        `Only DRAFT or REJECTED production plans can be edited (current status: ${existing.status}).`,
        400,
      );
    }

    const targetWhId = input.warehouseId || existing.warehouseId;
    if (input.warehouseId) {
      await assertWarehouseAccess(user, targetWhId, 'READ_WRITE');
    }

    const updated = await prisma.$transaction(async tx => {
      if (input.items) {
        await tx.productionPlanMaterialRequirement.deleteMany({
          where: { productionPlanId: id },
        });
        await tx.productionPlanItem.deleteMany({ where: { productionPlanId: id } });

        const prepared = await this.buildPlanItemsAndMaterials(
          tx,
          targetWhId,
          existing.planDate,
          input.items,
          user,
          id,
        );

        for (const item of prepared) {
          const planItem = await tx.productionPlanItem.create({
            data: {
              productionPlanId: id,
              lineNumber: item.lineNumber,
              productVariantId: item.productVariantId,
              inventoryItemId: item.inventoryItemId,
              bomId: item.bomId,
              bomVersionId: item.bomVersionId,
              uomId: item.uomId,
              demandQuantity: item.demandQuantity,
              availableFgQuantity: item.availableFgQuantity,
              existingPlannedQuantity: item.existingPlannedQuantity,
              netRequirementQuantity: item.netRequirementQuantity,
              plannedQuantity: item.plannedQuantity,
              yieldPercentage: item.yieldPercentage,
              expectedWastagePercent: item.expectedWastagePercent,
              estimatedMaterialCost: item.estimatedMaterialCost,
              estimatedOverheadCost: item.estimatedOverheadCost,
              estimatedTotalCost: item.estimatedTotalCost,
              demandSources:
                item.demandSources.length > 0 ? { create: item.demandSources } : undefined,
            },
          });

          if (item.materials.length > 0) {
            await tx.productionPlanMaterialRequirement.createMany({
              data: item.materials.map(m => ({
                productionPlanId: id,
                productionPlanItemId: planItem.id,
                ...m,
              })),
            });
          }
        }
      }

      return tx.productionPlan.update({
        where: { id },
        data: {
          warehouseId: targetWhId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.targetStartDate !== undefined
            ? { targetStartDate: input.targetStartDate ? new Date(input.targetStartDate) : null }
            : {}),
          ...(input.targetEndDate !== undefined
            ? { targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: PLAN_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionPlan',
      entityId: id,
      previousState: { status: existing.status, name: existing.name },
      newState: { status: updated.status, name: updated.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  private static async transitionPlan(
    id: string,
    allowedFrom: ProductionPlanStatus[],
    toStatus: ProductionPlanStatus,
    auditAction: AuditAction,
    user: UserContext,
    meta: AuditMeta,
    extraData: Prisma.ProductionPlanUpdateInput,
    reason: string,
    validateBeforeTransition?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.productionPlan.findUnique({ where: { id } });
      if (!existing) throw new AppError('Production plan not found.', 404);
      await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

      if (!allowedFrom.includes(existing.status)) {
        throw new AppError(
          `Cannot transition production plan from ${existing.status} to ${toStatus}.`,
          400,
        );
      }

      if (validateBeforeTransition) {
        await validateBeforeTransition(tx);
      }

      const plan = await tx.productionPlan.update({
        where: { id },
        data: {
          status: toStatus,
          ...extraData,
        },
        include: PLAN_INCLUDE,
      });

      await tx.productionPlanStatusHistory.create({
        data: {
          productionPlanId: id,
          fromStatus: existing.status,
          toStatus,
          changedById: user.userId,
          reason,
        },
      });

      return { plan, previousStatus: existing.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: auditAction,
      entityType: 'ProductionPlan',
      entityId: id,
      previousState: { status: result.previousStatus },
      newState: { status: result.plan.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    if (toStatus === 'SUBMITTED' || toStatus === 'APPROVED' || toStatus === 'REJECTED') {
      await NotificationEventsService.onProductionPlanEvent(
        {
          id: result.plan.id,
          planNumber: result.plan.planNumber,
          warehouseId: result.plan.warehouseId,
        },
        toStatus,
        reason,
      );
    }

    return result.plan;
  }

  static submitPlan(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionPlan(
      id,
      ['DRAFT', 'REJECTED'],
      ProductionPlanStatus.SUBMITTED,
      AuditAction.SUBMIT,
      user,
      meta,
      { submittedById: user.userId, submittedAt: new Date() },
      'Production plan submitted for approval',
    );
  }

  static approvePlan(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionPlan(
      id,
      ['SUBMITTED'],
      ProductionPlanStatus.APPROVED,
      AuditAction.APPROVE,
      user,
      meta,
      { approvedById: user.userId, approvedAt: new Date() },
      'Production plan approved',
    );
  }

  static rejectPlan(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    return this.transitionPlan(
      id,
      ['SUBMITTED'],
      ProductionPlanStatus.REJECTED,
      AuditAction.REJECT,
      user,
      meta,
      { rejectedById: user.userId, rejectedAt: new Date(), rejectionReason: reason },
      reason,
    );
  }

  static releasePlan(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionPlan(
      id,
      ['APPROVED'],
      ProductionPlanStatus.RELEASED,
      AuditAction.RELEASE,
      user,
      meta,
      { releasedById: user.userId, releasedAt: new Date() },
      'Production plan released for work order generation',
      async tx => {
        const items = await tx.productionPlanItem.findMany({
          where: { productionPlanId: id },
          include: { bomVersion: true },
        });
        for (const item of items) {
          if (item.bomVersion.status !== 'ACTIVE') {
            throw new AppError(
              `Cannot release plan: BOM version v${item.bomVersion.versionNumber} is no longer ACTIVE (status: ${item.bomVersion.status}).`,
              400,
            );
          }
        }
      },
    );
  }

  static cancelPlan(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    return this.transitionPlan(
      id,
      ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED'],
      ProductionPlanStatus.CANCELLED,
      AuditAction.CANCEL,
      user,
      meta,
      { cancelledById: user.userId, cancelledAt: new Date(), cancellationReason: reason },
      reason,
    );
  }
}
