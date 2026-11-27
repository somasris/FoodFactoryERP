import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FoodFactoryOfflineDB } from '../offline/db';
import { OfflineRepository } from '../offline/offline-repository';
import { OfflineOperationQueue } from '../offline/operation-queue';
import { SyncEngine } from '../offline/sync-engine';
import { withSyncLock } from '../offline/sync-lock';
import { syncApiService } from '../services/sync.service';
import { ApiError } from '../services/api-client';
import * as connectionState from '../offline/connection-state';

describe('Sprint 3: Offline Operation Queue, Dependencies, Lock & Sync Engine', () => {
  let db: FoodFactoryOfflineDB;
  let repo: OfflineRepository;
  let queue: OfflineOperationQueue;
  let engine: SyncEngine;

  beforeEach(() => {
    vi.restoreAllMocks();
    db = new FoodFactoryOfflineDB(`sync_test_${Math.random().toString(36).slice(2)}`);
    repo = new OfflineRepository(db);
    queue = new OfflineOperationQueue(db, repo);
    engine = new SyncEngine(repo, queue);
  });

  it('prevents duplicate queue entries with the same idempotencyKey', async () => {
    const first = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      idempotencyKey: 'stable-key-1',
      payload: { customerId: 'c1' },
    });
    const second = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      idempotencyKey: 'stable-key-1',
      payload: { customerId: 'c1' },
    });

    expect(second.operationId).toBe(first.operationId);
    expect(await repo.listOperationsByUser('user-1')).toHaveLength(1);
  });

  it('respects dependencyOperationIds ordering before releasing dependent operations', async () => {
    const createOp = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: { customerId: 'c1' },
    });
    const submitOp = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      entityId: createOp.entityId,
      operationType: 'SALES_ORDER_SUBMIT',
      payload: {},
      dependencyOperationIds: [createOp.operationId],
    });

    const batch1 = await queue.getReadyBatch('user-1');
    expect(batch1.map(o => o.operationId)).toEqual([createOp.operationId]);

    await repo.putPendingOperation({ ...createOp, status: 'SYNCED' });
    const batch2 = await queue.getReadyBatch('user-1');
    expect(batch2.map(o => o.operationId)).toEqual([submitOp.operationId]);
  });

  it('supports cancelling unsent operations and retrying failed operations', async () => {
    const op = await queue.enqueue({
      userId: 'user-1',
      entityType: 'INVENTORY_RECEIPT',
      operationType: 'INVENTORY_RECEIPT_DRAFT',
      payload: { warehouseId: 'w1' },
    });

    expect(await queue.cancelOperation('user-1', op.operationId)).toBe(true);
    const cancelled = await repo.getPendingOperation('user-1', op.operationId);
    expect(cancelled?.status).toBe('CANCELLED');
  });

  it('SyncEngine pushes operations, handles SYNCED and CONFLICT outcomes, and pulls updates', async () => {
    vi.spyOn(connectionState, 'probeApiServer').mockResolvedValue({
      reachable: true,
      checkedAt: new Date().toISOString(),
      latencyMs: 12,
    });

    const op1 = await queue.enqueue({
      userId: 'user-1',
      entityType: 'INVENTORY_RECEIPT',
      operationType: 'INVENTORY_RECEIPT_DRAFT',
      payload: { warehouseId: 'w1' },
    });
    const op2 = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_UPDATE',
      payload: { notes: 'edited' },
    });

    vi.spyOn(syncApiService, 'pushBatch').mockResolvedValue({
      serverTimestamp: new Date().toISOString(),
      results: [
        {
          operationId: op1.operationId,
          idempotencyKey: op1.idempotencyKey,
          status: 'SYNCED',
          serverEntityId: 'srv-rcp-1',
        },
        {
          operationId: op2.operationId,
          idempotencyKey: op2.idempotencyKey,
          status: 'CONFLICT',
          conflictCategory: 'RECORD_MODIFIED',
          errorMessage: 'Modified by another user',
        },
      ],
    });

    vi.spyOn(syncApiService, 'pullChanges').mockResolvedValue({
      nextCursor: new Date().toISOString(),
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: {
        PRODUCTS: [{ id: 'prod-1', name: 'Spiced Chips', updatedAt: new Date().toISOString() }],
      },
    });

    const summary = await engine.runSync('user-1');
    expect(summary.ran).toBe(true);
    expect(summary.syncedCount).toBe(1);
    expect(summary.conflictCount).toBe(1);
    expect(summary.pulledCount).toBe(1);

    const conflicts = await repo.listConflicts('user-1');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictCategory).toBe('RECORD_MODIFIED');

    const cachedProduct = await repo.getCachedEntity('user-1', 'PRODUCTS', 'prod-1');
    expect(cachedProduct?.data).toMatchObject({ name: 'Spiced Chips' });
  });

  it('prevents concurrent sync execution in another tab when lease is held', async () => {
    window.localStorage.setItem(
      'ff_offline_sync_lock_user-1',
      JSON.stringify({ tabId: 'other-tab', expiresAt: Date.now() + 20_000 }),
    );
    const res = await withSyncLock('user-1', async () => 'done');
    expect(res.acquired).toBe(false);
    window.localStorage.removeItem('ff_offline_sync_lock_user-1');
  });

  it('coalesces offline draft updates into pending create and chains submit dependencies across batches', async () => {
    vi.spyOn(connectionState, 'probeApiServer').mockResolvedValue({
      reachable: true,
      checkedAt: new Date().toISOString(),
      latencyMs: 10,
    });

    const createOp = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: { customerId: 'c1', warehouseId: 'w1', notes: 'initial' },
    });

    const updatedOp = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      entityId: createOp.entityId,
      operationType: 'SALES_ORDER_DRAFT_UPDATE',
      payload: { customerId: 'c1', warehouseId: 'w1', notes: 'updated offline' },
    });

    expect(updatedOp.operationId).toBe(createOp.operationId);
    expect(updatedOp.idempotencyKey).toBe(createOp.idempotencyKey);
    expect(updatedOp.payload.notes).toBe('updated offline');

    const submitOp = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      entityId: createOp.entityId,
      operationType: 'SALES_ORDER_SUBMIT',
      payload: {},
    });

    expect(submitOp.dependencyOperationIds).toContain(createOp.operationId);

    const pushSpy = vi
      .spyOn(syncApiService, 'pushBatch')
      .mockResolvedValueOnce({
        serverTimestamp: new Date().toISOString(),
        results: [
          {
            operationId: createOp.operationId,
            idempotencyKey: createOp.idempotencyKey,
            status: 'SYNCED',
            serverEntityId: 'srv-so-100',
            serverVersion: '2026-11-27T10:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        serverTimestamp: new Date().toISOString(),
        results: [
          {
            operationId: submitOp.operationId,
            idempotencyKey: submitOp.idempotencyKey,
            status: 'SYNCED',
            serverEntityId: 'srv-so-100',
          },
        ],
      });

    vi.spyOn(syncApiService, 'pullChanges').mockResolvedValue({
      nextCursor: new Date().toISOString(),
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: {},
    });

    const summary = await engine.runSync('user-1');
    expect(summary.syncedCount).toBe(2);
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(pushSpy.mock.calls[1][0][0].entityId).toBe('srv-so-100');

    const state = await repo.getLocalSalesOrderState('user-1', createOp.entityId);
    expect(state.resolvedServerId).toBe('srv-so-100');
  });

  it('pauses sync on 401 session expiry without failing pending operations', async () => {
    vi.spyOn(connectionState, 'probeApiServer').mockResolvedValue({
      reachable: true,
      checkedAt: new Date().toISOString(),
      latencyMs: 8,
    });

    const op = await queue.enqueue({
      userId: 'user-1',
      entityType: 'SALES_ORDER',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: { customerId: 'c1', warehouseId: 'w1', lines: [] },
    });

    vi.spyOn(syncApiService, 'pushBatch').mockRejectedValue(
      new ApiError('Access token expired', 401),
    );

    const summary = await engine.runSync('user-1');
    expect(summary.skippedReason).toBe('SESSION_EXPIRED');
    expect(summary.failedCount).toBe(0);

    const persisted = await repo.getPendingOperation('user-1', op.operationId);
    expect(persisted?.status).toBe('PENDING');
    expect(persisted?.lastErrorCode).toBe('SESSION_EXPIRED');
  });
});
