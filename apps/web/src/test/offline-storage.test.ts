import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { FoodFactoryOfflineDB } from '../offline/db';
import { OfflineRepository, sanitizeForOfflineStorage } from '../offline/offline-repository';

describe('Sprint 2: IndexedDB Offline Storage & User Partitioning', () => {
  let db: FoodFactoryOfflineDB;
  let repo: OfflineRepository;

  beforeEach(async () => {
    db = new FoodFactoryOfflineDB(`test_db_${Math.random().toString(36).slice(2)}`);
    repo = new OfflineRepository(db);
  });

  it('saves and reads cached entities with user partitioning', async () => {
    await repo.saveCachedEntity({
      userId: 'user-a',
      entityType: 'PRODUCT',
      localRecordId: 'prod-1',
      data: { id: 'prod-1', name: 'Mango Pulp' },
    });

    const foundA = await repo.getCachedEntity('user-a', 'PRODUCT', 'prod-1');
    const foundB = await repo.getCachedEntity('user-b', 'PRODUCT', 'prod-1');

    expect(foundA?.data).toEqual({ id: 'prod-1', name: 'Mango Pulp' });
    expect(foundB).toBeUndefined();
  });

  it('strips passwords, JWTs, and refresh tokens from offline storage', () => {
    const sanitized = sanitizeForOfflineStorage({
      id: 'u1',
      username: 'operator',
      password: 'secret-password',
      accessToken: 'jwt-123',
      refreshToken: 'ref-456',
      nested: { token: 'abc', safeField: 'ok' },
    });

    expect(sanitized).toEqual({
      id: 'u1',
      username: 'operator',
      nested: { safeField: 'ok' },
    });
  });

  it('prunes expired cache while preserving pending operations', async () => {
    await repo.saveCachedEntity({
      userId: 'user-a',
      entityType: 'CUSTOMER',
      localRecordId: 'cust-expired',
      data: { name: 'Old Customer' },
      ttlMs: -1000, // already expired
    });

    await repo.putPendingOperation({
      operationId: 'op-1',
      idempotencyKey: 'idem-1',
      entityType: 'SALES_ORDER',
      entityId: 'draft-1',
      operationType: 'SALES_ORDER_DRAFT_CREATE',
      payload: { customerId: 'cust-1' },
      userId: 'user-a',
      factoryId: null,
      warehouseId: null,
      clientCreatedAt: new Date().toISOString(),
      clientUpdatedAt: new Date().toISOString(),
      baseServerVersion: null,
      localSequence: 1,
      dependencyOperationIds: [],
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: null,
      lastAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      serverResultEntityId: null,
    });

    const pruned = await repo.pruneExpiredCache('user-a');
    expect(pruned).toBe(1);
    expect(await repo.listCachedEntities('user-a', 'CUSTOMER')).toHaveLength(0);
    expect(await repo.listOperationsByUser('user-a')).toHaveLength(1);
  });

  it('clears cached data and session snapshot on logout', async () => {
    await repo.saveUserSessionSnapshot({
      id: 'user-a',
      email: 'a@test.local',
      username: 'usera',
      fullName: 'User A',
      isActive: true,
      roles: ['SALESMAN'],
      permissions: ['sales.orders.read'],
    });
    await repo.saveCachedEntity({
      userId: 'user-a',
      entityType: 'PRODUCT',
      localRecordId: 'p1',
      data: { name: 'Juice' },
    });

    await repo.clearUserDataOnLogout('user-a', false);
    expect(await repo.getValidUserSessionSnapshot('user-a')).toBeNull();
    expect(await repo.listCachedEntities('user-a', 'PRODUCT')).toHaveLength(0);
  });
});
