import { z } from 'zod';
import { Prisma } from '@prisma/client';

const decimalRate = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v), {
    message: 'Percentage must be a valid decimal with up to 2 decimal places',
  })
  .refine(
    v => {
      const d = new Prisma.Decimal(v);
      return d.gte(0) && d.lte(100);
    },
    { message: 'Tax percentage must be between 0 and 100' },
  );

export const createTaxRateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Tax code is required')
      .max(20)
      .transform(v => v.toUpperCase()),
    name: z.string().trim().min(1, 'Tax name is required').max(50),
    ratePercentage: decimalRate,
    cgstPercentage: decimalRate,
    sgstPercentage: decimalRate,
    igstPercentage: decimalRate,
  })
  .superRefine((data, ctx) => {
    const rate = new Prisma.Decimal(data.ratePercentage);
    const cgst = new Prisma.Decimal(data.cgstPercentage);
    const sgst = new Prisma.Decimal(data.sgstPercentage);
    const igst = new Prisma.Decimal(data.igstPercentage);

    if (!cgst.add(sgst).equals(rate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CGST + SGST must equal total rate percentage',
        path: ['cgstPercentage'],
      });
    }
    if (!igst.equals(rate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'IGST must equal total rate percentage',
        path: ['igstPercentage'],
      });
    }
  });

export const updateTaxRateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform(v => v.toUpperCase())
    .optional(),
  name: z.string().trim().min(1).max(50).optional(),
  ratePercentage: decimalRate.optional(),
  cgstPercentage: decimalRate.optional(),
  sgstPercentage: decimalRate.optional(),
  igstPercentage: decimalRate.optional(),
});

export const createTaxConfigSchema = z
  .object({
    hsnCode: z
      .string()
      .trim()
      .min(2, 'HSN code must be at least 2 characters')
      .max(10, 'HSN code must be at most 10 characters'),
    description: z.string().trim().max(255).optional().nullable(),
    taxRateId: z.string().uuid('Invalid tax rate ID'),
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
  })
  .refine(
    data => {
      if (data.effectiveFrom && data.effectiveTo) {
        return data.effectiveTo >= data.effectiveFrom;
      }
      return true;
    },
    {
      message: 'Effective To date must be on or after Effective From date',
      path: ['effectiveTo'],
    },
  );

export const updateTaxConfigSchema = z.object({
  hsnCode: z.string().trim().min(2).max(10).optional(),
  description: z.string().trim().max(255).optional().nullable(),
  taxRateId: z.string().uuid('Invalid tax rate ID').optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;
export type CreateTaxConfigInput = z.infer<typeof createTaxConfigSchema>;
export type UpdateTaxConfigInput = z.infer<typeof updateTaxConfigSchema>;
