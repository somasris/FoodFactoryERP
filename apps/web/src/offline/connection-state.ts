import { config } from '../config/env';

export interface HealthProbeResult {
  reachable: boolean;
  checkedAt: string;
  latencyMs: number;
}

const HEALTH_TIMEOUT_MS = 4000;

/**
 * Probes the backend /health endpoint with an explicit timeout.
 * navigator.onLine alone is never treated as proof that the ERP API is reachable.
 */
export async function probeApiServer(signal?: AbortSignal): Promise<HealthProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: controller.signal,
    });

    return {
      reachable: response.ok,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      reachable: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getNextBackoffMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 30_000;
  const base = 5_000 * Math.pow(2, Math.min(consecutiveFailures - 1, 4));
  const jitter = Math.floor(Math.random() * 1_000);
  return Math.min(base + jitter, 60_000);
}
