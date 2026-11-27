import { Prisma, SyncConflictCategory, SyncOperationStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, toPlainJson } from '../master-data/master-data.utils';
import { getAuthorizedWarehouseIds, UserContext } from '../inventory/inventory.utils';
import { InventoryReceiptService } from '../inventory/inventory-receipt.service';
import { InventoryIssueService } from '../inventory/inventory-issue.service';
import { InventoryAdjustmentService } from '../inventory/inventory-adjustment.service';
import { InventoryTransferService } from '../inventory/inventory-transfer.service';
import { SalesService } from '../sales/sales.service';
import { ProductionPlanService } from '../production/production-plan.service';
import { WorkOrderService } from '../production/work-order.service';
import { ProductionBatchService } from '../production/production-batch.service';
import { MaterialFgService } from '../production/material-fg.service';
import {
  AllowedSyncOperationType,
  PullQueryInput,
  SyncOperationInput,
} from './sync.types';

const OPERATION_REQUIRED_PERMISSION: Record<AllowedSyncOperationType, string> = {
  INVENTORY_RECEIPT_DRAFT: 'inventory.receipt.create',
  INVENTORY_ISSUE_DRAFT: 'inventory.issue.create',
  INVENTORY_ADJUSTMENT_DRAFT: 'inventory.adjustment.create',
  WAREHOUSE_TRANSFER_DRAFT: 'inventory.transfer.create',
  SALES_ORDER_DRAFT_CREATE: 'sales.orders.create',
  SALES_ORDER_DRAFT_UPDATE: 'sales.orders.update',
  SALES_ORDER_SUBMIT: 'sales.orders.submit',
  PRODUCTION_PLAN_DRAFT: 'production.plans.create',
  WORK_ORDER_DRAFT_UPDATE: 'production.work_orders.update',
  BATCH_PROGRESS_LOG: 'production.batches.execute',
  BATCH_DOWNTIME_LOG: 'production.batches.execute',
  BATCH_MATERIAL_CONSUMPTION_DRAFT: 'production.batches.execute',
  BATCH_MATERIAL_RETURN_DRAFT: 'production.batches.execute',
  QUALITY_OBSERVATION_DRAFT: 'production.quality.inspect',
};

export interface SyncUserContext extends UserContext {
  username: string;
  permissions: string[];
}

export interface SyncOperationResult {
  operationId: string;
  idempotencyKey: string;
  status: SyncOperationStatus;
  duplicate?: boolean;
  serverEntityId?: string | null;
  serverVersion?: string | null;
  serverConflictId?: string;
  conflictCategory?: SyncConflictCategory;
  serverSnapshot?: Record<string, unknown> | null;
  errorCode?: string;
  errorMessage?: string;
}

function hasOperationPermission(user: SyncUserContext, opType: AllowedSyncOperationType): boolean {
  if (user.roles.includes('OWNER')) return true;
  if (user.roles.includes('AUDITOR')) return false;
  const required = OPERATION_REQUIRED_PERMISSION[opType];
  return user.permissions.includes(required);
}

function classifyError(err: unknown): {
  status: SyncOperationStatus;
  conflictCategory?: SyncConflictCategory;
  errorCode: string;
  errorMessage: string;
} {
  const message = err instanceof Error ? err.message : 'Operation synchronization failed';
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const lower = message.toLowerCase();

  if (statusCode === 403) {
    return {
      status: 'CONFLICT',
      conflictCategory: 'INSUFFICIENT_PERMISSION',
      errorCode: 'INSUFFICIENT_PERMISSION',
      errorMessage: message,
    };
  }
  if (statusCode === 409 || lower.includes('modified by another user') || lower.includes('version')) {
    return {
      status: 'CONFLICT',
      conflictCategory: 'RECORD_MODIFIED',
      errorCode: 'RECORD_MODIFIED',
      errorMessage: message,
    };
  }
  if (lower.includes('insufficient') && (lower.includes('stock') || lower.includes('balance') || lower.includes('available'))) {
    return {
      status: 'CONFLICT',
      conflictCategory: 'STOCK_UNAVAILABLE',
      errorCode: 'STOCK_UNAVAILABLE',
      errorMessage: message,
    };
  }
  if (lower.includes('already completed') || lower.includes('completed batch')) {
    return {
      status: 'CONFLICT',
      conflictCategory: 'BATCH_ALREADY_COMPLETED',
      errorCode: 'BATCH_ALREADY_COMPLETED',
      errorMessage: message,
    };
  }
  if (lower.includes('status') && (lower.includes('only') || lower.includes('transition') || lower.includes('cannot'))) {
    return {
      status: 'CONFLICT',
      conflictCategory: 'INVALID_STATE_TRANSITION',
      errorCode: 'INVALID_STATE_TRANSITION',
      errorMessage: message,
    };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return {
      status: 'FAILED',
      conflictCategory: 'VALIDATION_FAILED',
      errorCode: 'VALIDATION_FAILED',
      errorMessage: message,
    };
  }
  return {
    status: 'FAILED',
    errorCode: 'SERVER_ERROR',
    errorMessage: message,
  };
}

export class SyncService {
  static async getStatus(user: SyncUserContext) {
    const [syncedCount, failedCount, unresolvedConflicts] = await Promise.all([
      prisma.syncIdempotencyRecord.count({ where: { userId: user.userId, status: 'SYNCED' } }),
      prisma.syncIdempotencyRecord.count({ where: { userId: user.userId, status: 'FAILED' } }),
      prisma.syncConflict.count({ where: { userId: user.userId, resolvedAt: null } }),
    ]);

    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles,
      permissionsCount: user.permissions.length,
      syncedCount,
      failedCount,
      unresolvedConflicts,
      serverTimestamp: new Date().toISOString(),
    };
  }

  static async pushBatch(
    user: SyncUserContext,
    operations: SyncOperationInput[],
    meta: AuditMeta,
  ): Promise<{ results: SyncOperationResult[]; serverTimestamp: string }> {
    const results: SyncOperationResult[] = [];
    const localToServerIdMap = new Map<string, string>();

    for (const op of operations) {
      // 1. Server-side idempotency check scoped to authenticated user
      const existing = await prisma.syncIdempotencyRecord.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: user.userId,
            idempotencyKey: op.idempotencyKey,
          },
        },
      });

      if (existing && existing.status === 'SYNCED') {
        const cachedResp = (existing.responsePayload as Record<string, unknown> | null) ?? {};
        if (existing.entityId) {
          localToServerIdMap.set(op.entityId, existing.entityId);
        }
        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          status: 'SYNCED',
          duplicate: true,
          serverEntityId: existing.entityId,
          serverVersion: (cachedResp.serverVersion as string | undefined) ?? null,
        });
        continue;
      }

      // 2. Server-side RBAC check
      if (!hasOperationPermission(user, op.operationType)) {
        const reason = `Insufficient permission for ${op.operationType}.`;
        const serverConflictId = await this.recordConflict(
          user.userId,
          op,
          'INSUFFICIENT_PERMISSION',
          reason,
          null,
        );
        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          status: 'CONFLICT',
          serverConflictId,
          conflictCategory: 'INSUFFICIENT_PERMISSION',
          errorCode: 'INSUFFICIENT_PERMISSION',
          errorMessage: reason,
        });
        continue;
      }

      // 3. Dispatch to authoritative domain service
      try {
        if (!localToServerIdMap.has(op.entityId) && op.dependencyOperationIds?.length) {
          const depRecord = await prisma.syncIdempotencyRecord.findFirst({
            where: {
              userId: user.userId,
              operationId: { in: op.dependencyOperationIds },
              status: 'SYNCED',
              entityId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
          });
          if (depRecord?.entityId) {
            localToServerIdMap.set(op.entityId, depRecord.entityId);
          }
        }
        const resolvedEntityId = localToServerIdMap.get(op.entityId) ?? op.entityId;
        const outcome = await this.dispatchOperation(user, op, resolvedEntityId, meta);
        if (outcome.serverEntityId) {
          localToServerIdMap.set(op.entityId, outcome.serverEntityId);
        }

        await prisma.syncIdempotencyRecord.upsert({
          where: {
            userId_idempotencyKey: {
              userId: user.userId,
              idempotencyKey: op.idempotencyKey,
            },
          },
          create: {
            userId: user.userId,
            idempotencyKey: op.idempotencyKey,
            operationId: op.operationId,
            entityType: op.entityType,
            operationType: op.operationType,
            entityId: outcome.serverEntityId,
            status: 'SYNCED',
            responsePayload: toPlainJson({
              serverEntityId: outcome.serverEntityId,
              serverVersion: outcome.serverVersion,
            }) as Prisma.InputJsonValue,
          },
          update: {
            status: 'SYNCED',
            entityId: outcome.serverEntityId,
            responsePayload: toPlainJson({
              serverEntityId: outcome.serverEntityId,
              serverVersion: outcome.serverVersion,
            }) as Prisma.InputJsonValue,
          },
        });

        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          status: 'SYNCED',
          serverEntityId: outcome.serverEntityId,
          serverVersion: outcome.serverVersion,
        });
      } catch (err) {
        const classified = classifyError(err);
        let serverConflictId: string | undefined;
        let serverSnapshot: Record<string, unknown> | null = null;
        if (classified.status === 'CONFLICT' && classified.conflictCategory) {
          if (
            classified.conflictCategory === 'RECORD_MODIFIED' &&
            op.entityType === 'SALES_ORDER'
          ) {
            const resolvedId = localToServerIdMap.get(op.entityId) ?? op.entityId;
            const currentOrder = await prisma.salesOrder
              .findUnique({
                where: { id: resolvedId },
                select: { id: true, orderNumber: true, status: true, updatedAt: true },
              })
              .catch(() => null);
            if (currentOrder) {
              serverSnapshot = {
                id: currentOrder.id,
                orderNumber: currentOrder.orderNumber,
                status: currentOrder.status,
                updatedAt: currentOrder.updatedAt.toISOString(),
              };
            }
          }
          serverConflictId = await this.recordConflict(
            user.userId,
            op,
            classified.conflictCategory,
            classified.errorMessage,
            serverSnapshot,
          );
        } else {
          await prisma.syncIdempotencyRecord.upsert({
            where: {
              userId_idempotencyKey: {
                userId: user.userId,
                idempotencyKey: op.idempotencyKey,
              },
            },
            create: {
              userId: user.userId,
              idempotencyKey: op.idempotencyKey,
              operationId: op.operationId,
              entityType: op.entityType,
              operationType: op.operationType,
              status: classified.status,
              responsePayload: toPlainJson({
                errorCode: classified.errorCode,
                errorMessage: classified.errorMessage,
              }) as Prisma.InputJsonValue,
            },
            update: {
              status: classified.status,
              responsePayload: toPlainJson({
                errorCode: classified.errorCode,
                errorMessage: classified.errorMessage,
              }) as Prisma.InputJsonValue,
            },
          });
        }

        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          status: classified.status,
          serverConflictId,
          conflictCategory: classified.conflictCategory,
          serverSnapshot,
          errorCode: classified.errorCode,
          errorMessage: classified.errorMessage,
        });
      }
    }

    return {
      results,
      serverTimestamp: new Date().toISOString(),
    };
  }

  private static async recordConflict(
    userId: string,
    op: SyncOperationInput,
    category: SyncConflictCategory,
    reason: string,
    serverSnapshot: Record<string, unknown> | null,
  ): Promise<string> {
    const existing = await prisma.syncConflict.findFirst({
      where: {
        userId,
        operationId: op.operationId,
        resolvedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await prisma.syncConflict.create({
      data: {
        operationId: op.operationId,
        userId,
        entityType: op.entityType,
        entityId: op.entityId,
        operationType: op.operationType,
        category,
        reason,
        localPayload: toPlainJson(op.payload) as Prisma.InputJsonValue,
        serverSnapshot: serverSnapshot
          ? (toPlainJson(serverSnapshot) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    return created.id;
  }

  private static async dispatchOperation(
    user: SyncUserContext,
    op: SyncOperationInput,
    resolvedEntityId: string,
    meta: AuditMeta,
  ): Promise<{ serverEntityId: string | null; serverVersion: string | null }> {
    const payload = op.payload as Record<string, unknown>;

    switch (op.operationType) {
      case 'INVENTORY_RECEIPT_DRAFT': {
        const created = await InventoryReceiptService.create(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'INVENTORY_ISSUE_DRAFT': {
        const created = await InventoryIssueService.create(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'INVENTORY_ADJUSTMENT_DRAFT': {
        const created = await InventoryAdjustmentService.create(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'WAREHOUSE_TRANSFER_DRAFT': {
        const created = await InventoryTransferService.create(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'SALES_ORDER_DRAFT_CREATE': {
        const created = await SalesService.createOrder(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'SALES_ORDER_DRAFT_UPDATE': {
        if (op.baseServerVersion) {
          const current = await prisma.salesOrder.findUnique({
            where: { id: resolvedEntityId },
            select: { updatedAt: true },
          });
          if (current && current.updatedAt.toISOString() !== op.baseServerVersion) {
            throw new AppError(
              'Sales order was modified by another user since your offline snapshot.',
              409,
            );
          }
        }
        const updated = await SalesService.updateOrder(resolvedEntityId, payload as never, user, meta);
        return { serverEntityId: updated.id, serverVersion: updated.updatedAt.toISOString() };
      }
      case 'SALES_ORDER_SUBMIT': {
        const submitted = await SalesService.submitOrder(resolvedEntityId, user, meta);
        return { serverEntityId: submitted.id, serverVersion: submitted.updatedAt.toISOString() };
      }
      case 'PRODUCTION_PLAN_DRAFT': {
        const created = await ProductionPlanService.createPlan(payload as never, user, meta);
        return { serverEntityId: created.id, serverVersion: created.updatedAt.toISOString() };
      }
      case 'WORK_ORDER_DRAFT_UPDATE': {
        if (op.baseServerVersion) {
          const current = await prisma.workOrder.findUnique({
            where: { id: resolvedEntityId },
            select: { updatedAt: true },
          });
          if (current && current.updatedAt.toISOString() !== op.baseServerVersion) {
            throw new AppError(
              'Work order was modified by another user since your offline snapshot.',
              409,
            );
          }
        }
        const updated = await WorkOrderService.updateDraftWorkOrder(
          resolvedEntityId,
          payload as never,
          user,
          meta,
        );
        return { serverEntityId: updated.id, serverVersion: updated.updatedAt.toISOString() };
      }
      case 'BATCH_PROGRESS_LOG':
      case 'BATCH_DOWNTIME_LOG': {
        const batch = await prisma.productionBatch.findUnique({
          where: { id: resolvedEntityId },
          select: { id: true, status: true, updatedAt: true },
        });
        if (!batch) throw new AppError('Production batch not found.', 404);
        if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
          throw new AppError(`Batch already completed or cancelled (${batch.status}).`, 409);
        }
        if (op.baseServerVersion && batch.updatedAt.toISOString() !== op.baseServerVersion) {
          throw new AppError('Production batch was modified by another user.', 409);
        }
        if (op.operationType === 'BATCH_PROGRESS_LOG' && payload.goodQuantity !== undefined) {
          const updated = await ProductionBatchService.recordOutput(
            resolvedEntityId,
            payload as never,
            user,
            meta,
          );
          return { serverEntityId: updated.id, serverVersion: updated.updatedAt.toISOString() };
        }
        const entry = await prisma.productionExecutionEntry.create({
          data: {
            productionBatchId: resolvedEntityId,
            entryType: 'NOTE',
            notes: `[OFFLINE ${op.operationType} @ ${op.clientCreatedAt}] ${String(payload.notes || '')}`,
            recordedById: user.userId,
          },
        });
        return { serverEntityId: entry.id, serverVersion: new Date().toISOString() };
      }
      case 'BATCH_MATERIAL_CONSUMPTION_DRAFT': {
        const updated = await ProductionBatchService.consumeMaterials(
          resolvedEntityId,
          payload as never,
          user,
          meta,
        );
        return { serverEntityId: updated.id, serverVersion: updated.updatedAt.toISOString() };
      }
      case 'BATCH_MATERIAL_RETURN_DRAFT': {
        const result = await MaterialFgService.returnMaterials(
          resolvedEntityId,
          payload as never,
          user,
          meta,
        );
        return { serverEntityId: result.batchId, serverVersion: new Date().toISOString() };
      }
      case 'QUALITY_OBSERVATION_DRAFT': {
        const result = await MaterialFgService.inspectQuality(
          resolvedEntityId,
          payload as never,
          user,
          meta,
        );
        return { serverEntityId: result.id, serverVersion: new Date().toISOString() };
      }
      default:
        throw new AppError(`Unsupported offline operation type: ${op.operationType}`, 400);
    }
  }

  static async pullChanges(user: SyncUserContext, input: PullQueryInput) {
    const since = input.cursor ? new Date(input.cursor) : new Date(0);
    const limit = input.limit ?? 50;
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const types = new Set(
      input.entityTypes ?? [
        'PRODUCTS',
        'RAW_MATERIALS',
        'CUSTOMERS',
        'SUPPLIERS',
        'WAREHOUSES',
        'BOMS',
        'SALES_ORDERS',
        'PRODUCTION_PLANS',
        'WORK_ORDERS',
        'PRODUCTION_BATCHES',
      ],
    );

    const canMaster = user.roles.includes('OWNER') || user.permissions.includes('master_data.read');
    const canCustomers = user.roles.includes('OWNER') || user.permissions.includes('customers.read');
    const canSuppliers =
      user.roles.includes('OWNER') ||
      user.permissions.includes('suppliers.read') ||
      canMaster;
    const canSales = user.roles.includes('OWNER') || user.permissions.includes('sales.orders.read');
    const canPlans =
      user.roles.includes('OWNER') || user.permissions.includes('production.plans.read');
    const canWo =
      user.roles.includes('OWNER') || user.permissions.includes('production.work_orders.read');
    const canBatches =
      user.roles.includes('OWNER') || user.permissions.includes('production.batches.read');

    const [
      products,
      rawMaterials,
      customers,
      suppliers,
      warehouses,
      boms,
      salesOrders,
      productionPlans,
      workOrders,
      productionBatches,
    ] = await Promise.all([
      types.has('PRODUCTS') && canMaster
        ? prisma.product.findMany({
            where: { updatedAt: { gt: since } },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('RAW_MATERIALS') && canMaster
        ? prisma.rawMaterial.findMany({
            where: { updatedAt: { gt: since } },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('CUSTOMERS') && canCustomers
        ? prisma.customer.findMany({
            where: { updatedAt: { gt: since } },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('SUPPLIERS') && canSuppliers
        ? prisma.supplier.findMany({
            where: { updatedAt: { gt: since } },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('WAREHOUSES')
        ? prisma.warehouse.findMany({
            where: {
              updatedAt: { gt: since },
              ...(allowedWh ? { id: { in: allowedWh } } : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('BOMS') && (canMaster || user.permissions.includes('bom.read'))
        ? prisma.bOM.findMany({
            where: { updatedAt: { gt: since } },
            take: limit,
            orderBy: { updatedAt: 'asc' },
            include: { versions: { where: { status: 'ACTIVE' } } },
          })
        : [],
      types.has('SALES_ORDERS') && canSales
        ? prisma.salesOrder.findMany({
            where: {
              updatedAt: { gt: since },
              ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('PRODUCTION_PLANS') && canPlans
        ? prisma.productionPlan.findMany({
            where: {
              updatedAt: { gt: since },
              ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('WORK_ORDERS') && canWo
        ? prisma.workOrder.findMany({
            where: {
              updatedAt: { gt: since },
              ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
      types.has('PRODUCTION_BATCHES') && canBatches
        ? prisma.productionBatch.findMany({
            where: {
              updatedAt: { gt: since },
              ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        : [],
    ]);

    const allTimestamps = [
      ...products,
      ...rawMaterials,
      ...customers,
      ...suppliers,
      ...warehouses,
      ...boms,
      ...salesOrders,
      ...productionPlans,
      ...workOrders,
      ...productionBatches,
    ].map(r => r.updatedAt.toISOString());

    const nextCursor =
      allTimestamps.length > 0 ? allTimestamps.sort().reverse()[0] : new Date().toISOString();

    return {
      nextCursor,
      hasMore: [
        products,
        rawMaterials,
        customers,
        suppliers,
        warehouses,
        boms,
        salesOrders,
        productionPlans,
        workOrders,
        productionBatches,
      ].some(arr => arr.length >= limit),
      changes: {
        PRODUCTS: products,
        RAW_MATERIALS: rawMaterials,
        CUSTOMERS: customers,
        SUPPLIERS: suppliers,
        WAREHOUSES: warehouses,
        BOMS: boms,
        SALES_ORDERS: salesOrders,
        PRODUCTION_PLANS: productionPlans,
        WORK_ORDERS: workOrders,
        PRODUCTION_BATCHES: productionBatches,
      },
      serverTimestamp: new Date().toISOString(),
    };
  }

  static async getOperationStatus(userId: string, operationId: string) {
    const record = await prisma.syncIdempotencyRecord.findFirst({
      where: { userId, operationId },
    });
    if (!record) {
      throw new AppError('Sync operation record not found.', 404);
    }
    return record;
  }

  static async listConflicts(userId: string) {
    return prisma.syncConflict.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async resolveConflict(
    user: UserContext,
    conflictId: string,
    action: 'RETRY_AFTER_REFRESH' | 'REAPPLY' | 'DISCARD' | 'REVIEW_REQUESTED',
  ) {
    const conflict = await prisma.syncConflict.findUnique({ where: { id: conflictId } });
    if (!conflict || conflict.userId !== user.userId) {
      throw new AppError('Sync conflict not found.', 404);
    }
    return prisma.syncConflict.update({
      where: { id: conflictId },
      data: {
        resolvedAt: new Date(),
        resolutionAction: action,
        resolvedById: user.userId,
      },
    });
  }
}
