import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { SalesLayout } from '../components/sales/SalesLayout';
import { SalesDashboardPage } from '../routes/sales/SalesDashboardPage';
import { SalesOrdersPage } from '../routes/sales/SalesOrdersPage';
import { SalesOrderFormPage } from '../routes/sales/SalesOrderFormPage';
import { SalesOrderDetailPage } from '../routes/sales/SalesOrderDetailPage';
import { salesService } from '../services/sales.service';
import { masterDataService } from '../services/master-data.service';

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

describe('Phase 2 Frontend Sales & Orders Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. SalesLayout renders permission-aware tabs for ADMIN vs AUDITOR', () => {
    const adminAuth = makeAuthValue(
      ['ADMIN'],
      [
        'sales.dashboard.read',
        'sales.orders.read',
        'sales.orders.create',
        'sales.orders.approve',
        'sales.orders.fulfill',
      ],
    );
    const { unmount } = renderWithProviders(
      <Routes>
        <Route path="/" element={<SalesLayout />} />
      </Routes>,
      adminAuth,
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Sales Orders')).toBeTruthy();
    expect(screen.getByText('New Order')).toBeTruthy();
    expect(screen.getByText('Pending Approvals')).toBeTruthy();
    expect(screen.getByText('Fulfillment')).toBeTruthy();
    unmount();

    const auditorAuth = makeAuthValue(['AUDITOR'], ['sales.dashboard.read', 'sales.orders.read']);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<SalesLayout />} />
      </Routes>,
      auditorAuth,
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Sales Orders')).toBeTruthy();
    expect(screen.queryByText('New Order')).toBeNull();
    expect(screen.queryByText('Pending Approvals')).toBeNull();
    expect(screen.queryByText('Fulfillment')).toBeNull();
  });

  it('2. SalesDashboardPage renders metrics and handles API error state', async () => {
    vi.spyOn(salesService, 'dashboard').mockResolvedValueOnce({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        totalOrders: 12,
        draftOrders: 2,
        pendingApprovals: 3,
        approvedOrders: 1,
        confirmedOrders: 4,
        partiallyFulfilledOrders: 1,
        fulfilledOrders: 1,
        cancelledOrders: 0,
        rejectedOrders: 0,
        confirmedSalesValue: '25400.00',
        recentOrders: [],
      },
    });

    const auth = makeAuthValue(['ADMIN'], ['sales.dashboard.read']);
    const { unmount } = renderWithProviders(<SalesDashboardPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeTruthy();
      expect(screen.getByText('₹25,400.00')).toBeTruthy();
    });
    unmount();

    vi.spyOn(salesService, 'dashboard').mockRejectedValueOnce(new Error('Network failure'));
    renderWithProviders(<SalesDashboardPage />, auth);
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeTruthy();
    });
  });

  it('3. SalesOrdersPage renders order rows and hides New Order for AUDITOR', async () => {
    vi.spyOn(salesService.orders, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        items: [
          {
            id: 'so-1',
            orderNumber: 'SO-261125-ABC123',
            customerId: 'c-1',
            warehouseId: 'w-1',
            orderDate: '2026-11-25T00:00:00.000Z',
            status: 'CONFIRMED',
            subtotal: '1000.00',
            discountAmount: '0.00',
            taxAmount: '50.00',
            totalAmount: '1050.00',
            createdAt: '2026-11-25T00:00:00.000Z',
            updatedAt: '2026-11-25T00:00:00.000Z',
            customer: {
              id: 'c-1',
              code: 'CUST-01',
              legalName: 'Madurai Stores',
              customerType: 'RETAILER',
            },
            warehouse: { id: 'w-1', code: 'WH-FG-01', name: 'Finished Goods' },
            _count: { lines: 2 },
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['sales.orders.read']);
    renderWithProviders(<SalesOrdersPage />, auditorAuth);

    await waitFor(() => {
      expect(screen.getByText('SO-261125-ABC123')).toBeTruthy();
      expect(screen.getByText('Madurai Stores')).toBeTruthy();
    });
    expect(screen.queryByText('New Order')).toBeNull();
  });

  it('4. SalesOrderFormPage shows validation error when submitting without required fields', async () => {
    vi.spyOn(masterDataService.customers, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.warehouses, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.productVariants, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.uoms, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });

    const auth = makeAuthValue(['SALESMAN'], ['sales.orders.create']);
    const { container } = renderWithProviders(<SalesOrderFormPage />, auth);

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Please select a customer.')).toBeTruthy();
    });
  });

  it('5. SalesOrderDetailPage renders lifecycle action buttons based on order status and permissions', async () => {
    vi.spyOn(salesService.orders, 'getById').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        id: 'so-1',
        orderNumber: 'SO-261125-XYZ',
        customerId: 'c-1',
        warehouseId: 'w-1',
        orderDate: '2026-11-25T00:00:00.000Z',
        status: 'APPROVED',
        subtotal: '500.00',
        discountAmount: '0.00',
        taxAmount: '25.00',
        totalAmount: '525.00',
        createdAt: '2026-11-25T00:00:00.000Z',
        updatedAt: '2026-11-25T00:00:00.000Z',
        customer: {
          id: 'c-1',
          code: 'CUST-01',
          legalName: 'Trichy Mart',
          customerType: 'RETAILER',
        },
        warehouse: { id: 'w-1', code: 'WH-FG-01', name: 'Finished Goods' },
        lines: [],
        statusHistory: [],
      },
    });

    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['sales.orders.read', 'sales.orders.confirm', 'sales.orders.cancel'],
    );
    renderWithProviders(
      <Routes>
        <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
      </Routes>,
      adminAuth,
      '/sales/orders/so-1',
    );

    await waitFor(() => {
      expect(screen.getByText('SO-261125-XYZ')).toBeTruthy();
      expect(screen.getByText('Confirm & Reserve Stock')).toBeTruthy();
      expect(screen.getByText('Cancel Order')).toBeTruthy();
    });
  });
});
