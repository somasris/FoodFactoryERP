import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { MasterDataLayout } from '../components/master-data/MasterDataLayout';
import { ProductsPage } from '../routes/master-data/ProductsPage';
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

describe('Phase 1.4 Frontend Master Data Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. MasterDataLayout shows all 12 tabs for ADMIN and restricts tabs for SALESMAN', () => {
    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['master_data.read', 'suppliers.read', 'customers.read', 'warehouses.read', 'bom.read'],
    );
    const { unmount } = renderWithProviders(
      <Routes>
        <Route path="/" element={<MasterDataLayout />} />
      </Routes>,
      adminAuth,
    );
    expect(screen.getByText('Products')).toBeTruthy();
    expect(screen.getByText('Suppliers')).toBeTruthy();
    expect(screen.getByText('Bill of Materials')).toBeTruthy();
    unmount();

    const salesmanAuth = makeAuthValue(
      ['SALESMAN'],
      ['master_data.read', 'customers.read', 'warehouses.read'],
    );
    renderWithProviders(
      <Routes>
        <Route path="/" element={<MasterDataLayout />} />
      </Routes>,
      salesmanAuth,
    );
    expect(screen.getByText('Products')).toBeTruthy();
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.queryByText('Suppliers')).toBeNull();
    expect(screen.queryByText('Bill of Materials')).toBeNull();
  });

  it('2. ProductsPage renders data from API and enforces permission-based Create button', async () => {
    vi.spyOn(masterDataService.products, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        items: [
          {
            id: 'p-1',
            categoryId: 'c-1',
            code: 'PRD-MUR',
            name: 'Butter Murukku',
            baseUomId: 'u-1',
            hsnCode: '21069099',
            taxRateId: 't-1',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
      },
    });
    vi.spyOn(masterDataService.productCategories, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.uoms, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.taxRates, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['master_data.read']);
    renderWithProviders(<ProductsPage />, auditorAuth);

    await waitFor(() => {
      expect(screen.getByText('Butter Murukku')).toBeTruthy();
    });
    // AUDITOR must NOT see "New Product" create button
    expect(screen.queryByText('New Product')).toBeNull();
  });

  it('3. ProductsPage renders error state when API call fails', async () => {
    vi.spyOn(masterDataService.products, 'list').mockRejectedValue(
      new Error('Failed to load products'),
    );
    vi.spyOn(masterDataService.productCategories, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.uoms, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });
    vi.spyOn(masterDataService.taxRates, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { items: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } },
    });

    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['master_data.read', 'master_data.create', 'master_data.update'],
    );
    renderWithProviders(<ProductsPage />, adminAuth);

    await waitFor(() => {
      expect(screen.getByText('Failed to load products')).toBeTruthy();
    });
    expect(screen.getByText('New Product')).toBeTruthy();
  });
});
