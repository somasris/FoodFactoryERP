import { z } from 'zod';

export const handoverPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const handoverStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'RETURNED', 'CLOSED']);

export const createHandoverSchema = z.object({
  factoryId: z.string().uuid(),
  warehouseId: z.string().uuid().optional().nullable(),
  productionLine: z.string().trim().max(80).optional().nullable(),
  shiftName: z.string().trim().min(1).max(40),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  incomingUserId: z.string().uuid().optional().nullable(),
  priority: handoverPriorityEnum.optional().default('NORMAL'),
  activeBatchesSummary: z.array(z.string().max(120)).max(20).optional().nullable(),
  pendingWorkOrdersSummary: z.array(z.string().max(120)).max(20).optional().nullable(),
  materialShortagesSummary: z.array(z.string().max(120)).max(20).optional().nullable(),
  equipmentIssues: z.string().trim().max(2000).optional().nullable(),
  pendingQualityNotes: z.string().trim().max(2000).optional().nullable(),
  productionDelays: z.string().trim().max(2000).optional().nullable(),
  safetyObservations: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const updateHandoverSchema = createHandoverSchema.partial().omit({ factoryId: true });

export const listHandoverQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shiftName: z.string().trim().max(40).optional(),
  status: handoverStatusEnum.optional(),
  priority: handoverPriorityEnum.optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const acknowledgeHandoverSchema = z.object({
  acknowledgementNotes: z.string().trim().max(1000).optional().nullable(),
});

export const returnHandoverSchema = z.object({
  returnReason: z.string().trim().min(3, 'Return reason is required').max(1000),
});

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: 'Quantity must be a positive decimal with up to 4 decimal places',
  });

export const evaluateSubstitutionSchema = z.object({
  warehouseId: z.string().uuid(),
  bomId: z.string().uuid(),
  bomVersionId: z.string().uuid(),
  originalItemId: z.string().uuid(),
  substituteItemId: z.string().uuid(),
  requiredQuantity: decimalPositive,
  uomId: z.string().uuid(),
  productionBatchId: z.string().uuid().optional().nullable(),
  workOrderId: z.string().uuid().optional().nullable(),
});

export const createSubstitutionRequestSchema = evaluateSubstitutionSchema.extend({
  reason: z.string().trim().min(5, 'Substitution reason is required').max(1000),
});

export const approveSubstitutionSchema = z.object({
  approvalNotes: z.string().trim().max(1000).optional().nullable(),
});

export const rejectSubstitutionSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'Rejection reason is required').max(1000),
});

export const applySubstitutionSchema = z.object({
  applicationNotes: z.string().trim().max(1000).optional().nullable(),
});

export type CreateHandoverInput = z.infer<typeof createHandoverSchema>;
export type UpdateHandoverInput = z.infer<typeof updateHandoverSchema>;
export type ListHandoverQuery = z.infer<typeof listHandoverQuerySchema>;
export type EvaluateSubstitutionInput = z.infer<typeof evaluateSubstitutionSchema>;
export type CreateSubstitutionRequestInput = z.infer<typeof createSubstitutionRequestSchema>;
