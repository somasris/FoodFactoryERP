import { z } from 'zod';

const decimalNonNeg4 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) >= 0, {
    message: 'Must be a non-negative decimal with up to 4 decimal places',
  });

const decimalPositive4 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: 'Must be a positive decimal with up to 4 decimal places',
  });

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const createBatchSchema = z.object({
  workOrderId: z.string().uuid(),
  plannedQuantity: decimalPositive4.optional(),
  operatorId: z.string().uuid().optional(),
  manufacturingDate: dateStringSchema,
  expiryDate: dateStringSchema,
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const consumeMaterialLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalPositive4,
  batchId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const consumeMaterialsSchema = z.object({
  lines: z.array(consumeMaterialLineSchema).min(1, 'At least one consumption line is required'),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const recordOutputSchema = z.object({
  goodQuantity: decimalNonNeg4,
  rejectedQuantity: decimalNonNeg4.optional().default('0'),
  wastageQuantity: decimalNonNeg4.optional().default('0'),
  wastageReason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const completeBatchSchema = z.object({
  goodQuantity: decimalPositive4.optional(),
  rejectedQuantity: decimalNonNeg4.optional(),
  wastageQuantity: decimalNonNeg4.optional(),
  wastageReason: z.string().trim().max(500).optional(),
  manufacturingDate: dateStringSchema,
  expiryDate: dateStringSchema,
  targetWarehouseId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const cancelOrPauseBatchSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const reserveBatchMaterialsSchema = z.object({
  warehouseId: z.string().uuid().optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type ConsumeMaterialsInput = z.infer<typeof consumeMaterialsSchema>;
export type RecordOutputInput = z.infer<typeof recordOutputSchema>;
export type CompleteBatchInput = z.infer<typeof completeBatchSchema>;
