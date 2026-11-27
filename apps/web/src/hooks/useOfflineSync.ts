import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useOffline } from '../context/OfflineContext';
import { offlineRepo, subscribeOfflineQueueChanges } from '../offline/offline-repository';
import { syncEngine, SyncRunSummary } from '../offline/sync-engine';

export function useOfflineSync() {
  const { user, isAuthenticated } = useAuth();
  const {
    isNavigatorOnline,
    isServerReachable,
    setSyncingState,
    setQueueCounts,
    setLastSuccessfulSyncAt,
  } = useOffline();

  const wasOfflineRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCounts = useCallback(async () => {
    if (!user?.id) {
      setQueueCounts({ pending: 0, processing: 0, failed: 0, conflict: 0, synced: 0 });
      return;
    }
    const counts = await offlineRepo.getQueueCounts(user.id);
    setQueueCounts(counts);
    const lastSync = await offlineRepo.getMetadata<string>(user.id, 'lastSuccessfulSyncAt');
    if (lastSync) {
      setLastSuccessfulSyncAt(lastSync);
    }
  }, [user?.id, setQueueCounts, setLastSuccessfulSyncAt]);

  const syncNow = useCallback(async (): Promise<SyncRunSummary | null> => {
    if (!isAuthenticated || !user?.id) return null;
    setSyncingState(true, false);
    try {
      const summary = await syncEngine.runSync(user.id);
      await refreshCounts();
      if (summary.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(summary.lastSuccessfulSyncAt);
      }
      setSyncingState(false, summary.failedCount > 0);
      return summary;
    } catch {
      await refreshCounts();
      setSyncingState(false, true);
      return null;
    }
  }, [isAuthenticated, user?.id, refreshCounts, setSyncingState, setLastSuccessfulSyncAt]);

  useEffect(() => {
    void refreshCounts();
    return subscribeOfflineQueueChanges(() => {
      void refreshCounts();
    });
  }, [refreshCounts]);

  // Schedule bounded automatic retry for transient-failed PENDING operations when online
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (!isAuthenticated || !user?.id || !isNavigatorOnline || !isServerReachable) {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const schedulePendingRetry = async () => {
      const pending = await offlineRepo.listOperationsByUser(user.id, 'PENDING');
      if (cancelled || pending.length === 0) return;

      const now = Date.now();
      let earliestMs = Infinity;
      for (const op of pending) {
        if (op.lastErrorCode === 'SESSION_EXPIRED') continue;
        const t = op.nextRetryAt ? new Date(op.nextRetryAt).getTime() : now;
        if (t < earliestMs) earliestMs = t;
      }
      if (!Number.isFinite(earliestMs)) return;

      const delayMs = Math.max(200, earliestMs - now);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) void syncNow();
      }, delayMs);
    };

    void schedulePendingRetry();
    const unsub = subscribeOfflineQueueChanges(() => {
      void schedulePendingRetry();
    });

    return () => {
      cancelled = true;
      unsub();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, isNavigatorOnline, isServerReachable, syncNow]);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (!isAuthenticated || !user?.id) {
      initialSyncDoneRef.current = false;
      return;
    }

    const canSync = isNavigatorOnline && isServerReachable;
    if (!canSync) {
      wasOfflineRef.current = true;
      return;
    }

    if (!initialSyncDoneRef.current || wasOfflineRef.current) {
      initialSyncDoneRef.current = true;
      wasOfflineRef.current = false;
      void syncNow();
    }
  }, [isAuthenticated, user?.id, isNavigatorOnline, isServerReachable, syncNow]);

  return { syncNow, refreshCounts };
}
