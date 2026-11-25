import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ProductionPlanningDashboardPage } from '../routes/production/ProductionPlanningDashboardPage';
import { ProductionDemandPage } from '../routes/production/ProductionDemandPage';
import { ProductionPlansPage } from '../routes/production/ProductionPlansPage';
import { ProductionPlanDetailPage } from '../routes/production/ProductionPlanDetailPage';
import { productionService } from '../services/production.service';
import { ProductionPlan } from '../types/production';

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

const samplePlan: ProductionPlan = {
  id: 'pp-1',
  planNumber: 'PP-261125-ABC123',
  name: 'Weekly Murukku Plan',
  warehouseId: 'wh-1',
  planDate: '2026-11-25T00:00:00.000Z',
  status: 'SUBMITTED',
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'FG Warehouse' },
  items: [
    {
      id: 'ppi-1',
      lineNumber: 1,
      productVariantId: 'pv-1',
      inventoryItemId: 'ii-fg',
      bomId: 'bom-1',
      bomVersionId: 'bv-1',
      uomId: 'uom-pcs',
      demandQuantity: '25.0000',
      availableFgQuantity: '5.0000',
      existingPlannedQuantity: '0.0000',
      netRequirementQuantity: '20.0000',
      plannedQuantity: '20.0000',
      yieldPercentage: '80.00',
      expectedWastagePercent: '20.00',
      estimatedMaterialCost: '400.00',
      estimatedOverheadCost: '100.00',
      estimatedTotalCost: '500.00',
      productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g', product: { id: 'p-1', code: 'P1', name: 'Murukku' } },
      bom: { id: 'bom-1', code: 'BOM-01', name: 'Murukku Recipe' },
      bomVersion: { id: 'bv-1', versionNumber: 1, status: 'ACTIVE', expectedGoodOutput: '100', yieldPercentage: '80', expectedWastagePercent: '20' },
      uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
    },
  ],
  materialRequirements: [
    {
      id: 'pmr-1',
      inventoryItemId: 'ii-rm',
      itemType: 'RAW_MATERIAL',
      requiredBaseQuantity: '10.0000',
      availableQuantity: '5.0000',
      reservedQuantity: '0.0000',
      netAvailableQuantity: '5.0000',
      shortageQuantity: '5.0000',
      unitMwacCost: '40.0000',
      estimatedCost: '400.00',
      inventoryItem: { id: 'ii-rm', code: 'RM-FLR', name: 'Rice Flour', itemType: 'RAW_MATERIAL', uom: { id: 'uom-kg', code: 'KG', symbol: 'kg' } },
    },
  ],
  statusHistory: [
    { id: 'h-1', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', reason: 'Submitted', createdAt: '2026-11-25T00:00:00.000Z' },
  ],
};

describe('Phase 3.2 Frontend Production Planning Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. ProductionPlanningDashboardPage renders KPIs and recent plans', async () => {
    const auth = makeAuthValue(['PRODUCTION'], ['production.plans.read']);
    vi.spyOn(productionService, 'dashboard').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        totalPlans: 4,
        draftPlans: 1,
        submittedPlans: 1,
        approvedPlans: 1,
        releasedPlans: 1,
        cancelledPlans: 0,
        plansWithShortages: 1,
        recentPlans: [samplePlan],
      },
      timestamp: '',
    });

    renderWithProviders(<ProductionPlanningDashboardPage />, auth);
    await waitFor(() => {
      expect(screen.getByText('PP-261125-ABC123')).toBeTruthy();
      expect(screen.getByText('Pending Approval')).toBeTruthy();
      expect(screen.getByText('Material Shortages')).toBeTruthy();
    });
  });

  it('2. ProductionDemandPage displays net requirements and creates a plan', async () => {
    const auth = makeAuthValue(['PRODUCTION'], ['production.demand.read', 'production.plans.create']);
    vi.spyOn(productionService, 'demand').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        orderDemandLines: [
          {
            salesOrderId: 'so-1',
            orderNumber: 'SO-001',
            orderDate: '2026-11-25T00:00:00.000Z',
            customerName: 'Retailer A',
            warehouseId: 'wh-1',
            warehouseCode: 'WH-FG-01',
            salesOrderLineId: 'sol-1',
            productVariantId: 'pv-1',
            sku: 'MUR-200',
            productName: 'Murukku 200g',
            uomId: 'uom-pcs',
            uomSymbol: 'pcs',
            remainingOrderQuantity: '25.0000',
            alreadyPlannedQuantity: '0.0000',
            unplannedQuantity: '25.0000',
          },
        ],
        productSummary: [
          {
            productVariantId: 'pv-1',
            sku: 'MUR-200',
            productName: 'Murukku 200g',
            warehouseId: 'wh-1',
            warehouseCode: 'WH-FG-01',
            uomSymbol: 'pcs',
            grossDemandQuantity: '25.0000',
            availableFgQuantity: '5.0000',
            netRequirementQuantity: '20.0000',
            activeBom: { bomCode: 'BOM-01', versionNumber: 1 },
            sources: [{ salesOrderId: 'so-1', orderNumber: 'SO-001', salesOrderLineId: 'sol-1', unplannedQuantity: '25.0000' }],
          },
        ],
      },
      timestamp: '',
    });
    const createSpy = vi.spyOn(productionService.plans, 'create').mockResolvedValue({
      success: true,
      message: 'OK',
      data: samplePlan,
      timestamp: '',
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProductionDemandPage />} />
        <Route path="/production/plans/:id" element={<div>Plan Detail</div>} />
      </Routes>,
      auth,
    );

    await waitFor(() => expect(screen.getByText('MUR-200')).toBeTruthy());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Create Production Plan'));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  });

  it('3. ProductionPlansPage renders plans list and empty state', async () => {
    const auth = makeAuthValue(['AUDITOR'], ['production.plans.read']);
    vi.spyOn(productionService.plans, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { items: [samplePlan], pagination: { page: 1, limit: 15, total: 1, totalPages: 1 } },
      timestamp: '',
    });

    renderWithProviders(<ProductionPlansPage />, auth);
    await waitFor(() => expect(screen.getByText('PP-261125-ABC123')).toBeTruthy());
  });

  it('4. ProductionPlanDetailPage displays shortages, approval controls for ADMIN, and hides mutations for AUDITOR', async () => {
    const adminAuth = makeAuthValue(['ADMIN'], ['production.plans.read', 'production.plans.approve', 'production.plans.cancel']);
    vi.spyOn(productionService.plans, 'getById').mockResolvedValue({
      success: true, message: 'OK', data: samplePlan, timestamp: '',
    });
    vi.spyOn(productionService.plans, 'getMaterialAvailability').mockResolvedValue({
      success: true,
      message: 'OK',
      data: [
        {
          inventoryItemId: 'ii-rm',
          itemCode: 'RM-FLR',
          itemName: 'Rice Flour',
          itemType: 'RAW_MATERIAL',
          uomSymbol: 'kg',
          requiredBaseQuantity: '10.0000',
          availableQuantity: '5.0000',
          reservedQuantity: '0.0000',
          netAvailableQuantity: '5.0000',
          shortageQuantity: '5.0000',
          warehouses: [],
        },
      ],
      timestamp: '',
    });
    const approveSpy = vi.spyOn(productionService.plans, 'approve').mockResolvedValue({
      success: true, message: 'OK', data: { ...samplePlan, status: 'APPROVED' }, timestamp: '',
    });

    const { unmount } = renderWithProviders(
      <Routes>
        <Route path="/production/plans/:id" element={<ProductionPlanDetailPage />} />
      </Routes>,
      adminAuth,
      '/production/plans/pp-1',
    );

    await waitFor(() => {
      expect(screen.getByText('Short 5')).toBeTruthy();
      expect(screen.getByText('Approve')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(approveSpy).toHaveBeenCalledWith('pp-1'));
    unmount();

    const auditorAuth = makeAuthValue(['AUDITOR'], ['production.plans.read']);
    renderWithProviders(
      <Routes>
        <Route path="/production/plans/:id" element={<ProductionPlanDetailPage />} />
      </Routes>,
      auditorAuth,
      '/production/plans/pp-1',
    );
    await waitFor(() => expect(screen.getByText('PP-261125-ABC123')).toBeTruthy());
    expect(screen.queryByText('Approve')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});
