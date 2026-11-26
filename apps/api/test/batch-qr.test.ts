import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sprint 4: Scan-to-Trace QR API & Security Suite', () => {
  const runTag = crypto.randomBytes(4).toString('hex');
  let prodToken = '';
  let salesmanToken = '';
  let prodId = '';
  let salesmanId = '';
  let batchId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('QrTest2026!');
    const prodRole = await prisma.role.findUnique({ where: { code: 'PRODUCTION' } });
    const salesmanRole = await prisma.role.findUnique({ where: { code: 'SALESMAN' } });

    const prodUser = await prisma.user.create({
      data: {
        email: `qr.prod.${runTag}@foodfactory.local`,
        username: `qr_prod_${runTag}`,
        fullName: 'QR Production',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: prodRole!.id } },
      },
    });
    prodId = prodUser.id;

    const salesUser = await prisma.user.create({
      data: {
        email: `qr.sales.${runTag}@foodfactory.local`,
        username: `qr_sales_${runTag}`,
        fullName: 'QR Sales',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: salesmanRole!.id } },
      },
    });
    salesmanId = salesUser.id;

    const r1 = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: prodUser.email, password: 'QrTest2026!' });
    prodToken = r1.body.data.accessToken;

    const r2 = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: salesUser.email, password: 'QrTest2026!' });
    salesmanToken = r2.body.data.accessToken;

    const batch = await prisma.productionBatch.findFirst({ orderBy: { createdAt: 'desc' } });
    batchId = batch?.id ?? '';
  });

  afterAll(async () => {
    if (batchId) {
      await prisma.batchQrReference.deleteMany({
        where: { productionBatchId: batchId, createdById: prodId },
      });
    }
    await prisma.user.deleteMany({ where: { id: { in: [prodId, salesmanId] } } });
  });

  it('1. Rejects unauthenticated and SALESMAN QR traceability access', async () => {
    const unauth = await request(app).get('/api/v1/production/traceability/qr/fake-ref');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/production/traceability/qr/fake-ref')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('2. Generates an opaque QR reference without duplicates, resolves traceability, and revokes cleanly', async () => {
    if (!batchId) return; // Skip only if DB has no seeded batch

    // Ensure prod user has warehouse access if restricted
    const batch = await prisma.productionBatch.findUnique({ where: { id: batchId } });
    await prisma.userWarehouseAccess.upsert({
      where: { userId_warehouseId: { userId: prodId, warehouseId: batch!.warehouseId } },
      create: { userId: prodId, warehouseId: batch!.warehouseId, accessLevel: 'READ_WRITE' },
      update: {},
    });

    const gen1 = await request(app)
      .post(`/api/v1/production/batches/${batchId}/qr`)
      .set(CSRF)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(gen1.status).toBe(200);
    const token1 = gen1.body.data.referenceToken as string;
    expect(token1).toBeTruthy();
    expect(token1).not.toContain(batchId);

    // Second call returns the same active QR token (no duplicate active QRs)
    const gen2 = await request(app)
      .post(`/api/v1/production/batches/${batchId}/qr`)
      .set(CSRF)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(gen2.body.data.referenceToken).toBe(token1);

    // Resolve traceability
    const trace = await request(app)
      .get(`/api/v1/production/traceability/qr/${token1}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(trace.status).toBe(200);
    expect(trace.body.data.batchIdentity.id).toBe(batchId);
    expect(Array.isArray(trace.body.data.timeline)).toBe(true);

    // Revoke & regenerate
    const rev = await request(app)
      .post(`/api/v1/production/batches/${batchId}/qr/revoke`)
      .set(CSRF)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ reason: 'Label damaged' });
    expect(rev.status).toBe(200);
    expect(rev.body.data.referenceToken).not.toBe(token1);

    // Old token returns 410 Gone
    const oldTrace = await request(app)
      .get(`/api/v1/production/traceability/qr/${token1}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(oldTrace.status).toBe(410);
  });
});
