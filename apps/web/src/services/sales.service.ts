import { apiClient, getAccessToken } from './api-client';
import { cachedApiGet } from '../offline/offline-cache';
import { config } from '../config/env';
import { PaginatedResponse } from '../types/master-data';
import {
  SalesDashboardSummary,
  SalesInvoice,
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
    cachedApiGet<SalesDashboardSummary>('SALES_DASHBOARD', `/sales/dashboard${buildQuery(params)}`),

  orders: {
    list: (params: SalesQuery = {}) =>
      cachedApiGet<PaginatedResponse<SalesOrder>>('SALES_ORDERS', `/sales/orders${buildQuery(params)}`),
    getById: (id: string) => cachedApiGet<SalesOrder>('SALES_ORDERS', `/sales/orders/${id}`),
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

  invoices: {
    list: (params: SalesQuery & { salesOrderId?: string } = {}) =>
      apiClient<PaginatedResponse<SalesInvoice>>(`/sales/invoices${buildQuery(params)}`),
    listByOrder: (orderId: string) =>
      apiClient<SalesInvoice[]>(`/sales/orders/${orderId}/invoices`),
    getById: (id: string) => apiClient<SalesInvoice>(`/sales/invoices/${id}`),
    getByNumber: (invoiceNumber: string) =>
      apiClient<SalesInvoice>(`/sales/invoices/number/${encodeURIComponent(invoiceNumber)}`),
    createFromOrder: (orderId: string, payload: Record<string, unknown>) =>
      apiClient<SalesInvoice>(`/sales/orders/${orderId}/invoices`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiClient<SalesInvoice>(`/sales/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    issue: (id: string) =>
      apiClient<SalesInvoice>(`/sales/invoices/${id}/issue`, { method: 'POST', body: '{}' }),
    cancel: (id: string, reason: string) =>
      apiClient<SalesInvoice>(`/sales/invoices/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    fetchPdfBlob: async (id: string): Promise<Blob> => {
      const token = getAccessToken();
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${config.apiBaseUrl}/sales/invoices/${id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to download invoice PDF');
      }
      return res.blob();
    },
  },
};
