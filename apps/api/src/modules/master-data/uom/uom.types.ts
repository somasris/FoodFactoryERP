import { z } from 'zod';

export const createUomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'UOM code is required')
    .max(10, 'UOM code must be at most 10 characters')
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'UOM name is required').max(50),
  symbol: z.string().trim().min(1, 'UOM symbol is required').max(10),
  category: z.string().trim().min(1).max(30).default('GENERAL').transform(v => v.toUpperCase()),
  isBaseUnit: z.boolean().default(false),
  decimalPlaces: z.number().int().min(0).max(6).default(2),
});

export const updateUomSchema = createUomSchema.partial();

export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createUnitConversionSchema = z.object({
  fromUomId: z.string().uuid('Invalid source UOM ID'),
  toUomId: z.string().uuid('Invalid target UOM ID'),
  multiplier: z
    .union([z.number(), z.string()])
    .transform(val => String(val).trim())
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val) && Number(val) > 0, {
      message: 'Multiplier must be a positive decimal with up to 6 decimal places',
    }),
});

export const updateUnitConversionSchema = z.object({
  multiplier: z
    .union([z.number(), z.string()])
    .transform(val => String(val).trim())
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val) && Number(val) > 0, {
      message: 'Multiplier must be a positive decimal with up to 6 decimal places',
    }),
});

export const convertQuantitySchema = z.object({
  fromUomId: z.string().uuid('Invalid source UOM ID'),
  toUomId: z.string().uuid('Invalid target UOM ID'),
  quantity: z
    .union([z.number(), z.string()])
    .transform(val => String(val).trim())
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val) && Number(val) >= 0, {
      message: 'Quantity must be a non-negative decimal',
    }),
});

export type CreateUomInput = z.infer<typeof createUomSchema>;
export type UpdateUomInput = z.infer<typeof updateUomSchema>;
export type CreateUnitConversionInput = z.infer<typeof createUnitConversionSchema>;
export type UpdateUnitConversionInput = z.infer<typeof updateUnitConversionSchema>;
export type ConvertQuantityInput = z.infer<typeof convertQuantitySchema>;
