import { apiClient } from './api-client';

export interface CustomerPayment {
  id: string;
  paymentNumber: string;
  financialYear: string;
  customerId: string;
  paymentDate: string;
  amount: string;
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'NEFT_RTGS' | 'OTHER';
  transactionReference: string | null;
  notes: string | null;
  status: 'RECORDED' | 'REVERSED';
  reversalReason: string | null;
  allocatedAmount: string;
  unallocatedAmount: string;
  customer: {
    id: string;
    code: string;
    legalName: string;
    customerType: string;
    gstin: string | null;
  };
  allocations: Array<{
    id: string;
    salesInvoiceId: string;
    allocatedAmount: string;
    isReversed: boolean;
    createdAt: string;
    salesInvoice: {
      id: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string | null;
      grandTotal: string;
      status: string;
      paymentStatus: string;
    };
  }>;
}

export interface ReceivablesReport {
  totals: {
    invoiceCount: number;
    totalInvoiced: string;
    totalPaid: string;
    totalCreditNotes: string;
    totalOutstanding: string;
  };
  customers: Array<{
    customerId: string;
    customerCode: string;
    customerLegalName: string;
    invoiceCount: number;
    totalInvoiced: string;
    totalPaid: string;
    totalCreditNotes: string;
    outstandingAmount: string;
    unallocatedPayments: string;
    excessCreditBalance: string;
  }>;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    effectiveDueDate: string;
    dueDateFallbackUsed: boolean;
    customerId: string;
    customerCode: string;
    customerLegalName: string;
    paymentStatus: string;
    grandTotal: string;
    paidAmount: string;
    creditNoteAmount: string;
    outstandingAmount: string;
    excessCreditBalance: string;
  }>;
}

export interface AgeingReport {
  asOfDate: string;
  fallbackRule: string;
  bucketTotals: {
    notDue: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    above90: string;
    totalOutstanding: string;
  };
  customers: Array<{
    customerId: string;
    customerCode: string;
    customerLegalName: string;
    notDue: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    above90: string;
    totalOutstanding: string;
  }>;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    customerId: string;
    customerLegalName: string;
    grandTotal: string;
    paidAmount: string;
    creditNoteAmount: string;
    outstandingAmount: string;
    daysPastDue: number;
    bucket: string;
  }>;
}

export interface CollectionReport {
  groupBy: 'daily' | 'monthly';
  accountingPolicy: string;
  summary: {
    transactionCount: number;
    recordedCount: number;
    reversedCount: number;
    totalGrossPaymentsReceived: string;
    totalReversedPayments: string;
    netCollections: string;
    totalAllocatedAmount: string;
    totalUnallocatedAdvances: string;
  };
  byPaymentMode: Array<{
    paymentMode: string;
    transactionCount: number;
    netCollected: string;
    allocatedAmount: string;
    unallocatedAdvances: string;
  }>;
  byCustomer: Array<{
    customerId: string;
    customerCode: string;
    customerLegalName: string;
    transactionCount: number;
    netCollected: string;
    allocatedAmount: string;
    unallocatedAdvances: string;
  }>;
  byPeriod: Array<{
    period: string;
    transactionCount: number;
    grossReceived: string;
    reversedAmount: string;
    netCollected: string;
    unallocatedAdvances: string;
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

export const paymentsService = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    customerId?: string;
    status?: string;
    paymentMode?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) =>
    apiClient<{
      items: CustomerPayment[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/sales/payments${buildQs(params)}`),

  getById: (id: string) => apiClient<CustomerPayment>(`/sales/payments/${id}`),

  create: (body: {
    customerId: string;
    paymentDate?: string;
    amount: string;
    paymentMode: string;
    transactionReference?: string;
    notes?: string;
    idempotencyKey?: string;
    allocations?: Array<{ salesInvoiceId: string; allocatedAmount: string }>;
  }) =>
    apiClient<CustomerPayment>('/sales/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  allocate: (id: string, allocations: Array<{ salesInvoiceId: string; allocatedAmount: string }>) =>
    apiClient<CustomerPayment>(`/sales/payments/${id}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ allocations }),
    }),

  reverse: (id: string, reason: string) =>
    apiClient<CustomerPayment>(`/sales/payments/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getInvoicePaymentHistory: (invoiceId: string) =>
    apiClient<{
      invoiceId: string;
      invoiceNumber: string;
      invoiceStatus: string;
      paymentStatus: string;
      grandTotal: string;
      netAllocatedPayments: string;
      issuedCreditNotesTotal: string;
      outstandingAmount: string;
      excessCreditBalance: string;
      allocations: Array<{
        id: string;
        allocatedAmount: string;
        isReversed: boolean;
        createdAt: string;
        payment: {
          id: string;
          paymentNumber: string;
          paymentDate: string;
          paymentMode: string;
          status: string;
        };
      }>;
    }>(`/sales/invoices/${invoiceId}/payments`),

  getReceivables: (params: {
    customerId?: string;
    invoiceId?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) => apiClient<ReceivablesReport>(`/sales/receivables${buildQs(params)}`),

  getAgeing: (params: {
    asOfDate?: string;
    customerId?: string;
    invoiceId?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) => apiClient<AgeingReport>(`/sales/ageing${buildQs(params)}`),

  async downloadAgeingExport(
    format: 'csv' | 'excel' | 'pdf',
    params: { asOfDate?: string; customerId?: string } = {},
  ) {
    const { downloadAuthenticatedExport } = await import('../utils/export-download');
    const qs = buildQs({ ...params, format });
    const ext = format === 'excel' ? 'xlsx' : format;
    await downloadAuthenticatedExport(`/sales/ageing${qs}`, `Receivables_Ageing.${ext}`);
  },

  getCollections: (params: {
    fromDate?: string;
    toDate?: string;
    paymentMode?: string;
    customerId?: string;
    groupBy?: 'daily' | 'monthly';
  } = {}) => apiClient<CollectionReport>(`/sales/collections${buildQs(params)}`),

  async downloadCollectionsExport(
    format: 'csv' | 'excel' | 'pdf',
    params: {
      fromDate?: string;
      toDate?: string;
      paymentMode?: string;
      customerId?: string;
      groupBy?: 'daily' | 'monthly';
    } = {},
  ) {
    const { downloadAuthenticatedExport } = await import('../utils/export-download');
    const qs = buildQs({ ...params, format });
    const ext = format === 'excel' ? 'xlsx' : format;
    await downloadAuthenticatedExport(`/sales/collections${qs}`, `Collection_Summary.${ext}`);
  },
};
