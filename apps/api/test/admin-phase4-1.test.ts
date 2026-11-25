import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4.1 System Administration Integration Suite', () => {
  let ownerToken: string;
  let adminToken: string;
  let productionToken: string;
  let salesmanToken: string;
  let auditorToken: string;

  let ownerUserId: string;
  let adminUserId: string;
  let targetUserId: string;
  let createdFactoryId: string;
  let createdRoleId: string;
  let whRmId: string;

  const testUsernames = [
    'p41_owner',
    'p41_admin',
    'p41_production',
    'p41_salesman',
    'p41_auditor',
    'p41_target_user',
  ];

  async function buildTokenForRole(username: string, email: string, roleCode: string) {
    const pw = await hashPassword('Phase4Pass!2026');
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new Error(`Seeded role ${roleCode} not found`);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: pw,
        fullName: `Test ${roleCode}`,
        userRoles: { create: { roleId: role.id } },
      },
    });

    const token = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [roleCode],
      permissions: role.permissions.map(p => p.permission.code),
    });

    return { user, token };
  }

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: testUsernames } } });
    await prisma.factory.deleteMany({ where: { code: 'FAC-P41-TEST' } });
    await prisma.role.deleteMany({ where: { code: 'QUALITY_SUPERVISOR_P41' } });

    const owner = await buildTokenForRole('p41_owner', 'p41_owner@foodfactory.com', 'OWNER');
    const admin = await buildTokenForRole('p41_admin', 'p41_admin@foodfactory.com', 'ADMIN');
    const prod = await buildTokenForRole(
      'p41_production',
      'p41_production@foodfactory.com',
      'PRODUCTION',
    );
    const sales = await buildTokenForRole(
      'p41_salesman',
      'p41_salesman@foodfactory.com',
      'SALESMAN',
    );
    const auditor = await buildTokenForRole(
      'p41_auditor',
      'p41_auditor@foodfactory.com',
      'AUDITOR',
    );
    const target = await buildTokenForRole(
      'p41_target_user',
      'p41_target_user@foodfactory.com',
      'PRODUCTION',
    );

    ownerToken = owner.token;
    ownerUserId = owner.user.id;
    adminToken = admin.token;
    adminUserId = admin.user.id;
    productionToken = prod.token;
    salesmanToken = sales.token;
    auditorToken = auditor.token;
    targetUserId = target.user.id;

    const wh = await prisma.warehouse.findFirst({ where: { isActive: true } });
    if (!wh) throw new Error('No active warehouse found in DB');
    whRmId = wh.id;
  });

  afterAll(async () => {
    await prisma.userWarehouseAccess.deleteMany({ where: { userId: targetUserId } });
    await prisma.user.deleteMany({ where: { username: { in: testUsernames } } });
    await prisma.factory.deleteMany({ where: { code: 'FAC-P41-TEST' } });
    await prisma.role.deleteMany({ where: { code: 'QUALITY_SUPERVISOR_P41' } });
  });

  it('1. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/organization');
    expect(res.status).toBe(401);
  });

  it('2. Organization profile read, validated update, and audit history', async () => {
    const getRes = await request(app)
      .get('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.gstin).toBeDefined();

    // Invalid GSTIN rejected
    const badRes = await request(app)
      .patch('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gstin: 'INVALID_GSTIN' });
    expect(badRes.status).toBe(400);

    // Valid update
    const origTradeName = getRes.body.data.tradeName;
    const updRes = await request(app)
      .patch('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tradeName: 'FoodFactory South India Updated',
        fssaiLicense: '12426003000123',
        defaultCurrency: 'INR',
        defaultTimezone: 'Asia/Kolkata',
      });
    expect(updRes.status).toBe(200);
    expect(updRes.body.data.tradeName).toBe('FoodFactory South India Updated');

    // Restore original tradeName
    await request(app)
      .patch('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tradeName: origTradeName });

    // Audit history
    const histRes = await request(app)
      .get('/api/v1/admin/organization/history')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.items.length).toBeGreaterThan(0);

    // AUDITOR cannot mutate organization
    const audMut = await request(app)
      .patch('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ tradeName: 'Hacked' });
    expect(audMut.status).toBe(403);
  });

  it('3. Factory CRUD and status lifecycle', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/factories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'FAC-P41-TEST',
        name: 'Madurai Snacks Plant',
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Plot 10, SIDCO Industrial Estate, Madurai 625008',
        email: 'madurai@foodfactory.com',
        phone: '+91 452 2400100',
      });
    expect(createRes.status).toBe(201);
    createdFactoryId = createRes.body.data.id;

    const listRes = await request(app)
      .get('/api/v1/admin/factories?search=Madurai')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.some((f: { id: string }) => f.id === createdFactoryId)).toBe(true);

    const updRes = await request(app)
      .patch(`/api/v1/admin/factories/${createdFactoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Madurai Packaging & Snacks Plant' });
    expect(updRes.status).toBe(200);
    expect(updRes.body.data.name).toBe('Madurai Packaging & Snacks Plant');

    const statusRes = await request(app)
      .patch(`/api/v1/admin/factories/${createdFactoryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.isActive).toBe(false);

    // PRODUCTION & SALESMAN cannot manage factories
    const prodMut = await request(app)
      .post('/api/v1/admin/factories')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        code: 'FAC-DENIED',
        name: 'Denied Plant',
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Denied Address 123',
      });
    expect(prodMut.status).toBe(403);
  });

  it('4. User administration: pagination, password reset, self-lockout prevention, activity', async () => {
    const listRes = await request(app)
      .get('/api/v1/admin/users?search=p41_target_user&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.length).toBe(1);
    expect(listRes.body.data.items[0].passwordHash).toBeUndefined();

    // Prevent self-deactivation
    const selfDeactRes = await request(app)
      .patch(`/api/v1/users/${adminUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(selfDeactRes.status).toBe(400);

    // ADMIN cannot reset OWNER password
    const resetOwnerRes = await request(app)
      .post(`/api/v1/admin/users/${ownerUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewOwnerPass!2026', reason: 'Unauthorized test' });
    expect(resetOwnerRes.status).toBe(403);

    // ADMIN can reset PRODUCTION user password
    const resetTargetRes = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewTargetPass!2026', reason: 'User forgot password' });
    expect(resetTargetRes.status).toBe(200);
    expect(resetTargetRes.body.data.sessionsRevoked).toBe(true);

    // Activity history
    const actRes = await request(app)
      .get(`/api/v1/admin/users/${targetUserId}/activity`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.items.length).toBeGreaterThan(0);
  });

  it('5. Role & permission administration with protected system roles & AUDITOR guard', async () => {
    const rolesRes = await request(app)
      .get('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rolesRes.status).toBe(200);
    const ownerRole = rolesRes.body.data.find((r: { code: string }) => r.code === 'OWNER');
    const auditorRole = rolesRes.body.data.find((r: { code: string }) => r.code === 'AUDITOR');
    expect(ownerRole).toBeDefined();
    expect(auditorRole).toBeDefined();

    // Cannot strip OWNER permissions
    const stripOwnerRes = await request(app)
      .put(`/api/v1/admin/roles/${ownerRole.id}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissionCodes: ['users.read'] });
    expect(stripOwnerRes.status).toBe(400);

    // Cannot assign write permission to AUDITOR
    const escalateAuditorRes = await request(app)
      .put(`/api/v1/admin/roles/${auditorRole.id}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissionCodes: ['users.read', 'users.create'] });
    expect(escalateAuditorRes.status).toBe(400);

    // Create custom role
    const createRoleRes = await request(app)
      .post('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'QUALITY_SUPERVISOR_P41',
        name: 'Quality Supervisor',
        description: 'Custom role for QA leads',
        permissionCodes: ['production.quality.read', 'production.quality.inspect'],
      });
    expect(createRoleRes.status).toBe(201);
    createdRoleId = createRoleRes.body.data.id;

    // Update custom role permissions
    const updPermRes = await request(app)
      .put(`/api/v1/admin/roles/${createdRoleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        permissionCodes: [
          'production.quality.read',
          'production.quality.inspect',
          'production.batches.read',
        ],
      });
    expect(updPermRes.status).toBe(200);
    expect(updPermRes.body.data.permissions).toContain('production.batches.read');
  });

  it('6. Warehouse access assignment, revocation, and audit history', async () => {
    const assignRes = await request(app)
      .put(`/api/v1/admin/warehouse-access/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignments: [{ warehouseId: whRmId, accessLevel: 'READ_WRITE' }],
      });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.length).toBe(1);
    expect(assignRes.body.data[0].warehouseId).toBe(whRmId);

    const revokeRes = await request(app)
      .delete(`/api/v1/admin/warehouse-access/users/${targetUserId}/warehouses/${whRmId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revokeRes.status).toBe(200);

    const histRes = await request(app)
      .get('/api/v1/admin/warehouse-access/history')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('7. System settings validation, optimistic concurrency, and RBAC', async () => {
    const listRes = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const varianceSetting = listRes.body.data.items.find(
      (s: { key: string }) => s.key === 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT',
    );
    expect(varianceSetting).toBeDefined();

    // Reject unknown/sensitive key
    const badKeyRes = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ settings: [{ key: 'DATABASE_URL', value: 'postgres://hacked' }] });
    expect(badKeyRes.status).toBe(400);

    // Reject invalid value
    const badValRes = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        settings: [{ key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT', value: '500' }],
      });
    expect(badValRes.status).toBe(400);

    // Valid update with expectedVersion (always choose a different value so version increments)
    const nextVal = varianceSetting.value === '7' ? '8' : '7';
    const updRes = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        settings: [
          {
            key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT',
            value: nextVal,
            expectedVersion: varianceSetting.version,
          },
        ],
      });
    expect(updRes.status).toBe(200);
    expect(updRes.body.data[0].value).toBe(nextVal);

    // Stale expectedVersion triggers 409 conflict
    const staleRes = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        settings: [
          {
            key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT',
            value: '5',
            expectedVersion: varianceSetting.version,
          },
        ],
      });
    expect(staleRes.status).toBe(409);

    // SALESMAN & AUDITOR denied
    const salesDenied = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesDenied.status).toBe(403);

    const audDenied = await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ settings: [{ key: 'PRODUCTION_VARIANCE_THRESHOLD_PERCENT', value: '5' }] });
    expect(audDenied.status).toBe(403);
  });
});
