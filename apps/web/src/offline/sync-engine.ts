import { PendingOperationRecord } from './db';
import { offlineRepo, OfflineRepository, isQuotaExceededError } from './offline-repository';
import {
  computeRetryDelayMs,
  generateUuid,
  MAX_TRANSIENT_RETRIES,
  offlineQueue,
  OfflineOperationQueue,
} from './operation-queue';
import { withSyncLock } from './sync-lock';
import { probeApiServer } from './connection-state';
import { syncApiService } from '../services/sync.service';
import { ApiError } from '../services/api-client';
import { ConflictCategory } from './types';

export interface SyncRunSummary {
  ran: boolean;
  skippedReason?: string;
  pushedCount: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  pulledCount: number;
  lastSuccessfulSyncAt: string | null;
}

export class SyncEngine {
  constructor(
    private readonly repo: OfflineRepository = offlineRepo,
    private readonly queue: OfflineOperationQueue = offlineQueue,
  ) {}

  async runSync(userId: string): Promise<SyncRunSummary> {
    const summary: SyncRunSummary = {
      ran: false,
      pushedCount: 0,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      pulledCount: 0,
      lastSuccessfulSyncAt: null,
    };

    if (!userId) {
      summary.skippedReason = 'UNAUTHENTICATED';
      return summary;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      summary.skippedReason = 'OFFLINE';
      return summary;
    }

    const probe = await probeApiServer();
    if (!probe.reachable) {
      summary.skippedReason = 'SERVER_UNAVAILABLE';
      return summary;
    }

    const lockResult = await withSyncLock(userId, async () => {
      summary.ran = true;

      // 1. Push pending operations in dependency order across bounded batches
      let batches = 0;
      const MAX_BATCHES_PER_RUN = 10;
      while (batches < MAX_BATCHES_PER_RUN) {
        const batch = await this.queue.getReadyBatch(userId, 20);
        if (batch.length === 0) break;

        const batchOutcome = await this.pushBatch(userId, batch, summary);
        batches++;

        if (batchOutcome === 'SESSION_EXPIRED') {
          summary.skippedReason = 'SESSION_EXPIRED';
          return;
        }
        if (batchOutcome === 'TRANSIENT_ABORT') {
          return;
        }
      }

      // 2. Pull incremental server changes
      try {
        await this.pullIncremental(userId, summary);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          summary.skippedReason = 'SESSION_EXPIRED';
          return;
        }
        throw err;
      }

      if (summary.failedCount === 0 && summary.conflictCount === 0) {
        const nowIso = new Date().toISOString();
        await this.repo.setMetadata(userId, 'lastSuccessfulSyncAt', nowIso);
        summary.lastSuccessfulSyncAt = nowIso;
      }

      if (
        typeof window !== 'undefined' &&
        (summary.syncedCount > 0 || summary.pulledCount > 0)
      ) {
        window.dispatchEvent(new CustomEvent('ff:offline-sync-completed', { detail: summary }));
      }
    });

    if (!lockResult.acquired) {
      summary.skippedReason = 'LOCK_HELD_BY_OTHER_TAB';
    }

    return summary;
  }

  private async pushBatch(
    userId: string,
    batch: PendingOperationRecord[],
    summary: SyncRunSummary,
  ): Promise<'OK' | 'SESSION_EXPIRED' | 'TRANSIENT_ABORT'> {
    const nowIso = new Date().toISOString();
    for (const op of batch) {
      await this.repo.putPendingOperation({
        ...op,
        status: 'PROCESSING',
        lastAttemptAt: nowIso,
      });
    }

    try {
      const response = await syncApiService.pushBatch(
        batch.map(op => ({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityId: op.entityId,
          operationType: op.operationType,
          payload: op.payload,
          factoryId: op.factoryId,
          warehouseId: op.warehouseId,
          clientCreatedAt: op.clientCreatedAt,
          clientUpdatedAt: op.clientUpdatedAt,
          baseServerVersion: op.baseServerVersion,
          localSequence: op.localSequence,
          dependencyOperationIds: op.dependencyOperationIds,
        })),
      );

      summary.pushedCount += batch.length;
      const opById = new Map(batch.map(o => [o.operationId, o]));

      for (const res of response.results) {
        const op = opById.get(res.operationId);
        if (!op) continue;

        if (res.status === 'SYNCED') {
          await this.repo.putPendingOperation({
            ...op,
            status: 'SYNCED',
            serverResultEntityId: res.serverEntityId ?? op.serverResultEntityId,
            lastErrorCode: null,
            lastErrorMessage: null,
          });
          if (res.serverEntityId && res.serverEntityId !== op.entityId) {
            await this.repo.setMetadata(
              userId,
              `localToServerId:${op.entityId}`,
              res.serverEntityId,
            );
            const remainingOps = await this.repo.listOperationsByEntityId(
              userId,
              op.entityType,
              op.entityId,
            );
            for (const depOp of remainingOps) {
              if (depOp.operationId !== op.operationId && depOp.status === 'PENDING') {
                await this.repo.putPendingOperation({
                  ...depOp,
                  entityId: res.serverEntityId,
                  baseServerVersion:
                    depOp.baseServerVersion ?? res.serverVersion ?? null,
                });
              }
            }
          }
          await this.repo.recordSyncAttempt({
            attemptId: generateUuid(),
            operationId: op.operationId,
            userId,
            attemptedAt: nowIso,
            outcome: 'SUCCESS',
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
          });
          summary.syncedCount++;
        } else if (res.status === 'CONFLICT') {
          const category: ConflictCategory = res.conflictCategory ?? 'RECORD_MODIFIED';
          await this.repo.putPendingOperation({
            ...op,
            status: 'CONFLICT',
            lastErrorCode: res.errorCode ?? category,
            lastErrorMessage: res.errorMessage ?? 'Conflict detected during synchronization.',
          });
          await this.repo.saveConflict({
            conflictId: generateUuid(),
            serverConflictId: res.serverConflictId ?? null,
            operationId: op.operationId,
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            operationType: op.operationType,
            conflictCategory: category,
            localPayload: op.payload,
            serverSnapshot: res.serverSnapshot ?? null,
            reason: res.errorMessage ?? 'Conflict detected on server.',
            detectedAt: nowIso,
            resolvedAt: null,
            resolutionAction: null,
          });
          await this.repo.recordSyncAttempt({
            attemptId: generateUuid(),
            operationId: op.operationId,
            userId,
            attemptedAt: nowIso,
            outcome: 'CONFLICT',
            httpStatus: 409,
            errorCode: category,
            errorMessage: res.errorMessage ?? null,
          });
          summary.conflictCount++;
        } else {
          // Permanent validation/business error from server
          await this.repo.putPendingOperation({
            ...op,
            status: 'FAILED',
            lastErrorCode: res.errorCode ?? 'VALIDATION_FAILED',
            lastErrorMessage: res.errorMessage ?? 'Server rejected operation.',
          });
          await this.repo.recordSyncAttempt({
            attemptId: generateUuid(),
            operationId: op.operationId,
            userId,
            attemptedAt: nowIso,
            outcome: 'PERMANENT_ERROR',
            httpStatus: 400,
            errorCode: res.errorCode ?? 'VALIDATION_FAILED',
            errorMessage: res.errorMessage ?? null,
          });
          summary.failedCount++;
        }
      }
      return 'OK';
    } catch (err) {
      const isSessionExpired = err instanceof ApiError && err.statusCode === 401;
      const isForbidden = err instanceof ApiError && err.statusCode === 403;
      const isValidationErr =
        err instanceof ApiError &&
        err.statusCode >= 400 &&
        err.statusCode < 500 &&
        !isSessionExpired &&
        !isForbidden;
      const errMessage = err instanceof Error ? err.message : 'Network error during sync';

      if (isSessionExpired) {
        // Pause sync cleanly without discarding or failing pending operations
        for (const op of batch) {
          await this.repo.putPendingOperation({
            ...op,
            status: 'PENDING',
            lastErrorCode: 'SESSION_EXPIRED',
            lastErrorMessage: 'Session expired. Reauthenticate as the same user to resume sync.',
          });
        }
        return 'SESSION_EXPIRED';
      }

      if (isForbidden) {
        for (const op of batch) {
          await this.repo.putPendingOperation({
            ...op,
            status: 'CONFLICT',
            lastErrorCode: 'INSUFFICIENT_PERMISSION',
            lastErrorMessage: errMessage,
          });
          await this.repo.saveConflict({
            conflictId: generateUuid(),
            operationId: op.operationId,
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            operationType: op.operationType,
            conflictCategory: 'INSUFFICIENT_PERMISSION',
            localPayload: op.payload,
            serverSnapshot: null,
            reason: errMessage,
            detectedAt: nowIso,
            resolvedAt: null,
            resolutionAction: null,
          });
          summary.conflictCount++;
        }
        return 'TRANSIENT_ABORT';
      }

      for (const op of batch) {
        const nextRetryCount = op.retryCount + 1;
        const isPermanent = isValidationErr || nextRetryCount > MAX_TRANSIENT_RETRIES;

        await this.repo.putPendingOperation({
          ...op,
          status: isPermanent ? 'FAILED' : 'PENDING',
          retryCount: nextRetryCount,
          nextRetryAt: isPermanent
            ? null
            : new Date(Date.now() + computeRetryDelayMs(nextRetryCount)).toISOString(),
          lastErrorCode: isValidationErr ? 'VALIDATION_FAILED' : 'NETWORK_ERROR',
          lastErrorMessage: errMessage,
        });

        await this.repo.recordSyncAttempt({
          attemptId: generateUuid(),
          operationId: op.operationId,
          userId,
          attemptedAt: nowIso,
          outcome: isPermanent ? 'PERMANENT_ERROR' : 'TRANSIENT_ERROR',
          httpStatus: err instanceof ApiError ? err.statusCode : null,
          errorCode: isValidationErr ? 'VALIDATION_FAILED' : 'NETWORK_ERROR',
          errorMessage: errMessage,
        });

        if (isPermanent) {
          summary.failedCount++;
        }
      }
      return 'TRANSIENT_ABORT';
    }
  }

  private async pullIncremental(userId: string, summary: SyncRunSummary): Promise<void> {
    let cursor = (await this.repo.getMetadata<string>(userId, 'syncCursor')) ?? null;
    let pages = 0;
    const MAX_PAGES = 10;

    while (pages < MAX_PAGES) {
      const pullRes = await syncApiService.pullChanges({ cursor, limit: 50 });
      for (const [entityType, rows] of Object.entries(pullRes.changes)) {
        for (const row of rows) {
          const id = String(row.id ?? '');
          if (!id) continue;
          try {
            await this.repo.saveCachedEntity({
              userId,
              entityType,
              localRecordId: id,
              serverRecordId: id,
              serverRevision: typeof row.updatedAt === 'string' ? row.updatedAt : null,
              warehouseId: typeof row.warehouseId === 'string' ? row.warehouseId : null,
              data: row,
            });
            summary.pulledCount++;
          } catch (err) {
            if (isQuotaExceededError(err)) {
              await this.repo.pruneExpiredCache(userId);
              break;
            }
          }
        }
      }

      cursor = pullRes.nextCursor;
      await this.repo.setMetadata(userId, 'syncCursor', cursor);
      pages++;
      if (!pullRes.hasMore) break;
    }
  }
}

export const syncEngine = new SyncEngine();
