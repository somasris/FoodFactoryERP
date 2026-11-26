/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ConnectivityState, OfflineQueueCounts } from '../offline/types';
import { getNextBackoffMs, probeApiServer } from '../offline/connection-state';
import { registerPwaServiceWorker } from '../offline/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface OfflineContextValue {
  connectivityState: ConnectivityState;
  isNavigatorOnline: boolean;
  isServerReachable: boolean;
  isSyncing: boolean;
  hasSyncError: boolean;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  counts: OfflineQueueCounts;
  storageAvailable: boolean;
  storageQuotaError: string | null;
  swUpdateAvailable: boolean;
  canInstallPwa: boolean;
  applySwUpdate: () => Promise<void>;
  promptInstallPwa: () => Promise<void>;
  triggerHealthCheck: () => Promise<boolean>;
  setSyncingState: (syncing: boolean, error?: boolean) => void;
  setLastSuccessfulSyncAt: (timestamp: string | null) => void;
  setQueueCounts: (counts: OfflineQueueCounts) => void;
  setStorageStatus: (available: boolean, quotaError?: string | null) => void;
}

const DEFAULT_COUNTS: OfflineQueueCounts = {
  pending: 0,
  processing: 0,
  failed: 0,
  conflict: 0,
  synced: 0,
};

export const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isNavigatorOnline, setIsNavigatorOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isServerReachable, setIsServerReachable] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [counts, setCounts] = useState<OfflineQueueCounts>(DEFAULT_COUNTS);
  const [storageAvailable, setStorageAvailable] = useState<boolean>(
    () => typeof indexedDB !== 'undefined',
  );
  const [storageQuotaError, setStorageQuotaError] = useState<string | null>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  const swUpdateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHealthCheck = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNavigatorOnline(false);
      setIsServerReachable(false);
      setLastCheckedAt(new Date().toISOString());
      return false;
    }

    const result = await probeApiServer();
    setIsNavigatorOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    setIsServerReachable(result.reachable);
    setLastCheckedAt(result.checkedAt);

    if (result.reachable) {
      consecutiveFailuresRef.current = 0;
    } else {
      consecutiveFailuresRef.current += 1;
    }

    return result.reachable;
  }, []);

  // Register Service Worker & PWA install prompt listener
  useEffect(() => {
    registerPwaServiceWorker({
      onNeedRefresh: updateFn => {
        swUpdateFnRef.current = updateFn;
        setSwUpdateAvailable(true);
      },
    });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Debounced browser online/offline listeners + adaptive health probing
  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const scheduleNextProbe = () => {
      if (!isMounted) return;
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      const delay = getNextBackoffMs(consecutiveFailuresRef.current);
      probeTimerRef.current = setTimeout(async () => {
        await triggerHealthCheck();
        scheduleNextProbe();
      }, delay);
    };

    const handleOnline = () => {
      setIsNavigatorOnline(true);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await triggerHealthCheck();
        scheduleNextProbe();
      }, 300);
    };

    const handleOffline = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      setIsNavigatorOnline(false);
      setIsServerReachable(false);
      setLastCheckedAt(new Date().toISOString());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    triggerHealthCheck().then(scheduleNextProbe);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    };
  }, [triggerHealthCheck]);

  const applySwUpdate = useCallback(async () => {
    if (swUpdateFnRef.current) {
      await swUpdateFnRef.current(true);
    } else {
      window.location.reload();
    }
  }, []);

  const promptInstallPwa = useCallback(async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPromptEvent(null);
    }
  }, [installPromptEvent]);

  const setSyncingState = useCallback((syncing: boolean, error = false) => {
    setIsSyncing(syncing);
    setHasSyncError(error);
  }, []);

  const setStorageStatus = useCallback((available: boolean, quotaError: string | null = null) => {
    setStorageAvailable(available);
    setStorageQuotaError(quotaError);
  }, []);

  const connectivityState: ConnectivityState = (() => {
    if (!isNavigatorOnline) return 'OFFLINE';
    if (!isServerReachable) return 'SERVER_UNAVAILABLE';
    if (isSyncing) return 'SYNCING';
    if (hasSyncError || counts.failed > 0) return 'SYNC_ERROR';
    return 'ONLINE';
  })();

  return (
    <OfflineContext.Provider
      value={{
        connectivityState,
        isNavigatorOnline,
        isServerReachable,
        isSyncing,
        hasSyncError,
        lastCheckedAt,
        lastSuccessfulSyncAt,
        counts,
        storageAvailable,
        storageQuotaError,
        swUpdateAvailable,
        canInstallPwa: !!installPromptEvent,
        applySwUpdate,
        promptInstallPwa,
        triggerHealthCheck,
        setSyncingState,
        setLastSuccessfulSyncAt,
        setQueueCounts: setCounts,
        setStorageStatus,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

const FALLBACK_OFFLINE_CONTEXT: OfflineContextValue = {
  connectivityState: 'ONLINE',
  isNavigatorOnline: true,
  isServerReachable: true,
  isSyncing: false,
  hasSyncError: false,
  lastCheckedAt: null,
  lastSuccessfulSyncAt: null,
  counts: DEFAULT_COUNTS,
  storageAvailable: false,
  storageQuotaError: null,
  swUpdateAvailable: false,
  canInstallPwa: false,
  applySwUpdate: async () => {},
  promptInstallPwa: async () => {},
  triggerHealthCheck: async () => true,
  setSyncingState: () => {},
  setLastSuccessfulSyncAt: () => {},
  setQueueCounts: () => {},
  setStorageStatus: () => {},
};

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  return ctx ?? FALLBACK_OFFLINE_CONTEXT;
}
