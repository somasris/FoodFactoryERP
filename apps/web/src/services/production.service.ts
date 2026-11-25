import { apiClient } from './api-client';
import { PaginatedResponse } from '../types/master-data';
import {
  MaterialAvailabilityDetail,
  ProductionDemandResponse,
  ProductionPlan,
  ProductionPlanningDashboard,
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
};
