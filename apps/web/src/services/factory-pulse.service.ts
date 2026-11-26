import { apiClient } from './api-client';
import { cachedApiGet } from '../offline/offline-cache';

export interface FactoryPulseData {
  generatedAt: string;
  filters: {
    factoryId: string | null;
    warehouseId: string | null;
    status: string | null;
  };
  scopes: {
    factories: Array<{ id: string; code: string; name: string }>;
    warehouses: Array<{ id: string; code: string; name: string; factoryId: string | null }>;
  };
  overview: {
    activeBatchesCount: number;
    runningWorkOrdersCount: number;
    completedTodayCount: number;
    delayedWorkOrdersCount: number;
    plannedQtyTotal: string;
    actualGoodQtyTotal: string;
  };
  productionActivity: Array<{
    batchId: string;
    batchNumber: string;
    productName: string;
    productCode: string;
    workOrderId: string;
    workOrderNumber: string;
    warehouseName: string;
    factoryName: string;
    status: string;
    plannedQuantity: string;
    actualGoodQuantity: string;
    uomSymbol: string;
    progressPercent: number | null;
    updatedAt: string;
  }>;
  materialReadiness: Array<{
    itemId: string;
    code: string;
    name: string;
    uomSymbol: string;
    physicalStock: string;
    reservedStock: string;
    availableStock: string;
    requiredStock: string;
    shortageQuantity: string;
    belowReorder: boolean;
  }>;
  qualityMonitoring: {
    pendingInspectionsCount: number;
    quarantinedBatchesCount: number;
    rejectedBatchesCount: number;
    recentInspections: Array<{
      id: string;
      inspectionNumber: string;
      decision: string;
      batchNumber: string;
      createdAt: string;
    }>;
  };
  attentionRequired: Array<{
    id: string;
    severity: 'CRITICAL' | 'WARNING';
    type: string;
    title: string;
    detail: string;
    navigationPath: string;
  }>;
}

export const factoryPulseService = {
  getPulse: (params: { factoryId?: string; warehouseId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.factoryId) qs.set('factoryId', params.factoryId);
    if (params.warehouseId) qs.set('warehouseId', params.warehouseId);
    if (params.status) qs.set('status', params.status);
    const queryStr = qs.toString();
    const endpoint = `/production/factory-pulse${queryStr ? `?${queryStr}` : ''}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return cachedApiGet<FactoryPulseData>('FACTORY_PULSE', endpoint);
    }
    return apiClient<FactoryPulseData>(endpoint);
  },
};
