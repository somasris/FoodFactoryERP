import { apiClient } from './api-client';

export interface SupplierInvoice {
  id: string;
  supplierInvoiceNumber: string;
  internalInvoiceNumber: string;
  financialYear: string;
  supplierId: string;
  factoryId: string;
  invoiceDate: string;
  receivedDate: string;
  dueDate: string | null;
  supplierLegalName: string;
  supplierGstin: string | null;
  supplierStateCode: string;
  placeOfSupply: string;
  isInterState: boolean;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  roundOff: string;
  grandTotal: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  matchingStatus: 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED' | 'MISMATCH';
  itcStatus: 'PENDING_VERIFICATION' | 'ELIGIBLE' | 'INELIGIBLE';
  itcNotes: string | null;
  notes: string | null;
  supplier: { id: string; code: string; legalName: string; gstin: string | null };
  factory: { id: string; code: string; name: string; state: string; stateCode: string };
  lines: Array<{
    id: string;
    lineNumber: number;
    inventoryItemId: string;
    descriptionSnapshot: string;
    hsnCodeSnapshot: string;
    quantity: string;
    uomId: string;
    unitPrice: string;
    taxableValue: string;
    taxRateSnapshot: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalAmount: string;
    inventoryItem: { id: string; code: string; name: string };
    uom: { id: string; code: string; symbol: string };
  }>;
  receiptMatches: Array<{
    id: string;
    receiptId: string;
    matchStatus: string;
    discrepancies: Array<{ type: string; description: string }> | null;
    matchedAt: string;
    receipt: {
      id: string;
      receiptNumber: string;
      receiptDate: string;
      status: string;
    };
  }>;
}

export interface PurchaseRegisterResponse {
  invoiceCount: number;
  totals: {
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    taxAmount: string;
    grandTotal: string;
  };
  rows: Array<{
    supplierInvoiceId: string;
    supplierName: string;
    supplierGstin: string;
    supplierInvoiceNumber: string;
    internalInvoiceNumber: string;
    invoiceDate: string;
    factoryName: string;
    hsnCode: string;
    itemDescription: string;
    quantity: string;
    uomSymbol: string;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalInvoiceValue: string;
    matchingStatus: string;
    itcStatus: string;
    status: string;
  }>;
}

function buildQs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const purchasesService = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
    factoryId?: string;
    status?: string;
    matchingStatus?: string;
    itcStatus?: string;
  } = {}) =>
    apiClient<{
      items: SupplierInvoice[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/purchases/invoices${buildQs(params)}`),

  getById: (id: string) => apiClient<SupplierInvoice>(`/purchases/invoices/${id}`),

  createDraft: (body: {
    supplierId: string;
    factoryId: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    itcStatus?: string;
    notes?: string;
    lines: Array<{
      inventoryItemId: string;
      uomId: string;
      quantity: string;
      unitPrice: string;
      taxRatePercent?: string;
      hsnCode?: string;
    }>;
  }) =>
    apiClient<SupplierInvoice>('/purchases/invoices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  post: (id: string) =>
    apiClient<SupplierInvoice>(`/purchases/invoices/${id}/post`, {
      method: 'POST',
    }),

  cancel: (id: string, reason: string) =>
    apiClient<SupplierInvoice>(`/purchases/invoices/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  matchReceipts: (id: string, receiptIds: string[], notes?: string) =>
    apiClient<SupplierInvoice>(`/purchases/invoices/${id}/match-receipts`, {
      method: 'POST',
      body: JSON.stringify({ receiptIds, notes }),
    }),

  updateItc: (id: string, itcStatus: string, itcNotes?: string) =>
    apiClient<SupplierInvoice>(`/purchases/invoices/${id}/itc`, {
      method: 'PATCH',
      body: JSON.stringify({ itcStatus, itcNotes }),
    }),

  getUnmatchedReceipts: () =>
    apiClient<
      Array<{
        id: string;
        receiptNumber: string;
        receiptDate: string;
        warehouse: { id: string; code: string; name: string };
        lines: Array<{
          inventoryItemId: string;
          quantity: string;
          unitCost: string;
          inventoryItem: { code: string; name: string };
          uom: { symbol: string };
        }>;
      }>
    >('/purchases/unmatched-receipts'),

  getRegister: (params: {
    supplierId?: string;
    factoryId?: string;
    matchingStatus?: string;
    itcStatus?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) => apiClient<PurchaseRegisterResponse>(`/purchases/register${buildQs(params)}`),

  async downloadRegisterExport(
    format: 'csv' | 'excel' | 'pdf',
    params: {
      supplierId?: string;
      factoryId?: string;
      matchingStatus?: string;
      itcStatus?: string;
      fromDate?: string;
      toDate?: string;
    } = {},
  ) {
    const { downloadAuthenticatedExport } = await import('../utils/export-download');
    const qs = buildQs({ ...params, format });
    const ext = format === 'excel' ? 'xlsx' : format;
    await downloadAuthenticatedExport(`/purchases/register${qs}`, `GST_Purchase_Register.${ext}`);
  },
};
