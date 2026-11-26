import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sprint 1: Global Command Center Search API', () => {
  const runTag = crypto.randomBytes(4).toString('hex');
  let adminToken = '';
  let salesmanToken = '';
  let adminId = '';
  let salesmanId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('SearchTest2026!');
    const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
    const salesmanRole = await prisma.role.findUnique({ where: { code: 'SALESMAN' } });

    const admin = await prisma.user.create({
      data: {
        email: `search.admin.${runTag}@foodfactory.local`,
        username: `search_admin_${runTag}`,
        fullName: `Search Admin ${runTag}`,
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: adminRole!.id } },
      },
    });
    adminId = admin.id;

    const salesman = await prisma.user.create({
      data: {
        email: `search.sales.${runTag}@foodfactory.local`,
        username: `search_sales_${runTag}`,
        fullName: `Search Sales ${runTag}`,
        passwordHash,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: salesmanRole!.id } },
      },
    });
    salesmanId = salesman.id;

    const r1 = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: admin.email, password: 'SearchTest2026!' });
    adminToken = r1.body.data.accessToken;

    const r2 = await request(app)
      .post('/api/v1/auth/login')
      .set(CSRF)
      .send({ usernameOrEmail: salesman.email, password: 'SearchTest2026!' });
    salesmanToken = r2.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [adminId, salesmanId] } } });
  });

  it('1. Rejects unauthenticated search with 401', async () => {
    const res = await request(app).get('/api/v1/search?q=test');
    expect(res.status).toBe(401);
  });

  it('2. Returns empty list for empty query and rejects invalid limit', async () => {
    const emptyRes = await request(app)
      .get('/api/v1/search?q=')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data.results).toEqual([]);

    const badLimit = await request(app)
      .get('/api/v1/search?q=test&limit=999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(badLimit.status).toBe(400);
  });

  it('3. Searches users for ADMIN without exposing passwordHash and blocks USER results for SALESMAN', async () => {
    const adminRes = await request(app)
      .get(`/api/v1/search?q=${runTag}&limit=10`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    const userItems = adminRes.body.data.results.filter(
      (r: { entityType: string }) => r.entityType === 'USER',
    );
    expect(userItems.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(userItems)).not.toContain('passwordHash');

    const salesRes = await request(app)
      .get(`/api/v1/search?q=${runTag}&limit=10`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesRes.status).toBe(200);
    const salesUserItems = salesRes.body.data.results.filter(
      (r: { entityType: string }) => r.entityType === 'USER',
    );
    expect(salesUserItems).toHaveLength(0);
  });
});
