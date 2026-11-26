import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { ShiftHandoverDashboardPage } from '../routes/production/ShiftHandoverDashboardPage';
import { MaterialSubstitutionPage } from '../routes/production/MaterialSubstitutionPage';
import { collaborationService } from '../services/collaboration.service';
import { masterDataService } from '../services/master-data.service';

vi.mock('../services/collaboration.service', () => ({
  collaborationService: {
    getHandoverDashboard: vi.fn(),
    listHandovers: vi.fn(),
    getHandoverById: vi.fn(),
    createHandover: vi.fn(),
    submitHandover: vi.fn(),
    acknowledgeHandover: vi.fn(),
    returnHandover: vi.fn(),
    closeHandover: vi.fn(),
    evaluateSubstitution: vi.fn(),
    listSubstitutions: vi.fn(),
    createSubstitutionRequest: vi.fn(),
    approveSubstitution: vi.fn(),
    rejectSubstitution: vi.fn(),
    applySubstitution: vi.fn(),
  },
}));

vi.mock('../services/master-data.service', () => ({
  masterDataService: {
    factories: { list: vi.fn() },
    warehouses: { list: vi.fn() },
    boms: { list: vi.fn() },
    inventoryItems: { list: vi.fn() },
    uoms: { list: vi.fn() },
  },
}));

const authStub: AuthContextType = {
  user: {
    id: 'user-1',
    email: 'prod@foodfactory.com',
    username: 'prod',
    fullName: 'Production Lead',
    isActive: true,
    roles: ['PRODUCTION'],
    permissions: ['production.batches.read', 'production.batches.create', 'production.batches.update', 'bom.read', 'bom.update'],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: () => true,
  hasPermission: () => true,
};

function renderPage(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authStub}>
        <I18nProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Phase 7: Factory Collaboration & Decision Support UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(masterDataService.factories.list).mockResolvedValue({
      success: true,
      data: [{ id: 'fac-1', code: 'FAC-01', name: 'Main Plant', isActive: true }],
    } as never);
    vi.mocked(masterDataService.warehouses.list).mockResolvedValue({
      success: true,
      data: { items: [{ id: 'wh-1', code: 'WH-01', name: 'RM Store' }] },
    } as never);
  });

  it('1. ShiftHandoverDashboardPage renders KPIs, list, and detail lifecycle actions', async () => {
    const handoverItem = {
      id: 'sh-1',
      handoverNumber: 'SH-2026-0001',
      factoryId: 'fac-1',
      shiftName: 'Morning Shift',
      shiftDate: '2026-11-26T00:00:00.000Z',
      outgoingUserId: 'u1',
      status: 'SUBMITTED' as const,
      priority: 'HIGH' as const,
      revisionNumber: 1,
      equipmentIssues: 'Mixer B seal needs check',
      createdAt: '2026-11-26T06:00:00.000Z',
    };

    vi.mocked(collaborationService.getHandoverDashboard).mockResolvedValue({
      pendingAcknowledgement: [handoverItem],
      unresolvedIssues: [handoverItem],
      recentlyClosed: [],
      overdueCount: 1,
      activeBatches: [],
      pendingQualityInspections: [],
    });
    vi.mocked(collaborationService.listHandovers).mockResolvedValue({
      items: [handoverItem],
      pagination: { page: 1, totalPages: 1, total: 1 },
    });
    vi.mocked(collaborationService.getHandoverById).mockResolvedValue({
      ...handoverItem,
      histories: [
        {
          id: 'h-1',
          revisionNumber: 1,
          action: 'SUBMITTED',
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          actorId: 'u1',
          createdAt: '2026-11-26T06:05:00.000Z',
        },
      ],
    });
    vi.mocked(collaborationService.acknowledgeHandover).mockResolvedValue({
      ...handoverItem,
      status: 'ACKNOWLEDGED',
    });

    renderPage(<ShiftHandoverDashboardPage />);

    expect(await screen.findByText('SH-2026-0001')).toBeTruthy();
    expect(screen.getByText(/1 overdue/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Mixer B seal needs check')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Acknowledge/i }));
    await waitFor(() => {
      expect(collaborationService.acknowledgeHandover).toHaveBeenCalledWith('sh-1', undefined);
    });
  });

  it('2. MaterialSubstitutionPage evaluates compatibility and renders requests queue', async () => {
    vi.mocked(masterDataService.boms.list).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'bom-1',
            code: 'BOM-CHOC',
            name: 'Chocolate Bar',
            versions: [{ id: 'bv-1', versionNumber: 1, status: 'ACTIVE' }],
          },
        ],
      },
    } as never);
    vi.mocked(masterDataService.inventoryItems.list).mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'item-orig', code: 'RM-SUGAR', name: 'Cane Sugar' },
          { id: 'item-sub', code: 'RM-JAG', name: 'Jaggery Powder' },
        ],
      },
    } as never);
    vi.mocked(masterDataService.uoms.list).mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 'uom-kg', symbol: 'kg', name: 'Kilogram' }],
      },
    } as never);
    vi.mocked(collaborationService.listSubstitutions).mockResolvedValue([
      {
        id: 'sub-req-1',
        requestNumber: 'SUB-2026-0001',
        warehouseId: 'wh-1',
        bomId: 'bom-1',
        bomVersionId: 'bv-1',
        originalItemId: 'item-orig',
        substituteItemId: 'item-sub',
        requiredQuantity: '10',
        compatibilityStatus: 'COMPATIBLE_WITH_WARNING',
        status: 'PENDING_APPROVAL',
        reason: 'Primary sugar delayed',
        createdAt: '2026-11-26T08:00:00.000Z',
      },
    ]);
    vi.mocked(collaborationService.evaluateSubstitution).mockResolvedValue({
      compatibilityStatus: 'COMPATIBLE_WITH_WARNING',
      reasons: [
        {
          code: 'ALLERGEN_REVIEW',
          severity: 'WARNING',
          message: 'Substitute allergen profile requires verification',
        },
      ],
      allergenComparison: {
        originalStatus: 'DECLARED_NONE',
        originalAllergens: [],
        substituteStatus: 'CONTAINS_ALLERGENS',
        substituteAllergens: ['SULPHITES'],
        substituteCrossContact: [],
        introducesNewAllergens: true,
        hasUnknownAllergenInfo: false,
      },
      inventorySummary: {
        requiredInSubstituteUom: '10',
        substituteUomSymbol: 'kg',
        availableAcceptedQty: '25',
        reservedQty: '0',
        quarantinedQty: '0',
        rejectedQty: '0',
        expiredQty: '0',
      },
    });
    vi.mocked(collaborationService.approveSubstitution).mockResolvedValue({
      id: 'sub-req-1',
      requestNumber: 'SUB-2026-0001',
      warehouseId: 'wh-1',
      bomId: 'bom-1',
      bomVersionId: 'bv-1',
      originalItemId: 'item-orig',
      substituteItemId: 'item-sub',
      requiredQuantity: '10',
      compatibilityStatus: 'COMPATIBLE_WITH_WARNING',
      status: 'APPROVED',
      reason: 'Primary sugar delayed',
      createdAt: '2026-11-26T08:00:00.000Z',
    });

    renderPage(<MaterialSubstitutionPage />);

    expect(await screen.findByText('SUB-2026-0001')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: 'wh-1' } });
    fireEvent.change(screen.getByLabelText('BOM'), { target: { value: 'bom-1' } });
    fireEvent.change(screen.getByLabelText('Original Material'), { target: { value: 'item-orig' } });
    fireEvent.change(screen.getByLabelText('Proposed Substitute'), { target: { value: 'item-sub' } });
    fireEvent.change(screen.getByLabelText('UOM'), { target: { value: 'uom-kg' } });

    fireEvent.click(screen.getByRole('button', { name: 'Check Compatibility' }));

    expect(await screen.findByText(/Substitute allergen profile requires verification/i)).toBeTruthy();
    expect(screen.getByText(/Introduces new allergens/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      expect(collaborationService.approveSubstitution).toHaveBeenCalledWith('sub-req-1');
    });
  });
});
