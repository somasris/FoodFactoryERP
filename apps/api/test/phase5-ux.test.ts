import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 5: Smart UX Backend API Suite', () => {
  let ownerToken: string;
  let salesmanToken: string;
  let ownerUserId: string;
  let salesmanUserId: string;
  let createdViewId: string;

  beforeAll(async () => {
    const pw = await hashPassword('Phase5UxPass2026!');
    await prisma.user.deleteMany({
      where: { username: { in: ['p5_owner', 'p5_salesman'] } },
    });

    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'OWNER' },
      include: { permissions: { include: { permission: true } } },
    });
    const salesmanRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'SALESMAN' },
      include: { permissions: { include: { permission: true } } },
    });

    const owner = await prisma.user.create({
      data: {
        email: 'p5_owner@foodfactory.local',
        username: 'p5_owner',
        passwordHash: pw,
        fullName: 'Phase 5 Owner',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: ownerRole.id } },
      },
    });
    ownerUserId = owner.id;
    ownerToken = generateAccessToken({
      userId: owner.id,
      username: owner.username,
      email: owner.email,
      roles: ['OWNER'],
      permissions: ownerRole.permissions.map(p => p.permission.code),
    });

    const salesman = await prisma.user.create({
      data: {
        email: 'p5_salesman@foodfactory.local',
        username: 'p5_salesman',
        passwordHash: pw,
        fullName: 'Phase 5 Salesman',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: salesmanRole.id } },
      },
    });
    salesmanUserId = salesman.id;
    salesmanToken = generateAccessToken({
      userId: salesman.id,
      username: salesman.username,
      email: salesman.email,
      roles: ['SALESMAN'],
      permissions: salesmanRole.permissions.map(p => p.permission.code),
    });

    // Seed an audit log entry containing sensitive fields for redaction verification
    await prisma.auditLog.create({
      data: {
        userId: ownerUserId,
        action: 'UPDATE',
        entityType: 'SystemConfig',
        entityId: 'p5-redaction-check',
        newState: {
          setting: 'smtp_mode',
          password: 'secret_password_123',
          token: 'secret_token_xyz',
        },
        remarks: 'Phase 5 redaction audit entry',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { entityId: 'p5-redaction-check' },
    });
    await prisma.user.deleteMany({
      where: { username: { in: ['p5_owner', 'p5_salesman'] } },
    });
    await prisma.$disconnect();
  });

  it('1. Rejects unauthenticated requests with 401', async () => {
    const [prefRes, viewRes, actRes] = await Promise.all([
      request(app).get('/api/v1/preferences'),
      request(app).get('/api/v1/saved-views'),
      request(app).get('/api/v1/activity-timeline'),
    ]);
    expect(prefRes.status).toBe(401);
    expect(viewRes.status).toBe(401);
    expect(actRes.status).toBe(401);
  });

  it('2. Persists, retrieves, and resets dashboard preferences & tour completion per user', async () => {
    const putDash = await request(app)
      .put('/api/v1/preferences/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        dashboardId: 'executive',
        hiddenWidgetIds: ['pendingApprovals'],
        widgetOrder: ['salesOrders', 'issuedInvoiceValue'],
      });
    expect(putDash.status).toBe(200);
    expect(putDash.body.data.dashboardLayout.executive.hiddenWidgetIds).toEqual(['pendingApprovals']);

    const putTour = await request(app)
      .put('/api/v1/preferences/tour')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ completed: true });
    expect(putTour.status).toBe(200);
    expect(putTour.body.data.tourCompleted).toBe(true);

    // Cross-user isolation: salesman should still have empty preferences
    const salesmanPref = await request(app)
      .get('/api/v1/preferences')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesmanPref.status).toBe(200);
    expect(salesmanPref.body.data.tourCompleted).toBe(false);
    expect(salesmanPref.body.data.dashboardLayout.executive).toBeUndefined();

    // Reset executive dashboard for owner
    const resetRes = await request(app)
      .delete('/api/v1/preferences/dashboard/executive')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.dashboardLayout.executive).toBeUndefined();
  });

  it('3. Saved Views CRUD enforces RBAC, ownership, and single default per module', async () => {
    // Salesman cannot create a view for quality_inspections (lacks production.quality.read)
    const forbiddenCreate = await request(app)
      .post('/api/v1/saved-views')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        module: 'quality_inspections',
        name: 'Pending QC',
        filters: { decision: 'PENDING' },
      });
    expect(forbiddenCreate.status).toBe(403);

    // Salesman creates a valid sales_orders view
    const createRes = await request(app)
      .post('/api/v1/saved-views')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        module: 'sales_orders',
        name: 'My Pending Approvals',
        filters: { status: 'SUBMITTED' },
        isDefault: true,
      });
    expect(createRes.status).toBe(201);
    createdViewId = createRes.body.data.id;

    // Duplicate name rejected with 409
    const dupRes = await request(app)
      .post('/api/v1/saved-views')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        module: 'sales_orders',
        name: 'My Pending Approvals',
        filters: { status: 'SUBMITTED' },
      });
    expect(dupRes.status).toBe(409);

    // Owner cannot update or delete salesman's private saved view (403)
    const crossUpdate = await request(app)
      .patch(`/api/v1/saved-views/${createdViewId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Hijacked' });
    expect(crossUpdate.status).toBe(403);

    // Salesman renames and deletes own view
    const patchRes = await request(app)
      .patch(`/api/v1/saved-views/${createdViewId}`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({ name: 'Submitted Orders' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Submitted Orders');

    const delRes = await request(app)
      .delete(`/api/v1/saved-views/${createdViewId}`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(delRes.status).toBe(200);
  });

  it('4. Activity Timeline redacts sensitive fields and enforces user/domain authorization', async () => {
    // Non-governance salesman cannot filter by another userId
    const crossUserTimeline = await request(app)
      .get(`/api/v1/activity-timeline?userId=${ownerUserId}`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(crossUserTimeline.status).toBe(403);

    // Owner sees activity timeline with redacted sensitive metadata
    const ownerTimeline = await request(app)
      .get('/api/v1/activity-timeline?category=ADMINISTRATION&limit=20')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerTimeline.status).toBe(200);
    const entry = ownerTimeline.body.data.items.find(
      (i: { entityId: string }) => i.entityId === 'p5-redaction-check',
    );
    expect(entry).toBeDefined();
    expect(entry.metadata.password).toBe('[REDACTED]');
    expect(entry.metadata.token).toBe('[REDACTED]');
    expect(entry.metadata.setting).toBe('smtp_mode');
  });
});
