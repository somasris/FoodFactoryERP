import { z } from 'zod';

const decimalNonNegative = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) >= 0, {
    message: 'Must be a non-negative decimal with up to 4 decimal places',
  });

export const createRawMaterialCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Category code is required')
    .max(20)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Category name is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateRawMaterialCategorySchema = createRawMaterialCategorySchema.partial();

export const ALLERGEN_CODES = [
  'MILK',
  'PEANUTS',
  'TREE_NUTS',
  'SOY',
  'WHEAT_GLUTEN',
  'EGGS',
  'FISH',
  'CRUSTACEANS',
  'SESAME',
] as const;

export const allergenCodeEnum = z.enum(ALLERGEN_CODES);
export const allergenDeclarationStatusEnum = z.enum(['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE']);

export const createRawMaterialSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  code: z
    .string()
    .trim()
    .min(1, 'Raw material code is required')
    .max(30)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Raw material name is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  materialType: z.enum(['RAW_INGREDIENT', 'PACKAGING_PRIMARY', 'PACKAGING_SECONDARY']),
  uomId: z.string().uuid('Invalid UOM ID'),
  hsnCode: z.string().trim().min(2, 'HSN code is required').max(10),
  taxRateId: z.string().uuid('Invalid tax rate ID'),
  minStockAlert: decimalNonNegative.default('0'),
  reorderQuantity: decimalNonNegative.optional().nullable(),
  allergenStatus: allergenDeclarationStatusEnum.optional().default('UNKNOWN'),
  allergens: z.array(allergenCodeEnum).optional().default([]),
  crossContactAllergens: z.array(allergenCodeEnum).optional().default([]),
});

export const updateRawMaterialSchema = createRawMaterialSchema.partial();

export type CreateRawMaterialCategoryInput = z.infer<typeof createRawMaterialCategorySchema>;
export type UpdateRawMaterialCategoryInput = z.infer<typeof updateRawMaterialCategorySchema>;
export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>;
