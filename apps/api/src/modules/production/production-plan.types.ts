import { z } from 'zod';

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

export const demandAllocationInputSchema = z.object({
  salesOrderId: z.string().uuid(),
  salesOrderLineId: z.string().uuid(),
  allocatedQuantity: decimalPositive4,
});

export const productionPlanItemInputSchema = z.object({
  productVariantId: z.string().uuid(),
  plannedQuantity: decimalPositive4.optional(),
  minBatchQuantity: decimalPositive4.optional(),
  manualDemandQuantity: decimalPositive4.optional(),
  demandSources: z.array(demandAllocationInputSchema).optional().default([]),
});

export const createProductionPlanSchema = z.object({
  name: z.string().trim().max(150).optional(),
  warehouseId: z.string().uuid(),
  planDate: dateStringSchema,
  targetStartDate: dateStringSchema,
  targetEndDate: dateStringSchema,
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  items: z.array(productionPlanItemInputSchema).min(1, 'At least one plan item is required'),
});

export const updateProductionPlanSchema = z.object({
  name: z.string().trim().max(150).nullable().optional(),
  warehouseId: z.string().uuid().optional(),
  targetStartDate: dateStringSchema.nullable().optional(),
  targetEndDate: dateStringSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(productionPlanItemInputSchema).min(1).optional(),
});

export const rejectOrCancelPlanSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export type CreateProductionPlanInput = z.infer<typeof createProductionPlanSchema>;
export type UpdateProductionPlanInput = z.infer<typeof updateProductionPlanSchema>;
