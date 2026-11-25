import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,4})?$/.test(val) && Number(val) > 0, {
    message: 'Must be a positive decimal number',
  });

const discountPercentSchema = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,2})?$/.test(val) && Number(val) >= 0 && Number(val) <= 100, {
    message: 'Discount percent must be between 0 and 100',
  })
  .optional()
  .default('0');

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const salesOrderLineInputSchema = z.object({
  productVariantId: z.string().uuid(),
  uomId: z.string().uuid(),
  orderedQuantity: decimalPositive,
  discountPercent: discountPercentSchema,
  notes: z.string().trim().max(500).optional(),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().uuid(),
  shippingAddressId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  orderDate: dateStringSchema,
  expectedDeliveryDate: dateStringSchema,
  notes: z.string().trim().max(1000).optional(),
  deliveryInstructions: z.string().trim().max(1000).optional(),
  lines: z.array(salesOrderLineInputSchema).min(1, 'At least one order line is required'),
});

export const updateSalesOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  shippingAddressId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().optional(),
  expectedDeliveryDate: dateStringSchema.nullable(),
  notes: z.string().trim().max(1000).nullable().optional(),
  deliveryInstructions: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(salesOrderLineInputSchema).min(1, 'At least one order line is required').optional(),
});

export const rejectSalesOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason is required').max(500),
});

export const cancelSalesOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});

export const confirmSalesOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export const fulfillSalesOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().uuid(),
        quantity: decimalPositive,
      }),
    )
    .min(1)
    .optional(),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type FulfillSalesOrderInput = z.infer<typeof fulfillSalesOrderSchema>;
