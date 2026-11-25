import { z } from 'zod';

const decimalPositive4 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: 'Must be a positive decimal with up to 4 decimal places',
  });

const decimalNonNeg4 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) >= 0, {
    message: 'Must be a non-negative decimal with up to 4 decimal places',
  });

export const returnMaterialLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalPositive4,
  batchId: z.string().uuid().optional(),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const returnMaterialsSchema = z.object({
  lines: z.array(returnMaterialLineSchema).min(1, 'At least one return line is required'),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const varianceApprovalSchema = z.object({
  inventoryItemId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const inspectQualitySchema = z.object({
  decision: z.enum(['ACCEPTED', 'PARTIALLY_ACCEPTED', 'QUARANTINED', 'REJECTED']),
  goodQuantity: decimalNonNeg4.optional(),
  rejectedQuantity: decimalNonNeg4.optional(),
  defectCategory: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  evidenceRef: z.string().trim().max(255).optional(),
});

export const releaseOrDispositionSchema = z.object({
  releaseNotes: z.string().trim().min(3, 'Release/disposition notes must be at least 3 characters').max(500),
});

export type ReturnMaterialsInput = z.infer<typeof returnMaterialsSchema>;
export type VarianceApprovalInput = z.infer<typeof varianceApprovalSchema>;
export type InspectQualityInput = z.infer<typeof inspectQualitySchema>;
