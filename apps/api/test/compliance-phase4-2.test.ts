import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 4.2 Financial & Compliance Management Suite', () => {
  let adminToken: string;
  let productionToken: string;
  let salesmanToken: string;
  let auditorToken: string;

  let whRmId: string;
  let uomKgId: string;
  let rmItemId: string;
  let createdAuditId: string;
  let createdDocId: string;
  let initialBalanceQty: number;

  async function buildUser(username: string, roleCode: string) {
    const pw = await hashPassword('Phase42Pass!2026');
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
        fullName: `P42 ${roleCode}`,
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
    const admin = await buildUser('p42_admin', 'ADMIN');
    const prod = await buildUser('p42_production', 'PRODUCTION');
    const sales = await buildUser('p42_salesman', 'SALESMAN');
    const auditor = await buildUser('p42_auditor', 'AUDITOR');

    adminToken = admin.token;
    productionToken = prod.token;
    salesmanToken = sales.token;
    auditorToken = auditor.token;

    const wh = await prisma.warehouse.findFirst({ where: { isActive: true } });
    if (!wh) throw new Error('No active warehouse found');
    whRmId = wh.id;

    // Grant PRODUCTION user warehouse access for stock audit
    await prisma.userWarehouseAccess.upsert({
      where: { userId_warehouseId: { userId: prod.user.id, warehouseId: whRmId } },
      update: { accessLevel: 'READ_WRITE' },
      create: { userId: prod.user.id, warehouseId: whRmId, accessLevel: 'READ_WRITE' },
    });

    const item = await prisma.inventoryItem.findFirst({
      where: { isActive: true },
      include: { uom: true },
    });
    if (!item) throw new Error('No active inventory item found');
    rmItemId = item.id;
    uomKgId = item.uomId;

    const balAgg = await prisma.inventoryBalance.aggregate({
      where: { warehouseId: whRmId, inventoryItemId: rmItemId },
      _sum: { quantityOnHand: true },
    });
    initialBalanceQty = Number(balAgg._sum.quantityOnHand || 0);
  });

  afterAll(async () => {
    if (createdAuditId) {
      await prisma.stockAudit.deleteMany({ where: { id: createdAuditId } });
    }
    if (createdDocId) {
      await prisma.complianceDocument.deleteMany({ where: { id: createdDocId } });
    }
  });

  it('1. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/compliance/gst/sales-summary');
    expect(res.status).toBe(401);
  });

  it('2. GST Sales Summary uses invoice snapshots and Purchase Summary reports unsupported ITC', async () => {
    const salesRes = await request(app)
      .get('/api/v1/compliance/gst/sales-summary')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(salesRes.status).toBe(200);
    expect(salesRes.body.data.counts).toHaveProperty('issued');
    expect(salesRes.body.data.counts).toHaveProperty('cancelled');
    expect(salesRes.body.data.counts).toHaveProperty('draft');
    expect(salesRes.body.data.totals).toHaveProperty('taxableSalesValue');
    expect(Array.isArray(salesRes.body.data.hsnSummary)).toBe(true);

    const purchRes = await request(app)
      .get('/api/v1/compliance/gst/purchase-summary')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(purchRes.status).toBe(200);
    expect(purchRes.body.data.purchaseInvoicingSupported).toBe(false);

    // SALESMAN & PRODUCTION denied tax compliance
    const salesDenied = await request(app)
      .get('/api/v1/compliance/gst/sales-summary')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesDenied.status).toBe(403);

    const prodDenied = await request(app)
      .get('/api/v1/compliance/gst/sales-summary')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodDenied.status).toBe(403);
  });

  it('3. Inventory valuation report & Stock Audit workflow (create -> submit -> approve -> post idempotently)', async () => {
    const valRes = await request(app)
      .get('/api/v1/compliance/inventory/valuation')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(valRes.status).toBe(200);
    expect(valRes.body.data.summary).toHaveProperty('totalValuation');

    // PRODUCTION creates physical stock count (+0 variance so we don't mutate test stock unpredictably, or +2 and check)
    const countedQty = initialBalanceQty + 2;
    const createRes = await request(app)
      .post('/api/v1/compliance/stock-audits')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        warehouseId: whRmId,
        notes: 'Cycle count verification',
        lines: [
          {
            inventoryItemId: rmItemId,
            uomId: uomKgId,
            countedQuantity: countedQty,
            varianceReason: 'PHYSICAL_COUNT',
          },
        ],
      });
    expect(createRes.status).toBe(201);
    createdAuditId = createRes.body.data.id;
    expect(Number(createRes.body.data.lines[0].varianceBaseQuantity)).toBe(2);

    // Submit
    const submitRes = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/submit`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    // PRODUCTION cannot review/approve
    const prodApproveDenied = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/review`)
      .set('Authorization', `Bearer ${productionToken}`)
      .send({ decision: 'APPROVED' });
    expect(prodApproveDenied.status).toBe(403);

    // AUDITOR cannot review/approve
    const audApproveDenied = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/review`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ decision: 'APPROVED' });
    expect(audApproveDenied.status).toBe(403);

    // ADMIN approves
    const approveRes = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', reason: 'Verified physical recount' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    // ADMIN posts adjustment via InventoryAdjustmentService
    const postRes = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: `P42-SA-${createdAuditId}` });
    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe('POSTED');
    expect(postRes.body.data.inventoryAdjustmentId).toBeTruthy();

    // Idempotent retry does not double-post
    const retryRes = await request(app)
      .post(`/api/v1/compliance/stock-audits/${createdAuditId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: `P42-SA-${createdAuditId}` });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.inventoryAdjustmentId).toBe(postRes.body.data.inventoryAdjustmentId);
  });

  it('4. Production cost compliance, traceability, and authorized exports (CSV, Excel, PDF)', async () => {
    const costRes = await request(app)
      .get('/api/v1/compliance/production-costing')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(costRes.status).toBe(200);
    expect(costRes.body.data.summary).toHaveProperty('finalizedCount');

    const traceRes = await request(app)
      .get('/api/v1/compliance/traceability')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(traceRes.status).toBe(200);
    expect(Array.isArray(traceRes.body.data.items)).toBe(true);

    const csvRes = await request(app)
      .get('/api/v1/compliance/export/gst-sales?format=csv')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');

    const pdfRes = await request(app)
      .get('/api/v1/compliance/export/inventory-valuation?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    // SALESMAN denied compliance exports
    const salesDenied = await request(app)
      .get('/api/v1/compliance/export/gst-sales?format=csv')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(salesDenied.status).toBe(403);
  });

  it('5. Compliance document metadata validation (blocks executables) and verification', async () => {
    const badDocRes = await request(app)
      .post('/api/v1/compliance/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'FSSAI',
        referenceNumber: 'FSSAI-2026-001',
        documentDate: '2026-04-01',
        fileName: 'malware.exe',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        fileReference: 's3://compliance/malware.exe',
      });
    expect(badDocRes.status).toBe(400);

    const createDocRes = await request(app)
      .post('/api/v1/compliance/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'FSSAI',
        referenceNumber: 'FSSAI-2026-001',
        documentDate: '2026-04-01',
        expiryDate: '2027-03-31',
        fileName: 'fssai-license-2026.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 245760,
        fileReference: 'vault://compliance/fssai-license-2026.pdf',
      });
    expect(createDocRes.status).toBe(201);
    createdDocId = createDocRes.body.data.id;

    const verifyRes = await request(app)
      .post(`/api/v1/compliance/documents/${createdDocId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED', remarks: 'Verified against FSSAI portal' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verificationStatus).toBe('VERIFIED');
  });
});
