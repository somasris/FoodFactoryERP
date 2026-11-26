import { apiClient } from './api-client';

export interface BatchQrResponse {
  referenceToken: string;
  tracePath: string;
  isActive: boolean;
  createdAt: string;
  labelData: {
    companyName: string;
    productName: string;
    variantName: string;
    sku: string;
    batchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    plannedQuantity: string;
    actualGoodQuantity: string;
    uomSymbol: string;
    factoryName: string;
  };
}

export interface BatchTraceabilityDetail {
  referenceToken: string;
  batchIdentity: {
    id: string;
    batchNumber: string;
    status: string;
    qualityStatus: string;
    productName: string;
    productCode: string;
    categoryName: string;
    variantName: string;
    sku: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    workOrderNumber: string;
    workOrderId: string;
    warehouseName: string;
    factoryName: string;
    plannedQuantity: string;
    actualGoodQuantity: string;
    rejectedQuantity: string;
    wastageQuantity: string;
    uomSymbol: string;
  };
  recipeAndInputs: {
    bomCode: string;
    bomName: string;
    bomVersionNumber: number;
    consumptions: Array<{
      id: string;
      itemCode: string;
      itemName: string;
      itemType: string;
      sourceBatchNumber: string;
      quantity: string;
      uomSymbol: string;
    }>;
    returns: Array<{
      id: string;
      itemCode: string;
      itemName: string;
      sourceBatchNumber: string;
      quantity: string;
      uomSymbol: string;
    }>;
  };
  productionHistory: {
    actualYieldPercent: string;
    entries: Array<{
      id: string;
      entryType: string;
      goodQuantity: string | null;
      rejectedQuantity: string | null;
      wastageQuantity: string | null;
      notes: string | null;
      createdAt: string;
    }>;
    costing: {
      status: string;
      totalProductionCost: string;
      costPerGoodUnit: string;
      finalizedAt: string | null;
    } | null;
  };
  qualityHistory: {
    inspectionNumber: string;
    decision: string;
    acceptedQuantity: string;
    rejectedQuantity: string;
    quarantinedQuantity: string;
    inspectedAt: string | null;
  } | null;
  finishedGoodsAndMovement: {
    finishedGoodsBatchNumber: string | null;
    movements: Array<{
      id: string;
      transactionNumber: string;
      transactionType: string;
      warehouseName: string;
      quantity: string;
      transactionDate: string;
    }>;
    dispatches: Array<{
      fulfillmentNumber: string;
      salesOrderNumber: string;
      salesOrderId: string;
      issueNumber: string;
    }>;
  };
  timeline: Array<{
    stage: string;
    title: string;
    detail: string;
    timestamp: string;
  }>;
}

export const batchQrService = {
  generateOrGet: (batchId: string) =>
    apiClient<BatchQrResponse>(`/production/batches/${batchId}/qr`, {
      method: 'POST',
      body: '{}',
    }),
  revokeAndRegenerate: (batchId: string, reason: string) =>
    apiClient<BatchQrResponse>(`/production/batches/${batchId}/qr/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  resolveTraceability: (reference: string) =>
    apiClient<BatchTraceabilityDetail>(
      `/production/traceability/qr/${encodeURIComponent(reference)}`,
    ),
};
