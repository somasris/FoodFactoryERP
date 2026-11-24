import { z } from 'zod';
import { addressInputSchema } from '../suppliers/suppliers.types';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const decimalNonNegative2 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0, {
    message: 'Credit limit must be a non-negative decimal with up to 2 decimal places',
  });

export const createCustomerSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Customer code is required')
    .max(20)
    .transform(v => v.toUpperCase()),
  legalName: z.string().trim().min(1, 'Legal name is required').max(150),
  tradeName: z.string().trim().max(150).optional().nullable(),
  customerType: z.enum(['RETAILER', 'DISTRIBUTOR', 'WHOLESALER', 'DIRECT']),
  contactName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email').max(100).optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(20).optional().nullable(),
  gstin: z
    .string()
    .trim()
    .transform(v => v.toUpperCase())
    .refine(v => v === '' || gstinRegex.test(v), 'Invalid GSTIN format')
    .optional()
    .nullable(),
  pan: z
    .string()
    .trim()
    .transform(v => v.toUpperCase())
    .refine(v => v === '' || panRegex.test(v), 'Invalid PAN format')
    .optional()
    .nullable(),
  creditPeriodDays: z.number().int().min(0).max(365).default(15),
  creditLimit: decimalNonNegative2.default('0'),
  addresses: z.array(addressInputSchema).optional().default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
