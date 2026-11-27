import { ApiError } from '../services/api-client';
import { ApiResponse } from '../types/api';
import { getActiveOfflineUserId } from './offline-cache';
import { offlineQueue } from './operation-queue';
import { OfflineEntityType, OfflineOperationType } from './types';

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.statusCode >= 502 && err.statusCode <= 504;
  }
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|offline|aborted/i.test(err.message)) return true;
  return false;
}

export async function executeOrQueueOffline<T>(params: {
  entityType: OfflineEntityType;
  entityId?: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  warehouseId?: string | null;
  baseServerVersion?: string | null;
  onlineCall: () => Promise<ApiResponse<T>>;
  buildOptimisticData?: (operationId: string) => T;
}): Promise<ApiResponse<T>> {
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  const userId = getActiveOfflineUserId();

  if (isOnline) {
    try {
      return await params.onlineCall();
    } catch (err) {
      if (!isNetworkFailure(err) || !userId) {
        throw err;
      }
    }
  }

  if (!userId) {
    throw new ApiError('Authentication required to queue offline operations.', 401);
  }

  const queuedOp = await offlineQueue.enqueue({
    userId,
    entityType: params.entityType,
    entityId: params.entityId,
    operationType: params.operationType,
    payload: params.payload,
    warehouseId:
      params.warehouseId ??
      (typeof params.payload.warehouseId === 'string' ? params.payload.warehouseId : null),
    baseServerVersion: params.baseServerVersion ?? null,
  });

  const optimistic = params.buildOptimisticData
    ? params.buildOptimisticData(queuedOp.operationId)
    : ({
        id: queuedOp.entityId,
        ...params.payload,
        status: 'DRAFT',
        isOfflineQueued: true,
        operationId: queuedOp.operationId,
      } as unknown as T);

  return {
    success: true,
    message: 'Saved on this device. It will sync automatically when the connection is restored.',
    data: optimistic,
    timestamp: queuedOp.clientCreatedAt,
  };
}
