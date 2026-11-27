import Dexie, { Table } from 'dexie';
import {
  ConflictCategory,
  OfflineEntityType,
  OfflineOperationStatus,
  OfflineOperationType,
} from './types';
import { UserProfile } from '../services/auth.service';

export interface CachedEntityRecord {
  id: string; // `${userId}:${entityType}:${localRecordId}`
  localRecordId: string;
  serverRecordId: string | null;
  entityType: string;
  operationType: string;
  localRevision: number;
  serverRevision: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: OfflineOperationStatus;
  userId: string;
  factoryId: string | null;
  warehouseId: string | null;
  data: unknown;
  expiresAt: string | null;
}

export interface PendingOperationRecord {
  operationId: string;
  idempotencyKey: string;
  entityType: OfflineEntityType;
  entityId: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  userId: string;
  factoryId: string | null;
  warehouseId: string | null;
  clientCreatedAt: string;
  clientUpdatedAt: string;
  baseServerVersion: string | null;
  localSequence: number;
  dependencyOperationIds: string[];
  status: OfflineOperationStatus;
  retryCount: number;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  serverResultEntityId: string | null;
}

export interface SyncAttemptRecord {
  attemptId: string;
  operationId: string;
  userId: string;
  attemptedAt: string;
  outcome: 'SUCCESS' | 'TRANSIENT_ERROR' | 'PERMANENT_ERROR' | 'CONFLICT';
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SyncConflictRecord {
  conflictId: string;
  serverConflictId?: string | null;
  operationId: string;
  userId: string;
  entityType: OfflineEntityType;
  entityId: string;
  operationType: OfflineOperationType;
  conflictCategory: ConflictCategory;
  localPayload: Record<string, unknown>;
  serverSnapshot: Record<string, unknown> | null;
  reason: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolutionAction: 'RETRY_AFTER_REFRESH' | 'REAPPLY' | 'DISCARD' | 'REVIEW_REQUESTED' | null;
}

export interface UserOfflinePreferenceRecord {
  userId: string;
  userProfileSnapshot: UserProfile;
  offlineSessionExpiresAt: string;
  lastActiveAt: string;
  autoSyncEnabled: boolean;
  updatedAt: string;
}

export interface OfflineMetadataRecord {
  key: string; // `${userId}:${name}`
  userId: string;
  value: unknown;
  updatedAt: string;
}

export class FoodFactoryOfflineDB extends Dexie {
  cachedEntities!: Table<CachedEntityRecord, string>;
  pendingOperations!: Table<PendingOperationRecord, string>;
  syncAttempts!: Table<SyncAttemptRecord, string>;
  syncConflicts!: Table<SyncConflictRecord, string>;
  userOfflinePreferences!: Table<UserOfflinePreferenceRecord, string>;
  offlineMetadata!: Table<OfflineMetadataRecord, string>;

  constructor(dbName = 'FoodFactoryOfflineDB') {
    super(dbName);
    this.version(1).stores({
      cachedEntities:
        'id, userId, [userId+entityType], [userId+entityType+serverRecordId], factoryId, warehouseId, updatedAt, expiresAt',
      pendingOperations:
        'operationId, idempotencyKey, userId, [userId+status], [userId+localSequence], entityType, entityId, operationType, clientCreatedAt',
      syncAttempts: 'attemptId, userId, operationId, attemptedAt',
      syncConflicts: 'conflictId, userId, operationId, entityType, detectedAt, resolvedAt',
      userOfflinePreferences: 'userId, offlineSessionExpiresAt, updatedAt',
      offlineMetadata: 'key, userId, updatedAt',
    });
  }
}

export const offlineDb = new FoodFactoryOfflineDB();
