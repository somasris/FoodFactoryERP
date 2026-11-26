import { z } from 'zod';

export const ALLERGEN_CATEGORIES = [
  { code: 'MILK', label: 'Milk and dairy' },
  { code: 'PEANUTS', label: 'Peanuts' },
  { code: 'TREE_NUTS', label: 'Tree nuts' },
  { code: 'SOY', label: 'Soy' },
  { code: 'WHEAT_GLUTEN', label: 'Wheat / gluten' },
  { code: 'EGGS', label: 'Eggs' },
  { code: 'FISH', label: 'Fish' },
  { code: 'CRUSTACEANS', label: 'Crustaceans' },
  { code: 'SESAME', label: 'Sesame' },
] as const;

export const shelfLifeRadarQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  itemType: z.enum(['RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS']).optional(),
  riskWindow: z
    .enum(['ALL', 'EXPIRED', 'EXPIRING_7D', 'EXPIRING_15D', 'EXPIRING_30D', 'LONGER_SHELF_LIFE', 'NO_EXPIRY'])
    .optional()
    .default('ALL'),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const efficiencyScorecardQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'fy', 'custom']).optional().default('month'),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  factoryId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export type ShelfLifeRadarQuery = z.infer<typeof shelfLifeRadarQuerySchema>;
export type EfficiencyScorecardQuery = z.infer<typeof efficiencyScorecardQuerySchema>;
