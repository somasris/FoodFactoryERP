import { apiClient } from './api-client';
import { ApiResponse } from '../types/api';

const unwrap = <T>(promise: Promise<ApiResponse<T>>): Promise<T> =>
  promise.then(res => res.data as T);

export interface DetailedHealthResponse {
  status: string;
  checkedAt: string;
  api: {
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
    memoryMb: { rss: number; heapUsed: number; heapTotal: number };
  };
  database: {
    status: string;
    latencyMs: number;
    error: string | null;
    latestMigration: string | null;
  };
  activeSessions: number;
  maintenanceMode: boolean;
}

export const operationsService = {
  getHealth: () => unwrap(apiClient<DetailedHealthResponse>('/operations/health')),
  getMonitoring: () =>
    unwrap(
      apiClient<{
        performance: {
          totalRequestsSampled: number;
          avgDurationMs: number;
          p95DurationMs: number;
          errorRatePercent: number;
          slowThresholdMs: number;
          slowRequestsCount: number;
          slowEndpoints: Array<Record<string, unknown>>;
        };
        recentErrors: Array<Record<string, unknown>>;
      }>('/operations/monitoring'),
    ),
  getDatabaseInfo: () =>
    unwrap(
      apiClient<{
        databaseSizeMb: number | null;
        migrationsCount: number;
        migrations: Array<{ migration_name: string; finished_at: string | null }>;
        largestTables: Array<{ tableName: string; sizeMb: number }>;
        recommendations: string[];
      }>('/operations/database'),
    ),
  listBackups: () =>
    unwrap(
      apiClient<{
        backups: Array<Record<string, unknown>>;
        restoreRequests: Array<Record<string, unknown>>;
      }>('/operations/backups'),
    ),
  triggerBackup: () =>
    unwrap(
      apiClient<Record<string, unknown>>('/operations/backups', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    ),
  verifyBackup: (id: string) =>
    unwrap(
      apiClient<Record<string, unknown>>(`/operations/backups/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    ),
  requestRestore: (backupRecordId: string, notes?: string) =>
    unwrap(
      apiClient<Record<string, unknown>>('/operations/restore-requests', {
        method: 'POST',
        body: JSON.stringify({ backupRecordId, notes }),
      }),
    ),
  reviewRestore: (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) =>
    unwrap(
      apiClient<Record<string, unknown>>(`/operations/restore-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    ),
  getMaintenanceMode: () =>
    unwrap(apiClient<{ enabled: boolean; message: string }>('/operations/maintenance-mode')),
  setMaintenanceMode: (enabled: boolean, message?: string) =>
    unwrap(
      apiClient<{ enabled: boolean; message: string }>('/operations/maintenance-mode', {
        method: 'PUT',
        body: JSON.stringify({ enabled, message }),
      }),
    ),
};
