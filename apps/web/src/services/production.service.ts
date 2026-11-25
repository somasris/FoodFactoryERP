import { apiClient } from './api-client';
import { PaginatedResponse } from '../types/master-data';
import {
  BatchCostingDetailResponse,
  BatchReconciliation,
  BatchVarianceApproval,
  CostingDashboardSummary,
  CostVarianceReportResponse,
  MaterialAvailabilityDetail,
  ProductionBatch,
  ProductionBatchCosting,
  ProductionCostEntryItem,
  ProductionDemandResponse,
  ProductionExecutionDashboard,
  ProductionOverheadAllocationItem,
  ProductionPlan,
  ProductionPlanningDashboard,
  QualityInspectionItem,
  RecallLookupResponse,
  WorkOrder,
  WorkOrderDashboardSummary,
  WorkOrderMaterialRequirement,
} from '../types/production';

export interface ProductionPlanQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface WorkOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  warehouseId?: string;
  productionPlanId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ProductionBatchQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  workOrderId?: string;
  warehouseId?: string;
}

const buildQuery = (params: object = {}): string => {
  const qs = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export const productionService = {
  dashboard: () => apiClient<ProductionPlanningDashboard>('/production/planning/dashboard'),
  demand: (params: { warehouseId?: string; fromDate?: string; toDate?: string } = {}) =>
    apiClient<ProductionDemandResponse>(`/production/demand${buildQuery(params)}`),
  plans: {
    list: (params: ProductionPlanQuery = {}) =>
      apiClient<PaginatedResponse<ProductionPlan>>(`/production/plans${buildQuery(params)}`),
    getById: (id: string) => apiClient<ProductionPlan>(`/production/plans/${id}`),
    getMaterialAvailability: (id: string) =>
      apiClient<MaterialAvailabilityDetail[]>(`/production/plans/${id}/material-availability`),
    create: (payload: Record<string, unknown>) =>
      apiClient<ProductionPlan>('/production/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiClient<ProductionPlan>(`/production/plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    submit: (id: string) =>
      apiClient<ProductionPlan>(`/production/plans/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<ProductionPlan>(`/production/plans/${id}/approve`, { method: 'POST', body: '{}' }),
    reject: (id: string, reason: string) =>
      apiClient<ProductionPlan>(`/production/plans/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    release: (id: string) =>
      apiClient<ProductionPlan>(`/production/plans/${id}/release`, { method: 'POST', body: '{}' }),
    cancel: (id: string, reason: string) =>
      apiClient<ProductionPlan>(`/production/plans/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
  workOrders: {
    dashboard: () => apiClient<WorkOrderDashboardSummary>('/production/work-orders/dashboard'),
    list: (params: WorkOrderQuery = {}) =>
      apiClient<PaginatedResponse<WorkOrder>>(`/production/work-orders${buildQuery(params)}`),
    getById: (id: string) => apiClient<WorkOrder>(`/production/work-orders/${id}`),
    getMaterialRequirements: (id: string) =>
      apiClient<WorkOrderMaterialRequirement[]>(`/production/work-orders/${id}/material-requirements`),
    create: (payload: Record<string, unknown>) =>
      apiClient<WorkOrder>('/production/work-orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    submit: (id: string) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}/approve`, { method: 'POST', body: '{}' }),
    reject: (id: string, reason: string) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    release: (id: string) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}/release`, { method: 'POST', body: '{}' }),
    cancel: (id: string, reason: string) =>
      apiClient<WorkOrder>(`/production/work-orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
  batches: {
    dashboard: () => apiClient<ProductionExecutionDashboard>('/production/batches/dashboard'),
    list: (params: ProductionBatchQuery = {}) =>
      apiClient<PaginatedResponse<ProductionBatch>>(`/production/batches${buildQuery(params)}`),
    getById: (id: string) => apiClient<ProductionBatch>(`/production/batches/${id}`),
    create: (payload: Record<string, unknown>) =>
      apiClient<ProductionBatch>('/production/batches', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    start: (id: string) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/start`, { method: 'POST', body: '{}' }),
    pause: (id: string, reason: string) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/pause`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    resume: (id: string) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/resume`, { method: 'POST', body: '{}' }),
    reserveMaterials: (id: string, warehouseId?: string) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/reserve-materials`, {
        method: 'POST',
        body: JSON.stringify(warehouseId ? { warehouseId } : {}),
      }),
    consume: (id: string, payload: Record<string, unknown>) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/consume`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    recordOutput: (id: string, payload: Record<string, unknown>) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/output`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    complete: (id: string, payload: Record<string, unknown> = {}) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    cancel: (id: string, reason: string) =>
      apiClient<ProductionBatch>(`/production/batches/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
  reconciliation: {
    dashboard: () => apiClient<BatchReconciliation[]>('/production/reconciliation'),
    getByBatchId: (batchId: string) =>
      apiClient<BatchReconciliation>(`/production/batches/${batchId}/reconciliation`),
    returnMaterials: (batchId: string, payload: Record<string, unknown>) =>
      apiClient<BatchReconciliation>(`/production/batches/${batchId}/return-materials`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    releaseReservation: (batchId: string, warehouseId?: string) =>
      apiClient<BatchReconciliation>(`/production/batches/${batchId}/release-reservation`, {
        method: 'POST',
        body: JSON.stringify(warehouseId ? { warehouseId } : {}),
      }),
    approveVariance: (batchId: string, payload: Record<string, unknown>) =>
      apiClient<BatchVarianceApproval>(`/production/batches/${batchId}/variance-approval`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  quality: {
    list: (params: { page?: number; limit?: number; search?: string; decision?: string } = {}) =>
      apiClient<PaginatedResponse<QualityInspectionItem>>(
        `/production/quality-inspections${buildQuery(params)}`,
      ),
    inspect: (id: string, payload: Record<string, unknown>) =>
      apiClient<QualityInspectionItem>(`/production/quality-inspections/${id}/inspect`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    release: (id: string, releaseNotes: string) =>
      apiClient<QualityInspectionItem>(`/production/quality-inspections/${id}/release`, {
        method: 'POST',
        body: JSON.stringify({ releaseNotes }),
      }),
    disposition: (id: string, releaseNotes: string) =>
      apiClient<QualityInspectionItem>(`/production/quality-inspections/${id}/disposition`, {
        method: 'POST',
        body: JSON.stringify({ releaseNotes }),
      }),
  },
  traceability: {
    recall: (batchNumber: string) =>
      apiClient<RecallLookupResponse>(
        `/production/traceability/recall${buildQuery({ batchNumber })}`,
      ),
  },
  costing: {
    dashboard: () => apiClient<CostingDashboardSummary>('/production/costing/dashboard'),
    listBatches: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) =>
      apiClient<PaginatedResponse<ProductionBatch & { costing?: ProductionBatchCosting | null }>>(
        `/production/costing/batches${buildQuery(params)}`,
      ),
    getBatchDetail: (batchId: string) =>
      apiClient<BatchCostingDetailResponse>(`/production/costing/batches/${batchId}`),
    calculate: (batchId: string, payload: { includeBomOverheads?: boolean; notes?: string } = {}) =>
      apiClient<ProductionBatchCosting>(`/production/costing/batches/${batchId}/calculate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    addEntry: (batchId: string, payload: Record<string, unknown>) =>
      apiClient<ProductionCostEntryItem>(`/production/costing/batches/${batchId}/entries`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    reviewEntry: (entryId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) =>
      apiClient<ProductionCostEntryItem>(`/production/costing/entries/${entryId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      }),
    deleteEntry: (entryId: string) =>
      apiClient<{ deleted: boolean }>(`/production/costing/entries/${entryId}`, {
        method: 'DELETE',
      }),
    addOverhead: (batchId: string, payload: Record<string, unknown>) =>
      apiClient<ProductionOverheadAllocationItem>(
        `/production/costing/batches/${batchId}/overheads`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    deleteOverhead: (allocationId: string) =>
      apiClient<{ deleted: boolean }>(`/production/costing/overheads/${allocationId}`, {
        method: 'DELETE',
      }),
    review: (batchId: string, notes?: string) =>
      apiClient<ProductionBatchCosting>(`/production/costing/batches/${batchId}/review`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    finalize: (batchId: string, payload: { idempotencyKey?: string; notes?: string } = {}) =>
      apiClient<ProductionBatchCosting>(`/production/costing/batches/${batchId}/finalize`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    addPostFinalizationNote: (batchId: string, note: string) =>
      apiClient<ProductionBatchCosting>(
        `/production/costing/batches/${batchId}/post-finalization-note`,
        {
          method: 'POST',
          body: JSON.stringify({ note }),
        },
      ),
    varianceReport: (params: { status?: string; fromDate?: string; toDate?: string } = {}) =>
      apiClient<CostVarianceReportResponse>(
        `/production/costing/variance-report${buildQuery(params)}`,
      ),
  },
};
