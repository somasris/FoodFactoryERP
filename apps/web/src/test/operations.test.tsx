import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { SystemHealthPage } from '../routes/admin/SystemHealthPage';
import { BackupRecoveryPage } from '../routes/admin/BackupRecoveryPage';
import { MaintenancePage } from '../routes/admin/MaintenancePage';
import { operationsService } from '../services/operations.service';

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'admin@foodfactory.com',
    username: 'adminuser',
    fullName: 'Admin User',
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

describe('Phase 4.5 System Reliability & Operations Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. SystemHealthPage displays API, PostgreSQL, and performance metrics', async () => {
    vi.spyOn(operationsService, 'getHealth').mockResolvedValue({
      status: 'healthy',
      checkedAt: new Date().toISOString(),
      api: {
        uptimeSeconds: 120,
        nodeVersion: 'v22.0.0',
        environment: 'test',
        memoryMb: { rss: 80, heapUsed: 40, heapTotal: 60 },
      },
      database: {
        status: 'connected',
        latencyMs: 3,
        error: null,
        latestMigration: '20261125131455_operations_reliability_phase_4_5',
      },
      activeSessions: 2,
      maintenanceMode: false,
    });
    vi.spyOn(operationsService, 'getMonitoring').mockResolvedValue({
      performance: {
        totalRequestsSampled: 10,
        avgDurationMs: 12,
        p95DurationMs: 25,
        errorRatePercent: 0,
        slowThresholdMs: 500,
        slowRequestsCount: 0,
        slowEndpoints: [],
      },
      recentErrors: [],
    });

    const admin = makeAuthValue(
      ['ADMIN'],
      ['operations.health.read', 'operations.monitoring.read'],
    );
    renderWithProviders(<SystemHealthPage />, admin);

    await waitFor(() => {
      expect(screen.getByText('healthy')).toBeTruthy();
    });
    expect(screen.getByText('connected')).toBeTruthy();
    expect(screen.getByText('25 ms')).toBeTruthy();
  });

  it('2. BackupRecoveryPage hides Trigger Backup for read-only AUDITOR', async () => {
    vi.spyOn(operationsService, 'listBackups').mockResolvedValue({
      backups: [
        {
          id: 'b-1',
          backupName: 'foodfactory-backup-2026.sql',
          status: 'UNAVAILABLE',
          verificationStatus: 'UNVERIFIED',
          failureReason: 'BACKUP_DIR not configured',
        },
      ],
      restoreRequests: [],
    });

    const auditor = makeAuthValue(['AUDITOR'], ['operations.backup.read']);
    renderWithProviders(<BackupRecoveryPage />, auditor);

    await waitFor(() => {
      expect(screen.getByText('foodfactory-backup-2026.sql')).toBeTruthy();
    });
    expect(screen.queryByText('Trigger Manual Backup')).toBeNull();
  });

  it('3. MaintenancePage shows maintenance status and database info', async () => {
    vi.spyOn(operationsService, 'getMaintenanceMode').mockResolvedValue({
      enabled: false,
      message: 'System is undergoing scheduled maintenance.',
    });
    vi.spyOn(operationsService, 'getDatabaseInfo').mockResolvedValue({
      databaseSizeMb: 12.5,
      migrationsCount: 15,
      migrations: [],
      largestTables: [{ tableName: 'audit_logs', sizeMb: 1.2 }],
      recommendations: ['Schedule regular pg_dump backups.'],
    });

    const admin = makeAuthValue(
      ['ADMIN'],
      ['operations.health.read', 'operations.maintenance.manage'],
    );
    renderWithProviders(<MaintenancePage />, admin);

    await waitFor(() => {
      expect(screen.getByText('Enable Maintenance Mode')).toBeTruthy();
    });
    expect(screen.getByText('NORMAL OPERATION')).toBeTruthy();
  });
});
