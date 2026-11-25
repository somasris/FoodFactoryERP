import { z } from 'zod';

const decimalPositive4 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
    message: 'Must be a positive decimal with up to 4 decimal places',
  });

const decimalNonNegative2 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0, {
    message: 'Must be a non-negative decimal with up to 2 decimal places',
  });

const decimalYieldPercent = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 100, {
    message: 'Yield percentage must be between 0.01 and 100',
  });

const decimalWastagePercent = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0 && Number(v) < 100, {
    message: 'Expected wastage percentage must be between 0 and 99.99',
  });

export const bomItemInputSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID'),
  standardQuantity: decimalPositive4,
  uomId: z.string().uuid('Invalid UOM ID'),
  scrapTolerancePercent: decimalNonNegative2.default('0'),
});

export const bomOverheadInputSchema = z.object({
  costType: z.enum(['LABOUR', 'UTILITY', 'MACHINE_DEPRECIATION', 'DIRECT_OVERHEAD']),
  description: z.string().trim().min(1, 'Overhead description is required').max(150),
  standardAmount: decimalNonNegative2,
});

export const createBomVersionBodySchema = z
  .object({
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
    expectedGoodOutput: decimalPositive4,
    yieldPercentage: decimalYieldPercent.optional().default('100'),
    expectedWastagePercent: decimalWastagePercent.optional().default('0'),
    outputUomId: z.string().uuid('Invalid output UOM ID'),
    remarks: z.string().trim().max(1000).optional().nullable(),
    items: z.array(bomItemInputSchema).min(1, 'At least one BOM component is required'),
    overheads: z.array(bomOverheadInputSchema).optional().default([]),
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

export const createBomSchema = z.object({
  productVariantId: z.string().uuid('Invalid product variant ID'),
  code: z
    .string()
    .trim()
    .min(1, 'BOM code is required')
    .max(30)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'BOM name is required').max(100),
  baseOutputQuantity: decimalPositive4,
  outputUomId: z.string().uuid('Invalid output UOM ID'),
  initialVersion: createBomVersionBodySchema.optional(),
});

export const updateBomHeaderSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform(v => v.toUpperCase())
    .optional(),
  name: z.string().trim().min(1).max(100).optional(),
  baseOutputQuantity: decimalPositive4.optional(),
  outputUomId: z.string().uuid('Invalid output UOM ID').optional(),
});

export const updateBomVersionSchema = createBomVersionBodySchema;

export const obsoleteBomVersionSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500).optional(),
});

export type CreateBomInput = z.infer<typeof createBomSchema>;
export type UpdateBomHeaderInput = z.infer<typeof updateBomHeaderSchema>;
export type CreateBomVersionInput = z.infer<typeof createBomVersionBodySchema>;
export type UpdateBomVersionInput = z.infer<typeof updateBomVersionSchema>;
