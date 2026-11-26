import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sprint 2: Live Factory Pulse API & Scope Suite', () => {
  const runTag = crypto.randomBytes(4).toString('hex');
  let prodToken = '';
  let salesmanToken = '';
  let prodId = '';
  let salesmanId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('PulseTest2026!');
    const prodRole = await prisma.role.findUnique({ where: { code: 'PRODUCTION' } });
    const salesmanRole = await prisma.role.findUnique({ where: { code: 'SALESMAN' } });

    const prodUser = await prisma.user.create({
      data: {
        email: `pulse.prod.${runTag}@foodfactory.local`,
        username: `pulse_prod_${runTag}`,
        fullName: 'Pulse Production',
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: prodRole!.id } },
      },
    });
    prodId = prodUser.id;

    const salesUser = await prisma.user.create({
      data: {
        email: `pulse.sales.${runTag}@foodfactory.local`,
        username: `pulse_sales_${runTag}`,
        fullName: 'Pulse Sales',
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
      .send({ usernameOrEmail: prodUser.email, password: 'PulseTest2026!' });
    prodToken = r1.body.data.accessToken;

    const r2 = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: salesUser.email, password: 'PulseTest2026!' });
    salesmanToken = r2.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [prodId, salesmanId] } } });
  });

  it('1. Rejects unauthenticated requests with 401 and SALESMAN without production.batches.read with 403', async () => {
    const unauth = await request(app).get('/api/v1/production/factory-pulse');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/production/factory-pulse')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('2. Returns real overview, activity, material readiness, quality, and attention sections for PRODUCTION', async () => {
    const res = await request(app)
      .get('/api/v1/production/factory-pulse')
      .set('Authorization', `Bearer ${prodToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.generatedAt).toBeTruthy();
    expect(typeof data.overview.activeBatchesCount).toBe('number');
    expect(typeof data.overview.runningWorkOrdersCount).toBe('number');
    expect(Array.isArray(data.productionActivity)).toBe(true);
    expect(Array.isArray(data.materialReadiness)).toBe(true);
    expect(typeof data.qualityMonitoring.pendingInspectionsCount).toBe('number');
    expect(Array.isArray(data.attentionRequired)).toBe(true);
  });
});
