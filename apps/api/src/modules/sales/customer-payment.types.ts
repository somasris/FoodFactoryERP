import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,2})?$/.test(val) && Number(val) > 0, {
    message: 'Amount must be a positive decimal with up to 2 decimal places',
  });

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const paymentModeSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'UPI',
  'CHEQUE',
  'NEFT_RTGS',
  'OTHER',
]);

export const paymentAllocationLineSchema = z.object({
  salesInvoiceId: z.string().uuid(),
  allocatedAmount: decimalPositive,
});

export const createCustomerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  paymentDate: dateStringSchema,
  amount: decimalPositive,
  paymentMode: paymentModeSchema,
  transactionReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  allocations: z.array(paymentAllocationLineSchema).optional(),
});

export const allocatePaymentSchema = z.object({
  allocations: z.array(paymentAllocationLineSchema).min(1, 'At least one allocation is required'),
});

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason is required').max(500),
});

export type CreateCustomerPaymentInput = z.infer<typeof createCustomerPaymentSchema>;
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
