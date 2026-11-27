import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { SalesOrdersPage } from '../routes/sales/SalesOrdersPage';
import { SalesOrderDetailPage } from '../routes/sales/SalesOrderDetailPage';
import { salesService } from '../services/sales.service';
import { SalesOrder } from '../types/sales';

const adminAuth: AuthContextType = {
  user: {
    id: 'u-1',
    email: 'admin@foodfactory.com',
    username: 'admin',
    fullName: 'Admin User',
    isActive: true,
    roles: ['ADMIN'],
    permissions: [
      'sales.orders.read',
      'sales.orders.create',
      'sales.orders.update',
      'sales.orders.cancel',
      'sales.orders.fulfill',
      'inventory.read',
    ],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: () => true,
  hasPermission: () => true,
};

const renderWithProviders = (ui: React.ReactElement, initialPath = '/sales/orders') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={adminAuth}>
          <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    ),
  };
};

const makeOrder = (overrides: Partial<SalesOrder>): SalesOrder => ({
  id: 'ord-1',
  orderNumber: 'SO-2026-00101',
  customerId: 'cust-1',
  warehouseId: 'wh-1',
  orderDate: '2026-11-27T00:00:00.000Z',
  status: 'APPROVED',
  subtotal: '1000.00',
  discountAmount: '0.00',
  taxAmount: '50.00',
  totalAmount: '1050.00',
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
  customer: { id: 'cust-1', code: 'C001', legalName: 'Fresh Mart', customerType: 'RETAILER' },
  warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'Finished Goods Warehouse' },
  _count: { lines: 1 },
  ...overrides,
});

describe('Sales Order List Stock Visibility Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1-5. Displays Stock Availability column, status badges, and expandable shortage details', async () => {
    vi.spyOn(salesService.orders, 'list').mockResolvedValueOnce({
      success: true,
      message: 'ok',
      timestamp: '2026-11-27T00:00:00.000Z',
      data: {
        items: [
          makeOrder({
            id: 'ord-suf',
            orderNumber: 'SO-2026-00124',
            stockAvailability: {
              status: 'SUFFICIENT',
              warehouseId: 'wh-1',
              warehouseCode: 'WH-FG-01',
              warehouseName: 'Finished Goods Warehouse',
              totalLines: 1,
              sufficientLines: 1,
              insufficientLines: 0,
              lines: [],
            },
          }),
          makeOrder({
            id: 'ord-part',
            orderNumber: 'SO-2026-00125',
            stockAvailability: {
              status: 'PARTIAL',
              warehouseId: 'wh-1',
              warehouseCode: 'WH-FG-01',
              warehouseName: 'Finished Goods Warehouse',
              totalLines: 2,
              sufficientLines: 1,
              insufficientLines: 1,
              lines: [
                {
                  salesOrderLineId: 'l-1',
                  lineNumber: 1,
                  productVariantId: 'v-1',
                  inventoryItemId: 'i-1',
                  sku: 'MUR-200',
                  productName: 'Murukku 200 g',
                  uomSymbol: 'pcs',
                  requestedQuantity: '100',
                  availableQuantity: '65',
                  shortageQuantity: '35',
                  isSufficient: false,
                },
                {
                  salesOrderLineId: 'l-2',
                  lineNumber: 2,
                  productVariantId: 'v-2',
                  inventoryItemId: 'i-2',
                  sku: 'MIX-200',
                  productName: 'Mixture 200 g',
                  uomSymbol: 'pcs',
                  requestedQuantity: '50',
                  availableQuantity: '50',
                  shortageQuantity: '0',
                  isSufficient: true,
                },
              ],
            },
          }),
          makeOrder({
            id: 'ord-insuf',
            orderNumber: 'SO-2026-00126',
            stockAvailability: {
              status: 'INSUFFICIENT',
              warehouseId: 'wh-1',
              warehouseCode: 'WH-FG-01',
              warehouseName: 'Finished Goods Warehouse',
              totalLines: 1,
              sufficientLines: 0,
              insufficientLines: 1,
              lines: [
                {
                  salesOrderLineId: 'l-3',
                  lineNumber: 1,
                  productVariantId: 'v-3',
                  inventoryItemId: 'i-3',
                  sku: 'COC-200',
                  productName: 'Coconut Biscuits 200 g',
                  uomSymbol: 'pcs',
                  requestedQuantity: '40',
                  availableQuantity: '0',
                  shortageQuantity: '40',
                  isSufficient: false,
                },
              ],
            },
          }),
        ],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      },
    });

    renderWithProviders(<SalesOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('SO-2026-00124')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /Stock Availability/i })).toBeTruthy();
    expect(screen.getByText('Sufficient Stock', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Partial Stock', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Insufficient Stock', { selector: 'span' })).toBeTruthy();

    // Expand shortage details on SO-2026-00125
    fireEvent.click(screen.getByText('1 of 2 items short'));
    expect(screen.getByText(/Murukku 200 g/)).toBeTruthy();
    expect(screen.getByText('100 pcs')).toBeTruthy();
    expect(screen.getByText('65 pcs')).toBeTruthy();
    expect(screen.getByText('35 pcs')).toBeTruthy();
    expect(screen.getByText(/Mixture 200 g/)).toBeTruthy();
  });

  it('6. Handles loading and unavailable/error states without showing false success', async () => {
    vi.spyOn(salesService.orders, 'list').mockRejectedValueOnce(new Error('Network error'));
    renderWithProviders(<SalesOrdersPage />);

    expect(screen.getByText(/Loading sales orders and checking stock availability/i)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
    expect(screen.queryByText('Sufficient Stock', { selector: 'span' })).toBeNull();
  });

  it('7-9. Supports stockAvailability filter, sorting, pagination, query invalidation, and navigation', async () => {
    const listSpy = vi.spyOn(salesService.orders, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-27T00:00:00.000Z',
      data: {
        items: [makeOrder({ id: 'ord-1', stockAvailability: null })],
        pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
      },
    });

    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/sales/orders" element={<SalesOrdersPage />} />
        <Route path="/sales/orders/:id" element={<div>Order Detail Route</div>} />
      </Routes>,
    );

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeTruthy();
    });

    // Filter by Insufficient Stock
    fireEvent.change(screen.getByLabelText('Filter by stock availability'), {
      target: { value: 'INSUFFICIENT' },
    });
    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ stockAvailability: 'INSUFFICIENT', page: 1 }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stock Availability/i })).toBeTruthy();
    });

    // Sort by Stock Availability
    fireEvent.click(screen.getByRole('button', { name: /Stock Availability/i }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'stockAvailability', sortOrder: 'asc' }),
      );
    });

    // Invalidate ['sales'] refreshes list
    const callsBefore = listSpy.mock.calls.length;
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await waitFor(() => {
      expect(listSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    // Clicking order navigates to detail page
    fireEvent.click(screen.getByText('SO-2026-00101'));
    await waitFor(() => {
      expect(screen.getByText('Order Detail Route')).toBeTruthy();
    });
  });

  it('10. SalesOrderDetailPage displays stock shortage warning while keeping order actions functional', async () => {
    vi.spyOn(salesService.orders, 'getById').mockResolvedValueOnce({
      success: true,
      message: 'ok',
      timestamp: '2026-11-27T00:00:00.000Z',
      data: makeOrder({
        id: 'ord-1',
        status: 'DRAFT',
        lines: [],
        stockAvailability: {
          status: 'INSUFFICIENT',
          warehouseId: 'wh-1',
          warehouseCode: 'WH-FG-01',
          warehouseName: 'Finished Goods Warehouse',
          totalLines: 1,
          sufficientLines: 0,
          insufficientLines: 1,
          lines: [
            {
              salesOrderLineId: 'l-1',
              lineNumber: 1,
              productVariantId: 'v-1',
              inventoryItemId: 'i-1',
              sku: 'MUR-200',
              productName: 'Murukku 200 g',
              uomSymbol: 'pcs',
              requestedQuantity: '100',
              availableQuantity: '65',
              shortageQuantity: '35',
              isSufficient: false,
            },
          ],
        },
      }),
    });
    vi.spyOn(salesService.invoices, 'listByOrder').mockResolvedValueOnce({
      success: true,
      message: 'ok',
      timestamp: '2026-11-27T00:00:00.000Z',
      data: [],
    });

    renderWithProviders(
      <Routes>
        <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
      </Routes>,
      '/sales/orders/ord-1',
    );

    await waitFor(() => {
      expect(screen.getByText('Insufficient Stock for Order')).toBeTruthy();
    });
    expect(screen.getByText('35 pcs')).toBeTruthy();
    // Unrelated actions (Edit, Submit, Cancel) remain available
    expect(screen.getByRole('button', { name: /Edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Submit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeTruthy();
  });
});
