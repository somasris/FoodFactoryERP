import { offlineRepo, isQuotaExceededError } from './offline-repository';
import { ApiError } from '../services/api-client';

export interface OfflineCachedResult<T> {
  data: T;
  isOfflineCached: boolean;
  cachedAt: string;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (err instanceof TypeError) return true; // fetch network failure
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
      // Fall through to offline cache on network failure
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
