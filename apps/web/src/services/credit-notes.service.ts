import { apiClient, getAccessToken } from './api-client';
import { config } from '../config/env';

export interface CreditNoteLine {
  id: string;
  originalInvoiceLineId: string;
  lineNumber: number;
  itemCodeSnapshot: string;
  descriptionSnapshot: string;
  hsnCodeSnapshot: string;
  uomSymbolSnapshot: string;
  quantity: string;
  unitPrice: string;
  taxableValue: string;
  taxRateSnapshot: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  totalAmount: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  financialYear: string;
  salesInvoiceId: string;
  customerId: string;
  creditNoteDate: string;
  reason: string;
  customerLegalName: string;
  customerGstin: string | null;
  placeOfSupply: string;
  isInterState: boolean;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  roundOff: string;
  grandTotal: string;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  cancellationReason: string | null;
  salesInvoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: string;
    status: string;
    paymentStatus: string;
  };
  customer: { id: string; code: string; legalName: string; gstin: string | null };
  lines: CreditNoteLine[];
}

function buildQs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const creditNotesService = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    customerId?: string;
    salesInvoiceId?: string;
  } = {}) =>
    apiClient<{
      items: CreditNote[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/sales/credit-notes${buildQs(params)}`),

  getById: (id: string) => apiClient<CreditNote>(`/sales/credit-notes/${id}`),

  listByInvoice: (invoiceId: string) =>
    apiClient<CreditNote[]>(`/sales/invoices/${invoiceId}/credit-notes`),

  createDraft: (body: {
    salesInvoiceId: string;
    creditNoteDate?: string;
    reason: string;
    idempotencyKey?: string;
    lines: Array<{ originalInvoiceLineId: string; quantity: string }>;
  }) =>
    apiClient<CreditNote>('/sales/credit-notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  issue: (id: string) =>
    apiClient<CreditNote>(`/sales/credit-notes/${id}/issue`, {
      method: 'POST',
    }),

  cancel: (id: string, reason: string) =>
    apiClient<CreditNote>(`/sales/credit-notes/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  async fetchPdfBlob(id: string): Promise<Blob> {
    const token = getAccessToken();
    const res = await fetch(`${config.apiBaseUrl}/sales/credit-notes/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to download credit note PDF');
    return res.blob();
  },
};
