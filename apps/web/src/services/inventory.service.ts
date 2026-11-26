import { apiClient } from './api-client';
import { cachedApiGet } from '../offline/offline-cache';
import { executeOrQueueOffline } from '../offline/offline-mutation';
import { PaginatedResponse } from '../types/master-data';
import {
  InventoryAdjustmentRecord,
  InventoryBalanceRecord,
  InventoryBatchRecord,
  InventoryDashboardSummary,
  InventoryIssueRecord,
  InventoryReceiptRecord,
  InventoryTransactionLineRecord,
  InventoryTransactionRecord,
  InventoryTransferRecord,
  InventoryValuationRecord,
} from '../types/inventory';

export interface InventoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: string;
  status?: string;
  itemType?: string;
  expiryStatus?: string;
  transactionType?: string;
  includeZero?: boolean;
}

const buildQuery = (params: InventoryQuery = {}): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export const inventoryService = {
  dashboard: () => cachedApiGet<InventoryDashboardSummary>('INVENTORY_DASHBOARD', '/inventory/dashboard'),

  balances: (params: InventoryQuery = {}) =>
    cachedApiGet<PaginatedResponse<InventoryBalanceRecord>>(
      'INVENTORY_BALANCES',
      `/inventory/balances${buildQuery(params)}`,
    ),

  batches: (params: InventoryQuery = {}) =>
    cachedApiGet<PaginatedResponse<InventoryBatchRecord>>(
      'INVENTORY_BATCHES',
      `/inventory/batches${buildQuery(params)}`,
    ),

  valuation: (params: InventoryQuery = {}) =>
    apiClient<PaginatedResponse<InventoryValuationRecord>>(`/inventory/valuation${buildQuery(params)}`),

  valuationHistory: (itemId: string, params: InventoryQuery = {}) =>
    apiClient<{
      item: InventoryValuationRecord;
      history: PaginatedResponse<
        InventoryTransactionLineRecord & {
          transaction: {
            id: string;
            transactionNumber: string;
            transactionType: string;
            referenceNumber: string;
            transactionDate: string;
            warehouse: { code: string; name: string };
          };
        }
      >;
    }>(`/inventory/valuation/${itemId}/history${buildQuery(params)}`),

  transactions: (params: InventoryQuery = {}) =>
    apiClient<PaginatedResponse<InventoryTransactionRecord>>(
      `/inventory/transactions${buildQuery(params)}`,
    ),

  reverseTransaction: (id: string, reason: string) =>
    apiClient<InventoryTransactionRecord>(`/inventory/transactions/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  receipts: {
    list: (params: InventoryQuery = {}) =>
      apiClient<PaginatedResponse<InventoryReceiptRecord>>(`/inventory/receipts${buildQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      executeOrQueueOffline<InventoryReceiptRecord>({
        entityType: 'INVENTORY_RECEIPT',
        operationType: 'INVENTORY_RECEIPT_DRAFT',
        payload,
        onlineCall: () =>
          apiClient<InventoryReceiptRecord>('/inventory/receipts', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
      }),
    submit: (id: string) =>
      apiClient<InventoryReceiptRecord>(`/inventory/receipts/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<InventoryReceiptRecord>(`/inventory/receipts/${id}/approve`, { method: 'POST', body: '{}' }),
    post: (id: string) =>
      apiClient<InventoryReceiptRecord>(`/inventory/receipts/${id}/post`, { method: 'POST', body: '{}' }),
    cancel: (id: string) =>
      apiClient<InventoryReceiptRecord>(`/inventory/receipts/${id}/cancel`, { method: 'POST', body: '{}' }),
  },

  issues: {
    list: (params: InventoryQuery = {}) =>
      apiClient<PaginatedResponse<InventoryIssueRecord>>(`/inventory/issues${buildQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      executeOrQueueOffline<InventoryIssueRecord>({
        entityType: 'INVENTORY_ISSUE',
        operationType: 'INVENTORY_ISSUE_DRAFT',
        payload,
        onlineCall: () =>
          apiClient<InventoryIssueRecord>('/inventory/issues', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
      }),
    submit: (id: string) =>
      apiClient<InventoryIssueRecord>(`/inventory/issues/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<InventoryIssueRecord>(`/inventory/issues/${id}/approve`, { method: 'POST', body: '{}' }),
    post: (id: string) =>
      apiClient<InventoryIssueRecord>(`/inventory/issues/${id}/post`, { method: 'POST', body: '{}' }),
    cancel: (id: string) =>
      apiClient<InventoryIssueRecord>(`/inventory/issues/${id}/cancel`, { method: 'POST', body: '{}' }),
  },

  transfers: {
    list: (params: InventoryQuery = {}) =>
      apiClient<PaginatedResponse<InventoryTransferRecord>>(`/inventory/transfers${buildQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      executeOrQueueOffline<InventoryTransferRecord>({
        entityType: 'WAREHOUSE_TRANSFER',
        operationType: 'WAREHOUSE_TRANSFER_DRAFT',
        payload,
        onlineCall: () =>
          apiClient<InventoryTransferRecord>('/inventory/transfers', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
      }),
    approve: (id: string) =>
      apiClient<InventoryTransferRecord>(`/inventory/transfers/${id}/approve`, { method: 'POST', body: '{}' }),
    dispatch: (id: string) =>
      apiClient<InventoryTransferRecord>(`/inventory/transfers/${id}/dispatch`, { method: 'POST', body: '{}' }),
    receive: (id: string) =>
      apiClient<InventoryTransferRecord>(`/inventory/transfers/${id}/receive`, { method: 'POST', body: '{}' }),
    cancel: (id: string) =>
      apiClient<InventoryTransferRecord>(`/inventory/transfers/${id}/cancel`, { method: 'POST', body: '{}' }),
  },

  adjustments: {
    list: (params: InventoryQuery = {}) =>
      apiClient<PaginatedResponse<InventoryAdjustmentRecord>>(`/inventory/adjustments${buildQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      executeOrQueueOffline<InventoryAdjustmentRecord>({
        entityType: 'INVENTORY_ADJUSTMENT',
        operationType: 'INVENTORY_ADJUSTMENT_DRAFT',
        payload,
        onlineCall: () =>
          apiClient<InventoryAdjustmentRecord>('/inventory/adjustments', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
      }),
    submit: (id: string) =>
      apiClient<InventoryAdjustmentRecord>(`/inventory/adjustments/${id}/submit`, { method: 'POST', body: '{}' }),
    approve: (id: string) =>
      apiClient<InventoryAdjustmentRecord>(`/inventory/adjustments/${id}/approve`, { method: 'POST', body: '{}' }),
    post: (id: string) =>
      apiClient<InventoryAdjustmentRecord>(`/inventory/adjustments/${id}/post`, { method: 'POST', body: '{}' }),
    cancel: (id: string) =>
      apiClient<InventoryAdjustmentRecord>(`/inventory/adjustments/${id}/cancel`, { method: 'POST', body: '{}' }),
  },
};
