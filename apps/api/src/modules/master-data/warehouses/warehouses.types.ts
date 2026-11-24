import { z } from 'zod';

export const createWarehouseSchema = z.object({
  factoryId: z.string().uuid('Invalid factory ID'),
  code: z
    .string()
    .trim()
    .min(1, 'Warehouse code is required')
    .max(20)
    .transform(v => v.toUpperCase()),
  name: z.string().trim().min(1, 'Warehouse name is required').max(100),
  warehouseType: z.enum([
    'RAW_MATERIAL',
    'PACKAGING',
    'FINISHED_GOODS',
    'GENERAL',
    'SCRAP_DAMAGED',
  ]),
  address: z.string().trim().max(1000).optional().nullable(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
