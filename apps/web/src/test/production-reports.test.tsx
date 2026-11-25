import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ProductionAnalyticsDashboardPage } from '../routes/production/ProductionAnalyticsDashboardPage';
import { ProductionPlanVsActualPage } from '../routes/production/ProductionPlanVsActualPage';
import { ProductionCostAnalyticsPage } from '../routes/production/ProductionCostAnalyticsPage';
import { productionService } from '../services/production.service';

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

describe('Phase 3.7: Production Reports & Analytics Frontend Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ProductionAnalyticsDashboardPage and hides costing KPIs without costing report permission', async () => {
    vi.spyOn(productionService.reports, 'dashboard').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        dateRange: {
          period: 'month',
          financialYear: '2026-27',
          fromDate: '2026-11-01T00:00:00.000Z',
          toDate: '2026-11-25T23:59:59.999Z',
        },
        kpis: {
          totalProductionPlans: 4,
          pendingProductionPlans: 1,
          totalWorkOrders: 5,
          activeWorkOrders: 2,
          completedWorkOrders: 3,
          totalProductionBatches: 6,
          batchesInProgress: 1,
          completedBatches: 5,
          plannedProductionQuantity: '100.0000',
          actualProducedQuantity: '92.0000',
          acceptedFinishedGoodsQuantity: '90.0000',
          rejectedQuantity: '2.0000',
          overallYieldPercentage: '92.00',
          materialWastagePercentage: '6.00',
          costAccess: false,
          totalActualProductionCost: null,
          averageCostPerAcceptedUnit: null,
          productionCostVariance: null,
        },
      },
    });
    vi.spyOn(productionService.reports, 'trends').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        granularity: 'daily',
        series: [
          {
            period: '2026-11-25',
            plannedQuantity: '100.0000',
            actualQuantity: '92.0000',
            rejectedQuantity: '2.0000',
            wastageQuantity: '6.0000',
            yieldPercent: '92.00',
            wastagePercent: '6.00',
            completedBatches: 5,
            totalCost: null,
          },
        ],
      },
    });

    const prodAuth = makeAuthValue(['PRODUCTION'], ['production.reports.read', 'production.reports.export']);
    renderWithProviders(<ProductionAnalyticsDashboardPage />, prodAuth);

    await waitFor(() => {
      expect(screen.getByText('92.00% Yield')).toBeTruthy();
      expect(screen.getByText('Planned vs Actual Production Trend')).toBeTruthy();
      expect(screen.queryByText('Total Actual Cost')).toBeNull();
    });
  });

  it('renders ProductionPlanVsActualPage with rows and export actions', async () => {
    vi.spyOn(productionService.reports, 'planVsActual').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        items: [
          {
            planId: 'pp-1',
            planNumber: 'PP/2026-27/00001',
            planDate: '2026-11-25T00:00:00.000Z',
            planStatus: 'RELEASED',
            warehouseName: 'FG Warehouse',
            productName: 'Murukku',
            sku: 'MUR-200',
            variantName: '200g',
            uomSymbol: 'pcs',
            plannedQuantity: '50.0000',
            workOrderedQuantity: '50.0000',
            actualProducedQuantity: '45.0000',
            acceptedQuantity: '45.0000',
            rejectedQuantity: '0.0000',
            remainingQuantity: '5.0000',
            completionPercent: '90.00',
            varianceClassification: 'UNDERPRODUCED',
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        productSummary: [],
      },
    });

    const adminAuth = makeAuthValue(['ADMIN'], ['production.reports.read', 'production.reports.export']);
    renderWithProviders(<ProductionPlanVsActualPage />, adminAuth);

    await waitFor(() => {
      expect(screen.getByText('PP/2026-27/00001')).toBeTruthy();
      expect(screen.getByText('UNDERPRODUCED')).toBeTruthy();
      expect(screen.getByText('CSV')).toBeTruthy();
    });
  });

  it('renders ProductionCostAnalyticsPage with finalized vs provisional summary', async () => {
    vi.spyOn(productionService.reports, 'costing').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        items: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
        summary: {
          finalizedStandardCost: '650.00',
          finalizedActualCost: '900.00',
          finalizedVarianceAmount: '250.00',
          provisionalNonFinalizedCost: '120.00',
          byStatus: {},
        },
        highestVarianceBatches: [],
      },
    });

    const auditorAuth = makeAuthValue(
      ['AUDITOR'],
      ['production.reports.read', 'production.reports.costing.read', 'production.reports.export'],
    );
    renderWithProviders(<ProductionCostAnalyticsPage />, auditorAuth);

    await waitFor(() => {
      expect(screen.getByText('Production Cost & Variance Analytics')).toBeTruthy();
      expect(screen.getByText(/900\.00/)).toBeTruthy();
      expect(screen.getByText('No batch costing records found.')).toBeTruthy();
    });
  });
});
