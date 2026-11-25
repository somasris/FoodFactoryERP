import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { MaterialReconciliationPage } from '../routes/production/MaterialReconciliationPage';
import { QualityInspectionsPage } from '../routes/production/QualityInspectionsPage';
import { BatchTraceabilityPage } from '../routes/production/BatchTraceabilityPage';
import { productionService } from '../services/production.service';
import { BatchReconciliation, QualityInspectionItem } from '../types/production';

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

const sampleRec: BatchReconciliation = {
  batchId: 'pb-1',
  batchNumber: 'PB/2026-27/00001',
  status: 'IN_PROGRESS',
  workOrder: { id: 'wo-1', workOrderNumber: 'WO/2026-27/00001' },
  productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
  uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
  plannedQuantity: '10.0000',
  actualGoodQuantity: '0.0000',
  expectedOutputWastage: '0.0000',
  actualOutputWastage: '0.0000',
  thresholdPercent: '5.00',
  lines: [
    {
      inventoryItemId: 'ii-rm',
      itemCode: 'RM-FLR',
      itemName: 'Rice Flour',
      uomId: 'uom-kg',
      uomSymbol: 'kg',
      bomStandardQuantity: '10.0000',
      expectedWastage: '1.0000',
      expectedTotalQuantity: '11.0000',
      actualConsumedQuantity: '15.0000',
      returnedQuantity: '2.0000',
      netConsumedQuantity: '13.0000',
      quantityVariance: '2.0000',
      variancePercent: '18.18',
      thresholdPercent: '5.00',
      exceedsThreshold: true,
      approval: null,
    },
  ],
  returns: [],
};

const sampleQi: QualityInspectionItem = {
  id: 'qi-1',
  inspectionNumber: 'QI-261125-ABC',
  productionBatchId: 'pb-1',
  inventoryBatchId: 'ib-1',
  warehouseId: 'wh-1',
  inspectedQuantity: '10.0000',
  goodQuantity: '0.0000',
  rejectedQuantity: '0.0000',
  decision: 'QUARANTINED',
  productionBatch: {
    id: 'pb-1',
    batchNumber: 'PB/2026-27/00001',
    productVariant: { id: 'pv-1', sku: 'MUR-200', name: '200g' },
    uom: { id: 'uom-pcs', code: 'PCS', symbol: 'pcs' },
  },
  inventoryBatch: {
    id: 'ib-1',
    batchNumber: 'PB/2026-27/00001',
    qualityStatus: 'QUARANTINED',
  },
};

describe('Phase 3.5 Frontend Material & Finished Goods Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Material Reconciliation with excess variance alert and ADMIN approval button', async () => {
    vi.spyOn(productionService.reconciliation, 'dashboard').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: [sampleRec],
    });

    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['production.batches.read', 'production.batches.return', 'production.variances.approve'],
    );
    renderWithProviders(<MaterialReconciliationPage />, adminAuth);

    await waitFor(() => {
      expect(screen.getByText('PB/2026-27/00001')).toBeTruthy();
      expect(screen.getByText('RM-FLR')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Return/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Approve Variance/i })).toBeTruthy();
  });

  it('renders Quality Inspections and enforces RBAC on quarantine release', async () => {
    vi.spyOn(productionService.quality, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        items: [sampleQi],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      },
    });

    const adminAuth = makeAuthValue(
      ['ADMIN'],
      ['production.quality.read', 'production.quality.release'],
    );
    renderWithProviders(<QualityInspectionsPage />, adminAuth);

    await waitFor(() => {
      expect(screen.getByText('QI-261125-ABC')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Release/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeTruthy();
  });

  it('hides mutation controls for AUDITOR on Reconciliation and Quality pages', async () => {
    vi.spyOn(productionService.quality, 'list').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        items: [sampleQi],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      },
    });

    const auditorAuth = makeAuthValue(['AUDITOR'], ['production.quality.read']);
    renderWithProviders(<QualityInspectionsPage />, auditorAuth);

    await waitFor(() => {
      expect(screen.getByText('QI-261125-ABC')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Release/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reject/i })).toBeNull();
  });

  it('performs recall lookup on BatchTraceabilityPage', async () => {
    const recallSpy = vi.spyOn(productionService.traceability, 'recall').mockResolvedValue({
      success: true,
      message: 'OK',
      timestamp: '',
      data: {
        query: 'PB/2026-27/00001',
        matches: [
          {
            id: 'ib-1',
            batchNumber: 'PB/2026-27/00001',
            qualityStatus: 'ACCEPTED',
            inventoryItem: { id: 'ii-fg', code: 'FG-MUR', name: 'Murukku 200g', itemType: 'FINISHED_GOODS' },
            producedFromBatches: [
              {
                id: 'pb-1',
                batchNumber: 'PB/2026-27/00001',
                workOrder: { id: 'wo-1', workOrderNumber: 'WO/2026-27/00001' },
                consumptions: [
                  {
                    id: 'c-1',
                    baseQuantity: '15.0000',
                    inventoryItem: { id: 'ii-rm', code: 'RM-FLR', name: 'Rice Flour' },
                    batch: { id: 'ib-rm', batchNumber: 'RM-LOT-01' },
                  },
                ],
              },
            ],
            transactionLines: [],
          },
        ],
      },
    });

    const auth = makeAuthValue(['AUDITOR'], ['production.quality.read']);
    renderWithProviders(<BatchTraceabilityPage />, auth);

    fireEvent.change(screen.getByPlaceholderText(/Enter Finished Goods Batch/i), {
      target: { value: 'PB/2026-27/00001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trace Batch/i }));

    await waitFor(() => {
      expect(recallSpy).toHaveBeenCalledWith('PB/2026-27/00001');
      expect(screen.getByText(/RM-LOT-01/i)).toBeTruthy();
    });
  });
});
