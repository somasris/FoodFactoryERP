import { apiClient } from './api-client';
import {
  ConflictCategory,
  OfflineEntityType,
  OfflineOperationStatus,
  OfflineOperationType,
} from '../offline/types';

export interface PushOperationDto {
  operationId: string;
  idempotencyKey: string;
  entityType: OfflineEntityType;
  entityId: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  factoryId?: string | null;
  warehouseId?: string | null;
  clientCreatedAt: string;
  clientUpdatedAt: string;
  baseServerVersion?: string | null;
  localSequence: number;
  dependencyOperationIds?: string[];
}

export interface PushOperationResultDto {
  operationId: string;
  idempotencyKey: string;
  status: OfflineOperationStatus;
  duplicate?: boolean;
  serverEntityId?: string | null;
  serverVersion?: string | null;
  conflictCategory?: ConflictCategory;
  serverSnapshot?: Record<string, unknown> | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface PullResponseDto {
  nextCursor: string;
  hasMore: boolean;
  changes: Record<string, Array<Record<string, unknown>>>;
  serverTimestamp: string;
}

export interface SyncStatusDto {
  userId: string;
  username: string;
  roles: string[];
  permissionsCount: number;
  syncedCount: number;
  failedCount: number;
  unresolvedConflicts: number;
  serverTimestamp: string;
}

export const syncApiService = {
  async getStatus(): Promise<SyncStatusDto> {
    const res = await apiClient<SyncStatusDto>('/sync/status', { method: 'GET' });
    return res.data as SyncStatusDto;
  },

  async pushBatch(operations: PushOperationDto[]): Promise<{
    results: PushOperationResultDto[];
    serverTimestamp: string;
  }> {
    const res = await apiClient<{
      results: PushOperationResultDto[];
      serverTimestamp: string;
    }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
    return res.data!;
  },

  async pullChanges(params: {
    cursor?: string | null;
    limit?: number;
    entityTypes?: string[];
  }): Promise<PullResponseDto> {
    const res = await apiClient<PullResponseDto>('/sync/pull', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data!;
  },

  async resolveConflict(
    conflictId: string,
    action: 'RETRY_AFTER_REFRESH' | 'REAPPLY' | 'DISCARD' | 'REVIEW_REQUESTED',
  ): Promise<void> {
    await apiClient(`/sync/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },
};
