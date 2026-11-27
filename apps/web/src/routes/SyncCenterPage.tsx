import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOffline } from '../context/OfflineContext';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { offlineRepo, subscribeOfflineQueueChanges } from '../offline/offline-repository';
import { offlineQueue } from '../offline/operation-queue';
import { offlineDb, PendingOperationRecord, SyncConflictRecord } from '../offline/db';
import { syncApiService } from '../services/sync.service';
import { useTranslation } from '../i18n/I18nContext';

type SyncTab = 'conflicts' | 'pending' | 'failed' | 'synced';

export const SyncCenterPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { connectivityState, isSyncing, lastSuccessfulSyncAt, counts } = useOffline();
  const { syncNow, refreshCounts } = useOfflineSync();

  const [activeTab, setActiveTab] = useState<SyncTab>('conflicts');
  const [operations, setOperations] = useState<PendingOperationRecord[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const [ops, confs] = await Promise.all([
      offlineRepo.listOperationsByUser(user.id),
      offlineRepo.listConflicts(user.id, true),
    ]);
    setOperations(ops);
    setConflicts(confs);
    if (confs.length === 0 && ops.some(o => o.status === 'PENDING')) {
      setActiveTab('pending');
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
    return subscribeOfflineQueueChanges(() => {
      void loadData();
    });
  }, [loadData]);

  const handleManualSync = async () => {
    setStatusMessage(null);
    const summary = await syncNow();
    await loadData();
    if (summary) {
      if (!summary.ran) {
        setStatusMessage(`Sync skipped: ${summary.skippedReason ?? 'unavailable'}`);
      } else {
        setStatusMessage(
          `Sync complete: ${summary.syncedCount} synced, ${summary.conflictCount} conflicts, ${summary.failedCount} failed.`,
        );
      }
    }
  };

  const handleRetryOp = async (operationId: string) => {
    if (!user?.id) return;
    await offlineQueue.retryFailedOperation(user.id, operationId);
    await refreshCounts();
    await loadData();
  };

  const handleCancelOp = async (operationId: string) => {
    if (!user?.id) return;
    await offlineQueue.cancelOperation(user.id, operationId);
    await refreshCounts();
    await loadData();
  };

  const handleResolveConflict = async (
    conflict: SyncConflictRecord,
    action: 'RETRY_AFTER_REFRESH' | 'DISCARD' | 'REVIEW_REQUESTED',
  ) => {
    if (!user?.id) return;
    try {
      if (navigator.onLine) {
        const targetConflictId = conflict.serverConflictId ?? conflict.conflictId;
        await syncApiService.resolveConflict(targetConflictId, action).catch(() => undefined);
      }

      await offlineDb.syncConflicts.update(conflict.conflictId, {
        resolvedAt: new Date().toISOString(),
        resolutionAction: action,
      });

      if (action === 'RETRY_AFTER_REFRESH') {
        await offlineQueue.retryFailedOperation(user.id, conflict.operationId);
      } else if (action === 'DISCARD') {
        const op = await offlineRepo.getPendingOperation(user.id, conflict.operationId);
        if (op) {
          await offlineRepo.putPendingOperation({
            ...op,
            status: 'CANCELLED',
            clientUpdatedAt: new Date().toISOString(),
          });
        }
      }

      await refreshCounts();
      await loadData();
      setStatusMessage(`Conflict resolved (${action.replace(/_/g, ' ').toLowerCase()}).`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to resolve conflict');
    }
  };

  const pendingOps = operations.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING');
  const failedOps = operations.filter(o => o.status === 'FAILED');
  const syncedOps = operations.filter(o => o.status === 'SYNCED');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E1E7DD] bg-white p-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">{t('offline.syncCenter')}</h1>
          <p className="text-xs text-[#66756A]">
            {t('common.lastUpdated')}:{' '}
            {lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt).toLocaleString() : '—'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleManualSync()}
          disabled={isSyncing || connectivityState === 'OFFLINE'}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#245C3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? t('offline.syncing') : t('offline.syncNow')}</span>
        </button>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="rounded-lg border border-[#E1E7DD] bg-[#EAF1E8] px-4 py-2.5 text-xs font-medium text-[#17452C]"
        >
          {statusMessage}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#66756A]">
            <Clock className="h-4 w-4 text-[#C58A25]" />
            <span>Pending</span>
          </div>
          <div className="mt-1 text-xl font-bold text-[#24352A]">{counts.pending}</div>
        </div>
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#66756A]">
            <AlertTriangle className="h-4 w-4 text-[#C74440]" />
            <span>Conflicts</span>
          </div>
          <div className="mt-1 text-xl font-bold text-[#C74440]">{conflicts.length}</div>
        </div>
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#66756A]">
            <XCircle className="h-4 w-4 text-[#C74440]" />
            <span>Failed</span>
          </div>
          <div className="mt-1 text-xl font-bold text-[#24352A]">{counts.failed}</div>
        </div>
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#66756A]">
            <CheckCircle2 className="h-4 w-4 text-[#27834A]" />
            <span>Synced</span>
          </div>
          <div className="mt-1 text-xl font-bold text-[#27834A]">{counts.synced}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E1E7DD] pb-2">
        {(
          [
            { id: 'conflicts', label: `Conflicts (${conflicts.length})` },
            { id: 'pending', label: `Pending (${pendingOps.length})` },
            { id: 'failed', label: `Failed (${failedOps.length})` },
            { id: 'synced', label: `Synced (${syncedOps.length})` },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[#245C3A] text-white'
                : 'bg-white text-[#66756A] border border-[#E1E7DD] hover:bg-[#EAF1E8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conflicts View */}
      {activeTab === 'conflicts' && (
        <div className="space-y-3">
          {conflicts.length === 0 ? (
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-6 text-center text-xs text-[#66756A]">
              No unresolved synchronization conflicts.
            </div>
          ) : (
            conflicts.map(conflict => (
              <div
                key={conflict.conflictId}
                className="rounded-xl border border-[#C74440]/30 bg-white p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#C74440]/10 px-2 py-0.5 text-[11px] font-bold text-[#C74440]">
                        {conflict.conflictCategory}
                      </span>
                      <span className="text-xs font-semibold text-[#24352A]">
                        {conflict.entityType} • {conflict.operationType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#66756A]">{conflict.reason}</p>
                  </div>
                  <span className="text-[11px] text-[#8A958C]">
                    {new Date(conflict.detectedAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-2.5">
                    <div className="mb-1 text-[11px] font-semibold text-[#17452C]">
                      Local Submitted Data
                    </div>
                    <pre className="max-h-32 overflow-auto text-[11px] text-[#24352A]">
                      {JSON.stringify(conflict.localPayload, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-2.5">
                    <div className="mb-1 text-[11px] font-semibold text-[#17452C]">
                      Current Server Snapshot
                    </div>
                    <pre className="max-h-32 overflow-auto text-[11px] text-[#24352A]">
                      {conflict.serverSnapshot
                        ? JSON.stringify(conflict.serverSnapshot, null, 2)
                        : 'Server snapshot unavailable (permission or validation conflict).'}
                    </pre>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleResolveConflict(conflict, 'RETRY_AFTER_REFRESH')}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#245C3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry After Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResolveConflict(conflict, 'REVIEW_REQUESTED')}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E1E7DD] bg-[#EAF1E8] px-3 py-1.5 text-xs font-semibold text-[#17452C] hover:bg-[#DCE7D8]"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Request Authorized Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResolveConflict(conflict, 'DISCARD')}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#C74440]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#C74440] hover:bg-[#C74440]/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Discard Local Draft</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Operations List for Pending / Failed / Synced */}
      {activeTab !== 'conflicts' && (
        <div className="space-y-2.5">
          {(activeTab === 'pending'
            ? pendingOps
            : activeTab === 'failed'
              ? failedOps
              : syncedOps
          ).map(op => (
            <div
              key={op.operationId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E1E7DD] bg-white p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#17452C]">{op.operationType}</span>
                  <span className="rounded bg-[#EAF1E8] px-2 py-0.5 text-[10px] font-semibold text-[#17452C]">
                    {op.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#66756A]">
                  Entity: {op.entityType} ({op.entityId.slice(0, 8)}…) • Queued:{' '}
                  {new Date(op.clientCreatedAt).toLocaleString()}
                </div>
                {op.lastErrorMessage && (
                  <div className="mt-1 text-[11px] text-[#C74440]">{op.lastErrorMessage}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {op.status === 'FAILED' && (
                  <button
                    type="button"
                    onClick={() => void handleRetryOp(op.operationId)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#245C3A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#17452C]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry</span>
                  </button>
                )}
                {(op.status === 'PENDING' || op.status === 'FAILED') && (
                  <button
                    type="button"
                    onClick={() => void handleCancelOp(op.operationId)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E1E7DD] px-3 py-1 text-xs font-semibold text-[#C74440] hover:bg-[#C74440]/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {(activeTab === 'pending'
            ? pendingOps
            : activeTab === 'failed'
              ? failedOps
              : syncedOps
          ).length === 0 && (
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-6 text-center text-xs text-[#66756A]">
              No {activeTab} operations.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
