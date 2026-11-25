import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4.4 Audit & Governance Integration Suite', () => {
  let adminToken: string;
  let auditorToken: string;
  let salesmanToken: string;
  let productionToken: string;
  let seededAuditId: string;

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase44Pass!2026');
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
        fullName: `P44 ${roleCode}`,
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
    const admin = await buildUser('p44_admin', 'ADMIN');
    const auditor = await buildUser('p44_auditor', 'AUDITOR');
    const salesman = await buildUser('p44_salesman', 'SALESMAN');
    const prod = await buildUser('p44_production', 'PRODUCTION');

    adminToken = admin.token;
    auditorToken = auditor.token;
    salesmanToken = salesman.token;
    productionToken = prod.token;

    // Create an audit log with a sensitive field to verify redaction & field diffs
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.user.id,
        action: 'UPDATE',
        entityType: 'UserSecurity',
        entityId: admin.user.id,
        previousState: { isActive: true, passwordHash: 'super-secret-hash' },
        newState: { isActive: false, passwordHash: 'new-secret-hash' },
        remarks: 'P44 redaction & diff test',
      },
    });
    seededAuditId = log.id;
  });

  it('1. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/governance/audit-logs');
    expect(res.status).toBe(401);
  });

  it('2. Audit log listing, field diffs, and sensitive field redaction', async () => {
    const res = await request(app)
      .get(`/api/v1/governance/audit-logs/${seededAuditId}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.previousState.passwordHash).toBe('[REDACTED]');
    expect(res.body.data.newState.passwordHash).toBe('[REDACTED]');
    expect(res.body.data.fieldDiffs.some((d: { field: string }) => d.field === 'isActive')).toBe(
      true,
    );
  });

  it('3. Audit trail is strictly append-only (rejects PUT/PATCH/DELETE)', async () => {
    const delRes = await request(app)
      .delete(`/api/v1/governance/audit-logs/${seededAuditId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/v1/governance/audit-logs/${seededAuditId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ remarks: 'tampered' });
    expect(patchRes.status).toBe(404);
  });

  it('4. Approval history, user activity, unified transactions, and CSV export', async () => {
    const [appRes, actRes, txRes, expRes] = await Promise.all([
      request(app)
        .get('/api/v1/governance/approvals')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/governance/user-activity')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/governance/transactions')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/governance/audit-logs/export')
        .set('Authorization', `Bearer ${auditorToken}`),
    ]);

    expect(appRes.status).toBe(200);
    expect(appRes.body.data).toHaveProperty('counts');
    expect(actRes.status).toBe(200);
    expect(txRes.status).toBe(200);
    expect(expRes.status).toBe(200);
    expect(expRes.headers['content-type']).toContain('text/csv');

    // SALESMAN & PRODUCTION denied governance audit trail
    const salesDenied = await request(app)
      .get('/api/v1/governance/audit-logs')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesDenied.status).toBe(403);

    const prodDenied = await request(app)
      .get('/api/v1/governance/audit-logs')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodDenied.status).toBe(403);
  });
});
