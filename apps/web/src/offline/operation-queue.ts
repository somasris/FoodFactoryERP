import { FoodFactoryOfflineDB, offlineDb, PendingOperationRecord } from './db';
import { isQuotaExceededError, OfflineRepository, offlineRepo } from './offline-repository';
import { OfflineEntityType, OfflineOperationType } from './types';

export const MAX_TRANSIENT_RETRIES = 5;

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function computeRetryDelayMs(retryCount: number): number {
  const base = 2_000 * Math.pow(2, Math.min(retryCount, 6));
  const jitter = Math.floor(Math.random() * 1_000);
  return Math.min(base + jitter, 300_000);
}

export interface EnqueueOperationParams {
  userId: string;
  entityType: OfflineEntityType;
  entityId?: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  factoryId?: string | null;
  warehouseId?: string | null;
  baseServerVersion?: string | null;
  dependencyOperationIds?: string[];
}

export class OfflineOperationQueue {
  constructor(
    private readonly db: FoodFactoryOfflineDB = offlineDb,
    private readonly repo: OfflineRepository = offlineRepo,
  ) {}

  /**
   * Durably persists a new operation in IndexedDB before returning.
   * Prevents duplicate entries when the same idempotencyKey is already queued.
   */
  async enqueue(params: EnqueueOperationParams): Promise<PendingOperationRecord> {
    if (!params.userId) {
      throw new Error('Cannot queue offline operation without an authenticated userId.');
    }

    const idempotencyKey = params.idempotencyKey ?? generateUuid();
    const existingByKey = await this.db.pendingOperations
      .where('idempotencyKey')
      .equals(idempotencyKey)
      .filter(op => op.userId === params.userId && op.status !== 'CANCELLED')
      .first();

    if (existingByKey) {
      return existingByKey;
    }

    const now = new Date().toISOString();

    // Coalesce offline draft updates into an existing still-PENDING local draft creation
    if (params.entityId && params.operationType === 'SALES_ORDER_DRAFT_UPDATE') {
      const existingOps = await this.repo.listOperationsByEntityId(
        params.userId,
        params.entityType,
        params.entityId,
      );
      const pendingCreate = existingOps.find(
        op => op.operationType === 'SALES_ORDER_DRAFT_CREATE' && op.status === 'PENDING',
      );
      if (pendingCreate) {
        const coalesced: PendingOperationRecord = {
          ...pendingCreate,
          payload: { ...pendingCreate.payload, ...params.payload },
          clientUpdatedAt: now,
        };
        try {
          await this.repo.putPendingOperation(coalesced);
        } catch (err) {
          if (isQuotaExceededError(err)) {
            throw new Error(
              'Local browser storage quota exceeded. Free up space before saving offline.',
            );
          }
          throw err;
        }
        return coalesced;
      }
    }

    // Automatically chain dependencies on prior unresolved operations for the same entity
    const depIds = new Set<string>(params.dependencyOperationIds ?? []);
    if (params.entityId) {
      const priorOps = await this.repo.listOperationsByEntityId(
        params.userId,
        params.entityType,
        params.entityId,
      );
      for (const prior of priorOps) {
        if (prior.status !== 'SYNCED' && prior.status !== 'CANCELLED') {
          depIds.add(prior.operationId);
        }
      }
    }

    const operationId = generateUuid();
    const localSequence = await this.repo.getNextSequence(params.userId);

    const record: PendingOperationRecord = {
      operationId,
      idempotencyKey,
      entityType: params.entityType,
      entityId: params.entityId ?? operationId,
      operationType: params.operationType,
      payload: params.payload,
      userId: params.userId,
      factoryId: params.factoryId ?? null,
      warehouseId: params.warehouseId ?? null,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      baseServerVersion: params.baseServerVersion ?? null,
      localSequence,
      dependencyOperationIds: Array.from(depIds),
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: null,
      lastAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      serverResultEntityId: null,
    };

    try {
      await this.repo.putPendingOperation(record);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        throw new Error(
          'Local browser storage quota exceeded. Free up space before saving offline.',
        );
      }
      throw err;
    }
    return record;
  }

  /**
   * Returns PENDING operations whose dependencies are satisfied and whose backoff window has elapsed.
   */
  async getReadyBatch(userId: string, maxBatchSize = 20): Promise<PendingOperationRecord[]> {
    const allOps = await this.repo.listOperationsByUser(userId);
    const syncedIds = new Set(allOps.filter(o => o.status === 'SYNCED').map(o => o.operationId));
    const nowMs = Date.now();

    const ready: PendingOperationRecord[] = [];
    for (const op of allOps) {
      if (op.status !== 'PENDING') continue;
      if (op.nextRetryAt && new Date(op.nextRetryAt).getTime() > nowMs) continue;

      const depsSatisfied = op.dependencyOperationIds.every(depId => syncedIds.has(depId));
      if (!depsSatisfied) continue;

      ready.push(op);
      if (ready.length >= maxBatchSize) break;
    }
    return ready;
  }

  async cancelOperation(userId: string, operationId: string): Promise<boolean> {
    const op = await this.repo.getPendingOperation(userId, operationId);
    if (!op) return false;
    if (op.status !== 'PENDING' && op.status !== 'FAILED') {
      return false;
    }
    await this.repo.putPendingOperation({
      ...op,
      status: 'CANCELLED',
      clientUpdatedAt: new Date().toISOString(),
    });
    return true;
  }

  async retryFailedOperation(userId: string, operationId: string): Promise<boolean> {
    const op = await this.repo.getPendingOperation(userId, operationId);
    if (!op || (op.status !== 'FAILED' && op.status !== 'CONFLICT')) {
      return false;
    }
    await this.repo.putPendingOperation({
      ...op,
      status: 'PENDING',
      nextRetryAt: null,
      clientUpdatedAt: new Date().toISOString(),
    });
    return true;
  }
}

export const offlineQueue = new OfflineOperationQueue();
