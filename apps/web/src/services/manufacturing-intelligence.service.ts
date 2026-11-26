import { apiClient } from './api-client';

export interface AllergenProfileData {
  bomId: string;
  bomVersionId: string;
  bomVersionNumber: number;
  derivedAt: string;
  isHistoricalSnapshot: boolean;
  overallStatus: 'CONTAINS_ALLERGENS' | 'CONTAINS_UNKNOWN_INGREDIENTS' | 'NO_KNOWN_ALLERGENS';
  hasUnknownIngredients: boolean;
  confirmedAllergens: string[];
  crossContactAllergens: string[];
  unknownIngredients: Array<{
    inventoryItemId: string;
    code: string;
    name: string;
    reason: string;
  }>;
}

export interface BatchJourneyStageData {
  key: string;
  title: string;
  status: 'OCCURRED' | 'PENDING' | 'NOT_APPLICABLE';
  timestamp: string | null;
  actor: string | null;
  summary: string;
  details: Record<string, unknown>;
  navigationPath: string | null;
}

export interface BatchJourneyData {
  batch: {
    id: string;
    batchNumber: string;
    status: string;
    productName: string;
    sku: string;
    plannedQuantity: string;
    actualGoodQuantity: string;
    uomSymbol: string;
  };
  stages: BatchJourneyStageData[];
  genealogy: {
    backwardInputs: Array<{
      inventoryItemCode: string;
      inventoryItemName: string;
      batchNumber: string | null;
      quantity: string;
      uomSymbol: string;
    }>;
    splitSiblingBatches: Array<{
      id: string;
      batchNumber: string;
      status: string;
      plannedQuantity: string;
      actualGoodQuantity: string;
    }>;
    forwardSalesDispatches: Array<{
      orderNumber: string;
      salesOrderId: string;
      status: string;
      fulfilledAt: string;
    }>;
  };
}

export interface ShelfLifeRadarSummaryBucket {
  riskWindow: string;
  batchRowCount: number;
  totalOnHandQty: string;
  availableQty: string;
  reservedQty: string;
  quarantinedQty: string;
  rejectedQty: string;
}

export interface ShelfLifeRadarItem {
  balanceId: string;
  batchId: string | null;
  batchNumber: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomSymbol: string;
  warehouseCode: string;
  warehouseName: string;
  factoryName: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  qualityStatus: string;
  riskWindow: string;
  daysToExpiry: number | null;
  totalOnHandQty: string;
  availableQty: string;
  reservedQty: string;
  quarantinedQty: string;
  rejectedQty: string;
}

export interface ShelfLifeRadarData {
  summary: ShelfLifeRadarSummaryBucket[];
  items: ShelfLifeRadarItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface EfficiencyScorecardData {
  dateRange: { period: string; fromDate: string; toDate: string };
  recordCounts: {
    totalBatches: number;
    COMPLETED: number;
    IN_PROGRESS: number;
    CANCELLED: number;
    CREATED: number;
    completionTimeRecordCount: number;
    costedBatchCount: number;
    totalWorkOrders: number;
    completedWorkOrders: number;
  };
  quantityMetricsByUom: Array<{
    uomCode: string;
    uomSymbol: string;
    completedBatchCount: number;
    plannedQuantity: string;
    actualGoodQuantity: string;
    rejectedQuantity: string;
    wastageQuantity: string;
    yieldPercentage: string | null;
    wastagePercentage: string | null;
    rejectionPercentage: string | null;
  }>;
  performance: {
    avgBatchCompletionHours: string | null;
    workOrderCompletionRatePercent: string | null;
    totalMaterialCostVariance: string;
    totalProductionCostVariance: string;
  };
  sourceBatches: Array<{
    id: string;
    batchNumber: string;
    status: string;
    productName: string;
    plannedQuantity: string;
    actualGoodQuantity: string;
    uomSymbol: string;
    actualYieldPercent: string;
    completedAt: string | null;
  }>;
}

export const manufacturingIntelligenceService = {
  async getBatchJourney(batchId: string): Promise<BatchJourneyData> {
    const res = await apiClient<BatchJourneyData>(
      `/manufacturing-intelligence/batches/${batchId}/journey`,
    );
    return res.data!;
  },

  async getBatchAllergens(batchId: string): Promise<AllergenProfileData> {
    const res = await apiClient<AllergenProfileData>(
      `/manufacturing-intelligence/allergens/batches/${batchId}`,
    );
    return res.data!;
  },

  async getBomVersionAllergens(bomVersionId: string): Promise<AllergenProfileData> {
    const res = await apiClient<AllergenProfileData>(
      `/manufacturing-intelligence/allergens/bom-version/${bomVersionId}`,
    );
    return res.data!;
  },

  async getShelfLifeRadar(params: {
    itemType?: string;
    riskWindow?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ShelfLifeRadarData> {
    const qs = new URLSearchParams();
    if (params.itemType) qs.set('itemType', params.itemType);
    if (params.riskWindow && params.riskWindow !== 'ALL') qs.set('riskWindow', params.riskWindow);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const res = await apiClient<ShelfLifeRadarData>(
      `/manufacturing-intelligence/shelf-life-radar?${qs.toString()}`,
    );
    return res.data!;
  },

  async getEfficiencyScorecard(params: {
    period?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<EfficiencyScorecardData> {
    const qs = new URLSearchParams();
    if (params.period) qs.set('period', params.period);
    if (params.fromDate) qs.set('fromDate', params.fromDate);
    if (params.toDate) qs.set('toDate', params.toDate);
    const res = await apiClient<EfficiencyScorecardData>(
      `/manufacturing-intelligence/efficiency-scorecard?${qs.toString()}`,
    );
    return res.data!;
  },
};
