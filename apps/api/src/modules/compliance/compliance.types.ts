import { AdjustmentReason } from '@prisma/client';
import { z } from 'zod';

export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  financialYear: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
  includeDrafts: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
});

export const createStockAuditSchema = z.object({
  warehouseId: z.string().uuid(),
  auditDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        batchId: z.string().uuid().optional().nullable(),
        uomId: z.string().uuid(),
        countedQuantity: z.number().min(0),
        varianceReason: z.nativeEnum(AdjustmentReason).optional().nullable(),
        remarks: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1, 'At least one counted item line is required'),
});

export const reviewStockAuditSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
});

export const postStockAuditSchema = z.object({
  idempotencyKey: z.string().min(4).max(100).optional(),
});

export const ALLOWED_COMPLIANCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|ps1|js|mjs|cjs|vbs|msi|dll|so|py|php)$/i;

export const createComplianceDocSchema = z.object({
  category: z.enum(['FSSAI', 'GST', 'QUALITY_CERT', 'CALIBRATION', 'AUDIT_EVIDENCE', 'OTHER']),
  referenceNumber: z.string().min(2).max(100),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional()
    .nullable(),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().max(36).optional().nullable(),
  fileName: z
    .string()
    .min(3)
    .max(255)
    .refine(name => !BLOCKED_EXTENSIONS.test(name), 'Executable file types are strictly prohibited'),
  mimeType: z
    .string()
    .refine(
      mime => ALLOWED_COMPLIANCE_MIME_TYPES.has(mime),
      'Unsupported file type. Allowed: PDF, PNG, JPEG, CSV, XLSX',
    ),
  fileSizeBytes: z.number().int().min(1).max(10 * 1024 * 1024, 'Max file size is 10 MB'),
  fileReference: z.string().min(3).max(500),
  remarks: z.string().max(500).optional().nullable(),
});

export const verifyComplianceDocSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  remarks: z.string().max(500).optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type CreateStockAuditInput = z.infer<typeof createStockAuditSchema>;
export type ReviewStockAuditInput = z.infer<typeof reviewStockAuditSchema>;
export type CreateComplianceDocInput = z.infer<typeof createComplianceDocSchema>;
export type VerifyComplianceDocInput = z.infer<typeof verifyComplianceDocSchema>;
