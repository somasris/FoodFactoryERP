export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string;
  category: string;
  isBaseUnit: boolean;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnitConversion {
  id: string;
  fromUomId: string;
  toUomId: string;
  multiplier: string;
  isActive: boolean;
  fromUom?: UnitOfMeasure;
  toUom?: UnitOfMeasure;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRate {
  id: string;
  code: string;
  name: string;
  ratePercentage: string;
  cgstPercentage: string;
  sgstPercentage: string;
  igstPercentage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxConfiguration {
  id: string;
  hsnCode: string;
  description?: string | null;
  taxRateId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  taxRate?: TaxRate;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryEntity {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterial {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  materialType: 'RAW_INGREDIENT' | 'PACKAGING_PRIMARY' | 'PACKAGING_SECONDARY';
  uomId: string;
  hsnCode: string;
  taxRateId: string;
  minStockAlert: string;
  reorderQuantity?: string | null;
  isActive: boolean;
  category?: CategoryEntity;
  uom?: UnitOfMeasure;
  taxRate?: TaxRate;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  baseUomId: string;
  hsnCode: string;
  taxRateId: string;
  isActive: boolean;
  category?: CategoryEntity;
  baseUom?: UnitOfMeasure;
  taxRate?: TaxRate;
  _count?: { variants: number };
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  netWeightGrams: string;
  uomId: string;
  defaultSellingPrice: string;
  barcode?: string | null;
  isActive: boolean;
  product?: Product;
  uom?: UnitOfMeasure;
  createdAt: string;
  updatedAt: string;
}

export interface PartyAddress {
  id?: string;
  addressType: 'BILLING' | 'SHIPPING' | 'OFFICE' | 'DISPATCH';
  addressLine1: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  paymentTermsDays: number;
  isActive: boolean;
  addresses?: PartyAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  customerType: 'RETAILER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'DIRECT';
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  creditPeriodDays: number;
  creditLimit: string;
  isActive: boolean;
  addresses?: PartyAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface Factory {
  id: string;
  code: string;
  name: string;
  state: string;
  stateCode: string;
  address: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  warehouseType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS' | 'GENERAL' | 'SCRAP_DAMAGED';
  address?: string | null;
  isActive: boolean;
  factory?: Factory;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemRef {
  id: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  code: string;
  name: string;
  uomId: string;
  uom?: UnitOfMeasure;
  isActive: boolean;
}

export interface BOMItem {
  id: string;
  bomVersionId: string;
  inventoryItemId: string;
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  standardQuantity: string;
  uomId: string;
  scrapTolerancePercent: string;
  inventoryItem?: InventoryItemRef;
  uom?: UnitOfMeasure;
}

export interface BOMOverhead {
  id: string;
  bomVersionId: string;
  costType: 'LABOUR' | 'UTILITY' | 'MACHINE_DEPRECIATION' | 'DIRECT_OVERHEAD';
  description: string;
  standardAmount: string;
}

export interface BOMVersion {
  id: string;
  bomId: string;
  versionNumber: number;
  status: 'DRAFT' | 'ACTIVE' | 'OBSOLETE';
  effectiveFrom: string;
  effectiveTo?: string | null;
  expectedGoodOutput: string;
  yieldPercentage?: string;
  expectedWastagePercent?: string;
  outputUomId: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  remarks?: string | null;
  outputUom?: UnitOfMeasure;
  items?: BOMItem[];
  overheads?: BOMOverhead[];
  _count?: { items: number; overheads: number };
  createdAt: string;
  updatedAt: string;
}

export interface BOMCostEstimate {
  bomId: string;
  versionId: string;
  versionNumber: number;
  status: string;
  targetOutputQuantity: string;
  outputUomSymbol: string;
  yieldPercentage: string;
  expectedWastagePercent: string;
  totalStandardMaterialCost: string;
  totalEffectiveMaterialCost: string;
  totalOverheadCost: string;
  totalEstimatedCost: string;
  estimatedUnitCost: string;
  items: Array<{
    id: string;
    inventoryItemId: string;
    itemCode: string;
    itemName: string;
    itemType: string;
    recipeUomSymbol: string;
    baseUomSymbol: string;
    standardQuantity: string;
    scrapTolerancePercent: string;
    effectiveQuantity: string;
    effectiveBaseQuantity: string;
    unitMwacCost: string;
    standardCost: string;
    effectiveCost: string;
  }>;
  overheads: Array<{
    id: string;
    costType: string;
    description: string;
    standardAmount: string;
  }>;
}

export interface BOMAuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  remarks?: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; username: string } | null;
}

export interface BOM {
  id: string;
  productVariantId: string;
  code: string;
  name: string;
  baseOutputQuantity: string;
  outputUomId: string;
  isActive: boolean;
  productVariant?: ProductVariant;
  outputUom?: UnitOfMeasure;
  versions?: BOMVersion[];
  createdAt: string;
  updatedAt: string;
}
