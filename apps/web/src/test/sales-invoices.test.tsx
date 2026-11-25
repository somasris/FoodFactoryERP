import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { SalesInvoicesPage } from '../routes/sales/SalesInvoicesPage';
import { SalesInvoiceDetailPage } from '../routes/sales/SalesInvoiceDetailPage';
import { SalesInvoiceFormPage } from '../routes/sales/SalesInvoiceFormPage';
import { salesService } from '../services/sales.service';
import { SalesInvoice } from '../types/sales';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'test@foodfactory.com',
    username: 'testuser',
    fullName: 'Test User',
    isActive: true,
    roles,
    permissions,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: (r: string) => roles.includes('OWNER') || roles.includes(r),
  hasPermission: (p: string) => roles.includes('OWNER') || permissions.includes(p),
});

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType, initialPath = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

const sampleInvoice: SalesInvoice = {
  id: 'inv-1',
  invoiceNumber: 'INV/2026-27/00001',
  financialYear: '2026-27',
  salesOrderId: 'so-1',
  customerId: 'cust-1',
  warehouseId: 'wh-1',
  companyId: 'comp-1',
  invoiceDate: '2026-11-25T00:00:00.000Z',
  dueDate: '2026-12-10T00:00:00.000Z',
  status: 'DRAFT',
  companyLegalName: 'South Indian Food Works Pvt Ltd',
  companyGstin: '33AAACF1234M1Z5',
  companyStateCode: '33',
  companyAddress: 'Tiruchirappalli, TN',
  customerLegalName: 'Trichy Retail Mart',
  customerGstin: '33AABCT1234M1Z5',
  customerStateCode: '33',
  customerBillingAddress: '12 Main Road, Tiruchirappalli, Tamil Nadu - 620001',
  placeOfSupply: 'Tamil Nadu (33)',
  isInterState: false,
  subtotal: '750.00',
  discountAmount: '0.00',
  taxableAmount: '750.00',
  cgstAmount: '18.75',
  sgstAmount: '18.75',
  igstAmount: '0.00',
  taxAmount: '37.50',
  roundOffAmount: '0.50',
  grandTotal: '788.00',
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  salesOrder: { id: 'so-1', orderNumber: 'SO-2026-001' },
  customer: { id: 'cust-1', code: 'C001', legalName: 'Trichy Retail Mart' },
  warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'Finished Goods' },
  lines: [
    {
      id: 'il-1',
      salesOrderLineId: 'sol-1',
      lineNumber: 1,
      productVariantId: 'pv-1',
      inventoryItemId: 'ii-1',
      uomId: 'uom-1',
      taxRateId: 'tr-1',
      itemCode: 'MUR-200',
      itemName: 'Butter Murukku 200g',
      hsnCode: '21069099',
      uomCode: 'PCS',
      uomSymbol: 'pcs',
      quantity: '15.0000',
      baseQuantity: '15.0000',
      unitPrice: '50.00',
      discountPercent: '0.00',
      discountAmount: '0.00',
      taxableAmount: '750.00',
      gstRate: '5.00',
      cgstRate: '2.50',
      sgstRate: '2.50',
      igstRate: '0.00',
      cgstAmount: '18.75',
      sgstAmount: '18.75',
      igstAmount: '0.00',
      taxAmount: '37.50',
      lineTotal: '787.50',
    },
  ],
  statusHistory: [
    {
      id: 'h-1',
      fromStatus: null,
      toStatus: 'DRAFT',
      reason: 'Draft invoice created',
      createdAt: '2026-11-25T00:00:00.000Z',
    },
  ],
};

describe('Phase 2.6 Frontend Sales Invoicing Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. SalesInvoicesPage renders empty state and populated invoice table', async () => {
    const auth = makeAuthValue(['ADMIN'], ['sales.invoices.read']);
    vi.spyOn(salesService.invoices, 'list').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: {
        items: [],
        pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
      },
      timestamp: '',
    });

    const { unmount } = renderWithProviders(<SalesInvoicesPage />, auth);
    await waitFor(() => {
      expect(screen.getByText(/No sales invoices found/i)).toBeTruthy();
    });
    unmount();

    vi.spyOn(salesService.invoices, 'list').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: {
        items: [sampleInvoice],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      },
      timestamp: '',
    });
    renderWithProviders(<SalesInvoicesPage />, auth);
    await waitFor(() => {
      expect(screen.getByText('INV/2026-27/00001')).toBeTruthy();
      expect(screen.getByText('Trichy Retail Mart')).toBeTruthy();
      expect(screen.getByText('₹788.00')).toBeTruthy();
    });
  });

  it('2. SalesInvoiceDetailPage shows GST breakdown, permission-gated actions, issue/cancel, and PDF download', async () => {
    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['sales.invoices.read', 'sales.invoices.update', 'sales.invoices.issue', 'sales.invoices.cancel', 'sales.invoices.download'],
    );
    vi.spyOn(salesService.invoices, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      data: sampleInvoice,
      timestamp: '',
    });
    const issueSpy = vi.spyOn(salesService.invoices, 'issue').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { ...sampleInvoice, status: 'ISSUED' },
      timestamp: '',
    });
    const pdfSpy = vi
      .spyOn(salesService.invoices, 'fetchPdfBlob')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-pdf');
    globalThis.URL.revokeObjectURL = vi.fn();

    renderWithProviders(
      <Routes>
        <Route path="/sales/invoices/:id" element={<SalesInvoiceDetailPage />} />
      </Routes>,
      adminAuth,
      '/sales/invoices/inv-1',
    );

    await waitFor(() => {
      expect(screen.getByText('INV/2026-27/00001')).toBeTruthy();
      expect(screen.getAllByText('CGST').length).toBeGreaterThan(0);
      expect(screen.getAllByText('SGST').length).toBeGreaterThan(0);
    });

    // Issue flow
    fireEvent.click(screen.getByText('Issue Invoice'));
    await waitFor(() => expect(screen.getByText('Issue GST Sales Invoice')).toBeTruthy());
    const issueBtns = screen.getAllByText('Issue Invoice');
    fireEvent.click(issueBtns[issueBtns.length - 1]);
    await waitFor(() => expect(issueSpy).toHaveBeenCalledWith('inv-1'));

    // PDF download
    fireEvent.click(screen.getByText('Download PDF'));
    await waitFor(() => expect(pdfSpy).toHaveBeenCalledWith('inv-1'));
  });

  it('3. SalesInvoiceDetailPage hides edit/issue/cancel for AUDITOR read-only role', async () => {
    const auditorAuth = makeAuthValue(['AUDITOR'], ['sales.invoices.read', 'sales.invoices.download']);
    vi.spyOn(salesService.invoices, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      data: sampleInvoice,
      timestamp: '',
    });

    renderWithProviders(
      <Routes>
        <Route path="/sales/invoices/:id" element={<SalesInvoiceDetailPage />} />
      </Routes>,
      auditorAuth,
      '/sales/invoices/inv-1',
    );

    await waitFor(() => expect(screen.getByText('INV/2026-27/00001')).toBeTruthy());
    expect(screen.queryByText('Edit Draft')).toBeNull();
    expect(screen.queryByText('Issue Invoice')).toBeNull();
    expect(screen.queryByText('Cancel Invoice')).toBeNull();
    expect(screen.getByText('Download PDF')).toBeTruthy();
  });

  it('4. SalesInvoiceFormPage creates a draft invoice from an eligible fulfilled order', async () => {
    const salesmanAuth = makeAuthValue(['SALESMAN'], ['sales.invoices.create', 'sales.orders.read']);
    vi.spyOn(salesService.orders, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        id: 'so-1',
        orderNumber: 'SO-2026-001',
        customerId: 'cust-1',
        warehouseId: 'wh-1',
        orderDate: '2026-11-24T00:00:00.000Z',
        status: 'FULFILLED',
        subtotal: '750.00',
        discountAmount: '0.00',
        taxAmount: '37.50',
        totalAmount: '787.50',
        createdAt: '',
        updatedAt: '',
        customer: { id: 'cust-1', code: 'C001', legalName: 'Trichy Retail Mart', customerType: 'RETAILER' },
        warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'FG' },
        lines: [
          {
            id: 'sol-1',
            lineNumber: 1,
            productVariantId: 'pv-1',
            inventoryItemId: 'ii-1',
            uomId: 'uom-1',
            orderedQuantity: '15.0000',
            baseQuantity: '15.0000',
            reservedBaseQuantity: '0.0000',
            fulfilledBaseQuantity: '15.0000',
            invoicedBaseQuantity: '0.0000',
            unitPrice: '50.00',
            discountPercent: '0.00',
            taxRateId: 'tr-1',
            taxPercentage: '5.00',
            taxableAmount: '750.00',
            taxAmount: '37.50',
            lineTotal: '787.50',
            productVariant: {
              id: 'pv-1',
              sku: 'MUR-200',
              name: '200g',
              defaultSellingPrice: '50.00',
              uomId: 'uom-1',
              product: { id: 'p-1', code: 'P1', name: 'Butter Murukku', hsnCode: '21069099' },
            },
            uom: { id: 'uom-1', code: 'PCS', symbol: 'pcs' },
          },
        ],
      },
      timestamp: '',
    });
    const createSpy = vi.spyOn(salesService.invoices, 'createFromOrder').mockResolvedValue({
      success: true,
      message: 'OK',
      data: sampleInvoice,
      timestamp: '',
    });

    renderWithProviders(
      <Routes>
        <Route path="/sales/orders/:orderId/invoices/new" element={<SalesInvoiceFormPage />} />
        <Route path="/sales/invoices/:id" element={<div>Invoice Detail Mock</div>} />
      </Routes>,
      salesmanAuth,
      '/sales/orders/so-1/invoices/new',
    );

    await waitFor(() => expect(screen.getByText('Butter Murukku')).toBeTruthy());
    fireEvent.click(screen.getByText('Create Draft Invoice'));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });
});
