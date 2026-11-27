import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OfflineRepository } from '../offline/offline-repository';
import { offlineDb } from '../offline/db';
import { SalesOrderDetailPage } from '../routes/sales/SalesOrderDetailPage';
import { ReceivablesAgeingPage } from '../routes/sales/ReceivablesAgeingPage';
import { paymentsService } from '../services/payments.service';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-sales-1', username: 'sales1', roles: ['SALESMAN'], permissions: ['sales.orders.read', 'sales.payments.read'] },
    isAuthenticated: true,
    hasPermission: () => true,
  }),
}));

const repo = new OfflineRepository(offlineDb);

function renderWithRouter(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
          <Route path="/sync-center" element={<div>Sync Center Page</div>} />
          <Route path="/sales/receivables" element={<ReceivablesAgeingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('P1.2 Offline Sales Order Detail & P1.1 Collection Summary UI', () => {
  beforeEach(async () => {
    await offlineDb.pendingOperations.clear();
    await offlineDb.cachedEntities.clear();
  });

  it('displays locally queued offline sales order draft with Pending Sync status before sync', async () => {
    const localId = 'local-so-uuid-1';
    await repo.putPendingOperation({
      operationId: 'op-1',
      idempotencyKey: 'idem-1',
      entityType: 'SALES_ORDER',
      entityId: localId,
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: {
        customerId: 'cust-tn-1',
        warehouseId: 'wh-fg-1',
        notes: 'Deliver before 5 PM',
        lines: [
          {
            productVariantId: 'var-murukku-200g',
            uomId: 'uom-pcs',
            orderedQuantity: '150',
            discountPercent: '0',
          },
        ],
      },
      userId: 'user-sales-1',
      factoryId: null,
      warehouseId: 'wh-fg-1',
      clientCreatedAt: '2026-11-27T05:00:00.000Z',
      clientUpdatedAt: '2026-11-27T05:00:00.000Z',
      baseServerVersion: null,
      localSequence: 1,
      dependencyOperationIds: [],
      status: 'PENDING',
      retryCount: 0,
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      serverResultEntityId: null,
    });

    renderWithRouter(`/sales/orders/${localId}`);

    await waitFor(() => {
      expect(screen.getByText(/Pending Sync \(PENDING\)/i)).toBeTruthy();
      expect(screen.getByText(/Deliver before 5 PM/i)).toBeTruthy();
      expect(screen.getByText('150')).toBeTruthy();
      expect(screen.getByText(/Open Sync Center/i)).toBeTruthy();
    });
  });

  it('preserves local draft and displays error/conflict details when sync fails', async () => {
    const localId = 'local-so-conflict-1';
    await repo.putPendingOperation({
      operationId: 'op-2',
      idempotencyKey: 'idem-2',
      entityType: 'SALES_ORDER',
      entityId: localId,
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: {
        customerId: 'cust-ka-1',
        warehouseId: 'wh-fg-1',
        lines: [{ productVariantId: 'var-1', uomId: 'uom-1', orderedQuantity: '120' }],
      },
      userId: 'user-sales-1',
      factoryId: null,
      warehouseId: 'wh-fg-1',
      clientCreatedAt: '2026-11-27T05:00:00.000Z',
      clientUpdatedAt: '2026-11-27T05:00:00.000Z',
      baseServerVersion: null,
      localSequence: 2,
      dependencyOperationIds: [],
      status: 'CONFLICT',
      retryCount: 1,
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorCode: 'INSUFFICIENT_STOCK',
      lastErrorMessage: 'Short by 32 packets',
      serverResultEntityId: null,
    });

    renderWithRouter(`/sales/orders/${localId}`);

    await waitFor(() => {
      expect(screen.getByText(/Sync Conflict — Action Required/i)).toBeTruthy();
      expect(screen.getByText(/Short by 32 packets/i)).toBeTruthy();
      expect(screen.getByText('120')).toBeTruthy();
    });
  });

  it('renders Collection Summary tab in ReceivablesAgeingPage', async () => {
    vi.spyOn(paymentsService, 'getReceivables').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: {
        totals: { invoiceCount: 1, totalInvoiced: '7875.00', totalPaid: '4000.00', totalCreditNotes: '0.00', totalOutstanding: '3875.00' },
        customers: [],
        invoices: [],
      },
    });
    vi.spyOn(paymentsService, 'getCollections').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: {
        groupBy: 'monthly',
        accountingPolicy: 'Reversed excluded',
        summary: {
          transactionCount: 1,
          recordedCount: 1,
          reversedCount: 0,
          totalGrossPaymentsReceived: '4000.00',
          totalReversedPayments: '0.00',
          netCollections: '4000.00',
          totalAllocatedAmount: '4000.00',
          totalUnallocatedAdvances: '0.00',
        },
        byPaymentMode: [{ paymentMode: 'BANK_TRANSFER', transactionCount: 1, netCollected: '4000.00', allocatedAmount: '4000.00', unallocatedAdvances: '0.00' }],
        byCustomer: [{ customerId: 'c1', customerCode: 'CA', customerLegalName: 'Retailer A', transactionCount: 1, netCollected: '4000.00', allocatedAmount: '4000.00', unallocatedAdvances: '0.00' }],
        byPeriod: [{ period: '2026-11', transactionCount: 1, grossReceived: '4000.00', reversedAmount: '0.00', netCollected: '4000.00', unallocatedAdvances: '0.00' }],
      },
    });

    renderWithRouter('/sales/receivables');
    const colBtn = await screen.findByText('Collection Summary');
    colBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/Net Collections/i)).toBeTruthy();
      expect(screen.getByText('2026-11')).toBeTruthy();
      expect(screen.getByText('Retailer A')).toBeTruthy();
    });
  });
});
