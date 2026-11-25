import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ReportsComplianceLayout } from '../components/reports/ReportsComplianceLayout';
import { FinancialCompliancePage } from '../routes/compliance/FinancialCompliancePage';
import { StockAuditPage } from '../routes/compliance/StockAuditPage';
import { complianceService } from '../services/compliance.service';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'auditor@foodfactory.com',
    username: 'auditoruser',
    fullName: 'Auditor User',
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

describe('Phase 4.2 Financial & Compliance Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. ReportsComplianceLayout renders permission-filtered tabs', () => {
    const auditor = makeAuthValue(
      ['AUDITOR'],
      ['compliance.tax.read', 'compliance.stock_audit.read'],
    );
    renderWithProviders(<ReportsComplianceLayout />, auditor);
    expect(screen.getByText('Financial Compliance')).toBeTruthy();
    expect(screen.getByText('Stock Audit')).toBeTruthy();
  });

  it('2. FinancialCompliancePage renders GST summary & purchase availability notice', async () => {
    vi.spyOn(complianceService, 'getGstSalesSummary').mockResolvedValue({
      disclaimer: 'Immutable invoice snapshot summary.',
      counts: { issued: 3, cancelled: 1, draft: 0 },
      totals: {
        taxableSalesValue: '10000.00',
        cgstAmount: '250.00',
        sgstAmount: '250.00',
        igstAmount: '0.00',
        totalGstCollected: '500.00',
        grandTotal: '10500.00',
        intraStateTaxable: '10000.00',
        interStateTaxable: '0.00',
      },
      hsnSummary: [],
      taxRateSummary: [],
      monthlySummary: [],
    });
    vi.spyOn(complianceService, 'getPurchaseTaxSummary').mockResolvedValue({
      purchaseInvoicingSupported: false,
      activeSuppliersCount: 2,
      statusNotice: 'Supplier tax invoices are not implemented in the current scope.',
    });

    const auditor = makeAuthValue(['AUDITOR'], ['compliance.tax.read', 'compliance.export']);
    renderWithProviders(<FinancialCompliancePage />, auditor);

    await waitFor(() => {
      expect(screen.getByText('₹10000.00')).toBeTruthy();
    });
    expect(
      screen.getByText(/Supplier tax invoices are not implemented in the current scope/),
    ).toBeTruthy();
  });

  it('3. StockAuditPage hides Approve/Post for AUDITOR and shows them for ADMIN', async () => {
    vi.spyOn(complianceService, 'listStockAudits').mockResolvedValue({
      items: [
        {
          id: 'sa-1',
          auditNumber: 'SA-2026-001',
          warehouseId: 'wh-1',
          status: 'SUBMITTED',
          auditDate: new Date().toISOString(),
          notes: null,
          inventoryAdjustmentId: null,
          warehouse: { id: 'wh-1', code: 'WH-RM-01', name: 'Raw Material' },
          createdBy: { id: 'u-2', username: 'prod', fullName: 'Prod' },
          lines: [],
        },
      ],
    });

    const auditor = makeAuthValue(['AUDITOR'], ['compliance.stock_audit.read']);
    const { unmount } = renderWithProviders(<StockAuditPage />, auditor);
    await waitFor(() => {
      expect(screen.getByText('SA-2026-001')).toBeTruthy();
    });
    expect(screen.queryByText('Approve')).toBeNull();
    unmount();

    const admin = makeAuthValue(
      ['ADMIN'],
      ['compliance.stock_audit.read', 'compliance.stock_audit.review'],
    );
    renderWithProviders(<StockAuditPage />, admin);
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeTruthy();
    });
  });
});
