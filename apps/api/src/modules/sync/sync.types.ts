import { z } from 'zod';

export const ALLOWED_SYNC_OPERATIONS = [
  'INVENTORY_RECEIPT_DRAFT',
  'INVENTORY_ISSUE_DRAFT',
  'INVENTORY_ADJUSTMENT_DRAFT',
  'WAREHOUSE_TRANSFER_DRAFT',
  'SALES_ORDER_DRAFT_CREATE',
  'SALES_ORDER_DRAFT_UPDATE',
  'SALES_ORDER_SUBMIT',
  'PRODUCTION_PLAN_DRAFT',
  'WORK_ORDER_DRAFT_UPDATE',
  'BATCH_PROGRESS_LOG',
  'BATCH_DOWNTIME_LOG',
  'BATCH_MATERIAL_CONSUMPTION_DRAFT',
  'BATCH_MATERIAL_RETURN_DRAFT',
  'QUALITY_OBSERVATION_DRAFT',
] as const;

export type AllowedSyncOperationType = (typeof ALLOWED_SYNC_OPERATIONS)[number];

export const syncOperationSchema = z.object({
  operationId: z.string().min(8).max(64),
  idempotencyKey: z.string().min(8).max(128),
  entityType: z.string().min(2).max(60),
  entityId: z.string().min(1).max(64),
  operationType: z.enum(ALLOWED_SYNC_OPERATIONS),
  payload: z.record(z.unknown()),
  factoryId: z.string().nullable().optional(),
  warehouseId: z.string().nullable().optional(),
  clientCreatedAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  clientUpdatedAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  baseServerVersion: z.string().nullable().optional(),
  localSequence: z.number().int().nonnegative(),
  dependencyOperationIds: z.array(z.string()).max(20).optional().default([]),
});

export const pushBatchSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(25),
});

export const pullQuerySchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  entityTypes: z
    .array(
      z.enum([
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
      ]),
    )
    .optional(),
});

export const resolveConflictSchema = z.object({
  action: z.enum(['RETRY_AFTER_REFRESH', 'REAPPLY', 'DISCARD', 'REVIEW_REQUESTED']),
});

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
export type PushBatchInput = z.infer<typeof pushBatchSchema>;
export type PullQueryInput = z.infer<typeof pullQuerySchema>;
