import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ProductionExecutionDashboardPage } from '../routes/production/ProductionExecutionDashboardPage';
import { ProductionBatchesPage } from '../routes/production/ProductionBatchesPage';
import { ProductionBatchDetailPage } from '../routes/production/ProductionBatchDetailPage';
import { productionService } from '../services/production.service';
import { ProductionBatch, WorkOrder } from '../types/production';

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

const sampleWo: WorkOrder = {
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
  allocatedBatchQuantity: '15.0000',
  completedQuantity: '0.0000',
  status: 'RELEASED',
  priority: 'NORMAL',
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
  uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
};

const sampleBatch: ProductionBatch = {
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
  uomId: 'uom-pcs',
  plannedQuantity: '15.0000',
  actualGoodQuantity: '12.0000',
  rejectedQuantity: '1.0000',
  wastageQuantity: '2.0000',
  actualYieldPercent: '80.00',
  completionPercent: '80.00',
  wastageReason: 'Over-roasted edge pieces',
  status: 'IN_PROGRESS',
  operatorId: 'u-1',
  materialsReserved: false,
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  workOrder: {
    id: 'wo-1',
    workOrderNumber: 'WO/2026-27/00001',
    status: 'IN_PROGRESS',
    plannedQuantity: '40.0000',
    allocatedBatchQuantity: '15.0000',
    actualGoodQuantity: '0.0000',
    actualScrapQuantity: '0.0000',
  },
  productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
  bom: { id: 'bom-1', code: 'BOM-01', name: 'Murukku Recipe' },
  bomVersion: {
    id: 'bv-1',
    versionNumber: 1,
    status: 'ACTIVE',
    expectedGoodOutput: '100',
    yieldPercentage: '100',
    expectedWastagePercent: '0',
  },
  warehouse: { id: 'wh-1', code: 'WH-FG-01', name: 'FG Warehouse' },
  uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
  expectedMaterials: [
    {
      bomItemId: 'bi-1',
      inventoryItemId: 'ii-rm',
      itemCode: 'RM-FLR',
      itemName: 'Rice Flour',
      itemType: 'RAW_MATERIAL',
      uomId: 'uom-kg',
      uomCode: 'KG',
      uomSymbol: 'kg',
      expectedQuantity: '7.5000',
      consumedQuantity: '0.0000',
      remainingQuantity: '7.5000',
    },
  ],
  consumptions: [],
  statusHistory: [
    { id: 'h-1', fromStatus: 'CREATED', toStatus: 'IN_PROGRESS', createdAt: '2026-11-25T00:00:00.000Z' },
  ],
};

describe('Phase 3.4 Frontend Batch Production Execution Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Execution Dashboard with KPIs and released work orders', async () => {
    vi.spyOn(productionService.batches, 'dashboard').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        totalBatches: 3,
        createdCount: 1,
        inProgressCount: 1,
        pausedCount: 0,
        completedCount: 1,
        cancelledCount: 0,
        releasedWorkOrdersCount: 1,
        recentBatches: [sampleBatch],
      },
    });
    vi.spyOn(productionService.workOrders, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        items: [sampleWo],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const auth = makeAuthValue(['PRODUCTION'], ['production.batches.read', 'production.batches.create']);
    renderWithProviders(<ProductionExecutionDashboardPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
      expect(screen.getAllByText('WO/2026-27/00001').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByRole('button', { name: /Create Batch/i })).toBeTruthy();
  });

  it('renders Production Batches List with status filter', async () => {
    const listSpy = vi.spyOn(productionService.batches, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        items: [sampleBatch],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      },
    });

    const auth = makeAuthValue(['PRODUCTION'], ['production.batches.read']);
    renderWithProviders(<ProductionBatchesPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Filter by batch status'), {
      target: { value: 'IN_PROGRESS' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));
    });
  });

  it('renders Batch Detail execution controls, expected materials, and completion modal', async () => {
    vi.spyOn(productionService.batches, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: sampleBatch,
    });
    const completeSpy = vi.spyOn(productionService.batches, 'complete').mockResolvedValue({
      success: true,
      message: 'Completed',
      timestamp: '',
      data: { ...sampleBatch, status: 'COMPLETED' },
    });

    const prodAuth = makeAuthValue(
      ['PRODUCTION'],
      [
        'production.batches.read',
        'production.batches.execute',
        'production.batches.consume',
        'production.batches.complete',
        'production.batches.cancel',
      ],
    );
    renderWithProviders(
      <Routes>
        <Route path="/production/batches/:id" element={<ProductionBatchDetailPage />} />
      </Routes>,
      prodAuth,
      '/production/batches/pb-1',
    );

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
    });
    expect(screen.getByText('RM-FLR')).toBeTruthy();
    expect(screen.getByText(/80\.00% yield/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Complete Batch/i }));
    await waitFor(() => {
      expect(screen.getByText('Confirm Batch Completion')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Complete & Receive FG/i }));
    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith('pb-1', expect.any(Object));
    });
  });

  it('hides execution controls for AUDITOR (read-only)', async () => {
    vi.spyOn(productionService.batches, 'getById').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: sampleBatch,
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['production.batches.read']);
    renderWithProviders(
      <Routes>
        <Route path="/production/batches/:id" element={<ProductionBatchDetailPage />} />
      </Routes>,
      auditorAuth,
      '/production/batches/pb-1',
    );

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /Complete Batch/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Record Consumption/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel Batch/i })).toBeNull();
  });
});
