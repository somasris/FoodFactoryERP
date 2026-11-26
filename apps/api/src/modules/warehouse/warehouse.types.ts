import { z } from 'zod';
import {
  AbcClass,
  BarcodeEntityType,
  CycleCountFrequency,
  CycleCountPlanStatus,
  StorageCondition,
  WarehouseLocationType,
} from '@prisma/client';

const positiveDecimalString = z
  .union([z.string(), z.number()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, 'Quantity must be greater than 0');

const nonNegativeDecimalString = z
  .union([z.string(), z.number()])
  .transform(v => String(v).trim())
  .refine(v => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) >= 0, 'Value must be >= 0');

// ---------------------------------------------------------------------------
// Location Hierarchy Schemas
// ---------------------------------------------------------------------------

export const createZoneSchema = z.object({
  warehouseId: z.string().uuid(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  zoneType: z.nativeEnum(WarehouseLocationType).default(WarehouseLocationType.ZONE),
  storageCondition: z.nativeEnum(StorageCondition).default(StorageCondition.AMBIENT),
  isTemperatureControlled: z.boolean().default(false),
  temperatureMinC: z.number().min(-80).max(100).optional().nullable(),
  temperatureMaxC: z.number().min(-80).max(100).optional().nullable(),
  allergenProfile: z.string().trim().max(200).optional().nullable(),
});

export const updateZoneSchema = createZoneSchema.omit({ warehouseId: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export const createRackSchema = z.object({
  warehouseId: z.string().uuid(),
  zoneId: z.string().uuid(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  aisle: z.string().trim().max(30).optional().nullable(),
});

export const updateRackSchema = createRackSchema
  .omit({ warehouseId: true, zoneId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const createShelfSchema = z.object({
  warehouseId: z.string().uuid(),
  rackId: z.string().uuid(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  levelNumber: z.coerce.number().int().min(1).max(99).default(1),
});

export const updateShelfSchema = createShelfSchema
  .omit({ warehouseId: true, rackId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const createBinSchema = z.object({
  warehouseId: z.string().uuid(),
  shelfId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(100),
  locationType: z.nativeEnum(WarehouseLocationType).default(WarehouseLocationType.BIN),
  storageCondition: z.nativeEnum(StorageCondition).default(StorageCondition.AMBIENT),
  capacityQuantity: nonNegativeDecimalString.default('0'),
  capacityUomId: z.string().uuid().optional().nullable(),
  isTemperatureControlled: z.boolean().default(false),
  allergenRestriction: z.string().trim().max(200).optional().nullable(),
  allowMixedItems: z.boolean().default(true),
  allowMixedBatches: z.boolean().default(true),
});

export const updateBinSchema = createBinSchema
  .omit({ warehouseId: true, shelfId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

// ---------------------------------------------------------------------------
// Bin Movement Schemas
// ---------------------------------------------------------------------------

export const putAwaySchema = z.object({
  warehouseId: z.string().uuid(),
  toBinId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  quantity: positiveDecimalString,
  referenceType: z.string().trim().max(40).optional(),
  referenceId: z.string().trim().max(60).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const binTransferSchema = z.object({
  warehouseId: z.string().uuid(),
  fromBinId: z.string().uuid(),
  toBinId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  quantity: positiveDecimalString,
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const pickFromBinSchema = z.object({
  warehouseId: z.string().uuid(),
  fromBinId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  quantity: positiveDecimalString,
  referenceType: z.string().trim().max(40).optional(),
  referenceId: z.string().trim().max(60).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Barcode & Scan Schemas
// ---------------------------------------------------------------------------

export const createBarcodeSchema = z.object({
  entityType: z.nativeEnum(BarcodeEntityType),
  entityId: z.string().trim().min(1).max(80),
  barcodeValue: z.string().trim().min(3).max(120).optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  labelFormat: z.enum(['CODE128', 'QR']).default('CODE128'),
});

export const scanExecuteSchema = z.object({
  operation: z.enum(['PUT_AWAY', 'BIN_TRANSFER', 'PICK']),
  warehouseId: z.string().uuid(),
  itemOrBatchBarcode: z.string().trim().min(1).max(120),
  fromBinBarcode: z.string().trim().max(120).optional(),
  toBinBarcode: z.string().trim().max(120).optional(),
  quantity: positiveDecimalString,
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Cycle Count Schemas
// ---------------------------------------------------------------------------

export const createCycleCountPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  warehouseId: z.string().uuid(),
  abcClass: z.nativeEnum(AbcClass).optional().nullable(),
  frequency: z.nativeEnum(CycleCountFrequency),
  isBlindCount: z.boolean().default(false),
  binId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  nextRunDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateCycleCountPlanStatusSchema = z.object({
  status: z.nativeEnum(CycleCountPlanStatus),
});

export const recordCycleCountSchema = z.object({
  isRecount: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        countedQuantity: nonNegativeDecimalString,
        investigationNotes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1),
});

export const investigateVarianceSchema = z.object({
  lineId: z.string().uuid(),
  investigationNotes: z.string().trim().min(3).max(500),
  recountRequired: z.boolean().default(false),
});
