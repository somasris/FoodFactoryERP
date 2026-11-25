import { z } from 'zod';

export const reportPeriodSchema = z.enum(['today', 'week', 'month', 'fy', 'custom']).default('month');

export const baseReportQuerySchema = z.object({
  period: reportPeriodSchema.optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  productCategoryId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  productionPlanId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  productionBatchId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const trendsQuerySchema = baseReportQuerySchema.extend({
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export const exportReportParamsSchema = z.object({
  reportType: z.enum([
    'plan-vs-actual',
    'work-order-performance',
    'batch-yield',
    'material-consumption',
    'quality',
    'costing',
  ]),
});

export const exportReportQuerySchema = baseReportQuerySchema.extend({
  format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});

export type BaseReportQuery = z.infer<typeof baseReportQuerySchema>;
export type TrendsQuery = z.infer<typeof trendsQuerySchema>;
export type ExportReportType = z.infer<typeof exportReportParamsSchema>['reportType'];
export type ExportFormat = z.infer<typeof exportReportQuerySchema>['format'];
