import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,4})?$/.test(val) && Number(val) > 0, {
    message: 'Must be a positive decimal',
  });

const decimalNonNegative = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,2})?$/.test(val) && Number(val) >= 0, {
    message: 'Must be a non-negative decimal',
  });

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const supplierInvoiceLineInputSchema = z.object({
  inventoryItemId: z.string().uuid(),
  description: z.string().trim().max(200).optional(),
  hsnCode: z.string().trim().min(2).max(10).optional(),
  quantity: decimalPositive,
  uomId: z.string().uuid(),
  unitPrice: decimalNonNegative,
  discountPercent: decimalNonNegative.optional().default('0'),
  taxRatePercent: decimalNonNegative.optional(),
});

export const createSupplierInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  factoryId: z.string().uuid(),
  supplierInvoiceNumber: z.string().trim().min(1, 'Supplier invoice number is required').max(60),
  invoiceDate: dateStringSchema,
  receivedDate: dateStringSchema.optional(),
  dueDate: dateStringSchema.optional(),
  supplierGstin: z.string().trim().max(15).optional(),
  supplierStateCode: z.string().trim().length(2).optional(),
  itcStatus: z.enum(['PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE']).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  lines: z.array(supplierInvoiceLineInputSchema).min(1, 'At least one line item is required'),
});

export const updateSupplierInvoiceSchema = z.object({
  supplierInvoiceNumber: z.string().trim().min(1).max(60).optional(),
  invoiceDate: dateStringSchema.optional(),
  receivedDate: dateStringSchema.optional(),
  dueDate: dateStringSchema.nullable().optional(),
  itcStatus: z.enum(['PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE']).optional(),
  itcNotes: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(supplierInvoiceLineInputSchema).min(1).optional(),
});

export const cancelSupplierInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});

export const matchReceiptsSchema = z.object({
  receiptIds: z.array(z.string().uuid()).min(1, 'At least one inventory receipt is required'),
  notes: z.string().trim().max(500).optional(),
});

export const updateItcSchema = z.object({
  itcStatus: z.enum(['PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE']),
  itcNotes: z.string().trim().max(500).optional(),
});

export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>;
export type MatchReceiptsInput = z.infer<typeof matchReceiptsSchema>;
