import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ExecutiveDashboardPage } from '../routes/reports/ExecutiveDashboardPage';
import { BusinessIntelligencePage } from '../routes/reports/BusinessIntelligencePage';
import { reportsService } from '../services/reports.service';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'owner@foodfactory.com',
    username: 'owneruser',
    fullName: 'Owner User',
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

describe('Phase 4.3 Business Intelligence Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. ExecutiveDashboardPage renders live Business and Operational KPIs', async () => {
    vi.spyOn(reportsService, 'getExecutiveDashboard').mockResolvedValue({
      businessKpis: {
        issuedInvoiceValue: '25000.00',
        issuedTaxableSales: '23809.52',
        issuedInvoiceCount: 4,
        salesOrderCount: 6,
        productionOutputQty: '500.0000',
        inventoryValue: '120000.00',
        finalizedProductionCost: '15000.00',
        qualityRejectionRatePercent: '1.50',
        materialWastageQty: '5.0000',
        pendingApprovalsCount: 2,
      },
      operationalKpis: {
        activeWorkOrders: 3,
        activeProductionBatches: 2,
        pendingInspections: 1,
        lowStockItemsCount: 4,
        expiringBatchesCount: 1,
        delayedProductionPlans: 0,
      },
    });

    const admin = makeAuthValue(['ADMIN'], ['analytics.dashboard.read']);
    renderWithProviders(<ExecutiveDashboardPage />, admin);

    await waitFor(() => {
      expect(screen.getByText('₹25000.00')).toBeTruthy();
    });
    expect(screen.getByText('₹120000.00')).toBeTruthy();
    expect(screen.getByText('Active Work Orders')).toBeTruthy();
  });

  it('2. BusinessIntelligencePage hides restricted tabs for SALESMAN', async () => {
    vi.spyOn(reportsService, 'getSalesAnalytics').mockResolvedValue({
      revenueSourceNote: 'Authoritative ISSUED SalesInvoices',
      totalTaxableRevenue: '23809.52',
      orderStatusBreakdown: [],
      salesByCustomer: [],
    });

    const salesman = makeAuthValue(['SALESMAN'], ['analytics.sales.read']);
    renderWithProviders(<BusinessIntelligencePage />, salesman);

    await waitFor(() => {
      expect(screen.getByText('₹23809.52')).toBeTruthy();
    });
    expect(screen.queryByText(/Gross Margin/)).toBeNull();
    expect(screen.queryByText('Factory Performance')).toBeNull();
  });

  it('3. BusinessIntelligencePage renders Production Analytics KPIs and Plan vs Actual table', async () => {
    vi.spyOn(reportsService, 'getSalesAnalytics').mockResolvedValue({
      revenueSourceNote: 'Authoritative ISSUED SalesInvoices',
      totalTaxableRevenue: '1000.00',
      orderStatusBreakdown: [],
      salesByCustomer: [],
    });
    vi.spyOn(reportsService, 'getProductionAnalytics').mockResolvedValue({
      dashboard: {
        kpis: {
          totalProductionPlans: 5,
          pendingProductionPlans: 1,
          totalWorkOrders: 4,
          completedWorkOrders: 3,
          totalProductionBatches: 6,
          batchesInProgress: 1,
          completedBatches: 5,
          plannedProductionQuantity: '500.0000',
          actualProducedQuantity: '480.0000',
          acceptedFinishedGoodsQuantity: '470.0000',
          rejectedQuantity: '10.0000',
          overallYieldPercentage: '96.00',
          materialWastagePercentage: '2.50',
        },
      },
      planVsActual: [
        {
          planId: 'p-1',
          planNumber: 'PP-2026-001',
          planName: 'Murukku Run',
          planStatus: 'RELEASED',
          warehouseName: 'Finished Goods Warehouse',
          productName: 'Murukku 200 g',
          sku: 'MUR-200',
          uomSymbol: 'pcs',
          plannedQuantity: '200.0000',
          actualProducedQuantity: '190.0000',
          acceptedQuantity: '188.0000',
          completionPercent: '95.00',
          varianceClassification: 'UNDERPRODUCED',
        },
      ],
    });

    const owner = makeAuthValue(['OWNER'], []);
    renderWithProviders(<BusinessIntelligencePage />, owner);

    fireEvent.click(screen.getByRole('button', { name: 'Production Analytics' }));

    await waitFor(() => {
      expect(screen.getByText('96.00%')).toBeTruthy();
    });
    expect(screen.getByText('PP-2026-001')).toBeTruthy();
    expect(screen.getByText('Murukku 200 g')).toBeTruthy();
    expect(screen.getByText('95.00%')).toBeTruthy();
  });
});

