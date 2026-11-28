import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { verifyPitchDemo } from '../prisma/demo-pitch/verify-demo';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

const DEMO_LOGIN_CREDENTIALS = [
  { role: 'OWNER', email: process.env.DEMO_OWNER_EMAIL || 'demo.owner@foodfactory.local' },
  { role: 'ADMIN', email: process.env.DEMO_ADMIN_EMAIL || 'demo.admin@foodfactory.local' },
  { role: 'SALESMAN', email: process.env.DEMO_SALESMAN_EMAIL || 'demo.salesman@foodfactory.local' },
  { role: 'PRODUCTION', email: process.env.DEMO_PRODUCTION_EMAIL || 'demo.production@foodfactory.local' },
  { role: 'AUDITOR', email: process.env.DEMO_AUDITOR_EMAIL || 'demo.auditor@foodfactory.local' },
];

async function countPitchCustomersWithRetry(retries = 3): Promise<number> {
  try {
    return await prisma.customer.count({ where: { code: { startsWith: 'PITCH-' } } });
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2500));
      return countPitchCustomersWithRetry(retries - 1);
    }
    throw err;
  }
}

describe('Pitch-Ready Interconnected Demo Dataset Consistency, RBAC & Exports', () => {
  let ownerToken = '';
  let adminToken = '';
  let salesmanToken = '';
  let productionToken = '';
  let auditorToken = '';
  let hasPitchData = false;
  let retailerAInvoiceId = '';
  let distBOrderId = '';
  let murukkuBatchId = '';

  beforeAll(async () => {
    const pitchCustomerCount = await countPitchCustomersWithRetry();
    hasPitchData = pitchCustomerCount >= 5;
    if (!hasPitchData) return;

    const demoPassword = process.env.DEMO_DEFAULT_PASSWORD || 'DemoFactory2026!';
    const loginRole = async (role: string) => {
      const cfg = DEMO_LOGIN_CREDENTIALS.find(a => a.role === role);
      if (!cfg) throw new Error(`Missing demo account config for ${role}`);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set(CSRF)
        .send({ usernameOrEmail: cfg.email, password: demoPassword });
      expect(res.status).toBe(200);
      return res.body.data.accessToken as string;
    };

    ownerToken = await loginRole('OWNER');
    adminToken = await loginRole('ADMIN');
    salesmanToken = await loginRole('SALESMAN');
    productionToken = await loginRole('PRODUCTION');
    auditorToken = await loginRole('AUDITOR');

    const inv1 = await prisma.salesInvoice.findFirst({
      where: { idempotencyKey: 'PITCH-INV-RETAILER-A' },
    });
    retailerAInvoiceId = inv1?.id ?? '';

    const custB = await prisma.customer.findUnique({ where: { code: 'PITCH-CUST-02' } });
    const soB = custB
      ? await prisma.salesOrder.findFirst({
          where: { customerId: custB.id, notes: { contains: 'Distributor B' } },
        })
      : null;
    distBOrderId = soB?.id ?? '';

    const batch1 = await prisma.productionBatch.findFirst({
      where: { idempotencyKey: 'PITCH-BATCH-MUR-01' },
    });
    murukkuBatchId = batch1?.id ?? '';
  }, 30000);

  it('1. Passes all financial, inventory, costing, and shortage reconciliation checks', async () => {
    if (!hasPitchData) return;
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: 'demo_admin' },
      include: { userRoles: { include: { role: true } } },
    });
    const report = await verifyPitchDemo(prisma, {
      userId: admin.id,
      username: admin.username,
      roles: admin.userRoles.map(ur => ur.role.code),
    });
    expect(report.counts.customers).toBe(5);
    expect(report.counts.suppliers).toBe(4);
    expect(report.counts.products).toBe(5);
    expect(report.counts.rawMaterials).toBe(8);
    expect(report.counts.boms).toBe(5);
    expect(report.counts.supplierInvoices).toBe(4);
    expect(report.counts.productionBatches).toBe(4);
    expect(report.counts.salesOrders).toBe(6);
    expect(report.counts.salesInvoices).toBe(5);
    expect(report.counts.customerPayments).toBe(6);
    expect(report.counts.creditNotes).toBe(1);
    expect(report.allPassed).toBe(true);
  }, 30000);

  it('2. Serves Distributor B shortage, Retailer A invoice PDF, ageing, purchase register, and batch costing via API', async () => {
    if (!hasPitchData) return;

    const distRes = await request(app)
      .get(`/api/v1/sales/orders/${distBOrderId}`)
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(distRes.status).toBe(200);
    expect(distRes.body.data.stockAvailability.status).toBe('INSUFFICIENT');
    expect(Number(distRes.body.data.stockAvailability.lines[0].shortageQuantity)).toBe(32);

    const invPdf = await request(app)
      .get(`/api/v1/sales/invoices/${retailerAInvoiceId}/pdf`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(invPdf.status).toBe(200);
    expect(Buffer.from(invPdf.body).toString('utf8', 0, 4)).toBe('%PDF');

    const ageingRes = await request(app)
      .get('/api/v1/sales/ageing')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ageingRes.status).toBe(200);
    expect(Number(ageingRes.body.data.bucketTotals.totalOutstanding)).toBeGreaterThanOrEqual(3875);

    const regRes = await request(app)
      .get('/api/v1/purchases/register')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(regRes.status).toBe(200);
    expect(regRes.body.data.invoiceCount).toBeGreaterThanOrEqual(4);

    const costRes = await request(app)
      .get(`/api/v1/production/costing/batches/${murukkuBatchId}`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(costRes.status).toBe(200);
    const actualCost = costRes.body.data.costing?.totalActualCost ?? costRes.body.data.totalActualCost;
    expect(Number(actualCost)).toBe(5855);
  }, 45000);

  it('3. Generates valid CSV, Excel, and PDF analytics exports and enforces RBAC', async () => {
    if (!hasPitchData) return;

    const csvRes = await request(app)
      .get('/api/v1/reports/export/sales?format=csv')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('Murukku 200g,Traditional Snacks,150.00,7500.00');

    const xlsxRes = await request(app)
      .get('/api/v1/reports/export/sales?format=excel')
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(xlsxRes.status).toBe(200);
    expect(Buffer.from(xlsxRes.body).subarray(0, 2).toString('utf8')).toBe('PK');

    const pdfRes = await request(app)
      .get('/api/v1/reports/export/sales?format=pdf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdfRes.status).toBe(200);
    expect(Buffer.from(pdfRes.body).toString('utf8', 0, 4)).toBe('%PDF');

    // RBAC: AUDITOR cannot create payments; PRODUCTION cannot read payments
    const audPay = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ customerId: '00000000-0000-0000-0000-000000000000', amount: '10', paymentMode: 'CASH' });
    expect(audPay.status).toBe(403);

    const prodPay = await request(app)
      .get('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodPay.status).toBe(403);

    const execDash = await request(app)
      .get('/api/v1/reports/executive-dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(execDash.status).toBe(200);
  }, 45000);
});
