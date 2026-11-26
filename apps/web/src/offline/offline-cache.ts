import { offlineRepo, isQuotaExceededError } from './offline-repository';
import { apiClient, ApiError } from '../services/api-client';
import { ApiResponse } from '../types/api';

let activeOfflineUserId: string | null = null;

export function setActiveOfflineUserId(userId: string | null): void {
  activeOfflineUserId = userId;
}

export function getActiveOfflineUserId(): string | null {
  return activeOfflineUserId;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|offline|aborted/i.test(err.message)) return true;
  return false;
}

/**
 * Fetches live data when online and persists a user-partitioned snapshot in IndexedDB.
 * Falls back to the last synchronized snapshot when offline or on network failure.
 */
export async function fetchWithOfflineCache<T>(params: {
  userId: string | undefined;
  entityType: string;
  cacheKey: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
}): Promise<T> {
  const { userId, entityType, cacheKey, fetcher, ttlMs } = params;
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (isOnline) {
    try {
      const liveData = await fetcher();
      if (userId) {
        offlineRepo
          .saveCachedEntity({
            userId,
            entityType,
            localRecordId: cacheKey,
            data: liveData,
            ttlMs,
          })
          .catch(err => {
            if (isQuotaExceededError(err)) {
              void offlineRepo.pruneExpiredCache(userId);
            }
          });
      }
      return liveData;
    } catch (err) {
      if (!isNetworkFailure(err) || !userId) {
        throw err;
      }
    }
  }

  if (userId) {
    const cached = await offlineRepo.getCachedEntity(userId, entityType, cacheKey);
    if (cached && cached.data !== undefined) {
      return cached.data as T;
    }
  }

  throw new ApiError(
    'You are offline and this data has not been cached on this device yet.',
    503,
  );
}

/**
 * Cached GET helper for read-only ERP endpoints (never used for auth/admin/compliance).
 */
export function cachedApiGet<T>(
  entityType: string,
  endpoint: string,
  ttlMs?: number,
): Promise<ApiResponse<T>> {
  return fetchWithOfflineCache<ApiResponse<T>>({
    userId: activeOfflineUserId ?? undefined,
    entityType,
    cacheKey: endpoint,
    fetcher: () => apiClient<T>(endpoint),
    ttlMs,
  });
}
