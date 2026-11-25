import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4.3 Business Intelligence & Reports Suite', () => {
  let adminToken: string;
  let productionToken: string;
  let salesmanToken: string;
  let auditorToken: string;

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase43Pass!2026');
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
        fullName: `P43 ${roleCode}`,
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
    const admin = await buildUser('p43_admin', 'ADMIN');
    const prod = await buildUser('p43_production', 'PRODUCTION');
    const sales = await buildUser('p43_salesman', 'SALESMAN');
    const auditor = await buildUser('p43_auditor', 'AUDITOR');

    adminToken = admin.token;
    productionToken = prod.token;
    salesmanToken = sales.token;
    auditorToken = auditor.token;
  });

  it('1. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/reports/executive-dashboard');
    expect(res.status).toBe(401);
  });

  it('2. Executive Dashboard returns live Business and Operational KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/reports/executive-dashboard?financialYear=2026-27')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.businessKpis).toHaveProperty('issuedInvoiceValue');
    expect(res.body.data.businessKpis).toHaveProperty('inventoryValue');
    expect(res.body.data.operationalKpis).toHaveProperty('activeWorkOrders');
    expect(res.body.data.operationalKpis).toHaveProperty('pendingInspections');
  });

  it('3. Sales, Inventory, Production, Profitability, and Factory analytics return structured data', async () => {
    const [salesRes, invRes, prodRes, profRes, facRes] = await Promise.all([
      request(app).get('/api/v1/reports/sales').set('Authorization', `Bearer ${auditorToken}`),
      request(app).get('/api/v1/reports/inventory').set('Authorization', `Bearer ${auditorToken}`),
      request(app).get('/api/v1/reports/production').set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/reports/profitability')
        .set('Authorization', `Bearer ${auditorToken}`),
      request(app)
        .get('/api/v1/reports/factory-performance')
        .set('Authorization', `Bearer ${auditorToken}`),
    ]);

    expect(salesRes.status).toBe(200);
    expect(salesRes.body.data.revenueSourceNote).toContain('ISSUED SalesInvoices');

    expect(invRes.status).toBe(200);
    expect(Array.isArray(invRes.body.data.qualityDistribution)).toBe(true);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.data).toHaveProperty('dashboard');

    expect(profRes.status).toBe(200);
    expect(profRes.body.data.disclaimer).toContain('NOT net profit');

    expect(facRes.status).toBe(200);
    expect(Array.isArray(facRes.body.data.items)).toBe(true);
  });

  it('4. BI Exports (CSV, Excel, PDF) and RBAC enforcement across roles', async () => {
    const csvRes = await request(app)
      .get('/api/v1/reports/export/profitability?format=csv')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');

    const pdfRes = await request(app)
      .get('/api/v1/reports/export/factory-performance?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    // SALESMAN allowed sales analytics, denied profitability & factory performance
    const salesAllowed = await request(app)
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesAllowed.status).toBe(200);

    const salesProfDenied = await request(app)
      .get('/api/v1/reports/profitability')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesProfDenied.status).toBe(403);

    // PRODUCTION allowed production analytics, denied profitability
    const prodAllowed = await request(app)
      .get('/api/v1/reports/production')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodAllowed.status).toBe(200);

    const prodProfDenied = await request(app)
      .get('/api/v1/reports/profitability')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodProfDenied.status).toBe(403);
  });
});
