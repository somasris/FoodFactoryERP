import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { InventoryLayout } from '../components/inventory/InventoryLayout';
import { StockBalancesPage } from '../routes/inventory/StockBalancesPage';
import { InventoryReceiptsPage } from '../routes/inventory/InventoryReceiptsPage';
import { inventoryService } from '../services/inventory.service';
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

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

describe('Phase 1.5 Frontend Inventory Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. InventoryLayout renders all 9 tabs for ADMIN and hides Valuation for PRODUCTION without inventory.valuation.read', () => {
    const adminAuth = makeAuthValue(['ADMIN'], ['inventory.read', 'inventory.valuation.read']);
    const { unmount } = renderWithProviders(
      <Routes>
        <Route path="/" element={<InventoryLayout />} />
      </Routes>,
      adminAuth,
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Stock Balances')).toBeTruthy();
    expect(screen.getByText('Receipts')).toBeTruthy();
    expect(screen.getByText('Issues')).toBeTruthy();
    expect(screen.getByText('Transfers')).toBeTruthy();
    expect(screen.getByText('Adjustments')).toBeTruthy();
    expect(screen.getByText('Batches & Expiry')).toBeTruthy();
    expect(screen.getByText('Valuation')).toBeTruthy();
    expect(screen.getByText('Transaction History')).toBeTruthy();
    unmount();

    const prodAuth = makeAuthValue(['PRODUCTION'], ['inventory.read']);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<InventoryLayout />} />
      </Routes>,
      prodAuth,
    );
    expect(screen.getByText('Stock Balances')).toBeTruthy();
    expect(screen.queryByText('Valuation')).toBeNull();
  });

  it('2. StockBalancesPage renders API stock balance rows', async () => {
    vi.spyOn(masterDataService.warehouses, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(inventoryService, 'balances').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        items: [
          {
            id: 'bal-1',
            warehouseId: 'wh-1',
            inventoryItemId: 'item-1',
            quantityOnHand: '100.0000',
            quantityReserved: '10.0000',
            availableQuantity: '90.0000',
            unitCost: '50.0000',
            totalValue: '5000.0000',
            isExpired: false,
            warehouse: { id: 'wh-1', code: 'WH-RM-01', name: 'Main Raw Material Warehouse' },
            inventoryItem: {
              id: 'item-1',
              code: 'RM-FLR-01',
              name: 'Wheat Flour',
              itemType: 'RAW_MATERIAL',
              uom: { id: 'u-1', code: 'KG', symbol: 'kg' },
            },
            batch: {
              id: 'b-1',
              batchNumber: 'BATCH-01',
              receivedDate: '2026-01-01T00:00:00.000Z',
              unitCost: '50.0000',
            },
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });

    const auth = makeAuthValue(['ADMIN'], ['inventory.read']);
    renderWithProviders(<StockBalancesPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('RM-FLR-01')).toBeTruthy();
      expect(screen.getByText('BATCH-01')).toBeTruthy();
      expect(screen.getByText('90.000')).toBeTruthy();
    });
  });

  it('3. InventoryReceiptsPage hides New Receipt button for read-only AUDITOR', async () => {
    vi.spyOn(masterDataService.warehouses, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.inventoryItems, 'list').mockResolvedValue({
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
    vi.spyOn(inventoryService.receipts, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } },
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['inventory.read']);
    renderWithProviders(<InventoryReceiptsPage />, auditorAuth);

    await waitFor(() => {
      expect(screen.getByText('No inventory receipts found.')).toBeTruthy();
    });
    expect(screen.queryByText('New Receipt')).toBeNull();
  });
});
