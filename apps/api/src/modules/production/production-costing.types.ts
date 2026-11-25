import { z } from 'zod';

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform(v => String(v).trim())
  .refine(v => /^-?\d+(\.\d+)?$/.test(v), 'Must be a valid decimal number');

const positiveDecimalStringSchema = decimalStringSchema.refine(
  v => Number(v) > 0,
  'Must be greater than zero',
);

const nonNegativeDecimalStringSchema = decimalStringSchema.refine(
  v => Number(v) >= 0,
  'Must be zero or greater',
);

export const listCostingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED']).optional(),
  workOrderId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
});

export const createCostEntrySchema = z.object({
  entryType: z.enum(['DIRECT_LABOUR', 'MACHINE_COST', 'OTHER_DIRECT_EXPENSE']),
  description: z.string().trim().min(1, 'Description is required').max(200),
  quantityOrHours: positiveDecimalStringSchema,
  rate: nonNegativeDecimalStringSchema,
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const reviewCostEntrySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().trim().max(1000).optional(),
});

export const createOverheadAllocationSchema = z.object({
  costType: z.enum(['LABOUR', 'UTILITY', 'MACHINE_DEPRECIATION', 'DIRECT_OVERHEAD']),
  description: z.string().trim().min(1, 'Description is required').max(150),
  allocationMethod: z.enum(['PER_BATCH', 'PER_UNIT', 'PERCENT_OF_MATERIAL', 'PER_LABOUR_HOUR']),
  rateOrAmount: nonNegativeDecimalStringSchema,
});

export const calculateCostingSchema = z.object({
  includeBomOverheads: z.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional(),
});

export const reviewCostingSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const finalizeCostingSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const postFinalizationNoteSchema = z.object({
  note: z.string().trim().min(1, 'Adjustment note is required').max(1000),
});

export const varianceReportQuerySchema = z.object({
  status: z.enum(['DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  productVariantId: z.string().uuid().optional(),
});
