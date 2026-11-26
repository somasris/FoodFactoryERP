import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OfflineProvider, useOffline } from '../context/OfflineContext';
import { OfflineStatusBadge } from '../components/layout/OfflineStatusBadge';
import { probeApiServer, getNextBackoffMs } from '../offline/connection-state';

const StateTester: React.FC = () => {
  const { connectivityState, setSyncingState, setQueueCounts } = useOffline();
  return (
    <div>
      <span data-testid="state">{connectivityState}</span>
      <button onClick={() => setSyncingState(true, false)}>StartSync</button>
      <button onClick={() => setSyncingState(false, true)}>FailSync</button>
      <button
        onClick={() =>
          setQueueCounts({ pending: 3, processing: 0, failed: 1, conflict: 1, synced: 0 })
        }
      >
        SetCounts
      </button>
      <OfflineStatusBadge />
    </div>
  );
};

describe('Sprint 1: PWA Foundation & Offline State Manager', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('probeApiServer returns reachable=true on 200 OK and false on network failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
    const okResult = await probeApiServer();
    expect(okResult.reachable).toBe(true);

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network down'));
    const failResult = await probeApiServer();
    expect(failResult.reachable).toBe(false);
  });

  it('getNextBackoffMs applies exponential backoff with cap', () => {
    expect(getNextBackoffMs(0)).toBe(30_000);
    const first = getNextBackoffMs(1);
    expect(first).toBeGreaterThanOrEqual(5_000);
    expect(first).toBeLessThanOrEqual(6_000);
    expect(getNextBackoffMs(10)).toBeLessThanOrEqual(60_000);
  });

  it('OfflineStatusBadge renders Online, Syncing, Sync Failed, and attention count', () => {
    render(
      <MemoryRouter>
        <OfflineProvider>
          <StateTester />
        </OfflineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('state').textContent).toBe('ONLINE');
    expect(screen.getByTestId('offline-status-badge').textContent).toContain('Online');

    act(() => {
      screen.getByText('StartSync').click();
    });
    expect(screen.getByTestId('state').textContent).toBe('SYNCING');
    expect(screen.getByTestId('offline-status-badge').textContent).toContain('Syncing');

    act(() => {
      screen.getByText('FailSync').click();
      screen.getByText('SetCounts').click();
    });
    expect(screen.getByTestId('state').textContent).toBe('SYNC_ERROR');
    expect(screen.getByTestId('offline-status-badge').textContent).toContain('Sync Failed');
    // 3 pending + 1 failed + 1 conflict = 5
    expect(screen.getByTestId('offline-status-badge').textContent).toContain('5');
  });
});
