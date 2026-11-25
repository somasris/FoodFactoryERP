import { apiClient, getAccessToken } from './api-client';
import { ApiResponse } from '../types/api';
import { config } from '../config/env';

const unwrap = <T>(promise: Promise<ApiResponse<T>>): Promise<T> =>
  promise.then(res => res.data as T);

export interface GstSalesSummary {
  disclaimer: string;
  counts: { issued: number; cancelled: number; draft: number };
  totals: {
    taxableSalesValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalGstCollected: string;
    grandTotal: string;
    intraStateTaxable: string;
    interStateTaxable: string;
  };
  hsnSummary: Array<{
    hsnCode: string;
    lineCount: number;
    totalQuantity: string;
    taxableAmount: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    taxAmount: string;
    totalValue: string;
  }>;
  taxRateSummary: Array<{
    gstRate: string;
    lineCount: number;
    taxableAmount: string;
    taxAmount: string;
  }>;
  monthlySummary: Array<{
    month: string;
    invoiceCount: number;
    taxableAmount: string;
    taxAmount: string;
    grandTotal: string;
  }>;
}

export interface PurchaseTaxSummary {
  purchaseInvoicingSupported: boolean;
  activeSuppliersCount: number;
  statusNotice: string;
}

export interface InventoryValuationReport {
  summary: {
    totalValuation: string;
    rawMaterialValuation: string;
    packagingValuation: string;
    finishedGoodsValuation: string;
    activeStockLines: number;
  };
  warehouseSummary: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    totalValue: string;
    itemCount: number;
  }>;
  items: Array<{
    balanceId: string;
    warehouseCode: string;
    itemCode: string;
    itemName: string;
    itemType: string;
    valuationMethod: string;
    batchNumber: string | null;
    quantityOnHand: string;
    unitCost: string;
    totalValue: string;
  }>;
}

export interface StockAuditRecord {
  id: string;
  auditNumber: string;
  warehouseId: string;
  status: string;
  auditDate: string;
  notes: string | null;
  inventoryAdjustmentId: string | null;
  warehouse: { id: string; code: string; name: string };
  createdBy: { id: string; username: string; fullName: string };
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    expectedBaseQuantity: string;
    countedBaseQuantity: string;
    varianceBaseQuantity: string;
    varianceValue: string;
  }>;
}

export interface ComplianceDocumentRecord {
  id: string;
  category: string;
  referenceNumber: string;
  documentDate: string;
  expiryDate: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  verificationStatus: string;
  uploadedBy: { username: string; fullName: string };
}

export const complianceService = {
  getGstSalesSummary: (params?: { financialYear?: string; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.financialYear) qs.set('financialYear', params.financialYear);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    return unwrap(apiClient<GstSalesSummary>(`/compliance/gst/sales-summary?${qs.toString()}`));
  },
  getPurchaseTaxSummary: () =>
    unwrap(apiClient<PurchaseTaxSummary>('/compliance/gst/purchase-summary')),
  getInventoryValuation: (warehouseId?: string) =>
    unwrap(
      apiClient<InventoryValuationReport>(
        warehouseId
          ? `/compliance/inventory/valuation?warehouseId=${warehouseId}`
          : '/compliance/inventory/valuation',
      ),
    ),
  getProductionCostCompliance: () =>
    unwrap(
      apiClient<{
        summary: {
          totalRecords: number;
          finalizedCount: number;
          provisionalCount: number;
          finalizedTotalCost: string;
          provisionalTotalCost: string;
        };
        items: Array<Record<string, unknown>>;
      }>('/compliance/production-costing'),
    ),
  getTraceability: (search?: string) =>
    unwrap(
      apiClient<{ items: Array<Record<string, unknown>> }>(
        search
          ? `/compliance/traceability?search=${encodeURIComponent(search)}`
          : '/compliance/traceability',
      ),
    ),
  listStockAudits: () =>
    unwrap(apiClient<{ items: StockAuditRecord[] }>('/compliance/stock-audits')),
  createStockAudit: (data: Record<string, unknown>) =>
    unwrap(
      apiClient<StockAuditRecord>('/compliance/stock-audits', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  submitStockAudit: (id: string) =>
    unwrap(
      apiClient<StockAuditRecord>(`/compliance/stock-audits/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    ),
  reviewStockAudit: (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) =>
    unwrap(
      apiClient<StockAuditRecord>(`/compliance/stock-audits/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    ),
  postStockAudit: (id: string) =>
    unwrap(
      apiClient<StockAuditRecord>(`/compliance/stock-audits/${id}/post`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: `UI-SA-${id}` }),
      }),
    ),
  listDocuments: () => unwrap(apiClient<ComplianceDocumentRecord[]>('/compliance/documents')),
  createDocument: (data: Record<string, unknown>) =>
    unwrap(
      apiClient<ComplianceDocumentRecord>('/compliance/documents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  verifyDocument: (id: string, status: 'VERIFIED' | 'REJECTED', remarks?: string) =>
    unwrap(
      apiClient<ComplianceDocumentRecord>(`/compliance/documents/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status, remarks }),
      }),
    ),
  downloadExport: async (
    reportType: 'gst-sales' | 'hsn-summary' | 'inventory-valuation' | 'production-costing' | 'traceability',
    format: 'csv' | 'excel' | 'pdf',
  ) => {
    const token = getAccessToken();
    const res = await fetch(`${config.apiBaseUrl}/compliance/export/${reportType}?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-${reportType}.${format === 'excel' ? 'xls' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
