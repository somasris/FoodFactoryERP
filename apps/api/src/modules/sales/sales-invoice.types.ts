import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,4})?$/.test(val) && Number(val) > 0, {
    message: 'Must be a positive decimal number',
  });

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const invoiceLineInputSchema = z.object({
  salesOrderLineId: z.string().uuid(),
  quantity: decimalPositive,
});

export const createSalesInvoiceSchema = z.object({
  fulfillmentId: z.string().uuid().optional(),
  billingAddressId: z.string().uuid().optional(),
  invoiceDate: dateStringSchema,
  dueDate: dateStringSchema,
  notes: z.string().trim().max(1000).optional(),
  termsAndConditions: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  lines: z.array(invoiceLineInputSchema).min(1).optional(),
});

export const updateSalesInvoiceSchema = z.object({
  billingAddressId: z.string().uuid().nullable().optional(),
  dueDate: dateStringSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  termsAndConditions: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(invoiceLineInputSchema).min(1).optional(),
});

export const cancelSalesInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type UpdateSalesInvoiceInput = z.infer<typeof updateSalesInvoiceSchema>;
