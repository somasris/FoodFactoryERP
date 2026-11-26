export interface PwaRegistrationHandlers {
  onNeedRefresh: (updateFn: (reloadPage?: boolean) => Promise<void>) => void;
  onOfflineReady?: () => void;
}

/**
 * Safely registers the VitePWA service worker in browser environments.
 * Skips registration in non-browser/test environments or when serviceWorker is unsupported.
 */
export async function registerPwaServiceWorker(
  handlers: PwaRegistrationHandlers,
): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  if (import.meta.env.MODE === 'test') {
    return;
  }

  try {
    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        handlers.onNeedRefresh(updateSW);
      },
      onOfflineReady() {
        handlers.onOfflineReady?.();
      },
    });
  } catch {
    // Graceful no-op when SW virtual module is unavailable (e.g. dev mode with SW disabled)
  }
}
