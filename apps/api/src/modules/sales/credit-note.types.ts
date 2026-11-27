import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,4})?$/.test(val) && Number(val) > 0, {
    message: 'Quantity must be a positive decimal',
  });

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const creditNoteLineInputSchema = z.object({
  originalInvoiceLineId: z.string().uuid(),
  quantity: decimalPositive,
});

export const createCreditNoteSchema = z.object({
  salesInvoiceId: z.string().uuid(),
  creditNoteDate: dateStringSchema,
  reason: z.string().trim().min(3, 'Credit note reason is required').max(500),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  lines: z.array(creditNoteLineInputSchema).min(1, 'At least one credit note line is required'),
});

export const cancelCreditNoteSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type CancelCreditNoteInput = z.infer<typeof cancelCreditNoteSchema>;
