import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { WorkOrdersDashboardPage } from '../routes/production/WorkOrdersDashboardPage';
import { WorkOrdersPage } from '../routes/production/WorkOrdersPage';
import { WorkOrderFormPage } from '../routes/production/WorkOrderFormPage';
import { WorkOrderDetailPage } from '../routes/production/WorkOrderDetailPage';
import { productionService } from '../services/production.service';
import { ProductionPlan, WorkOrder } from '../types/production';

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
  planNumber: 'PP-261125-WO1',
  name: 'Murukku Plan',
  warehouseId: 'wh-1',
  planDate: '2026-11-25T00:00:00.000Z',
  status: 'APPROVED',
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
      demandQuantity: '100.0000',
      availableFgQuantity: '0.0000',
      existingPlannedQuantity: '0.0000',
      netRequirementQuantity: '100.0000',
      plannedQuantity: '100.0000',
      workOrderedQuantity: '40.0000',
      yieldPercentage: '100.00',
      expectedWastagePercent: '0.00',
      estimatedMaterialCost: '0.00',
      estimatedOverheadCost: '0.00',
      estimatedTotalCost: '0.00',
      productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
      bom: { id: 'bom-1', code: 'BOM-01', name: 'Murukku Recipe' },
      bomVersion: {
        id: 'bv-1',
        versionNumber: 2,
        status: 'ACTIVE',
        expectedGoodOutput: '100',
        yieldPercentage: '100',
        expectedWastagePercent: '0',
      },
      uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
    },
  ],
};

const sampleWorkOrder: WorkOrder = {
  id: 'wo-1',
  workOrderNumber: 'WO/2026-27/00001',
  financialYear: '2026-27',
  productionPlanId: 'pp-1',
  productionPlanItemId: 'ppi-1',
  productVariantId: 'pv-1',
  inventoryItemId: 'ii-fg',
  bomId: 'bom-1',
  bomVersionId: 'bv-1',
  warehouseId: 'wh-1',
  uomId: 'uom-pcs',
  plannedQuantity: '40.0000',
  completedQuantity: '0.0000',
  status: 'SUBMITTED',
  priority: 'URGENT',
  plannedStartDate: '2026-12-01T00:00:00.000Z',
  plannedEndDate: '2026-12-02T00:00:00.000Z',
  productionLine: 'Line-A1',
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  productionPlan: { id: 'pp-1', planNumber: 'PP-261125-WO1', name: 'Murukku Plan', status: 'APPROVED' },
  productionPlanItem: { id: 'ppi-1', lineNumber: 1, plannedQuantity: '100.0000', workOrderedQuantity: '40.0000' },
  productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
  bom: { id: 'bom-1', code: 'BOM-01', name: 'Murukku Recipe' },
  bomVersion: {
    id: 'bv-1',
    versionNumber: 2,
    status: 'ACTIVE',
    expectedGoodOutput: '100',
    yieldPercentage: '100',
    expectedWastagePercent: '0',
  },
  warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'FG Warehouse' },
  uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
  materialRequirements: [
    {
      inventoryItemId: 'ii-rm',
      itemCode: 'RM-FLR',
      itemName: 'Rice Flour',
      itemType: 'RAW_MATERIAL',
      uomCode: 'KG',
      uomSymbol: 'kg',
      requiredQuantity: '20.0000',
      availableQuantity: '5.0000',
      reservedQuantity: '0.0000',
      netAvailableQuantity: '5.0000',
      shortageQuantity: '15.0000',
      warehouses: ['WH-RM-01'],
    },
  ],
  scheduleConflicts: [
    {
      workOrderId: 'wo-2',
      workOrderNumber: 'WO/2026-27/00002',
      status: 'RELEASED',
      reason: 'Overlapping schedule on production line "Line-A1"',
    },
  ],
  statusHistory: [
    { id: 'h-1', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', reason: 'Submitted', createdAt: '2026-11-25T00:00:00.000Z' },
  ],
};

describe('Phase 3.3 Frontend Work Order Management Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Work Orders Dashboard KPIs and recent orders', async () => {
    vi.spyOn(productionService.workOrders, 'dashboard').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        totalWorkOrders: 5,
        draftCount: 1,
        submittedCount: 2,
        approvedCount: 1,
        releasedCount: 1,
        inProgressCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        urgentCount: 2,
        recentWorkOrders: [sampleWorkOrder],
      },
    });

    const auth = makeAuthValue(['PRODUCTION'], ['production.work_orders.read']);
    renderWithProviders(<WorkOrdersDashboardPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('WO/2026-27/00001')).toBeTruthy();
    });
    expect(screen.getByText('Total Work Orders')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Pending Approval')).toBeTruthy();
  });

  it('renders Work Orders List with search and status filter', async () => {
    const listSpy = vi.spyOn(productionService.workOrders, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        items: [sampleWorkOrder],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      },
    });

    const auth = makeAuthValue(['PRODUCTION'], ['production.work_orders.read']);
    renderWithProviders(<WorkOrdersPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('WO/2026-27/00001')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Filter by work order status'), {
      target: { value: 'SUBMITTED' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUBMITTED' }));
    });
  });

  it('creates a Work Order from an APPROVED Production Plan with remaining quantity', async () => {
    vi.spyOn(productionService.plans, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: samplePlan,
    });
    const createSpy = vi.spyOn(productionService.workOrders, 'create').mockResolvedValue({
      success: true,
      message: 'Created',
      timestamp: '',
      data: sampleWorkOrder,
    });

    const auth = makeAuthValue(['PRODUCTION'], ['production.work_orders.read', 'production.work_orders.create']);
    renderWithProviders(
      <Routes>
        <Route path="/production/plans/:planId/work-orders/new" element={<WorkOrderFormPage />} />
        <Route path="/production/work-orders/:id" element={<div>Created WO Detail</div>} />
      </Routes>,
      auth,
      '/production/plans/pp-1/work-orders/new',
    );

    await waitFor(() => {
      expect(screen.getByText(/Create Work Order from PP-261125-WO1/i)).toBeTruthy();
    });

    // Remaining quantity defaults to 60 (100 - 40)
    const qtyInput = screen.getByLabelText(/Work Order Quantity/i) as HTMLInputElement;
    expect(qtyInput.value).toBe('60');

    fireEvent.click(screen.getByRole('button', { name: /Create Draft Work Order/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          productionPlanId: 'pp-1',
          productionPlanItemId: 'ppi-1',
          plannedQuantity: '60',
        }),
      );
      expect(screen.getByText('Created WO Detail')).toBeTruthy();
    });
  });

  it('renders Work Order Detail with BOM requirements, schedule conflict warning, and RBAC actions', async () => {
    vi.spyOn(productionService.workOrders, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: sampleWorkOrder,
    });
    const approveSpy = vi.spyOn(productionService.workOrders, 'approve').mockResolvedValue({
      success: true,
      message: 'Approved',
      timestamp: '',
      data: { ...sampleWorkOrder, status: 'APPROVED' },
    });

    // ADMIN sees Approve & Reject on SUBMITTED work order
    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['production.work_orders.read', 'production.work_orders.approve', 'production.work_orders.cancel'],
    );
    renderWithProviders(
      <Routes>
        <Route path="/production/work-orders/:id" element={<WorkOrderDetailPage />} />
      </Routes>,
      adminAuth,
      '/production/work-orders/wo-1',
    );

    await waitFor(() => {
      expect(screen.getByText('WO/2026-27/00001')).toBeTruthy();
    });
    expect(screen.getByText(/Schedule Conflict Warning/i)).toBeTruthy();
    expect(screen.getByText('WO/2026-27/00002')).toBeTruthy();
    expect(screen.getByText('RM-FLR')).toBeTruthy();
    expect(screen.getAllByText('Shortage').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('wo-1');
    });
  });

  it('hides mutation actions for AUDITOR (read-only)', async () => {
    vi.spyOn(productionService.workOrders, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: sampleWorkOrder,
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['production.work_orders.read']);
    renderWithProviders(
      <Routes>
        <Route path="/production/work-orders/:id" element={<WorkOrderDetailPage />} />
      </Routes>,
      auditorAuth,
      '/production/work-orders/wo-1',
    );

    await waitFor(() => {
      expect(screen.getByText('WO/2026-27/00001')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reject/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel Work Order/i })).toBeNull();
  });
});
