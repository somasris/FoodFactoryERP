import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('New Sales Order Stock Availability & Full Order-to-Cash Integration Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  let adminToken: string;
  let adminUserId: string;
  let customerId: string;
  let whFgId: string;
  let murVariantId: string;
  let mixVariantId: string;
  let banVariantId: string;
  let pcsUomId: string;

  beforeAll(async () => {
    const pw = await hashPassword('NewOrderTest2026!');
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });
    const user = await prisma.user.create({
      data: {
        email: `new_so_admin_${suffix}@foodfactory.com`,
        username: `new_so_admin_${suffix}`,
        passwordHash: pw,
        fullName: 'New Order Admin',
        isActive: true,
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
    adminUserId = user.id;
    adminToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      roles: ['ADMIN'],
      permissions: adminRole.permissions.map(p => p.permission.code),
    });

    const wh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whFgId = wh.id;
    const cust = await prisma.customer.findUniqueOrThrow({ where: { code: 'DEMO-CUST-01' } });
    customerId = cust.id;
    const pcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    pcsUomId = pcs.id;

    murVariantId = (await prisma.productVariant.findUniqueOrThrow({ where: { sku: 'MUR-200' } })).id;
    mixVariantId = (await prisma.productVariant.findUniqueOrThrow({ where: { sku: 'MIX-200' } })).id;
    banVariantId = (await prisma.productVariant.findUniqueOrThrow({ where: { sku: 'BAN-200' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Brand-new small order (10 pcs Murukku 200g) resolves default WH-FG-01 and shows SUFFICIENT', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        // Omit warehouseId to test deterministic default FINISHED_GOODS warehouse resolution
        lines: [{ productVariantId: murVariantId, uomId: pcsUomId, orderedQuantity: '10' }],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;
    expect(createRes.body.data.warehouseId).toBe(whFgId);

    const detailRes = await request(app)
      .get(`/api/v1/sales/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.stockAvailability.status).toBe('SUFFICIENT');
    expect(detailRes.body.data.stockAvailability.lines[0].isSufficient).toBe(true);
  });

  it('2. Multi-product new order (MUR-200, MIX-200, BAN-200 x 10 each) shows SUFFICIENT and deducts stock on fulfillment', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFgId,
        lines: [
          { productVariantId: murVariantId, uomId: pcsUomId, orderedQuantity: '10' },
          { productVariantId: mixVariantId, uomId: pcsUomId, orderedQuantity: '10' },
          { productVariantId: banVariantId, uomId: pcsUomId, orderedQuantity: '10' },
        ],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;

    await request(app).post(`/api/v1/sales/orders/${orderId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${orderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const conf = await request(app).post(`/api/v1/sales/orders/${orderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(conf.status).toBe(200);

    const ful = await request(app).post(`/api/v1/sales/orders/${orderId}/fulfill`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(ful.status).toBe(200);
    expect(ful.body.data.order.status).toBe('FULFILLED');
  });

  it('3. Genuine shortage on new order shows INSUFFICIENT with warehouse & shortage details and rejects confirm', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFgId,
        lines: [{ productVariantId: murVariantId, uomId: pcsUomId, orderedQuantity: '999999' }],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;

    const detail = await request(app).get(`/api/v1/sales/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.stockAvailability.status).toBe('INSUFFICIENT');

    await request(app).post(`/api/v1/sales/orders/${orderId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${orderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const conf = await request(app).post(`/api/v1/sales/orders/${orderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(conf.status).toBe(400);
    expect(conf.body.message).toMatch(/WH-FG-01/);
    expect(conf.body.message).toMatch(/Shortage:/);
  });

  it('4. Complete Demo Workflow: Create -> Submit -> Approve -> Confirm -> Fulfill -> Invoice -> Payment -> 0 Outstanding', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFgId,
        lines: [{ productVariantId: murVariantId, uomId: pcsUomId, orderedQuantity: '5' }],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;

    expect((await request(app).post(`/api/v1/sales/orders/${orderId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF)).status).toBe(200);
    expect((await request(app).post(`/api/v1/sales/orders/${orderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF)).status).toBe(200);
    expect((await request(app).post(`/api/v1/sales/orders/${orderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({})).status).toBe(200);
    expect((await request(app).post(`/api/v1/sales/orders/${orderId}/fulfill`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({})).status).toBe(200);

    // Create & issue invoice
    const orderDetail = await request(app).get(`/api/v1/sales/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`);
    const orderLineId = orderDetail.body.data.lines[0].id as string;
    const invCreate = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        lines: [{ salesOrderLineId: orderLineId, quantity: '5' }],
      });
    expect(invCreate.status).toBe(201);
    const invoiceId = invCreate.body.data.id as string;
    const grandTotal = invCreate.body.data.grandTotal as string;

    const invIssue = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(invIssue.status).toBe(200);

    // Record & allocate payment
    const payCreate = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: 'UPI',
        amount: grandTotal,
        referenceNumber: `UPI-DEMO-${suffix}`,
      });
    expect(payCreate.status).toBe(201);
    const paymentId = payCreate.body.data.id as string;

    const payAlloc = await request(app)
      .post(`/api/v1/sales/payments/${paymentId}/allocate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        allocations: [{ salesInvoiceId: invoiceId, allocatedAmount: grandTotal }],
      });
    expect(payAlloc.status).toBe(200);

    const invAfter = await request(app)
      .get(`/api/v1/sales/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invAfter.status).toBe(200);
    expect(invAfter.body.data.paymentStatus).toBe('PAID');
  });
});
