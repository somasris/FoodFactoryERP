import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { AuditGovernancePage } from '../routes/admin/AuditGovernancePage';
import { governanceService } from '../services/governance.service';

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

describe('Phase 4.4 Audit & Governance Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. AuditGovernancePage renders audit logs with diff count and export button', async () => {
    vi.spyOn(governanceService, 'listAuditLogs').mockResolvedValue({
      items: [
        {
          id: 'log-1',
          userId: 'u-1',
          user: { id: 'u-1', username: 'admin', fullName: 'Admin' },
          action: 'UPDATE',
          entityType: 'Company',
          entityId: 'c-12345678',
          ipAddress: '127.0.0.1',
          remarks: 'Updated organization tradeName',
          createdAt: new Date().toISOString(),
          previousState: { tradeName: 'Old' },
          newState: { tradeName: 'New' },
          fieldDiffs: [{ field: 'tradeName', previousValue: 'Old', newValue: 'New' }],
        },
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });

    const auditor = makeAuthValue(
      ['AUDITOR'],
      [
        'governance.audit.read',
        'governance.audit.export',
        'governance.approvals.read',
        'governance.activity.read',
      ],
    );
    renderWithProviders(<AuditGovernancePage />, auditor);

    await waitFor(() => {
      expect(screen.getByText('Updated organization tradeName')).toBeTruthy();
    });
    expect(screen.getByText('Inspect (1)')).toBeTruthy();
    expect(screen.getByText('Export Audit CSV')).toBeTruthy();
  });
});
