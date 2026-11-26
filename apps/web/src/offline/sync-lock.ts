const LOCK_KEY = 'ff_offline_sync_lock';
const LOCK_TTL_MS = 30_000;
const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}`;

/**
 * Coordinates synchronization across multiple browser tabs.
 * Uses Web Locks API when available, with a TTL-based localStorage lease fallback.
 */
export async function withSyncLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const lockName = `foodfactory_sync_${userId}`;

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(lockName, { ifAvailable: true }, async lock => {
      if (!lock) {
        return { acquired: false };
      }
      const result = await fn();
      return { acquired: true, result };
    });
  }

  // Fallback for environments without navigator.locks (e.g., older browsers / jsdom)
  const storageKey = `${LOCK_KEY}_${userId}`;
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { tabId: string; expiresAt: number };
      if (parsed.tabId !== TAB_ID && parsed.expiresAt > now) {
        return { acquired: false };
      }
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ tabId: TAB_ID, expiresAt: now + LOCK_TTL_MS }),
    );
  } catch {
    // Proceed if localStorage is unavailable
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { tabId: string };
        if (parsed.tabId === TAB_ID) {
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Ignore
    }
  }
}
