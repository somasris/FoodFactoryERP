import { apiClient } from './api-client';
import {
  BarcodeEntityType,
  BarcodeLabelItem,
  BinMovementItem,
  BinStockAllocationItem,
  CycleCountFrequency,
  CycleCountPlanItem,
  CycleCountPlanStatus,
  PickingSuggestionResponse,
  PutAwaySuggestionResponse,
  StorageCondition,
  WarehouseAnalyticsResponse,
  WarehouseBinItem,
  WarehouseLayoutResponse,
  WarehouseLocationType,
} from '../types/warehouse';

export const warehouseService = {
  getLayout: (warehouseId: string) =>
    apiClient<WarehouseLayoutResponse>(`/warehouse/layout/${warehouseId}`),

  listZones: (warehouseId?: string) =>
    apiClient<Array<{ id: string; code: string; name: string; warehouseId: string }>>(
      `/warehouse/zones${warehouseId ? `?warehouseId=${warehouseId}` : ''}`,
    ),

  createZone: (payload: {
    warehouseId: string;
    code: string;
    name: string;
    zoneType?: WarehouseLocationType;
    storageCondition?: StorageCondition;
    isTemperatureControlled?: boolean;
    allergenProfile?: string;
  }) => apiClient('/warehouse/zones', { method: 'POST', body: JSON.stringify(payload) }),

  createRack: (payload: {
    warehouseId: string;
    zoneId: string;
    code: string;
    name: string;
    aisle?: string;
  }) => apiClient('/warehouse/racks', { method: 'POST', body: JSON.stringify(payload) }),

  createShelf: (payload: {
    warehouseId: string;
    rackId: string;
    code: string;
    name: string;
    levelNumber?: number;
  }) => apiClient('/warehouse/shelves', { method: 'POST', body: JSON.stringify(payload) }),

  listBins: (warehouseId?: string) =>
    apiClient<WarehouseBinItem[]>(
      `/warehouse/bins${warehouseId ? `?warehouseId=${warehouseId}` : ''}`,
    ),

  createBin: (payload: {
    warehouseId: string;
    shelfId: string;
    code: string;
    name: string;
    locationType?: WarehouseLocationType;
    storageCondition?: StorageCondition;
    capacityQuantity?: string;
    isTemperatureControlled?: boolean;
    allergenRestriction?: string;
    allowMixedItems?: boolean;
    allowMixedBatches?: boolean;
  }) => apiClient<WarehouseBinItem>('/warehouse/bins', { method: 'POST', body: JSON.stringify(payload) }),

  listLocationStock: (params: { warehouseId?: string; binId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.warehouseId) qs.set('warehouseId', params.warehouseId);
    if (params.binId) qs.set('binId', params.binId);
    const q = qs.toString();
    return apiClient<BinStockAllocationItem[]>(`/warehouse/location-stock${q ? `?${q}` : ''}`);
  },

  listMovements: (warehouseId?: string) =>
    apiClient<BinMovementItem[]>(
      `/warehouse/movements${warehouseId ? `?warehouseId=${warehouseId}` : ''}`,
    ),

  putAway: (payload: {
    warehouseId: string;
    toBinId: string;
    inventoryItemId: string;
    batchId?: string | null;
    quantity: string;
    notes?: string;
  }) => apiClient<BinMovementItem>('/warehouse/put-away', { method: 'POST', body: JSON.stringify(payload) }),

  binTransfer: (payload: {
    warehouseId: string;
    fromBinId: string;
    toBinId: string;
    inventoryItemId: string;
    batchId?: string | null;
    quantity: string;
    notes?: string;
  }) => apiClient<BinMovementItem>('/warehouse/bin-transfers', { method: 'POST', body: JSON.stringify(payload) }),

  pickFromBin: (payload: {
    warehouseId: string;
    fromBinId: string;
    inventoryItemId: string;
    batchId?: string | null;
    quantity: string;
    notes?: string;
  }) => apiClient<BinMovementItem>('/warehouse/pick', { method: 'POST', body: JSON.stringify(payload) }),

  listBarcodes: (entityType?: BarcodeEntityType) =>
    apiClient<BarcodeLabelItem[]>(
      `/warehouse/barcodes${entityType ? `?entityType=${entityType}` : ''}`,
    ),

  createBarcode: (payload: {
    entityType: BarcodeEntityType;
    entityId: string;
    barcodeValue?: string;
    warehouseId?: string;
    labelFormat?: 'CODE128' | 'QR';
  }) => apiClient<BarcodeLabelItem>('/warehouse/barcodes', { method: 'POST', body: JSON.stringify(payload) }),

  lookupBarcode: (code: string) =>
    apiClient<{ entityType: BarcodeEntityType; barcode: BarcodeLabelItem | null; entity: Record<string, unknown> }>(
      `/warehouse/barcodes/lookup?code=${encodeURIComponent(code)}`,
    ),

  executeScan: (payload: {
    operation: 'PUT_AWAY' | 'BIN_TRANSFER' | 'PICK';
    warehouseId: string;
    itemOrBatchBarcode: string;
    fromBinBarcode?: string;
    toBinBarcode?: string;
    quantity: string;
    notes?: string;
  }) => apiClient<BinMovementItem>('/warehouse/scan/execute', { method: 'POST', body: JSON.stringify(payload) }),

  suggestPicking: (params: { warehouseId: string; inventoryItemId: string; quantity: string }) =>
    apiClient<PickingSuggestionResponse>(
      `/warehouse/suggestions/picking?warehouseId=${params.warehouseId}&inventoryItemId=${params.inventoryItemId}&quantity=${params.quantity}`,
    ),

  suggestPutAway: (params: {
    warehouseId: string;
    inventoryItemId: string;
    batchId?: string;
    quantity: string;
    storageCondition?: StorageCondition;
  }) => {
    const qs = new URLSearchParams({
      warehouseId: params.warehouseId,
      inventoryItemId: params.inventoryItemId,
      quantity: params.quantity,
    });
    if (params.batchId) qs.set('batchId', params.batchId);
    if (params.storageCondition) qs.set('storageCondition', params.storageCondition);
    return apiClient<PutAwaySuggestionResponse>(`/warehouse/suggestions/put-away?${qs.toString()}`);
  },

  listCycleCountPlans: (warehouseId?: string) =>
    apiClient<CycleCountPlanItem[]>(
      `/warehouse/cycle-counts/plans${warehouseId ? `?warehouseId=${warehouseId}` : ''}`,
    ),

  createCycleCountPlan: (payload: {
    name: string;
    warehouseId: string;
    abcClass?: 'A' | 'B' | 'C' | null;
    frequency: CycleCountFrequency;
    isBlindCount?: boolean;
    binId?: string | null;
    nextRunDate: string;
  }) => apiClient<CycleCountPlanItem>('/warehouse/cycle-counts/plans', { method: 'POST', body: JSON.stringify(payload) }),

  updateCycleCountPlanStatus: (id: string, status: CycleCountPlanStatus) =>
    apiClient<CycleCountPlanItem>(`/warehouse/cycle-counts/plans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  generateCycleCountAudit: (planId: string) =>
    apiClient<{ id: string; auditNumber: string }>(`/warehouse/cycle-counts/plans/${planId}/generate`, {
      method: 'POST',
      body: '{}',
    }),

  getAnalytics: (warehouseId: string) =>
    apiClient<WarehouseAnalyticsResponse>(`/warehouse/analytics/${warehouseId}`),
};
