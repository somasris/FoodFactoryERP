export type SessionSyncEvent =
  | { type: 'LOGOUT' }
  | { type: 'SESSION_EXPIRED' }
  | {
      type: 'SESSION_EXTENDED';
      inactivityExpiresAt: string;
      absoluteExpiresAt: string;
      timeoutMinutes: number;
      warningMinutes: number;
    };

const CHANNEL_NAME = 'ff_session_sync';
const STORAGE_FALLBACK_KEY = 'ff_session_sync_event';

export function broadcastSessionEvent(event: SessionSyncEvent): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(event);
      ch.close();
      return;
    }
  } catch {
    // Fall back to storage event
  }

  try {
    window.localStorage.setItem(
      STORAGE_FALLBACK_KEY,
      JSON.stringify({ ...event, ts: Date.now() }),
    );
    window.localStorage.removeItem(STORAGE_FALLBACK_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function subscribeSessionEvents(
  handler: (event: SessionSyncEvent) => void,
): () => void {
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (e: MessageEvent<SessionSyncEvent>) => {
        if (e.data && typeof e.data.type === 'string') {
          handler(e.data);
        }
      };
    }
  } catch {
    channel = null;
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_FALLBACK_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as SessionSyncEvent;
      if (parsed && typeof parsed.type === 'string') {
        handler(parsed);
      }
    } catch {
      // Ignore malformed storage payload
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('storage', onStorage);
    try {
      channel?.close();
    } catch {
      // Ignore close error
    }
  };
}
