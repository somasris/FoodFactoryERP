import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { AdministrationLayout } from '../components/admin/AdministrationLayout';
import { OrganizationPage } from '../routes/admin/OrganizationPage';
import { FactoriesPage } from '../routes/admin/FactoriesPage';
import { SystemSettingsPage } from '../routes/admin/SystemSettingsPage';
import { adminService } from '../services/admin.service';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'admin@foodfactory.com',
    username: 'adminuser',
    fullName: 'Admin User',
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

describe('Phase 4.1 System Administration Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. AdministrationLayout renders all 6 tabs for ADMIN and hides restricted tabs', () => {
    const fullAdmin = makeAuthValue(
      ['ADMIN'],
      [
        'administration.organization.read',
        'administration.factories.read',
        'administration.users.read',
        'administration.roles.read',
        'administration.warehouse_access.read',
        'administration.settings.read',
      ],
    );
    const { unmount } = renderWithProviders(<AdministrationLayout />, fullAdmin);
    expect(screen.getByText('Organization')).toBeTruthy();
    expect(screen.getByText('Factories')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Roles & Permissions')).toBeTruthy();
    expect(screen.getByText('Warehouse Access')).toBeTruthy();
    expect(screen.getByText('System Settings')).toBeTruthy();
    unmount();

    const limitedAuth = makeAuthValue(['AUDITOR'], ['administration.organization.read']);
    renderWithProviders(<AdministrationLayout />, limitedAuth);
    expect(screen.getByText('Organization')).toBeTruthy();
    expect(screen.queryByText('System Settings')).toBeNull();
  });

  it('2. OrganizationPage renders profile and hides Save button for read-only AUDITOR', async () => {
    vi.spyOn(adminService, 'getOrganization').mockResolvedValue({
      id: 'c-1',
      code: 'COMP-01',
      legalName: 'South Indian Food Works Pvt Ltd',
      tradeName: 'FoodFactory South India',
      gstin: '33AAACF1234M1Z5',
      pan: 'AAACF1234M',
      state: 'Tamil Nadu',
      stateCode: '33',
      email: 'contact@foodfactory.com',
      phone: '04312500000',
      address: 'Trichy Industrial Estate',
      logoUrl: null,
      registrationNumber: null,
      fssaiLicense: null,
      financialYearStartMonth: 4,
      defaultCurrency: 'INR',
      defaultTimezone: 'Asia/Kolkata',
      preferences: null,
      isActive: true,
      updatedAt: new Date().toISOString(),
      _count: { factories: 1, users: 5 },
    });
    vi.spyOn(adminService, 'getOrganizationHistory').mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    const auditor = makeAuthValue(['AUDITOR'], ['administration.organization.read']);
    renderWithProviders(<OrganizationPage />, auditor);

    await waitFor(() => {
      expect(screen.getByDisplayValue('South Indian Food Works Pvt Ltd')).toBeTruthy();
    });
    expect(screen.queryByText('Save Organization Profile')).toBeNull();
  });

  it('3. FactoriesPage renders factory list and associated warehouses', async () => {
    vi.spyOn(adminService, 'listFactories').mockResolvedValue({
      items: [
        {
          id: 'f-1',
          companyId: 'c-1',
          code: 'FAC-TRICHY-01',
          name: 'Trichy Packaged Foods Plant',
          state: 'Tamil Nadu',
          stateCode: '33',
          address: 'Plot 42, Thuvakudi',
          email: null,
          phone: null,
          isActive: true,
          warehouses: [
            {
              id: 'w-1',
              code: 'WH-RM-01',
              name: 'Main Raw Material',
              warehouseType: 'RAW_MATERIAL',
              isActive: true,
            },
          ],
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    const admin = makeAuthValue(
      ['ADMIN'],
      ['administration.factories.read', 'administration.factories.manage'],
    );
    renderWithProviders(<FactoriesPage />, admin);

    await waitFor(() => {
      expect(screen.getByText('Trichy Packaged Foods Plant')).toBeTruthy();
    });
    expect(screen.getByText(/WH-RM-01/)).toBeTruthy();
    expect(screen.getByText('Add Factory')).toBeTruthy();
  });

  it('4. SystemSettingsPage displays categorized settings', async () => {
    vi.spyOn(adminService, 'listSettings').mockResolvedValue({
      items: [
        {
          id: 's-1',
          key: 'GENERAL_DEFAULT_TIMEZONE',
          value: 'Asia/Kolkata',
          category: 'GENERAL',
          valueType: 'STRING',
          description: 'Default business timezone',
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      ],
      grouped: {
        GENERAL: [
          {
            id: 's-1',
            key: 'GENERAL_DEFAULT_TIMEZONE',
            value: 'Asia/Kolkata',
            category: 'GENERAL',
            valueType: 'STRING',
            description: 'Default business timezone',
            version: 1,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });

    const admin = makeAuthValue(
      ['ADMIN'],
      ['administration.settings.read', 'administration.settings.update'],
    );
    renderWithProviders(<SystemSettingsPage />, admin);

    await waitFor(() => {
      expect(screen.getByText('GENERAL_DEFAULT_TIMEZONE')).toBeTruthy();
    });
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });
});
