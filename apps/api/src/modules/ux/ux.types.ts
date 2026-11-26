import { z } from 'zod';

export const SAVED_VIEW_MODULES = [
  'sales_orders',
  'inventory_balances',
  'batch_expiry',
  'work_orders',
  'quality_inspections',
] as const;

export type SavedViewModule = (typeof SAVED_VIEW_MODULES)[number];

export const MODULE_REQUIRED_PERMISSION: Record<SavedViewModule, string> = {
  sales_orders: 'sales.orders.read',
  inventory_balances: 'inventory.read',
  batch_expiry: 'inventory.read',
  work_orders: 'production.work_orders.read',
  quality_inspections: 'production.quality.read',
};

export const dashboardPreferenceSchema = z.object({
  dashboardId: z.enum(['executive', 'sales', 'inventory', 'production']),
  hiddenWidgetIds: z.array(z.string().min(1).max(60)).max(30),
  widgetOrder: z.array(z.string().min(1).max(60)).max(30),
});

export const tourPreferenceSchema = z.object({
  completed: z.boolean(),
});

// Safe filter value schema validated per saved view
const filterScalarSchema = z.union([z.string().max(120), z.number(), z.boolean(), z.null()]);
export const savedViewFiltersSchema = z.record(z.string().min(1).max(50), filterScalarSchema);

export const savedViewSortSchema = z
  .object({
    field: z.string().min(1).max(50),
    direction: z.enum(['asc', 'desc']),
  })
  .optional()
  .nullable();

export const createSavedViewSchema = z.object({
  module: z.enum(SAVED_VIEW_MODULES),
  name: z.string().trim().min(1, 'View name is required').max(80),
  filters: savedViewFiltersSchema,
  sort: savedViewSortSchema,
  columns: z.array(z.string().min(1).max(50)).max(30).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const updateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  filters: savedViewFiltersSchema.optional(),
  sort: savedViewSortSchema,
  columns: z.array(z.string().min(1).max(50)).max(30).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const activityCategoryEnum = z.enum([
  'ALL',
  'SALES',
  'INVENTORY',
  'PRODUCTION',
  'QUALITY',
  'ADMINISTRATION',
  'AUTH',
]);

export const activityTimelineQuerySchema = z.object({
  category: activityCategoryEnum.optional().default('ALL'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type DashboardPreferenceInput = z.infer<typeof dashboardPreferenceSchema>;
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
export type ActivityTimelineQuery = z.infer<typeof activityTimelineQuerySchema>;
