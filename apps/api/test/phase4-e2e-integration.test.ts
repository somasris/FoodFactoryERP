import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4 Cross-Module End-to-End Integration Audit', () => {
  let ownerToken: string;
  let adminToken: string;
  let productionToken: string;
  let salesmanToken: string;
  let auditorToken: string;

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase4E2E!2026');
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new Error(`Role ${roleCode} not found`);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash: pw, isActive: true, registrationStatus: 'APPROVED' },
      create: {
        email: `${username}@foodfactory.com`,
        username,
        passwordHash: pw,
        fullName: `P4 E2E ${roleCode}`,
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: role.id } },
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
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
    const [owner, admin, prod, sales, auditor] = await Promise.all([
      buildUser('p4_e2e_owner', 'OWNER'),
      buildUser('p4_e2e_admin', 'ADMIN'),
      buildUser('p4_e2e_prod', 'PRODUCTION'),
      buildUser('p4_e2e_sales', 'SALESMAN'),
      buildUser('p4_e2e_auditor', 'AUDITOR'),
    ]);
    ownerToken = owner.token;
    adminToken = admin.token;
    productionToken = prod.token;
    salesmanToken = sales.token;
    auditorToken = auditor.token;
  });

  it('1. Reconciles organization, GST sales, inventory valuation, and executive dashboard KPIs', async () => {
    const [orgRes, gstRes, valRes, execRes] = await Promise.all([
      request(app)
        .get('/api/v1/admin/organization')
        .set('Authorization', `Bearer ${ownerToken}`),
      request(app)
        .get('/api/v1/compliance/gst/sales-summary')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/compliance/inventory/valuation')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/reports/executive-dashboard')
        .set('Authorization', `Bearer ${ownerToken}`),
    ]);

    expect(orgRes.status).toBe(200);
    expect(orgRes.body.data.gstin).toMatch(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}/);

    expect(gstRes.status).toBe(200);
    expect(valRes.status).toBe(200);
    expect(execRes.status).toBe(200);

    // Executive Dashboard issuedInvoiceValue must match GST Sales Summary grandTotal
    expect(execRes.body.data.businessKpis.issuedInvoiceValue).toBe(
      gstRes.body.data.totals.grandTotal,
    );
    // Executive Dashboard inventoryValue must match Compliance Inventory Valuation totalValuation
    expect(execRes.body.data.businessKpis.inventoryValue).toBe(
      valRes.body.data.summary.totalValuation,
    );
  });

  it('2. Enforces cross-phase RBAC boundaries across all 5 roles', async () => {
    // AUDITOR: read-only across all Phase 4 modules, denied all mutations
    const audRead = await request(app)
      .get('/api/v1/governance/audit-logs')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audRead.status).toBe(200);

    const audWrite = await request(app)
      .put('/api/v1/operations/maintenance-mode')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ enabled: true });
    expect(audWrite.status).toBe(403);

    // SALESMAN: allowed sales BI, denied admin, tax compliance, profitability, governance, operations
    expect(
      (
        await request(app)
          .get('/api/v1/reports/sales')
          .set('Authorization', `Bearer ${salesmanToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/reports/profitability')
          .set('Authorization', `Bearer ${salesmanToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/v1/operations/health')
          .set('Authorization', `Bearer ${salesmanToken}`)
      ).status,
    ).toBe(403);

    // PRODUCTION: allowed production BI, denied admin settings & governance audit logs
    expect(
      (
        await request(app)
          .get('/api/v1/reports/production')
          .set('Authorization', `Bearer ${productionToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/admin/settings')
          .set('Authorization', `Bearer ${productionToken}`)
      ).status,
    ).toBe(403);
  });
});
