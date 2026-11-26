export type WarehouseLocationType =
  | 'ZONE'
  | 'RACK'
  | 'SHELF'
  | 'BIN'
  | 'STAGING'
  | 'QUARANTINE'
  | 'COLD_STORAGE'
  | 'DISPATCH';

export type StorageCondition =
  | 'AMBIENT'
  | 'CHILLED'
  | 'FROZEN'
  | 'DRY'
  | 'HAZMAT'
  | 'QUARANTINE';

export type BarcodeEntityType =
  | 'RAW_MATERIAL'
  | 'PACKAGING_MATERIAL'
  | 'FINISHED_PRODUCT'
  | 'INVENTORY_BATCH'
  | 'WAREHOUSE_BIN'
  | 'PURCHASE_RECEIPT'
  | 'WORK_ORDER';

export type AbcClass = 'A' | 'B' | 'C';
export type CycleCountFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type CycleCountPlanStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface WarehouseBinItem {
  id: string;
  warehouseId: string;
  shelfId: string;
  code: string;
  name: string;
  locationType: WarehouseLocationType;
  storageCondition: StorageCondition;
  capacityQuantity: string;
  isTemperatureControlled: boolean;
  allergenRestriction: string | null;
  allowMixedItems: boolean;
  allowMixedBatches: boolean;
  isActive: boolean;
  usedQuantity?: string;
  utilizationPercent?: number;
  allocationsCount?: number;
}

export interface WarehouseLayoutResponse {
  id: string;
  code: string;
  name: string;
  warehouseType: string;
  factory?: { id: string; code: string; name: string; state: string };
  zones: Array<{
    id: string;
    code: string;
    name: string;
    zoneType: WarehouseLocationType;
    storageCondition: StorageCondition;
    isTemperatureControlled: boolean;
    allergenProfile: string | null;
    isActive: boolean;
    racks: Array<{
      id: string;
      code: string;
      name: string;
      aisle: string | null;
      shelves: Array<{
        id: string;
        code: string;
        name: string;
        levelNumber: number;
        bins: WarehouseBinItem[];
      }>;
    }>;
  }>;
}

export interface BinStockAllocationItem {
  id: string;
  warehouseId: string;
  binId: string;
  inventoryItemId: string;
  batchId: string | null;
  quantity: string;
  reservedQuantity: string;
  warehouse: { id: string; code: string; name: string };
  bin: {
    id: string;
    code: string;
    name: string;
    locationType: WarehouseLocationType;
    storageCondition: StorageCondition;
    capacityQuantity: string;
  };
  inventoryItem: {
    id: string;
    code: string;
    name: string;
    itemType: string;
    uom?: { symbol: string };
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string | null;
    qualityStatus: string;
  } | null;
}

export interface BinMovementItem {
  id: string;
  movementNumber: string;
  movementType: 'PUT_AWAY' | 'BIN_TRANSFER' | 'PICK' | 'CYCLE_COUNT_ADJUST';
  quantity: string;
  createdAt: string;
  notes: string | null;
  inventoryItem: { id: string; code: string; name: string };
  batch: { id: string; batchNumber: string } | null;
  fromBin: { id: string; code: string; name: string } | null;
  toBin: { id: string; code: string; name: string } | null;
  performedBy: { id: string; username: string; fullName: string };
}

export interface BarcodeLabelItem {
  id: string;
  barcodeValue: string;
  qrPayload: string | null;
  entityType: BarcodeEntityType;
  entityId: string;
  warehouseId: string | null;
  labelFormat: string;
  createdAt: string;
}

export interface PickingSuggestionResponse {
  warehouseId: string;
  inventoryItemId: string;
  requestedQuantity: string;
  shortfallQuantity: string;
  suggestions: Array<{
    binId: string;
    binCode: string;
    binName: string;
    storageCondition: StorageCondition;
    batchId: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    availableQuantity: string;
    suggestedPickQuantity: string;
    strategy: 'FEFO' | 'FIFO';
  }>;
}

export interface PutAwaySuggestionResponse {
  warehouseId: string;
  inventoryItemId: string;
  isQuarantined: boolean;
  suggestions: Array<{
    binId: string;
    binCode: string;
    binName: string;
    zoneCode: string;
    locationType: WarehouseLocationType;
    storageCondition: StorageCondition;
    capacityQuantity: string;
    usedQuantity: string;
    availableCapacity: string;
    consolidatesExistingStock: boolean;
  }>;
}

export interface CycleCountPlanItem {
  id: string;
  planNumber: string;
  name: string;
  warehouseId: string;
  abcClass: AbcClass | null;
  frequency: CycleCountFrequency;
  isBlindCount: boolean;
  binId: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  status: CycleCountPlanStatus;
  warehouse: { id: string; code: string; name: string };
}

export interface WarehouseAnalyticsResponse {
  warehouseId: string;
  locationUtilization: {
    totalBins: number;
    activeBins: number;
    occupiedBins: number;
    emptyBinsCount: number;
    totalCapacity: string;
    totalUsed: string;
    utilizationPercent: number;
  };
  emptyBins: Array<{ id: string; code: string; name: string; locationType: string }>;
  stockByLocation: Array<{ binId: string; binCode: string; quantity: string; value: string }>;
  batchLocationDistributionCount: number;
  pickingAccuracyPercent: number;
  cycleCountVariance: {
    auditsCount: number;
    totalLines: number;
    accurateLines: number;
    netVarianceValue: string;
  };
  expiryRiskByLocation: Array<{
    binId: string;
    binCode: string;
    itemCode: string;
    batchNumber: string;
    expiryDate: string;
    quantity: string;
  }>;
  movementVolume: {
    last7Days: Array<{ type: string; count: number }>;
    last30Days: Array<{ type: string; count: number }>;
  };
}
