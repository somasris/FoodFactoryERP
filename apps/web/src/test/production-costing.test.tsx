import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ProductionCostingDashboardPage } from '../routes/production/ProductionCostingDashboardPage';
import { BatchCostingDetailPage } from '../routes/production/BatchCostingDetailPage';
import { CostVarianceReportPage } from '../routes/production/CostVarianceReportPage';
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

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType, route = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

describe('Phase 3.6: Production Costing Frontend Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ProductionCostingDashboardPage with KPIs and batch list', async () => {
    vi.spyOn(productionService.costing, 'dashboard').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        totalBatches: 2,
        costedBatchesCount: 1,
        pendingCostEntryApprovals: 1,
        statusCounts: { DRAFT: 0, CALCULATED: 1, REVIEWED: 0, FINALIZED: 0 },
        totalStandardCost: '650.00',
        totalActualCost: '900.00',
        totalVarianceAmount: '250.00',
        totalVariancePercent: '38.46',
        totalWastageCost: '0.00',
        recentCostings: [],
      },
    });
    vi.spyOn(productionService.costing, 'listBatches').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        items: [
          {
            id: 'pb-1',
            batchNumber: 'PB/2026-27/00001',
            financialYear: '2026-27',
            workOrderId: 'wo-1',
            productId: 'p-1',
            productVariantId: 'pv-1',
            inventoryItemId: 'ii-fg',
            bomId: 'bom-1',
            bomVersionId: 'bv-1',
            warehouseId: 'wh-1',
            uomId: 'uom-1',
            plannedQuantity: '10.0000',
            actualGoodQuantity: '10.0000',
            rejectedQuantity: '0.0000',
            wastageQuantity: '0.0000',
            actualYieldPercent: '100.00',
            completionPercent: '100.00',
            status: 'COMPLETED',
            operatorId: 'u-1',
            materialsReserved: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            productVariant: { id: 'pv-1', sku: 'MUR-200', name: 'Murukku 200g' },
            costing: {
              id: 'c-1',
              productionBatchId: 'pb-1',
              status: 'CALCULATED',
              plannedQuantity: '10.0000',
              actualGoodQuantity: '10.0000',
              acceptedQuantity: '10.0000',
              rejectedQuantity: '0.0000',
              wastageQuantity: '0.0000',
              standardMaterialCost: '500.0000',
              standardLabourCost: '100.0000',
              standardOverheadCost: '50.0000',
              standardTotalCost: '650.0000',
              grossMaterialCost: '600.0000',
              materialReturnCost: '100.0000',
              netMaterialCost: '500.0000',
              rawMaterialCost: '500.0000',
              packagingMaterialCost: '0.0000',
              actualLabourCost: '120.0000',
              actualMachineCost: '80.0000',
              otherDirectCost: '0.0000',
              actualOverheadCost: '200.0000',
              wastageAndRejectionCost: '0.0000',
              totalActualCost: '900.0000',
              goodOutputCost: '900.0000',
              costPerAcceptedUnit: '90.0000',
              materialVarianceAmount: '0.0000',
              materialVariancePercent: '0.00',
              labourVarianceAmount: '20.0000',
              labourVariancePercent: '20.00',
              overheadVarianceAmount: '230.0000',
              overheadVariancePercent: '460.00',
              totalVarianceAmount: '250.0000',
              totalVariancePercent: '38.46',
              fgValuationApplied: false,
            },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 30,
          totalPages: 1,
        },
      },
    });

    const auth = makeAuthValue(['ADMIN'], ['production.costing.read']);
    renderWithProviders(<ProductionCostingDashboardPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
      expect(screen.getByText('Murukku 200g')).toBeTruthy();
      expect(screen.getByText('38.46% vs standard')).toBeTruthy();
    });
  });

  it('renders BatchCostingDetailPage with transparent breakdown and hides write actions for AUDITOR', async () => {
    vi.spyOn(productionService.costing, 'getBatchDetail').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        batch: {
          id: 'pb-1',
          batchNumber: 'PB/2026-27/00001',
          financialYear: '2026-27',
          workOrderId: 'wo-1',
          productId: 'p-1',
          productVariantId: 'pv-1',
          inventoryItemId: 'ii-fg',
          bomId: 'bom-1',
          bomVersionId: 'bv-1',
          warehouseId: 'wh-1',
          uomId: 'uom-1',
          plannedQuantity: '10.0000',
          actualGoodQuantity: '10.0000',
          rejectedQuantity: '0.0000',
          wastageQuantity: '0.0000',
          actualYieldPercent: '100.00',
          completionPercent: '100.00',
          status: 'COMPLETED',
          operatorId: 'u-1',
          materialsReserved: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          productVariant: { id: 'pv-1', sku: 'MUR-200', name: 'Murukku 200g' },
          uom: { id: 'uom-1', code: 'PCS', symbol: 'pcs' },
        },
        costing: {
          id: 'c-1',
          productionBatchId: 'pb-1',
          status: 'CALCULATED',
          plannedQuantity: '10.0000',
          actualGoodQuantity: '10.0000',
          acceptedQuantity: '10.0000',
          rejectedQuantity: '0.0000',
          wastageQuantity: '0.0000',
          standardMaterialCost: '500.0000',
          standardLabourCost: '100.0000',
          standardOverheadCost: '50.0000',
          standardTotalCost: '650.0000',
          grossMaterialCost: '600.0000',
          materialReturnCost: '100.0000',
          netMaterialCost: '500.0000',
          rawMaterialCost: '500.0000',
          packagingMaterialCost: '0.0000',
          actualLabourCost: '120.0000',
          actualMachineCost: '80.0000',
          otherDirectCost: '0.0000',
          actualOverheadCost: '200.0000',
          wastageAndRejectionCost: '0.0000',
          totalActualCost: '900.0000',
          goodOutputCost: '900.0000',
          costPerAcceptedUnit: '90.0000',
          materialVarianceAmount: '0.0000',
          materialVariancePercent: '0.00',
          labourVarianceAmount: '20.0000',
          labourVariancePercent: '20.00',
          overheadVarianceAmount: '230.0000',
          overheadVariancePercent: '460.00',
          totalVarianceAmount: '250.0000',
          totalVariancePercent: '38.46',
          fgValuationApplied: false,
          costEntries: [],
          overheadAllocations: [],
          history: [],
        },
        materialBreakdown: {
          grossMaterialCost: '600.0000',
          materialReturnCost: '100.0000',
          netMaterialCost: '500.0000',
          rawMaterialCost: '500.0000',
          packagingMaterialCost: '0.0000',
          ledgerIssueTotal: '600.0000',
          ledgerReturnTotal: '100.0000',
          isLedgerReconciled: true,
          lines: [
            {
              inventoryItemId: 'ii-rm',
              itemCode: 'RM-FLR',
              itemName: 'Rice Flour',
              itemType: 'RAW_MATERIAL',
              baseUomSymbol: 'kg',
              consumedQuantity: '12.0000',
              returnedQuantity: '2.0000',
              netQuantity: '10.0000',
              grossCost: '600.0000',
              returnCost: '100.0000',
              netCost: '500.0000',
              costSource: 'HISTORICAL_INVENTORY_TRANSACTION',
              batches: [],
            },
          ],
        },
      },
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['production.costing.read']);
    renderWithProviders(
      <Routes>
        <Route path="/production/costing/batches/:batchId" element={<BatchCostingDetailPage />} />
      </Routes>,
      auditorAuth,
      '/production/costing/batches/pb-1',
    );

    await waitFor(() => {
      expect(screen.getByText('Batch Costing: PB/2026-27/00001')).toBeTruthy();
      expect(screen.getByText('Ledger Reconciled')).toBeTruthy();
      expect(screen.queryByText('Recalculate Costing')).toBeNull();
      expect(screen.queryByText('Mark Reviewed')).toBeNull();
    });
  });

  it('renders CostVarianceReportPage summary and variance table', async () => {
    vi.spyOn(productionService.costing, 'varianceReport').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: '2026-11-25T00:00:00.000Z',
      data: {
        summary: {
          batchCount: 1,
          standardTotalCost: '650.00',
          actualTotalCost: '900.00',
          materialVarianceAmount: '0.00',
          labourVarianceAmount: '20.00',
          overheadVarianceAmount: '230.00',
          totalVarianceAmount: '250.00',
          totalVariancePercent: '38.46',
        },
        rows: [],
      },
    });

    const auth = makeAuthValue(['ADMIN'], ['production.costing.read']);
    renderWithProviders(<CostVarianceReportPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('Production Cost Variance Report')).toBeTruthy();
      expect(screen.getByText(/650\.00/)).toBeTruthy();
      expect(screen.getByText(/900\.00/)).toBeTruthy();
    });
  });
});
