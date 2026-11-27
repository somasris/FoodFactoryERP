import {
  CachedEntityRecord,
  FoodFactoryOfflineDB,
  offlineDb,
  OfflineMetadataRecord,
  PendingOperationRecord,
  SyncAttemptRecord,
  SyncConflictRecord,
  UserOfflinePreferenceRecord,
} from './db';
import { OfflineEntityType, OfflineOperationStatus, OfflineQueueCounts } from './types';
import { UserProfile } from '../services/auth.service';

const FORBIDDEN_SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'secret',
  'jwt',
]);

// Default 24-hour offline session window for previously authenticated users
export const DEFAULT_OFFLINE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Default 7-day cache TTL for read-only master data
export const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sanitizeForOfflineStorage<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForOfflineStorage(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      continue;
    }
    result[key] = sanitizeForOfflineStorage(val);
  }
  return result as T;
}

const queueListeners = new Set<() => void>();

export function subscribeOfflineQueueChanges(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

export function notifyOfflineQueueChanged(): void {
  for (const listener of queueListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

export class OfflineRepository {
  constructor(private readonly db: FoodFactoryOfflineDB = offlineDb) {}

  async saveCachedEntity(params: {
    userId: string;
    entityType: string;
    localRecordId: string;
    serverRecordId?: string | null;
    operationType?: string;
    serverRevision?: string | null;
    factoryId?: string | null;
    warehouseId?: string | null;
    data: unknown;
    ttlMs?: number;
  }): Promise<CachedEntityRecord> {
    if (!params.userId) {
      throw new Error('userId is required for offline cache partitioning');
    }
    const now = new Date().toISOString();
    const id = `${params.userId}:${params.entityType}:${params.localRecordId}`;
    const existing = await this.db.cachedEntities.get(id);

    const record: CachedEntityRecord = {
      id,
      localRecordId: params.localRecordId,
      serverRecordId: params.serverRecordId ?? existing?.serverRecordId ?? params.localRecordId,
      entityType: params.entityType,
      operationType: params.operationType ?? 'CACHE_READ',
      localRevision: (existing?.localRevision ?? 0) + 1,
      serverRevision: params.serverRevision ?? existing?.serverRevision ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      userId: params.userId,
      factoryId: params.factoryId ?? null,
      warehouseId: params.warehouseId ?? null,
      data: sanitizeForOfflineStorage(params.data),
      expiresAt: new Date(Date.now() + (params.ttlMs ?? DEFAULT_CACHE_TTL_MS)).toISOString(),
    };

    await this.db.cachedEntities.put(record);
    return record;
  }

  async getCachedEntity(
    userId: string,
    entityType: string,
    localRecordId: string,
  ): Promise<CachedEntityRecord | undefined> {
    if (!userId) return undefined;
    const id = `${userId}:${entityType}:${localRecordId}`;
    return this.db.cachedEntities.get(id);
  }

  async listCachedEntities(userId: string, entityType: string): Promise<CachedEntityRecord[]> {
    if (!userId) return [];
    return this.db.cachedEntities.where('[userId+entityType]').equals([userId, entityType]).toArray();
  }

  async saveUserSessionSnapshot(
    user: UserProfile,
    ttlMs = DEFAULT_OFFLINE_SESSION_TTL_MS,
  ): Promise<UserOfflinePreferenceRecord> {
    const now = new Date().toISOString();
    const existing = await this.db.userOfflinePreferences.get(user.id);
    const record: UserOfflinePreferenceRecord = {
      userId: user.id,
      userProfileSnapshot: sanitizeForOfflineStorage(user),
      offlineSessionExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
      lastActiveAt: now,
      autoSyncEnabled: existing?.autoSyncEnabled ?? true,
      updatedAt: now,
    };
    await this.db.userOfflinePreferences.put(record);
    return record;
  }

  async getValidUserSessionSnapshot(userId: string): Promise<UserOfflinePreferenceRecord | null> {
    const record = await this.db.userOfflinePreferences.get(userId);
    if (!record) return null;
    if (new Date(record.offlineSessionExpiresAt).getTime() <= Date.now()) {
      return null;
    }
    return record;
  }

  async getLastActiveUserSnapshot(): Promise<UserOfflinePreferenceRecord | null> {
    const all = await this.db.userOfflinePreferences.toArray();
    const valid = all
      .filter(r => new Date(r.offlineSessionExpiresAt).getTime() > Date.now())
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    return valid[0] ?? null;
  }

  async setMetadata(userId: string, name: string, value: unknown): Promise<void> {
    const key = `${userId}:${name}`;
    const record: OfflineMetadataRecord = {
      key,
      userId,
      value: sanitizeForOfflineStorage(value),
      updatedAt: new Date().toISOString(),
    };
    await this.db.offlineMetadata.put(record);
  }

  async getMetadata<T = unknown>(userId: string, name: string): Promise<T | undefined> {
    const rec = await this.db.offlineMetadata.get(`${userId}:${name}`);
    return rec?.value as T | undefined;
  }

  async getNextSequence(userId: string): Promise<number> {
    return this.db.transaction('rw', this.db.offlineMetadata, async () => {
      const current = (await this.getMetadata<number>(userId, 'localSequence')) ?? 0;
      const next = current + 1;
      await this.setMetadata(userId, 'localSequence', next);
      return next;
    });
  }

  async putPendingOperation(op: PendingOperationRecord): Promise<void> {
    const sanitized: PendingOperationRecord = {
      ...op,
      payload: sanitizeForOfflineStorage(op.payload),
    };
    await this.db.pendingOperations.put(sanitized);
    notifyOfflineQueueChanged();
  }

  async getPendingOperation(
    userId: string,
    operationId: string,
  ): Promise<PendingOperationRecord | undefined> {
    const op = await this.db.pendingOperations.get(operationId);
    if (!op || op.userId !== userId) return undefined;
    return op;
  }

  async listOperationsByUser(
    userId: string,
    status?: OfflineOperationStatus,
  ): Promise<PendingOperationRecord[]> {
    if (!userId) return [];
    if (status) {
      return this.db.pendingOperations
        .where('[userId+status]')
        .equals([userId, status])
        .sortBy('localSequence');
    }
    return this.db.pendingOperations.where('userId').equals(userId).sortBy('localSequence');
  }

  async listOperationsByEntityId(
    userId: string,
    entityType: OfflineEntityType,
    entityId: string,
  ): Promise<PendingOperationRecord[]> {
    if (!userId || !entityId) return [];
    const ops = await this.listOperationsByUser(userId);
    return ops.filter(
      op =>
        op.entityType === entityType &&
        op.status !== 'CANCELLED' &&
        (op.entityId === entityId || op.serverResultEntityId === entityId),
    );
  }

  async findOperationByEntityId(
    userId: string,
    entityType: OfflineEntityType,
    entityId: string,
  ): Promise<PendingOperationRecord | undefined> {
    const matches = await this.listOperationsByEntityId(userId, entityType, entityId);
    if (matches.length === 0) return undefined;
    return matches[matches.length - 1];
  }

  async getLocalSalesOrderState(
    userId: string,
    entityId: string,
  ): Promise<{
    createOp: PendingOperationRecord | null;
    latestOp: PendingOperationRecord | null;
    mergedPayload: Record<string, unknown> | null;
    resolvedServerId: string | null;
  }> {
    const matches = await this.listOperationsByEntityId(userId, 'SALES_ORDER', entityId);
    const mappedServerId =
      (await this.getMetadata<string>(userId, `localToServerId:${entityId}`)) ?? null;

    if (matches.length === 0) {
      return {
        createOp: null,
        latestOp: null,
        mergedPayload: null,
        resolvedServerId: mappedServerId,
      };
    }

    const createOp = matches.find(m => m.operationType === 'SALES_ORDER_DRAFT_CREATE') ?? null;
    const latestOp = matches[matches.length - 1] ?? null;

    let mergedPayload: Record<string, unknown> | null = null;
    for (const op of matches) {
      if (
        op.operationType === 'SALES_ORDER_DRAFT_CREATE' ||
        op.operationType === 'SALES_ORDER_DRAFT_UPDATE'
      ) {
        mergedPayload = { ...(mergedPayload ?? {}), ...op.payload };
      }
    }

    const serverIdFromOps =
      matches.find(m => m.status === 'SYNCED' && m.serverResultEntityId)?.serverResultEntityId ??
      mappedServerId;

    return {
      createOp,
      latestOp,
      mergedPayload,
      resolvedServerId: serverIdFromOps && serverIdFromOps !== entityId ? serverIdFromOps : null,
    };
  }

  async getQueueCounts(userId: string): Promise<OfflineQueueCounts> {
    const ops = await this.listOperationsByUser(userId);
    const counts: OfflineQueueCounts = {
      pending: 0,
      processing: 0,
      failed: 0,
      conflict: 0,
      synced: 0,
    };
    for (const op of ops) {
      if (op.status === 'PENDING') counts.pending++;
      else if (op.status === 'PROCESSING') counts.processing++;
      else if (op.status === 'FAILED') counts.failed++;
      else if (op.status === 'CONFLICT') counts.conflict++;
      else if (op.status === 'SYNCED') counts.synced++;
    }
    return counts;
  }

  async recordSyncAttempt(attempt: SyncAttemptRecord): Promise<void> {
    await this.db.syncAttempts.put(attempt);
  }

  async saveConflict(conflict: SyncConflictRecord): Promise<void> {
    await this.db.syncConflicts.put({
      ...conflict,
      localPayload: sanitizeForOfflineStorage(conflict.localPayload),
      serverSnapshot: conflict.serverSnapshot
        ? sanitizeForOfflineStorage(conflict.serverSnapshot)
        : null,
    });
    notifyOfflineQueueChanged();
  }

  async listConflicts(userId: string, unresolvedOnly = true): Promise<SyncConflictRecord[]> {
    const rows = await this.db.syncConflicts.where('userId').equals(userId).toArray();
    return unresolvedOnly ? rows.filter(r => !r.resolvedAt) : rows;
  }

  /**
   * Prunes expired read-only cached entities while strictly preserving pending operations and conflicts.
   */
  async pruneExpiredCache(userId: string): Promise<number> {
    const nowIso = new Date().toISOString();
    const expired = await this.db.cachedEntities
      .where('userId')
      .equals(userId)
      .filter(rec => !!rec.expiresAt && rec.expiresAt < nowIso)
      .primaryKeys();
    if (expired.length > 0) {
      await this.db.cachedEntities.bulkDelete(expired);
    }
    return expired.length;
  }

  /**
   * Clears cached data and session snapshot on logout so no sensitive ERP data remains exposed.
   * Pending operations remain partitioned by userId unless clearQueue is explicitly true.
   */
  async clearUserDataOnLogout(userId: string, clearQueue = false): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.cachedEntities,
        this.db.userOfflinePreferences,
        this.db.offlineMetadata,
        this.db.pendingOperations,
        this.db.syncConflicts,
        this.db.syncAttempts,
      ],
      async () => {
        await this.db.cachedEntities.where('userId').equals(userId).delete();
        await this.db.userOfflinePreferences.where('userId').equals(userId).delete();
        await this.db.offlineMetadata.where('userId').equals(userId).delete();
        if (clearQueue) {
          await this.db.pendingOperations.where('userId').equals(userId).delete();
          await this.db.syncConflicts.where('userId').equals(userId).delete();
          await this.db.syncAttempts.where('userId').equals(userId).delete();
        }
      },
    );
  }
}

export const offlineRepo = new OfflineRepository();
