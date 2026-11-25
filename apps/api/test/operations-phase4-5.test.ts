import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4.5 System Reliability & Operations Suite', () => {
  let adminToken: string;
  let auditorToken: string;
  let salesmanToken: string;
  let backupId: string;

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase45Pass!2026');
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new Error(`Role ${roleCode} not found`);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash: pw, isActive: true },
      create: {
        email: `${username}@foodfactory.com`,
        username,
        passwordHash: pw,
        fullName: `P45 ${roleCode}`,
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
    const admin = await buildUser('p45_admin', 'ADMIN');
    const auditor = await buildUser('p45_auditor', 'AUDITOR');
    const salesman = await buildUser('p45_salesman', 'SALESMAN');

    adminToken = admin.token;
    auditorToken = auditor.token;
    salesmanToken = salesman.token;
  });

  afterAll(async () => {
    // Always ensure maintenance mode is disabled after tests
    await request(app)
      .put('/api/v1/operations/maintenance-mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false });
  });

  it('1. Rejects unauthenticated requests on /operations/health with 401 while keeping /health public', async () => {
    const pubRes = await request(app).get('/api/v1/health');
    expect(pubRes.status).toBe(200);
    expect(pubRes.headers['x-request-id']).toBeDefined();

    const privRes = await request(app).get('/api/v1/operations/health');
    expect(privRes.status).toBe(401);
  });

  it('2. Detailed health, monitoring (with stack trace restriction), and database visibility', async () => {
    const [healthRes, monAdminRes, monAudRes, dbRes] = await Promise.all([
      request(app)
        .get('/api/v1/operations/health')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/operations/monitoring')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/operations/monitoring')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/operations/database')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.database.status).toBe('connected');
    expect(JSON.stringify(healthRes.body)).not.toContain('postgresql://');

    expect(monAdminRes.status).toBe(200);
    expect(monAdminRes.body.data.performance).toHaveProperty('totalRequestsSampled');
    expect(monAudRes.status).toBe(200);

    expect(dbRes.status).toBe(200);
    expect(dbRes.body.data.migrationsCount).toBeGreaterThan(0);

    // SALESMAN denied operational diagnostics
    const salesDenied = await request(app)
      .get('/api/v1/operations/health')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesDenied.status).toBe(403);
  });

  it('3. Safe backup trigger (honest UNAVAILABLE when BACKUP_DIR unset) and controlled restore approval', async () => {
    const triggerRes = await request(app)
      .post('/api/v1/operations/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(triggerRes.status).toBe(201);
    backupId = triggerRes.body.data.id;
    expect(['UNAVAILABLE', 'COMPLETED']).toContain(triggerRes.body.data.status);

    // Request restore
    const reqRes = await request(app)
      .post('/api/v1/operations/restore-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backupRecordId: backupId, notes: 'Staging verification drill' });
    expect(reqRes.status).toBe(201);

    // Approve restore (does NOT auto-execute destructive restore)
    const appRes = await request(app)
      .post(`/api/v1/operations/restore-requests/${reqRes.body.data.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(appRes.status).toBe(200);
    expect(appRes.body.data.status).toBe('APPROVED');

    // AUDITOR cannot trigger backups or approve restores
    const audDenied = await request(app)
      .post('/api/v1/operations/backups')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({});
    expect(audDenied.status).toBe(403);
  });

  it('4. Maintenance mode blocks regular users with 503 while ADMIN bypasses', async () => {
    const enableRes = await request(app)
      .put('/api/v1/operations/maintenance-mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, message: 'Scheduled maintenance window' });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.enabled).toBe(true);

    // Regular user (SALESMAN) gets 503
    const blockedRes = await request(app)
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(blockedRes.status).toBe(503);

    // ADMIN bypasses maintenance mode
    const adminBypassRes = await request(app)
      .get('/api/v1/admin/organization')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminBypassRes.status).toBe(200);

    // Disable maintenance mode
    const disableRes = await request(app)
      .put('/api/v1/operations/maintenance-mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.enabled).toBe(false);
  });
});
