import { z } from 'zod';

export const LABEL_SIZE_PRESETS = {
  SMALL_PRODUCT: { widthMm: 50, heightMm: 30 },
  STANDARD_BATCH: { widthMm: 100, heightMm: 70 },
  LARGE_CARTON: { widthMm: 148, heightMm: 105 },
} as const;

export const layoutConfigSchema = z.object({
  showCompanyName: z.boolean().default(true),
  showCompanyAddress: z.boolean().default(true),
  showFactoryName: z.boolean().default(true),
  showFssaiLicense: z.boolean().default(true),
  showProductName: z.boolean().default(true),
  showSku: z.boolean().default(true),
  showBatchNumber: z.boolean().default(true),
  showManufacturingDate: z.boolean().default(true),
  showExpiryDate: z.boolean().default(true),
  showNetQuantity: z.boolean().default(true),
  showQualityStatus: z.boolean().default(true),
  showAllergenDeclaration: z.boolean().default(true),
  showStorageInstructions: z.boolean().default(true),
  optionalFields: z
    .array(
      z.enum([
        'VARIANT_NAME',
        'WORK_ORDER_NUMBER',
        'WAREHOUSE_CODE',
        'INSPECTION_NUMBER',
      ]),
    )
    .default([]),
});

export type LabelLayoutConfig = z.infer<typeof layoutConfigSchema>;

export const createLabelTemplateSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    sizePreset: z.enum(['SMALL_PRODUCT', 'STANDARD_BATCH', 'LARGE_CARTON', 'CUSTOM']).default('STANDARD_BATCH'),
    widthMm: z.number().min(25).max(300),
    heightMm: z.number().min(20).max(300),
    logoPlacement: z.enum(['TOP_LEFT', 'TOP_RIGHT', 'TOP_CENTER', 'NONE']).default('TOP_LEFT'),
    includeQr: z.boolean().default(true),
    includeBarcode: z.boolean().default(true),
    layoutConfig: layoutConfigSchema.default({}),
    defaultStorageInstructions: z.string().trim().max(255).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const updateLabelTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    sizePreset: z.enum(['SMALL_PRODUCT', 'STANDARD_BATCH', 'LARGE_CARTON', 'CUSTOM']).optional(),
    widthMm: z.number().min(25).max(300).optional(),
    heightMm: z.number().min(20).max(300).optional(),
    logoPlacement: z.enum(['TOP_LEFT', 'TOP_RIGHT', 'TOP_CENTER', 'NONE']).optional(),
    includeQr: z.boolean().optional(),
    includeBarcode: z.boolean().optional(),
    layoutConfig: layoutConfigSchema.optional(),
    defaultStorageInstructions: z.string().trim().max(255).optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const generateBatchLabelSchema = z
  .object({
    productionBatchId: z.string().uuid(),
    templateId: z.string().uuid(),
    copies: z.number().int().min(1).max(200).default(1),
    labelMode: z.enum(['RELEASED', 'INTERNAL_STATUS']).default('RELEASED'),
    storageInstructionsOverride: z.string().trim().max(255).optional(),
    idempotencyKey: z.string().trim().min(4).max(100).optional(),
  })
  .strict();

export const reprintBatchLabelSchema = z
  .object({
    copies: z.number().int().min(1).max(200).default(1),
    idempotencyKey: z.string().trim().min(4).max(100).optional(),
  })
  .strict();

export interface AuthoritativeLabelSnapshot {
  companyName: string;
  companyAddress: string;
  fssaiLicense: string | null;
  factoryName: string;
  warehouseCode: string;
  productName: string;
  productCode: string;
  variantName: string;
  sku: string;
  batchNumber: string;
  workOrderNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  netQuantity: string;
  uomSymbol: string;
  qualityDecision: string;
  inspectionNumber: string | null;
  labelMode: 'RELEASED' | 'INTERNAL_STATUS';
  allergenSummary: {
    overallStatus: string;
    confirmedAllergens: string[];
    crossContactAllergens: string[];
    hasUnknownIngredients: boolean;
    declarationText: string;
  };
  storageInstructions: string | null;
  qrReferenceToken: string | null;
  tracePath: string | null;
  barcodeValue: string | null;
}
