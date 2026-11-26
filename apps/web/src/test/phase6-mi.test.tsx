import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { AllergenAlertBanner } from '../components/production/AllergenAlertBanner';
import { BatchJourneyTimeline } from '../components/production/BatchJourneyTimeline';
import { EfficiencyScorecardSection } from '../components/production/EfficiencyScorecardSection';

const authStub: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: () => false,
  hasPermission: () => false,
};

const wrap = (ui: React.ReactNode) =>
  render(
    <AuthContext.Provider value={authStub}>
      <I18nProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </I18nProvider>
    </AuthContext.Provider>,
  );

describe('Phase 6: Manufacturing Intelligence Frontend Suite', () => {
  it('1. AllergenAlertBanner renders confirmed allergens, cross-contact, and incomplete declaration warnings', () => {
    wrap(
      <AllergenAlertBanner
        profile={{
          bomId: 'b1',
          bomVersionId: 'bv1',
          bomVersionNumber: 1,
          derivedAt: new Date().toISOString(),
          isHistoricalSnapshot: true,
          overallStatus: 'CONTAINS_ALLERGENS',
          hasUnknownIngredients: true,
          confirmedAllergens: ['MILK'],
          crossContactAllergens: ['PEANUTS'],
          unknownIngredients: [
            { inventoryItemId: 'i1', code: 'RM-UNK', name: 'Spice Mix', reason: 'UNKNOWN' },
          ],
        }}
      />,
    );

    expect(screen.getByText(/ALLERGEN ALERT: Confirmed Allergens Present/i)).toBeTruthy();
    expect(screen.getByText('MILK')).toBeTruthy();
    expect(screen.getByText('PEANUTS')).toBeTruthy();
    expect(screen.getByText(/RM-UNK \(Spice Mix\)/)).toBeTruthy();
    expect(screen.getByText('Historical Batch Snapshot')).toBeTruthy();
  });

  it('2. BatchJourneyTimeline renders occurred vs pending stages and split-batch sibling links', () => {
    wrap(
      <BatchJourneyTimeline
        journey={{
          batch: {
            id: 'pb1',
            batchNumber: 'PB/2026/001',
            status: 'IN_PROGRESS',
            productName: 'Butter Biscuits',
            sku: 'BB-100',
            plannedQuantity: '100',
            actualGoodQuantity: '0',
            uomSymbol: 'kg',
          },
          stages: [
            {
              key: 'bom_recipe',
              title: 'BOM & Recipe Version',
              status: 'OCCURRED',
              timestamp: new Date().toISOString(),
              actor: null,
              summary: 'BOM-001 v1',
              details: {},
              navigationPath: '/production/boms',
            },
            {
              key: 'quality_inspection',
              title: 'Quality Inspection & Decision',
              status: 'PENDING',
              timestamp: null,
              actor: null,
              summary: 'Awaiting quality inspection',
              details: {},
              navigationPath: '/production/quality',
            },
          ],
          genealogy: {
            backwardInputs: [],
            splitSiblingBatches: [
              {
                id: 'pb2',
                batchNumber: 'PB/2026/002',
                status: 'CREATED',
                plannedQuantity: '50',
                actualGoodQuantity: '0',
              },
            ],
            forwardSalesDispatches: [],
          },
        }}
      />,
    );

    expect(screen.getByText('BOM & Recipe Version')).toBeTruthy();
    expect(screen.getByText('OCCURRED')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(screen.getByText(/PB\/2026\/002/)).toBeTruthy();
  });

  it('3. EfficiencyScorecardSection renders UOM-grouped metrics and handles null ratios safely', () => {
    vi.restoreAllMocks();
    wrap(
      <EfficiencyScorecardSection
        scorecard={{
          dateRange: { period: 'month', fromDate: '', toDate: '' },
          recordCounts: {
            totalBatches: 2,
            COMPLETED: 1,
            IN_PROGRESS: 1,
            CANCELLED: 0,
            CREATED: 0,
            completionTimeRecordCount: 1,
            costedBatchCount: 1,
            totalWorkOrders: 1,
            completedWorkOrders: 1,
          },
          quantityMetricsByUom: [
            {
              uomCode: 'KG',
              uomSymbol: 'kg',
              completedBatchCount: 1,
              plannedQuantity: '100.0000',
              actualGoodQuantity: '95.0000',
              rejectedQuantity: '2.0000',
              wastageQuantity: '3.0000',
              yieldPercentage: '95.00',
              wastagePercentage: '3.00',
              rejectionPercentage: '2.06',
            },
          ],
          performance: {
            avgBatchCompletionHours: '2.50',
            workOrderCompletionRatePercent: '100.00',
            totalMaterialCostVariance: '120.00',
            totalProductionCostVariance: '150.00',
          },
          sourceBatches: [],
        }}
      />,
    );

    expect(screen.getByText('Production Efficiency Scorecard')).toBeTruthy();
    expect(screen.getByText('2.50 h')).toBeTruthy();
    expect(screen.getByText('95.00%')).toBeTruthy();
    expect(screen.getByText('₹120.00')).toBeTruthy();
  });
});
