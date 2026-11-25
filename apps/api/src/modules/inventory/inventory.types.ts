import { z } from 'zod';

const decimalPositive = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,6})?$/.test(val) && Number(val) > 0, {
    message: 'Must be a positive decimal number',
  });

const decimalNonNegative = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^\d+(\.\d{1,6})?$/.test(val) && Number(val) >= 0, {
    message: 'Must be a non-negative decimal number',
  });

const decimalNonZeroSigned = z
  .union([z.number(), z.string()])
  .transform(val => String(val).trim())
  .refine(val => /^-?\d+(\.\d{1,6})?$/.test(val) && Number(val) !== 0, {
    message: 'Must be a non-zero decimal number',
  });

export const idempotencySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

// --- Receipts ---
export const createReceiptLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalPositive,
  unitCost: decimalNonNegative,
  batchNumber: z.string().trim().min(1).max(60).optional(),
  manufacturingDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  expiryDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createReceiptSchema = z.object({
  warehouseId: z.string().uuid(),
  receiptDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  supplierRef: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(createReceiptLineSchema).min(1, 'At least one receipt line is required'),
});

// --- Issues ---
export const createIssueLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  uomId: z.string().uuid(),
  requestedQuantity: decimalPositive,
  batchId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createIssueSchema = z.object({
  warehouseId: z.string().uuid(),
  pickingStrategy: z.enum(['FIFO', 'FEFO']).default('FEFO'),
  issueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  departmentRef: z.string().trim().max(100).optional(),
  purpose: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(createIssueLineSchema).min(1, 'At least one issue line is required'),
});

// --- Transfers ---
export const createTransferLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalPositive,
  batchId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createTransferSchema = z
  .object({
    sourceWarehouseId: z.string().uuid(),
    destinationWarehouseId: z.string().uuid(),
    transferDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    notes: z.string().trim().max(1000).optional(),
    lines: z.array(createTransferLineSchema).min(1, 'At least one transfer line is required'),
  })
  .refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['destinationWarehouseId'],
  });

// --- Adjustments ---
export const createAdjustmentLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantityDelta: decimalNonZeroSigned,
  batchId: z.string().uuid().optional(),
  unitCost: decimalNonNegative.optional(),
  reasonNote: z.string().trim().max(500).optional(),
});

export const createAdjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  reason: z.enum([
    'PHYSICAL_COUNT',
    'DAMAGE',
    'SPOILAGE',
    'EXPIRY',
    'SHRINKAGE',
    'OPENING_STOCK',
    'OTHER',
  ]),
  adjustmentDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(createAdjustmentLineSchema).min(1, 'At least one adjustment line is required'),
});

// --- Reversal ---
export const reverseTransactionSchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason is required').max(500),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;
