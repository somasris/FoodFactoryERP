import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { assertWarehouseAccess } from '../inventory/inventory.utils';
import { SyncUserContext } from '../sync/sync.service';

function hasPerm(user: SyncUserContext, perm: string): boolean {
  if (user.roles.includes('OWNER')) return true;
  return user.permissions.includes(perm);
}

export interface BatchJourneyStage {
  key: string;
  title: string;
  status: 'OCCURRED' | 'PENDING' | 'NOT_APPLICABLE';
  timestamp: string | null;
  actor: string | null;
  summary: string;
  details: Record<string, unknown>;
  navigationPath: string | null;
}

export class BatchJourneyService {
  /**
   * Assemble an end-to-end, non-fabricated lifecycle journey for a ProductionBatch.
   * Distinguishes OCCURRED events from PENDING/NOT_APPLICABLE stages and enforces RBAC & warehouse scope.
   */
  static async getBatchJourney(batchId: string, user: SyncUserContext) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        product: { select: { id: true, code: true, name: true } },
        productVariant: { select: { id: true, sku: true, name: true } },
        uom: { select: { code: true, symbol: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        operator: { select: { id: true, fullName: true, username: true } },
        bom: { select: { id: true, code: true, name: true } },
        bomVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            yieldPercentage: true,
            approvedAt: true,
          },
        },
        workOrder: {
          include: {
            productionPlan: {
              select: {
                id: true,
                planNumber: true,
                status: true,
                createdAt: true,
                approvedAt: true,
              },
            },
          },
        },
        consumptions: {
          include: {
            inventoryItem: { select: { code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            uom: { select: { symbol: true } },
          },
          orderBy: { consumedAt: 'asc' },
        },
        returns: {
          include: {
            inventoryItem: { select: { code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            uom: { select: { symbol: true } },
            returnedBy: { select: { fullName: true } },
          },
          orderBy: { returnedAt: 'asc' },
        },
        qualityInspection: {
          include: {
            inspector: { select: { fullName: true } },
            releasedBy: { select: { fullName: true } },
          },
        },
        finishedGoodsBatch: {
          select: {
            id: true,
            batchNumber: true,
            qualityStatus: true,
            manufacturingDate: true,
            expiryDate: true,
          },
        },
        costing: {
          include: {
            calculatedBy: { select: { fullName: true } },
            finalizedBy: { select: { fullName: true } },
          },
        },
      },
    });

    if (!batch) {
      throw new AppError('Production batch not found.', 404);
    }

    await assertWarehouseAccess(user, batch.warehouseId, 'READ');

    // Downstream sales dispatch lookup only when finishedGoodsBatch exists AND user has sales.orders.read
    const downstreamDispatches: Array<{
      orderNumber: string;
      salesOrderId: string;
      status: string;
      fulfilledAt: Date;
    }> = [];
    if (batch.finishedGoodsBatchId && hasPerm(user, 'sales.orders.read')) {
      const issueLines = await prisma.inventoryIssueLine.findMany({
        where: { batchId: batch.finishedGoodsBatchId },
        select: { issueId: true },
        take: 20,
      });
      const issueIds = Array.from(new Set(issueLines.map(l => l.issueId)));
      if (issueIds.length > 0) {
        const fulfillments = await prisma.salesOrderFulfillment.findMany({
          where: { inventoryIssueId: { in: issueIds } },
          select: {
            fulfilledAt: true,
            salesOrder: { select: { id: true, orderNumber: true, status: true } },
          },
          take: 10,
        });

        const seenOrderIds = new Set<string>();
        for (const f of fulfillments) {
          if (seenOrderIds.has(f.salesOrder.id)) continue;
          seenOrderIds.add(f.salesOrder.id);
          downstreamDispatches.push({
            orderNumber: f.salesOrder.orderNumber,
            salesOrderId: f.salesOrder.id,
            status: f.salesOrder.status,
            fulfilledAt: f.fulfilledAt,
          });
        }
      }
    }

    const stages: BatchJourneyStage[] = [];

    // 1. BOM & Recipe Version
    stages.push({
      key: 'bom_recipe',
      title: 'BOM & Recipe Version',
      status: 'OCCURRED',
      timestamp: batch.bomVersion.approvedAt?.toISOString() ?? null,
      actor: null,
      summary: `${batch.bom.code} (${batch.bom.name}) • v${batch.bomVersion.versionNumber} (${batch.bomVersion.status})`,
      details: {
        yieldPercentage: batch.bomVersion.yieldPercentage.toString(),
      },
      navigationPath: hasPerm(user, 'bom.read') ? '/production/boms' : null,
    });

    // 2. Production Plan & Work Order
    stages.push({
      key: 'plan_work_order',
      title: 'Production Plan & Work Order',
      status: 'OCCURRED',
      timestamp: batch.workOrder.createdAt.toISOString(),
      actor: null,
      summary: batch.workOrder.productionPlan
        ? `Plan ${batch.workOrder.productionPlan.planNumber} → WO ${batch.workOrder.workOrderNumber} (${batch.workOrder.status})`
        : `WO ${batch.workOrder.workOrderNumber} (${batch.workOrder.status})`,
      details: {
        workOrderNumber: batch.workOrder.workOrderNumber,
        planNumber: batch.workOrder.productionPlan?.planNumber ?? null,
      },
      navigationPath: hasPerm(user, 'production.work_orders.read')
        ? `/production/work-orders/${batch.workOrderId}`
        : null,
    });

    // 3. Material Reservations
    stages.push({
      key: 'material_reservations',
      title: 'Material Reservations',
      status: batch.materialsReserved ? 'OCCURRED' : 'PENDING',
      timestamp: batch.materialsReserved ? batch.createdAt.toISOString() : null,
      actor: null,
      summary: batch.materialsReserved
        ? 'Raw & packaging materials reserved for this batch'
        : 'Materials not yet reserved',
      details: { reserved: batch.materialsReserved },
      navigationPath: `/production/batches/${batch.id}`,
    });

    // 4. Actual Material Consumption
    const lastConsumption = batch.consumptions[batch.consumptions.length - 1];
    stages.push({
      key: 'material_consumption',
      title: 'Material Consumption',
      status: batch.consumptions.length > 0 ? 'OCCURRED' : 'PENDING',
      timestamp: lastConsumption?.consumedAt.toISOString() ?? null,
      actor: null,
      summary:
        batch.consumptions.length > 0
          ? `${batch.consumptions.length} consumption entry(s) recorded`
          : 'No material consumption recorded yet',
      details: {
        count: batch.consumptions.length,
        inputBatches: batch.consumptions.map(c => ({
          itemCode: c.inventoryItem.code,
          itemName: c.inventoryItem.name,
          batchNumber: c.batch?.batchNumber ?? 'N/A',
          quantity: c.consumedQuantity.toString(),
          uom: c.uom.symbol,
        })),
      },
      navigationPath: `/production/batches/${batch.id}`,
    });

    // 5. Material Returns & Reconciliation
    const lastReturn = batch.returns[batch.returns.length - 1];
    stages.push({
      key: 'material_returns',
      title: 'Material Returns & Reconciliation',
      status: batch.returns.length > 0 ? 'OCCURRED' : 'NOT_APPLICABLE',
      timestamp: lastReturn?.returnedAt.toISOString() ?? null,
      actor: lastReturn?.returnedBy?.fullName ?? null,
      summary:
        batch.returns.length > 0
          ? `${batch.returns.length} return(s) posted back to inventory`
          : 'No unused material returns recorded',
      details: { count: batch.returns.length },
      navigationPath: `/production/reconciliation`,
    });

    // 6. Production Execution & Output
    stages.push({
      key: 'execution_output',
      title: 'Batch Execution & Output',
      status:
        batch.status === 'COMPLETED'
          ? 'OCCURRED'
          : batch.startedAt
            ? 'OCCURRED'
            : 'PENDING',
      timestamp: (batch.completedAt ?? batch.startedAt)?.toISOString() ?? null,
      actor: batch.operator.fullName,
      summary: `Status: ${batch.status} • Planned ${batch.plannedQuantity} ${batch.uom.symbol} • Good ${batch.actualGoodQuantity} ${batch.uom.symbol}`,
      details: {
        plannedQuantity: batch.plannedQuantity.toString(),
        actualGoodQuantity: batch.actualGoodQuantity.toString(),
        rejectedQuantity: batch.rejectedQuantity.toString(),
        wastageQuantity: batch.wastageQuantity.toString(),
        actualYieldPercent: batch.actualYieldPercent.toString(),
      },
      navigationPath: `/production/batches/${batch.id}`,
    });

    // 7. Quality Inspection
    const qi = batch.qualityInspection;
    stages.push({
      key: 'quality_inspection',
      title: 'Quality Inspection & Decision',
      status: qi && qi.decision !== 'PENDING' ? 'OCCURRED' : 'PENDING',
      timestamp: (qi?.releasedAt ?? qi?.inspectedAt)?.toISOString() ?? null,
      actor: qi?.releasedBy?.fullName ?? qi?.inspector?.fullName ?? null,
      summary: qi
        ? `Decision: ${qi.decision} • Good ${qi.goodQuantity} • Rejected ${qi.rejectedQuantity}`
        : 'Awaiting quality inspection',
      details: qi
        ? {
            decision: qi.decision,
            goodQuantity: qi.goodQuantity.toString(),
            rejectedQuantity: qi.rejectedQuantity.toString(),
          }
        : {},
      navigationPath: hasPerm(user, 'production.quality.read') ? '/production/quality' : null,
    });

    // 8. Finished Goods Receipt
    stages.push({
      key: 'fg_receipt',
      title: 'Finished Goods Batch Receipt',
      status: batch.finishedGoodsBatch ? 'OCCURRED' : 'PENDING',
      timestamp: batch.finishedGoodsBatch ? (batch.completedAt ?? batch.updatedAt).toISOString() : null,
      actor: null,
      summary: batch.finishedGoodsBatch
        ? `FG Batch ${batch.finishedGoodsBatch.batchNumber} (${batch.finishedGoodsBatch.qualityStatus})`
        : 'Finished goods batch not yet created',
      details: batch.finishedGoodsBatch
        ? {
            fgBatchNumber: batch.finishedGoodsBatch.batchNumber,
            qualityStatus: batch.finishedGoodsBatch.qualityStatus,
          }
        : {},
      navigationPath: hasPerm(user, 'inventory.read') ? '/inventory/expiry' : null,
    });

    // 9. Costing & Valuation Finalization
    const cost = batch.costing;
    stages.push({
      key: 'costing',
      title: 'Costing & Valuation',
      status: cost ? 'OCCURRED' : 'PENDING',
      timestamp: (cost?.finalizedAt ?? cost?.calculatedAt)?.toISOString() ?? null,
      actor: cost?.finalizedBy?.fullName ?? cost?.calculatedBy?.fullName ?? null,
      summary: cost
        ? `Status: ${cost.status} • Total Cost ₹${cost.totalActualCost} • Unit Cost ₹${cost.costPerAcceptedUnit}`
        : 'Batch costing not yet calculated',
      details: cost
        ? {
            status: cost.status,
            totalActualCost: cost.totalActualCost.toString(),
            costPerAcceptedUnit: cost.costPerAcceptedUnit.toString(),
          }
        : {},
      navigationPath: hasPerm(user, 'production.costing.read')
        ? `/production/costing/${batch.id}`
        : null,
    });

    // 10. Downstream Sales / Dispatch (permission-gated)
    if (hasPerm(user, 'sales.orders.read')) {
      stages.push({
        key: 'sales_dispatch',
        title: 'Sales & Dispatch',
        status: downstreamDispatches.length > 0 ? 'OCCURRED' : 'PENDING',
        timestamp: downstreamDispatches[0]?.fulfilledAt.toISOString() ?? null,
        actor: null,
        summary:
          downstreamDispatches.length > 0
            ? `Dispatched against ${downstreamDispatches.map(d => d.orderNumber).join(', ')}`
            : 'No sales order dispatch linked to this FG batch yet',
        details: { dispatches: downstreamDispatches },
        navigationPath:
          downstreamDispatches.length > 0
            ? `/sales/orders/${downstreamDispatches[0].salesOrderId}`
            : null,
      });
    }

    // Sibling / split batches from the same WorkOrder
    const siblingBatches = await prisma.productionBatch.findMany({
      where: { workOrderId: batch.workOrderId, id: { not: batch.id } },
      select: {
        id: true,
        batchNumber: true,
        status: true,
        plannedQuantity: true,
        actualGoodQuantity: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        productName: batch.product.name,
        sku: batch.productVariant.sku,
        warehouse: batch.warehouse,
        plannedQuantity: batch.plannedQuantity.toString(),
        actualGoodQuantity: batch.actualGoodQuantity.toString(),
        uomSymbol: batch.uom.symbol,
      },
      stages,
      genealogy: {
        backwardInputs: batch.consumptions.map(c => ({
          inventoryItemCode: c.inventoryItem.code,
          inventoryItemName: c.inventoryItem.name,
          batchNumber: c.batch?.batchNumber ?? null,
          quantity: c.consumedQuantity.toString(),
          uomSymbol: c.uom.symbol,
        })),
        splitSiblingBatches: siblingBatches.map(sb => ({
          id: sb.id,
          batchNumber: sb.batchNumber,
          status: sb.status,
          plannedQuantity: sb.plannedQuantity.toString(),
          actualGoodQuantity: sb.actualGoodQuantity.toString(),
        })),
        forwardSalesDispatches: downstreamDispatches,
      },
    };
  }
}
