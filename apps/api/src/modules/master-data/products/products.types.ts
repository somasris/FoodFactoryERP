import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, {
    message: 'Must be a positive decimal with up to 2 decimal places',
  });

const decimalNonNegative2 = z
  .union([z.number(), z.string()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0, {
    message: 'Must be a non-negative decimal with up to 2 decimal places',
  });

export const createProductCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Category code is required')
    .max(20)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Category name is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  code: z
    .string()
    .trim()
    .min(1, 'Product code is required')
    .max(30)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Product name is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  baseUomId: z.string().uuid('Invalid base UOM ID'),
  hsnCode: z.string().trim().min(2, 'HSN code is required').max(10),
  taxRateId: z.string().uuid('Invalid tax rate ID'),
});

export const updateProductSchema = createProductSchema.partial();

export const createProductVariantSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(30)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Variant name is required').max(100),
  netWeightGrams: decimalPositive,
  uomId: z.string().uuid('Invalid UOM ID'),
  defaultSellingPrice: decimalNonNegative2,
  barcode: z.string().trim().max(50).optional().nullable(),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
