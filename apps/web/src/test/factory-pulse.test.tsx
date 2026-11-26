import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FactoryPulsePage } from '../routes/production/FactoryPulsePage';
import { factoryPulseService, FactoryPulseData } from '../services/factory-pulse.service';

const MOCK_PULSE: FactoryPulseData = {
  generatedAt: '2026-11-26T12:00:00.000Z',
  filters: { factoryId: null, warehouseId: null, status: null },
  scopes: {
    factories: [{ id: 'f1', code: 'FAC-1', name: 'Chennai Plant' }],
    warehouses: [{ id: 'w1', code: 'WH-1', name: 'Main FG', factoryId: 'f1' }],
  },
  overview: {
    activeBatchesCount: 3,
    runningWorkOrdersCount: 4,
    completedTodayCount: 2,
    delayedWorkOrdersCount: 1,
    plannedQtyTotal: '500.00',
    actualGoodQtyTotal: '320.00',
  },
  productionActivity: [
    {
      batchId: 'b1',
      batchNumber: 'PB-2026-009',
      productName: 'Mango Juice 1L',
      productCode: 'FG-MJ-1L',
      workOrderId: 'wo1',
      workOrderNumber: 'WO/26-27/00001',
      warehouseName: 'Main FG',
      factoryName: 'Chennai Plant',
      status: 'IN_PROGRESS',
      plannedQuantity: '200.00',
      actualGoodQuantity: '120.00',
      uomSymbol: 'L',
      progressPercent: 60,
      updatedAt: '2026-11-26T12:00:00.000Z',
    },
  ],
  materialReadiness: [
    {
      itemId: 'rm1',
      code: 'RM-SUGAR',
      name: 'Refined Sugar',
      uomSymbol: 'kg',
      physicalStock: '100.00',
      reservedStock: '60.00',
      availableStock: '40.00',
      requiredStock: '90.00',
      shortageQuantity: '50.00',
      belowReorder: true,
    },
  ],
  qualityMonitoring: {
    pendingInspectionsCount: 1,
    quarantinedBatchesCount: 0,
    rejectedBatchesCount: 0,
    recentInspections: [],
  },
  attentionRequired: [
    {
      id: 'wo-1',
      severity: 'CRITICAL',
      type: 'DELAYED_WORK_ORDER',
      title: 'Delayed Work Order: WO/26-27/00001',
      detail: 'Due yesterday',
      navigationPath: '/production/work-orders/wo1',
    },
  ],
};

describe('Sprint 2 & 3: Live Factory Pulse & TV Mode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Factory Pulse metrics, material shortages, and enters/exits TV Mode', async () => {
    vi.spyOn(factoryPulseService, 'getPulse').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: MOCK_PULSE,
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <FactoryPulsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('PB-2026-009')).toBeTruthy();
      expect(screen.getByText(/Refined Sugar/)).toBeTruthy();
    });

    // Enter TV Mode
    fireEvent.click(screen.getByText('TV Mode'));
    expect(screen.getByTestId('tv-mode-container')).toBeTruthy();

    // Pause and resume rotation
    fireEvent.click(screen.getByLabelText('Pause rotation'));
    expect(screen.getByLabelText('Resume rotation')).toBeTruthy();

    // Exit TV Mode via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('tv-mode-container')).toBeNull();
    });
  });
});
