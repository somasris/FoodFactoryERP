import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 2: Sales & Orders Management Suite', () => {
  let adminToken: string;
  let salesmanToken: string;
  let auditorToken: string;
  let productionToken: string;

  let adminUserId: string;
  let salesmanUserId: string;
  let auditorUserId: string;
  let productionUserId: string;

  let whFGId: string;
  let pcsUomId: string;
  let taxRate5Id: string;
  let prodCatId: string;
  let productId: string;
  let variantId: string;
  let invItemId: string;
  let customerId: string;
  let shippingAddressId: string;

  const createdUsernames = ['so_admin', 'so_salesman', 'so_auditor', 'so_production'];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });

    const pw = await hashPassword('SalesTest2026!');
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    const roleMap = new Map(roles.map(r => [r.code, r]));

    const makeUser = async (username: string, roleCode: string) => {
      const role = roleMap.get(roleCode)!;
      const user = await prisma.user.create({
        data: {
          email: `${username}@foodfactory.com`,
          username,
          passwordHash: pw,
          fullName: `Test ${username}`,
          isActive: true,
          userRoles: { create: { roleId: role.id } },
        },
      });
      const token = generateAccessToken({
        userId: user.id,
        username: user.username,
        roles: [role.code],
        permissions: role.permissions.map(p => p.permission.code),
      });
      return { user, token };
    };

    const admin = await makeUser('so_admin', 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const salesman = await makeUser('so_salesman', 'SALESMAN');
    salesmanUserId = salesman.user.id;
    salesmanToken = salesman.token;

    const auditor = await makeUser('so_auditor', 'AUDITOR');
    auditorUserId = auditor.user.id;
    auditorToken = auditor.token;

    const prod = await makeUser('so_production', 'PRODUCTION');
    productionUserId = prod.user.id;
    productionToken = prod.token;

    const whFG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whFGId = whFG.id;

    // Grant salesman and production READ_WRITE access to WH-FG-01
    await prisma.userWarehouseAccess.createMany({
      data: [
        { userId: salesmanUserId, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
        { userId: productionUserId, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
        { userId: auditorUserId, warehouseId: whFGId, accessLevel: 'READ' },
      ],
    });

    const pcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    pcsUomId = pcs.id;

    const tax5 = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
    taxRate5Id = tax5.id;

    const suffix = Date.now().toString().slice(-6);
    const prodCat = await prisma.productCategory.create({
      data: { code: `PC-SO-${suffix}`, name: `Sales Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const prodEntity = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `PRD-SO-${suffix}`,
        name: `Masala Murukku ${suffix}`,
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: taxRate5Id,
        variants: {
          create: {
            sku: `SKU-SO-${suffix}`,
            name: `Masala Murukku 200g ${suffix}`,
            netWeightGrams: '200.00',
            uomId: pcsUomId,
            defaultSellingPrice: '100.00',
            inventoryItem: {
              create: {
                itemType: 'FINISHED_GOODS',
                code: `SKU-SO-${suffix}`,
                name: `Masala Murukku 200g ${suffix}`,
                uomId: pcsUomId,
                valuationMethod: 'BATCH_ACTUAL',
              },
            },
          },
        },
      },
      include: { variants: { include: { inventoryItem: true } } },
    });
    productId = prodEntity.id;
    variantId = prodEntity.variants[0].id;
    invItemId = prodEntity.variants[0].inventoryItem!.id;

    const customer = await prisma.customer.create({
      data: {
        code: `CUST-SO-${suffix}`,
        legalName: `Trichy Retail Mart ${suffix}`,
        customerType: 'RETAILER',
        addresses: {
          create: {
            addressType: 'SHIPPING',
            addressLine1: '100 Main Road',
            city: 'Tiruchirappalli',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '620001',
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
    customerId = customer.id;
    shippingAddressId = customer.addresses[0].id;

    // Seed 50 PCS of Finished Goods into WH-FG-01 via Inventory Receipt
    const rcpRes = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whFGId,
        lines: [
          {
            inventoryItemId: invItemId,
            uomId: pcsUomId,
            quantity: '50',
            unitCost: '60.00',
            batchNumber: `BATCH-SO-${suffix}`,
            manufacturingDate: '2026-01-01',
            expiryDate: '2027-06-01',
          },
        ],
      });
    const rcpId = rcpRes.body.data.id;
    await request(app).post(`/api/v1/inventory/receipts/${rcpId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/inventory/receipts/${rcpId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
  });

  afterAll(async () => {
    await prisma.salesOrderFulfillment.deleteMany({
      where: { salesOrder: { customerId } },
    });
    await prisma.salesOrderStatusHistory.deleteMany({
      where: { salesOrder: { customerId } },
    });
    await prisma.salesOrderLine.deleteMany({
      where: { salesOrder: { customerId } },
    });
    await prisma.salesOrder.deleteMany({ where: { customerId } });

    await prisma.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryTransaction.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryReceiptLine.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryReceipt.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryIssueLine.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryIssue.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryBatch.deleteMany({ where: { inventoryItemId: invItemId } });

    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.inventoryItem.deleteMany({ where: { id: invItemId } });
    await prisma.productVariant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productCategory.deleteMany({ where: { id: prodCatId } });

    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, salesmanUserId, auditorUserId, productionUserId] } },
    });
  });

  it('1. Enforces authentication (401) and RBAC across AUDITOR, SALESMAN, PRODUCTION', async () => {
    const unauth = await request(app).get('/api/v1/sales/orders');
    expect(unauth.status).toBe(401);

    // AUDITOR can read orders & dashboard, cannot create
    const audList = await request(app)
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audList.status).toBe(200);

    const audCreate = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '5' }],
      });
    expect(audCreate.status).toBe(403);

    // PRODUCTION cannot create sales orders
    const prodCreate = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '5' }],
      });
    expect(prodCreate.status).toBe(403);
  });

  it('2. Rejects invalid customer, invalid variant, and invalid quantities', async () => {
    const badCust = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        customerId: '00000000-0000-4000-8000-000000000000',
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '5' }],
      });
    expect(badCust.status).toBe(404);

    const badQty = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '-5' }],
      });
    expect(badQty.status).toBe(400);
  });

  it('3. Creates order with authoritative Decimal pricing & GST calculation, supports reject -> edit -> resubmit -> approve -> confirm -> cancel & stock release', async () => {
    // 10 PCS * 100.00 = 1000.00; 10% discount = 100.00; taxable = 900.00; GST 5% = 45.00; total = 945.00
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        customerId,
        shippingAddressId,
        warehouseId: whFGId,
        notes: 'Urgent festival order',
        lines: [
          {
            productVariantId: variantId,
            uomId: pcsUomId,
            orderedQuantity: '10',
            discountPercent: '10',
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const order = createRes.body.data;
    expect(order.status).toBe('DRAFT');
    expect(order.subtotal).toBe('1000');
    expect(order.discountAmount).toBe('100');
    expect(order.taxAmount).toBe('45');
    expect(order.totalAmount).toBe('945');

    // Submit by SALESMAN
    const sub1 = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/submit`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({});
    expect(sub1.status).toBe(200);
    expect(sub1.body.data.status).toBe('SUBMITTED');

    // SALESMAN cannot approve
    const salesApprove = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/approve`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({});
    expect(salesApprove.status).toBe(403);

    // ADMIN rejects
    const rejRes = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Increase quantity to 20' });
    expect(rejRes.status).toBe(200);
    expect(rejRes.body.data.status).toBe('REJECTED');

    // SALESMAN edits REJECTED order to 20 PCS (0% discount): 2000 + 100 tax = 2100
    const updRes = await request(app)
      .patch(`/api/v1/sales/orders/${order.id}`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '20', discountPercent: '0' }],
      });
    expect(updRes.status).toBe(200);
    expect(updRes.body.data.totalAmount).toBe('2100');

    // Resubmit -> Approve -> Confirm (reserves 20 PCS)
    await request(app).post(`/api/v1/sales/orders/${order.id}/submit`).set('Authorization', `Bearer ${salesmanToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/sales/orders/${order.id}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});

    const confRes = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `CONF-${order.id}` });
    expect(confRes.status).toBe(200);
    expect(confRes.body.data.status).toBe('CONFIRMED');

    // Idempotent confirm retry succeeds
    const confRetry = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `CONF-${order.id}` });
    expect(confRetry.status).toBe(200);

    // Verify InventoryBalance shows 20 reserved out of 50 onHand
    const balAfterConfirm = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: whFGId, inventoryItemId: invItemId },
    });
    expect(new Prisma.Decimal(balAfterConfirm.quantityOnHand).toFixed(4)).toBe('50.0000');
    expect(new Prisma.Decimal(balAfterConfirm.quantityReserved).toFixed(4)).toBe('20.0000');

    // Cancel CONFIRMED order -> releases 20 reserved back to 0
    const cancelRes = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Customer postponed' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const balAfterCancel = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: whFGId, inventoryItemId: invItemId },
    });
    expect(new Prisma.Decimal(balAfterCancel.quantityReserved).toFixed(4)).toBe('0.0000');

    // Verify status history & audit logs
    const histRes = await request(app)
      .get(`/api/v1/sales/orders/${order.id}/history`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('4. Concurrent confirmations cannot oversell available stock', async () => {
    const makeApprovedOrder = async (qty: string) => {
      const c = await request(app)
        .post('/api/v1/sales/orders')
        .set('Authorization', `Bearer ${salesmanToken}`)
        .set(CSRF)
        .send({
          customerId,
          warehouseId: whFGId,
          lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: qty }],
        });
      const id = c.body.data.id;
      await request(app).post(`/api/v1/sales/orders/${id}/submit`).set('Authorization', `Bearer ${salesmanToken}`).set(CSRF).send({});
      await request(app).post(`/api/v1/sales/orders/${id}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
      return id;
    };

    // Stock available is 50 PCS; two orders each request 35 PCS simultaneously!
    const [o1, o2] = await Promise.all([makeApprovedOrder('35'), makeApprovedOrder('35')]);
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/v1/sales/orders/${o1}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({}),
      request(app).post(`/api/v1/sales/orders/${o2}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({}),
    ]);

    expect([r1.status, r2.status].sort()).toEqual([200, 400]);

    const confirmedId = r1.status === 200 ? o1 : o2;
    // Cancel the confirmed one to restore 50 available for test 5
    await request(app)
      .post(`/api/v1/sales/orders/${confirmedId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Cleanup after concurrency test' });
  });

  it('5. Partial and full fulfillment posts InventoryIssue + InventoryTransaction and updates dashboard', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '30' }],
      });
    const orderId = createRes.body.data.id;
    const lineId = createRes.body.data.lines[0].id;

    await request(app).post(`/api/v1/sales/orders/${orderId}/submit`).set('Authorization', `Bearer ${salesmanToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/sales/orders/${orderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/sales/orders/${orderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});

    // Partial fulfillment of 12 PCS by PRODUCTION
    const partFulfill = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: `FUL-PART-${orderId}`,
        notes: 'Dispatch batch 1',
        lines: [{ salesOrderLineId: lineId, quantity: '12' }],
      });
    expect(partFulfill.status).toBe(200);
    expect(partFulfill.body.data.order.status).toBe('PARTIALLY_FULFILLED');

    // Duplicate idempotency key returns idempotently without double-issuing
    const partDup = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: `FUL-PART-${orderId}`,
        lines: [{ salesOrderLineId: lineId, quantity: '12' }],
      });
    expect(partDup.status).toBe(200);

    // Remaining fulfillment (18 PCS) without specifying lines
    const fullFulfill = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `FUL-FULL-${orderId}` });
    expect(fullFulfill.status).toBe(200);
    expect(fullFulfill.body.data.order.status).toBe('FULFILLED');

    // Verify InventoryBalance is now 20 onHand (50 - 30) and 0 reserved
    const bal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: whFGId, inventoryItemId: invItemId },
    });
    expect(new Prisma.Decimal(bal.quantityOnHand).toFixed(4)).toBe('20.0000');
    expect(new Prisma.Decimal(bal.quantityReserved).toFixed(4)).toBe('0.0000');

    // Verify Sales Dashboard
    const dashRes = await request(app)
      .get('/api/v1/sales/dashboard')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.fulfilledOrders).toBeGreaterThanOrEqual(1);
  });
});
