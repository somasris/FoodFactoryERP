import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sprint 3: Offline Sync API, Idempotency & RBAC Suite', () => {
  const runTag = crypto.randomBytes(4).toString('hex');
  let adminToken = '';
  let auditorToken = '';
  let adminUserId = '';
  let auditorUserId = '';
  let warehouseId = '';
  let rawMaterialItemId = '';
  let uomId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('SyncTest2026!');

    const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
    const auditorRole = await prisma.role.findUnique({ where: { code: 'AUDITOR' } });
    expect(adminRole).not.toBeNull();
    expect(auditorRole).not.toBeNull();

    const adminUser = await prisma.user.create({
      data: {
        email: `sync.admin.${runTag}@foodfactory.local`,
        username: `sync_admin_${runTag}`,
        fullName: 'Sync Admin',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: adminRole!.id } },
      },
    });
    adminUserId = adminUser.id;

    const auditorUser = await prisma.user.create({
      data: {
        email: `sync.auditor.${runTag}@foodfactory.local`,
        username: `sync_auditor_${runTag}`,
        fullName: 'Sync Auditor',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: auditorRole!.id } },
      },
    });
    auditorUserId = auditorUser.id;

    const loginAdmin = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: adminUser.email, password: 'SyncTest2026!' });
    adminToken = loginAdmin.body.data.accessToken;

    const loginAuditor = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: auditorUser.email, password: 'SyncTest2026!' });
    auditorToken = loginAuditor.body.data.accessToken;

    const wh = await prisma.warehouse.findFirst({ where: { isActive: true } });
    const item = await prisma.inventoryItem.findFirst({ where: { isActive: true } });
    warehouseId = wh!.id;
    rawMaterialItemId = item!.id;
    uomId = item!.uomId;
  });

  afterAll(async () => {
    await prisma.syncConflict.deleteMany({ where: { userId: { in: [adminUserId, auditorUserId] } } });
    await prisma.syncIdempotencyRecord.deleteMany({
      where: { userId: { in: [adminUserId, auditorUserId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, auditorUserId] } } });
  });

  it('1. Rejects unauthenticated sync requests with 401', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    expect(res.status).toBe(401);
  });

  it('2. Pushes an inventory receipt DRAFT and enforces server-side idempotency on replay', async () => {
    const operationId = crypto.randomUUID();
    const idempotencyKey = `idem-${runTag}-rcp-1`;

    const opPayload = {
      operationId,
      idempotencyKey,
      entityType: 'INVENTORY_RECEIPT',
      entityId: operationId,
      operationType: 'INVENTORY_RECEIPT_DRAFT',
      warehouseId,
      clientCreatedAt: new Date().toISOString(),
      clientUpdatedAt: new Date().toISOString(),
      localSequence: 1,
      payload: {
        warehouseId,
        receiptDate: new Date().toISOString(),
        supplierRef: `OFFLINE-SUP-${runTag}`,
        notes: 'Queued offline receipt',
        lines: [
          {
            inventoryItemId: rawMaterialItemId,
            uomId,
            quantity: 5,
            unitCost: 100,
            batchNumber: `BATCH-${runTag}`,
          },
        ],
      },
    };

    const firstRes = await request(app)
      .post('/api/v1/sync/push')
      .set(CSRF)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operations: [opPayload] });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.results).toHaveLength(1);
    expect(firstRes.body.data.results[0].errorMessage).toBeUndefined();
    expect(firstRes.body.data.results[0]).toMatchObject({ status: 'SYNCED' });
    const createdReceiptId = firstRes.body.data.results[0].serverEntityId;
    expect(createdReceiptId).toBeTruthy();

    // Verify receipt was created as DRAFT (not POSTED)
    const receipt = await prisma.inventoryReceipt.findUnique({ where: { id: createdReceiptId } });
    expect(receipt?.status).toBe('DRAFT');

    // Replay same idempotencyKey
    const replayRes = await request(app)
      .post('/api/v1/sync/push')
      .set(CSRF)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operations: [opPayload] });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.results[0].status).toBe('SYNCED');
    expect(replayRes.body.data.results[0].duplicate).toBe(true);
    expect(replayRes.body.data.results[0].serverEntityId).toBe(createdReceiptId);
  });

  it('3. Rejects AUDITOR mutation operations with INSUFFICIENT_PERMISSION conflict', async () => {
    const operationId = crypto.randomUUID();
    const res = await request(app)
      .post('/api/v1/sync/push')
      .set(CSRF)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        operations: [
          {
            operationId,
            idempotencyKey: `idem-${runTag}-auditor`,
            entityType: 'INVENTORY_RECEIPT',
            entityId: operationId,
            operationType: 'INVENTORY_RECEIPT_DRAFT',
            warehouseId,
            clientCreatedAt: new Date().toISOString(),
            clientUpdatedAt: new Date().toISOString(),
            localSequence: 1,
            payload: { warehouseId, lines: [] },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe('CONFLICT');
    expect(res.body.data.results[0].conflictCategory).toBe('INSUFFICIENT_PERMISSION');

    const conflictsRes = await request(app)
      .get('/api/v1/sync/conflicts')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(conflictsRes.status).toBe(200);
    expect(conflictsRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('4. Pulls incremental server changes with cursor pagination', async () => {
    const res = await request(app)
      .post('/api/v1/sync/pull')
      .set(CSRF)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cursor: null, limit: 10, entityTypes: ['WAREHOUSES', 'PRODUCTS'] });

    expect(res.status).toBe(200);
    expect(res.body.data.nextCursor).toBeTruthy();
    expect(Array.isArray(res.body.data.changes.WAREHOUSES)).toBe(true);
  });
});
