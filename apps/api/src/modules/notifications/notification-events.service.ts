import {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { logger } from '../../utils/logger';
import { NotificationService } from './notification.service';

export class NotificationEventsService {
  // ---------------------------------------------------------------------------
  // A. SALES EVENTS
  // ---------------------------------------------------------------------------

  static async onSalesOrderCreated(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
    customerName?: string;
  }) {
    await NotificationService.notifySafe({
      title: `Sales Order Created: ${order.orderNumber}`,
      message: `New sales order ${order.orderNumber}${order.customerName ? ` for ${order.customerName}` : ''} was created in draft.`,
      type: NotificationType.INFO,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.LOW,
      eventKey: `sales.order.created:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber, warehouseId: order.warehouseId },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
        roles: ['OWNER', 'ADMIN'],
      },
    });
  }

  static async onSalesOrderSubmitted(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
  }) {
    await NotificationService.notifySafe({
      title: `Approval Required: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} has been submitted and awaits approval.`,
      type: NotificationType.ACTION_REQUIRED,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.HIGH,
      eventKey: `sales.order.submitted:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber },
      target: {
        permissions: ['sales.orders.approve'],
        warehouseId: order.warehouseId,
      },
    });
  }

  static async onSalesOrderApproved(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
  }) {
    await NotificationService.notifySafe({
      title: `Sales Order Approved: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} has been approved and is ready for confirmation.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.NORMAL,
      eventKey: `sales.order.approved:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
        permissions: ['sales.orders.confirm'],
        warehouseId: order.warehouseId,
      },
    });
  }

  static async onSalesOrderRejected(order: {
    id: string;
    orderNumber: string;
    salesmanId?: string | null;
    reason: string;
  }) {
    await NotificationService.notifySafe({
      title: `Sales Order Rejected: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} was rejected: ${order.reason}`,
      type: NotificationType.WARNING,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.HIGH,
      eventKey: `sales.order.rejected:${order.id}:${Date.now()}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber, reason: order.reason },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
      },
    });
  }

  static async onSalesOrderConfirmed(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
  }) {
    // Notify salesman and fulfillment team
    await NotificationService.notifySafe({
      title: `Sales Order Confirmed: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} is confirmed and inventory has been reserved.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.NORMAL,
      eventKey: `sales.order.confirmed:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
        permissions: ['sales.orders.fulfill'],
        warehouseId: order.warehouseId,
      },
    });

    // Notify production planners without exposing confidential pricing
    await NotificationService.notifySafe({
      title: `Confirmed Demand: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} was confirmed and may affect production demand.`,
      type: NotificationType.INFO,
      category: NotificationCategory.PRODUCTION,
      priority: NotificationPriority.NORMAL,
      eventKey: `production.demand.so_confirmed:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/production/demand`,
      metadata: { orderNumber: order.orderNumber },
      target: {
        permissions: ['production.demand.read'],
        warehouseId: order.warehouseId,
      },
    });
  }

  static async onSalesOrderCancelled(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
    reason: string;
  }) {
    await NotificationService.notifySafe({
      title: `Sales Order Cancelled: ${order.orderNumber}`,
      message: `Sales order ${order.orderNumber} was cancelled: ${order.reason}`,
      type: NotificationType.WARNING,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.NORMAL,
      eventKey: `sales.order.cancelled:${order.id}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber, reason: order.reason },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
        roles: ['OWNER', 'ADMIN'],
      },
    });
  }

  static async onSalesOrderFulfilled(order: {
    id: string;
    orderNumber: string;
    warehouseId: string;
    salesmanId?: string | null;
    status: string;
  }) {
    await NotificationService.notifySafe({
      title: `Sales Order ${order.status === 'FULFILLED' ? 'Fulfilled' : 'Partially Fulfilled'}: ${order.orderNumber}`,
      message: `Dispatch recorded for sales order ${order.orderNumber} (${order.status}).`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.SALES,
      priority: NotificationPriority.NORMAL,
      eventKey: `sales.order.fulfilled:${order.id}:${order.status}:${Date.now()}`,
      entityType: 'SalesOrder',
      entityId: order.id,
      actionUrl: `/sales/orders/${order.id}`,
      metadata: { orderNumber: order.orderNumber, status: order.status },
      target: {
        userIds: order.salesmanId ? [order.salesmanId] : [],
        permissions: ['sales.invoices.create'],
        warehouseId: order.warehouseId,
      },
    });
  }

  static async onSalesInvoiceEvent(
    invoice: {
      id: string;
      invoiceNumber: string;
      warehouseId: string;
      salesmanId?: string | null;
    },
    event: 'CREATED' | 'ISSUED' | 'CANCELLED',
    reason?: string,
  ) {
    const userIds = invoice.salesmanId ? [invoice.salesmanId] : [];
    const titleMap = {
      CREATED: `Sales Invoice Drafted: ${invoice.invoiceNumber}`,
      ISSUED: `Sales Invoice Issued: ${invoice.invoiceNumber}`,
      CANCELLED: `Sales Invoice Cancelled: ${invoice.invoiceNumber}`,
    };
    const msgMap = {
      CREATED: `Draft invoice ${invoice.invoiceNumber} has been created.`,
      ISSUED: `Invoice ${invoice.invoiceNumber} has been finalized and issued.`,
      CANCELLED: `Invoice ${invoice.invoiceNumber} was cancelled${reason ? `: ${reason}` : '.'}`,
    };
    const typeMap = {
      CREATED: NotificationType.INFO,
      ISSUED: NotificationType.SUCCESS,
      CANCELLED: NotificationType.WARNING,
    };

    await NotificationService.notifySafe({
      title: titleMap[event],
      message: msgMap[event],
      type: typeMap[event],
      category: NotificationCategory.FINANCE,
      priority: event === 'CANCELLED' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      eventKey: `sales.invoice.${event.toLowerCase()}:${invoice.id}`,
      entityType: 'SalesInvoice',
      entityId: invoice.id,
      actionUrl: `/sales/invoices/${invoice.id}`,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      target: {
        userIds,
        roles: ['OWNER', 'ADMIN'],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // B. INVENTORY EVENTS
  // ---------------------------------------------------------------------------

  static async evaluateInventoryAlerts(warehouseId: string, inventoryItemIds: string[]) {
    if (inventoryItemIds.length === 0) return;

    try {
      const setting = await prisma.systemConfig.findUnique({
        where: { key: 'NOTIFICATIONS_LOW_STOCK_ALERTS' },
      });
      if (setting && setting.value === 'false') {
        return;
      }

      const uniqueIds = Array.from(new Set(inventoryItemIds));
      const [warehouse, items, balances] = await Promise.all([
        prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { code: true, name: true } }),
        prisma.inventoryItem.findMany({
          where: { id: { in: uniqueIds }, isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            rawMaterial: { select: { minStockAlert: true } },
          },
        }),
        prisma.inventoryBalance.groupBy({
          by: ['inventoryItemId'],
          where: { warehouseId, inventoryItemId: { in: uniqueIds } },
          _sum: { quantityOnHand: true, quantityReserved: true },
        }),
      ]);

      const balMap = new Map(
        balances.map(b => [
          b.inventoryItemId,
          {
            onHand: new Prisma.Decimal(b._sum.quantityOnHand ?? 0),
            reserved: new Prisma.Decimal(b._sum.quantityReserved ?? 0),
          },
        ]),
      );

      for (const item of items) {
        const bal = balMap.get(item.id);
        const onHand = bal ? bal.onHand : new Prisma.Decimal(0);
        const available = bal ? bal.onHand.sub(bal.reserved) : new Prisma.Decimal(0);
        const reorder = new Prisma.Decimal(item.rawMaterial?.minStockAlert ?? 0);

        const zeroKey = `ZERO_STOCK:${warehouseId}:${item.id}`;
        const lowKey = `LOW_STOCK:${warehouseId}:${item.id}`;

        if (onHand.lte(0)) {
          await NotificationService.triggerStateAlert(zeroKey, {
            title: `Zero Stock Alert: ${item.code}`,
            message: `${item.name} (${item.code}) has reached zero stock in warehouse ${warehouse?.code ?? warehouseId}.`,
            type: NotificationType.ERROR,
            category: NotificationCategory.INVENTORY,
            priority: NotificationPriority.CRITICAL,
            entityType: 'InventoryItem',
            entityId: item.id,
            actionUrl: `/inventory/balances`,
            metadata: { itemCode: item.code, warehouseCode: warehouse?.code, onHand: onHand.toString() },
            target: {
              roles: ['OWNER', 'ADMIN'],
              permissions: ['inventory.read'],
              warehouseId,
            },
          });
        } else {
          await NotificationService.resolveStateAlert(zeroKey);
        }

        if (reorder.gt(0) && available.lte(reorder) && onHand.gt(0)) {
          await NotificationService.triggerStateAlert(lowKey, {
            title: `Low Stock Alert: ${item.code}`,
            message: `Available stock for ${item.name} (${item.code}) in ${warehouse?.code ?? warehouseId} is ${available.toString()} (reorder level: ${reorder.toString()}).`,
            type: NotificationType.WARNING,
            category: NotificationCategory.INVENTORY,
            priority: NotificationPriority.HIGH,
            entityType: 'InventoryItem',
            entityId: item.id,
            actionUrl: `/inventory/balances`,
            metadata: {
              itemCode: item.code,
              warehouseCode: warehouse?.code,
              available: available.toString(),
              reorderLevel: reorder.toString(),
            },
            target: {
              roles: ['OWNER', 'ADMIN'],
              permissions: ['inventory.read'],
              warehouseId,
            },
          });
        } else if (reorder.gt(0) && available.gt(reorder)) {
          await NotificationService.resolveStateAlert(lowKey);
        }
      }
    } catch (err) {
      logger.error(`evaluateInventoryAlerts failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  static async onInventoryReceiptPosted(receipt: {
    id: string;
    receiptNumber: string;
    warehouseId: string;
    itemIds: string[];
  }) {
    await NotificationService.notifySafe({
      title: `Stock Receipt Posted: ${receipt.receiptNumber}`,
      message: `Inventory receipt ${receipt.receiptNumber} has been posted to stock.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.LOW,
      eventKey: `inventory.receipt.posted:${receipt.id}`,
      entityType: 'InventoryReceipt',
      entityId: receipt.id,
      actionUrl: `/inventory/receipts`,
      metadata: { receiptNumber: receipt.receiptNumber },
      target: {
        permissions: ['inventory.read'],
        warehouseId: receipt.warehouseId,
      },
    });
    await this.evaluateInventoryAlerts(receipt.warehouseId, receipt.itemIds);
  }

  static async onInventoryIssuePosted(issue: {
    id: string;
    issueNumber: string;
    warehouseId: string;
    itemIds: string[];
  }) {
    await NotificationService.notifySafe({
      title: `Stock Issue Posted: ${issue.issueNumber}`,
      message: `Inventory issue ${issue.issueNumber} has been posted.`,
      type: NotificationType.INFO,
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.LOW,
      eventKey: `inventory.issue.posted:${issue.id}`,
      entityType: 'InventoryIssue',
      entityId: issue.id,
      actionUrl: `/inventory/issues`,
      metadata: { issueNumber: issue.issueNumber },
      target: {
        permissions: ['inventory.read'],
        warehouseId: issue.warehouseId,
      },
    });
    await this.evaluateInventoryAlerts(issue.warehouseId, issue.itemIds);
  }

  static async onInventoryTransferEvent(transfer: {
    id: string;
    transferNumber: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    event: 'DISPATCHED' | 'RECEIVED';
    itemIds: string[];
  }) {
    const isDispatched = transfer.event === 'DISPATCHED';
    await NotificationService.notifySafe({
      title: `Transfer ${isDispatched ? 'Dispatched' : 'Received'}: ${transfer.transferNumber}`,
      message: `Warehouse transfer ${transfer.transferNumber} has been ${isDispatched ? 'dispatched and is in transit' : 'received at destination'}.`,
      type: isDispatched ? NotificationType.INFO : NotificationType.SUCCESS,
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.NORMAL,
      eventKey: `inventory.transfer.${transfer.event.toLowerCase()}:${transfer.id}`,
      entityType: 'WarehouseTransfer',
      entityId: transfer.id,
      actionUrl: `/inventory/transfers`,
      metadata: { transferNumber: transfer.transferNumber },
      target: {
        permissions: ['inventory.read'],
        warehouseId: isDispatched ? transfer.toWarehouseId : transfer.fromWarehouseId,
      },
    });

    await this.evaluateInventoryAlerts(
      isDispatched ? transfer.fromWarehouseId : transfer.toWarehouseId,
      transfer.itemIds,
    );
  }

  static async onInventoryAdjustmentPosted(adj: {
    id: string;
    adjustmentNumber: string;
    warehouseId: string;
    itemIds: string[];
  }) {
    await NotificationService.notifySafe({
      title: `Stock Adjustment Posted: ${adj.adjustmentNumber}`,
      message: `Inventory adjustment ${adj.adjustmentNumber} has been posted.`,
      type: NotificationType.WARNING,
      category: NotificationCategory.INVENTORY,
      priority: NotificationPriority.NORMAL,
      eventKey: `inventory.adjustment.posted:${adj.id}`,
      entityType: 'StockAdjustment',
      entityId: adj.id,
      actionUrl: `/inventory/adjustments`,
      metadata: { adjustmentNumber: adj.adjustmentNumber },
      target: {
        roles: ['OWNER', 'ADMIN'],
        permissions: ['inventory.read'],
        warehouseId: adj.warehouseId,
      },
    });
    await this.evaluateInventoryAlerts(adj.warehouseId, adj.itemIds);
  }

  // ---------------------------------------------------------------------------
  // C. PRODUCTION EVENTS
  // ---------------------------------------------------------------------------

  static async onProductionPlanEvent(
    plan: { id: string; planNumber: string; warehouseId: string; createdById?: string | null },
    event: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SHORTAGE_DETECTED',
    reason?: string,
  ) {
    if (event === 'SUBMITTED') {
      await NotificationService.notifySafe({
        title: `Production Plan Submitted: ${plan.planNumber}`,
        message: `Production plan ${plan.planNumber} awaits approval.`,
        type: NotificationType.ACTION_REQUIRED,
        category: NotificationCategory.PRODUCTION,
        priority: NotificationPriority.HIGH,
        eventKey: `production.plan.submitted:${plan.id}`,
        entityType: 'ProductionPlan',
        entityId: plan.id,
        actionUrl: `/production/planning/${plan.id}`,
        target: { permissions: ['production.plans.approve'], warehouseId: plan.warehouseId },
      });
      return;
    }

    if (event === 'SHORTAGE_DETECTED') {
      await NotificationService.notifySafe({
        title: `Material Shortage in Plan: ${plan.planNumber}`,
        message: `Production plan ${plan.planNumber} detected raw/packaging material shortages.`,
        type: NotificationType.WARNING,
        category: NotificationCategory.INVENTORY,
        priority: NotificationPriority.HIGH,
        eventKey: `production.plan.shortage:${plan.id}:${Date.now()}`,
        entityType: 'ProductionPlan',
        entityId: plan.id,
        actionUrl: `/production/planning/${plan.id}`,
        target: {
          roles: ['OWNER', 'ADMIN'],
          permissions: ['inventory.read', 'production.plans.read'],
          warehouseId: plan.warehouseId,
        },
      });
      return;
    }

    const approved = event === 'APPROVED';
    await NotificationService.notifySafe({
      title: `Production Plan ${approved ? 'Approved' : 'Rejected'}: ${plan.planNumber}`,
      message: approved
        ? `Production plan ${plan.planNumber} has been approved.`
        : `Production plan ${plan.planNumber} was rejected${reason ? `: ${reason}` : '.'}`,
      type: approved ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: NotificationCategory.PRODUCTION,
      priority: approved ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
      eventKey: `production.plan.${event.toLowerCase()}:${plan.id}:${Date.now()}`,
      entityType: 'ProductionPlan',
      entityId: plan.id,
      actionUrl: `/production/planning/${plan.id}`,
      target: {
        userIds: plan.createdById ? [plan.createdById] : [],
        permissions: ['production.plans.read'],
        warehouseId: plan.warehouseId,
      },
    });
  }

  static async onWorkOrderEvent(
    wo: { id: string; workOrderNumber: string; warehouseId: string; assignedToId?: string | null },
    event: 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RELEASED' | 'COMPLETED',
    reason?: string,
  ) {
    const userIds = wo.assignedToId ? [wo.assignedToId] : [];
    const target =
      event === 'SUBMITTED'
        ? { permissions: ['production.work_orders.approve'], warehouseId: wo.warehouseId }
        : event === 'COMPLETED'
          ? { userIds, roles: ['OWNER', 'ADMIN'], warehouseId: wo.warehouseId }
          : { userIds, permissions: ['production.work_orders.read'], warehouseId: wo.warehouseId };

    await NotificationService.notifySafe({
      title: `Work Order ${event.charAt(0) + event.slice(1).toLowerCase()}: ${wo.workOrderNumber}`,
      message:
        event === 'REJECTED' && reason
          ? `Work order ${wo.workOrderNumber} was rejected: ${reason}`
          : `Work order ${wo.workOrderNumber} status changed to ${event}.`,
      type:
        event === 'SUBMITTED'
          ? NotificationType.ACTION_REQUIRED
          : event === 'REJECTED'
            ? NotificationType.WARNING
            : event === 'COMPLETED' || event === 'APPROVED' || event === 'RELEASED'
              ? NotificationType.SUCCESS
              : NotificationType.INFO,
      category: NotificationCategory.PRODUCTION,
      priority: event === 'SUBMITTED' || event === 'REJECTED' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      eventKey: `production.wo.${event.toLowerCase()}:${wo.id}:${Date.now()}`,
      entityType: 'WorkOrder',
      entityId: wo.id,
      actionUrl: `/production/work-orders/${wo.id}`,
      target,
    });
  }

  static async onProductionBatchEvent(
    batch: { id: string; batchNumber: string; warehouseId: string; operatorId?: string | null },
    event: 'STARTED' | 'PAUSED' | 'COMPLETED',
  ) {
    await NotificationService.notifySafe({
      title: `Production Batch ${event.charAt(0) + event.slice(1).toLowerCase()}: ${batch.batchNumber}`,
      message: `Batch ${batch.batchNumber} has been ${event.toLowerCase()}.`,
      type: event === 'COMPLETED' ? NotificationType.SUCCESS : event === 'PAUSED' ? NotificationType.WARNING : NotificationType.INFO,
      category: NotificationCategory.PRODUCTION,
      priority: event === 'PAUSED' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      eventKey: `production.batch.${event.toLowerCase()}:${batch.id}:${Date.now()}`,
      entityType: 'ProductionBatch',
      entityId: batch.id,
      actionUrl: `/production/execution/${batch.id}`,
      target: {
        userIds: batch.operatorId ? [batch.operatorId] : [],
        roles: ['OWNER', 'ADMIN'],
        permissions: ['production.batches.read'],
        warehouseId: batch.warehouseId,
      },
    });
  }

  static async onProductionCostingFinalized(costing: {
    batchId: string;
    batchNumber: string;
    variancePercent?: number;
  }) {
    await NotificationService.notifySafe({
      title: `Production Costing Finalized: ${costing.batchNumber}`,
      message: `Batch costing for ${costing.batchNumber} has been finalized.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.FINANCE,
      priority: NotificationPriority.NORMAL,
      eventKey: `production.costing.finalized:${costing.batchId}`,
      entityType: 'ProductionBatch',
      entityId: costing.batchId,
      actionUrl: `/production/costing/${costing.batchId}`,
      target: { roles: ['OWNER', 'ADMIN'], permissions: ['production.costing.read'] },
    });

    if (costing.variancePercent !== undefined && Math.abs(costing.variancePercent) >= 10) {
      await NotificationService.notifySafe({
        title: `High Production Variance: ${costing.batchNumber}`,
        message: `Batch ${costing.batchNumber} recorded a cost/material variance of ${costing.variancePercent.toFixed(1)}%.`,
        type: NotificationType.WARNING,
        category: NotificationCategory.PRODUCTION,
        priority: NotificationPriority.HIGH,
        eventKey: `production.variance.exceeded:${costing.batchId}`,
        entityType: 'ProductionBatch',
        entityId: costing.batchId,
        actionUrl: `/production/costing/${costing.batchId}`,
        target: { roles: ['OWNER', 'ADMIN'], permissions: ['production.costing.read'] },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // D. QUALITY EVENTS
  // ---------------------------------------------------------------------------

  static async onQualityInspectionEvent(inspection: {
    id: string;
    inspectionNumber: string;
    batchNumber?: string;
    status: string;
    warehouseId?: string;
    event: 'CREATED' | 'COMPLETED' | 'QUARANTINE_RELEASED';
  }) {
    const isRejectedOrQuarantined =
      inspection.status === 'REJECTED' || inspection.status === 'QUARANTINED';

    const title =
      inspection.event === 'CREATED'
        ? `Quality Inspection Required: ${inspection.inspectionNumber}`
        : inspection.event === 'QUARANTINE_RELEASED'
          ? `Quality Disposition Completed: ${inspection.inspectionNumber}`
          : `Quality Inspection ${inspection.status}: ${inspection.inspectionNumber}`;

    const message =
      inspection.event === 'CREATED'
        ? `Quality inspection ${inspection.inspectionNumber}${inspection.batchNumber ? ` for batch ${inspection.batchNumber}` : ''} requires inspection.`
        : `Inspection ${inspection.inspectionNumber} status updated to ${inspection.status}.`;

    await NotificationService.notifySafe({
      title,
      message,
      type: isRejectedOrQuarantined
        ? NotificationType.ERROR
        : inspection.event === 'CREATED'
          ? NotificationType.ACTION_REQUIRED
          : NotificationType.SUCCESS,
      category: NotificationCategory.QUALITY,
      priority: isRejectedOrQuarantined
        ? NotificationPriority.CRITICAL
        : inspection.event === 'CREATED'
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL,
      eventKey: `quality.inspection.${inspection.event.toLowerCase()}:${inspection.id}:${inspection.status}`,
      entityType: 'QualityInspection',
      entityId: inspection.id,
      actionUrl: `/production/quality`,
      target: {
        roles: ['OWNER', 'ADMIN'],
        permissions: ['production.quality.read'],
        warehouseId: inspection.warehouseId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // E. ADMINISTRATION & OPERATIONS EVENTS
  // ---------------------------------------------------------------------------

  static async onUserRegistered(user: { id: string; username: string; requestedRole?: string | null }) {
    await NotificationService.notifySafe({
      title: `New User Registered: ${user.username}`,
      message: `User account ${user.username}${user.requestedRole ? ` (${user.requestedRole})` : ''} was registered.`,
      type: NotificationType.INFO,
      category: NotificationCategory.ADMINISTRATION,
      priority: NotificationPriority.NORMAL,
      eventKey: `admin.user.registered:${user.id}`,
      entityType: 'User',
      entityId: user.id,
      actionUrl: `/admin/users`,
      target: { roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onUserAccountChanged(
    targetUserId: string,
    username: string,
    summary: string,
    eventSlug: string,
  ) {
    await NotificationService.notifySafe({
      title: `Account Updated: ${username}`,
      message: summary,
      type: NotificationType.INFO,
      category: NotificationCategory.ADMINISTRATION,
      priority: NotificationPriority.HIGH,
      eventKey: `admin.user.${eventSlug}:${targetUserId}:${Date.now()}`,
      entityType: 'User',
      entityId: targetUserId,
      actionUrl: `/admin/users`,
      target: { userIds: [targetUserId], roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onRolePermissionsChanged(role: { id: string; code: string; name: string }) {
    await NotificationService.notifySafe({
      title: `Role Permissions Updated: ${role.code}`,
      message: `Permissions for role ${role.name} (${role.code}) were modified.`,
      type: NotificationType.WARNING,
      category: NotificationCategory.ADMINISTRATION,
      priority: NotificationPriority.HIGH,
      eventKey: `admin.role.permissions:${role.id}:${Date.now()}`,
      entityType: 'Role',
      entityId: role.id,
      actionUrl: `/admin/roles`,
      target: { roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onWarehouseAccessChanged(params: {
    userId: string;
    warehouseId: string;
    warehouseCode: string;
    granted: boolean;
    accessLevel?: string;
  }) {
    await NotificationService.notifySafe({
      title: `Warehouse Access ${params.granted ? 'Granted' : 'Revoked'}: ${params.warehouseCode}`,
      message: params.granted
        ? `You were granted ${params.accessLevel ?? ''} access to warehouse ${params.warehouseCode}.`
        : `Your access to warehouse ${params.warehouseCode} was revoked.`,
      type: params.granted ? NotificationType.INFO : NotificationType.WARNING,
      category: NotificationCategory.ADMINISTRATION,
      priority: NotificationPriority.NORMAL,
      eventKey: `admin.warehouse_access.${params.granted ? 'granted' : 'revoked'}:${params.userId}:${params.warehouseId}:${Date.now()}`,
      entityType: 'Warehouse',
      entityId: params.warehouseId,
      actionUrl: `/admin/warehouse-access`,
      target: { userIds: [params.userId], roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onSystemSettingsChanged(keys: string[]) {
    const maintenanceKey = keys.find(k => k === 'MAINTENANCE_MODE');
    await NotificationService.notifySafe({
      title: maintenanceKey ? 'Maintenance Mode Updated' : 'System Settings Updated',
      message: `System settings updated: ${keys.join(', ')}.`,
      type: maintenanceKey ? NotificationType.WARNING : NotificationType.INFO,
      category: NotificationCategory.SYSTEM,
      priority: maintenanceKey ? NotificationPriority.CRITICAL : NotificationPriority.NORMAL,
      eventKey: `admin.settings.updated:${Date.now()}`,
      entityType: 'SystemConfig',
      actionUrl: maintenanceKey ? `/admin/maintenance` : `/admin/settings`,
      target: { roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onBackupEvent(backup: {
    id: string;
    backupName: string;
    failed: boolean;
    failureReason?: string | null;
  }) {
    await NotificationService.notifySafe({
      title: backup.failed
        ? `Backup Failed: ${backup.backupName}`
        : `Backup Completed: ${backup.backupName}`,
      message: backup.failed
        ? `Database backup ${backup.backupName} failed${backup.failureReason ? `: ${backup.failureReason}` : '.'}`
        : `Database backup ${backup.backupName} completed successfully.`,
      type: backup.failed ? NotificationType.ERROR : NotificationType.SUCCESS,
      category: NotificationCategory.SYSTEM,
      priority: backup.failed ? NotificationPriority.CRITICAL : NotificationPriority.LOW,
      eventKey: `operations.backup.${backup.failed ? 'failed' : 'completed'}:${backup.id}`,
      entityType: 'BackupRecord',
      entityId: backup.id,
      actionUrl: `/admin/backups`,
      target: { roles: ['OWNER', 'ADMIN'] },
    });
  }

  static async onRestoreRequestEvent(
    req: { id: string; requestedById: string; status: string },
    event: 'SUBMITTED' | 'APPROVED' | 'REJECTED',
  ) {
    await NotificationService.notifySafe({
      title: `Restore Request ${event.charAt(0) + event.slice(1).toLowerCase()}`,
      message: `Database restore request ${req.id.slice(0, 8)} is now ${req.status}.`,
      type: event === 'SUBMITTED' ? NotificationType.ACTION_REQUIRED : event === 'APPROVED' ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: NotificationCategory.SYSTEM,
      priority: NotificationPriority.HIGH,
      eventKey: `operations.restore.${event.toLowerCase()}:${req.id}`,
      entityType: 'RestoreRequest',
      entityId: req.id,
      actionUrl: `/admin/backups`,
      target: { userIds: [req.requestedById], roles: ['OWNER', 'ADMIN'] },
    });
  }
}
