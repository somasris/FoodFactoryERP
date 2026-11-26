import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWithOfflineCache, setActiveOfflineUserId } from '../offline/offline-cache';
import { offlineRepo } from '../offline/offline-repository';

describe('Sprint 4: Read-Only Offline Cache', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setActiveOfflineUserId('cache-user-1');
    await offlineRepo.clearUserDataOnLogout('cache-user-1', true);
  });

  it('caches live responses when online and serves last synchronized data when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    const fetcher = vi.fn().mockResolvedValue({ items: [{ id: 'p1', name: 'Mango Pulp' }] });

    const live = await fetchWithOfflineCache({
      userId: 'cache-user-1',
      entityType: 'MASTER_PRODUCTS',
      cacheKey: '/master-data/products',
      fetcher,
    });
    expect(live).toEqual({ items: [{ id: 'p1', name: 'Mango Pulp' }] });

    // Wait a tick for async IndexedDB cache write
    await new Promise(r => setTimeout(r, 20));

    // Simulate offline
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    const offlineFetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const cached = await fetchWithOfflineCache({
      userId: 'cache-user-1',
      entityType: 'MASTER_PRODUCTS',
      cacheKey: '/master-data/products',
      fetcher: offlineFetcher,
    });
    expect(cached).toEqual({ items: [{ id: 'p1', name: 'Mango Pulp' }] });
    expect(offlineFetcher).not.toHaveBeenCalled();

    // Restore online
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('throws 503 ApiError when offline and data was never cached', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    await expect(
      fetchWithOfflineCache({
        userId: 'cache-user-1',
        entityType: 'MASTER_PRODUCTS',
        cacheKey: '/master-data/never-cached',
        fetcher: vi.fn(),
      }),
    ).rejects.toMatchObject({ statusCode: 503 });

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });
});
