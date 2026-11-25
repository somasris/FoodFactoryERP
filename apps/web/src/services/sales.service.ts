import { apiClient } from './api-client';
import { PaginatedResponse } from '../types/master-data';
import {
  SalesDashboardSummary,
  SalesOrder,
  SalesOrderFulfillmentItem,
  SalesOrderStatusHistoryItem,
} from '../types/sales';

export interface SalesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
}

const buildQuery = (params: SalesQuery = {}): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export const salesService = {
  dashboard: (params: { fromDate?: string; toDate?: string } = {}) =>
    apiClient<SalesDashboardSummary>(`/sales/dashboard${buildQuery(params)}`),

  orders: {
    list: (params: SalesQuery = {}) =>
      apiClient<PaginatedResponse<SalesOrder>>(`/sales/orders${buildQuery(params)}`),
    getById: (id: string) => apiClient<SalesOrder>(`/sales/orders/${id}`),
    getHistory: (id: string) => apiClient<SalesOrderStatusHistoryItem[]>(`/sales/orders/${id}/history`),
    create: (payload: Record<string, unknown>) =>
      apiClient<SalesOrder>('/sales/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiClient<SalesOrder>(`/sales/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    submit: (id: string) =>
      apiClient<SalesOrder>(`/sales/orders/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<SalesOrder>(`/sales/orders/${id}/approve`, { method: 'POST', body: '{}' }),
    reject: (id: string, reason: string) =>
      apiClient<SalesOrder>(`/sales/orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    confirm: (id: string) =>
      apiClient<SalesOrder>(`/sales/orders/${id}/confirm`, { method: 'POST', body: '{}' }),
    cancel: (id: string, reason: string) =>
      apiClient<SalesOrder>(`/sales/orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    fulfill: (
      id: string,
      payload: {
        notes?: string;
        lines?: Array<{ salesOrderLineId: string; quantity: string }>;
      } = {},
    ) =>
      apiClient<{ order: SalesOrder; fulfillment: SalesOrderFulfillmentItem }>(
        `/sales/orders/${id}/fulfill`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
  },
};
