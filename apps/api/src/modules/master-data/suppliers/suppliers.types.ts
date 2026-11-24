import { z } from 'zod';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const addressInputSchema = z.object({
  addressType: z.enum(['BILLING', 'SHIPPING', 'OFFICE', 'DISPATCH']).default('OFFICE'),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required').max(255),
  city: z.string().trim().min(1, 'City is required').max(50),
  state: z.string().trim().min(1, 'State is required').max(50),
  stateCode: z
    .string()
    .trim()
    .length(2, 'State code must be 2 digits')
    .regex(/^\d{2}$/, 'State code must be 2 digits'),
  pincode: z.string().trim().min(4, 'Pincode is required').max(10),
  isDefault: z.boolean().default(true),
});

export const createSupplierSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Supplier code is required')
    .max(20)
    .transform(v => v.toUpperCase()),
  legalName: z.string().trim().min(1, 'Legal name is required').max(150),
  tradeName: z.string().trim().max(150).optional().nullable(),
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
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  addresses: z.array(addressInputSchema).optional().default([]),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
