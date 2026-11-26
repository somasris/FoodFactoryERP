import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QrTraceabilityPage } from '../routes/production/QrTraceabilityPage';
import { batchQrService } from '../services/batch-qr.service';

describe('Sprint 4: QR Traceability Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders resolved batch traceability, inputs, quality, and timeline', async () => {
    vi.spyOn(batchQrService, 'resolveTraceability').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        referenceToken: 'tok-123',
        batchIdentity: {
          id: 'b1',
          batchNumber: 'PB-2026-011',
          status: 'COMPLETED',
          qualityStatus: 'ACCEPTED',
          productName: 'Turmeric Powder',
          productCode: 'FG-TUR',
          categoryName: 'Spices',
          variantName: '500g Pack',
          sku: 'TUR-500',
          manufacturingDate: '2026-11-20T00:00:00.000Z',
          expiryDate: '2027-11-20T00:00:00.000Z',
          workOrderNumber: 'WO/26-27/00005',
          workOrderId: 'wo5',
          warehouseName: 'Main FG',
          factoryName: 'Erode Plant',
          plannedQuantity: '100.0000',
          actualGoodQuantity: '98.0000',
          rejectedQuantity: '2.0000',
          wastageQuantity: '0.0000',
          uomSymbol: 'kg',
        },
        recipeAndInputs: {
          bomCode: 'BOM-TUR',
          bomName: 'Turmeric 500g',
          bomVersionNumber: 1,
          consumptions: [
            {
              id: 'c1',
              itemCode: 'RM-TUR',
              itemName: 'Raw Turmeric',
              itemType: 'RAW_MATERIAL',
              sourceBatchNumber: 'RM-B-101',
              quantity: '105.0000',
              uomSymbol: 'kg',
            },
          ],
          returns: [],
        },
        productionHistory: {
          actualYieldPercent: '98.00',
          entries: [],
          costing: null,
        },
        qualityHistory: {
          inspectionNumber: 'QI-2026-004',
          decision: 'ACCEPTED',
          acceptedQuantity: '98.0000',
          rejectedQuantity: '2.0000',
          quarantinedQuantity: '0.0000',
          inspectedAt: '2026-11-20T12:00:00.000Z',
        },
        finishedGoodsAndMovement: {
          finishedGoodsBatchNumber: 'FG-B-201',
          movements: [],
          dispatches: [],
        },
        timeline: [
          {
            stage: 'PRODUCTION_BATCH',
            title: 'Production Batch PB-2026-011',
            detail: 'BOM BOM-TUR v1',
            timestamp: '2026-11-20T08:00:00.000Z',
          },
        ],
      },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/trace/batch/tok-123']}>
          <Routes>
            <Route path="/trace/batch/:reference" element={<QrTraceabilityPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/PB-2026-011 — Turmeric Powder/)).toBeTruthy();
      expect(screen.getByText(/RM-B-101/)).toBeTruthy();
      expect(screen.getByText(/QI-2026-004/)).toBeTruthy();
    });
  });

  it('shows clear error state for revoked or invalid QR reference', async () => {
    vi.spyOn(batchQrService, 'resolveTraceability').mockRejectedValue(
      new Error('This QR reference has been revoked.'),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/trace/batch/revoked-tok']}>
          <Routes>
            <Route path="/trace/batch/:reference" element={<QrTraceabilityPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('This QR reference has been revoked.')).toBeTruthy();
    });
  });
});
