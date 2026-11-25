import { z } from 'zod';

export const analyticsFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  financialYear: z.string().optional(),
  factoryId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

