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

export const createWorkOrderSchema = z.object({
  productionPlanId: z.string().uuid(),
  productionPlanItemId: z.string().uuid(),
  plannedQuantity: decimalPositive4.optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
  plannedStartDate: dateStringSchema,
  plannedEndDate: dateStringSchema,
  productionLine: z.string().trim().max(80).optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const updateWorkOrderSchema = z.object({
  plannedQuantity: decimalPositive4.optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  plannedStartDate: dateStringSchema.nullable().optional(),
  plannedEndDate: dateStringSchema.nullable().optional(),
  productionLine: z.string().trim().max(80).nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
});

export const rejectOrCancelWorkOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
