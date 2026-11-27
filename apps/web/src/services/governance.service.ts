import { apiClient } from './api-client';
import { ApiResponse } from '../types/api';

const unwrap = <T>(promise: Promise<ApiResponse<T>>): Promise<T> =>
  promise.then(res => res.data as T);

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  user: { id: string; username: string; fullName: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  remarks: string | null;
  createdAt: string;
  previousState: unknown;
  newState: unknown;
  fieldDiffs: Array<{ field: string; previousValue: unknown; newValue: unknown }>;
}

export const governanceService = {
  listAuditLogs: (params?: { search?: string; entityType?: string; action?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.action) qs.set('action', params.action);
    if (params?.page) qs.set('page', String(params.page));
    return unwrap(
      apiClient<{
        items: AuditLogEntry[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/governance/audit-logs?${qs.toString()}`),
    );
  },
  getApprovals: (status?: string) =>
    unwrap(
      apiClient<{
        counts: { pending: number; approved: number; rejected: number };
        items: Array<Record<string, unknown>>;
      }>(status ? `/governance/approvals?status=${status}` : '/governance/approvals'),
    ),
  getUserActivity: (page = 1) =>
    unwrap(
      apiClient<{
        items: Array<Record<string, unknown>>;
        pagination: { page: number; totalPages: number; total: number };
      }>(`/governance/user-activity?page=${page}`),
    ),
  getTransactionHistory: () =>
    unwrap(
      apiClient<{ items: Array<Record<string, unknown>> }>('/governance/transactions'),
    ),
  exportAuditCsv: async () => {
    const { downloadAuthenticatedExport } = await import('../utils/export-download');
    const dateStamp = new Date().toISOString().slice(0, 10);
    await downloadAuthenticatedExport(
      '/governance/audit-logs/export',
      `Audit_Trail_${dateStamp}.csv`,
    );
  },
};
