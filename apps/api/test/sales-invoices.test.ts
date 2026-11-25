import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 2.6: Sales Invoicing Suite', () => {
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
  let taxRate12Id: string;
  let prodCatId: string;
  let productId: string;
  let variantId: string;
  let invItemId: string;
  let tnCustomerId: string; // Intra-state (stateCode 33)
  let kaCustomerId: string; // Inter-state (stateCode 29)
  let tnAddressId: string;
  let kaAddressId: string;

  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `inv_admin_${suffix}`,
    `inv_salesman_${suffix}`,
    `inv_auditor_${suffix}`,
    `inv_production_${suffix}`,
  ];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const pw = await hashPassword('InvoiceTest2026!');
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

    const admin = await makeUser(`inv_admin_${suffix}`, 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const salesman = await makeUser(`inv_salesman_${suffix}`, 'SALESMAN');
    salesmanUserId = salesman.user.id;
    salesmanToken = salesman.token;

    const auditor = await makeUser(`inv_auditor_${suffix}`, 'AUDITOR');
    auditorUserId = auditor.user.id;
    auditorToken = auditor.token;

    const prod = await makeUser(`inv_production_${suffix}`, 'PRODUCTION');
    productionUserId = prod.user.id;
    productionToken = prod.token;

    const whFG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whFGId = whFG.id;

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
    const tax12 = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_12' } });
    taxRate12Id = tax12.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `ICAT-${suffix}`, name: `Inv Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const product = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `IPRD-${suffix}`,
        name: 'Butter Murukku 200g',
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: taxRate5Id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `ISKU-${suffix}`,
        name: '200g Pouch',
        netWeightGrams: new Prisma.Decimal('200.00'),
        uomId: pcsUomId,
        defaultSellingPrice: new Prisma.Decimal('50.00'),
      },
    });
    variantId = variant.id;

    const invItem = await prisma.inventoryItem.create({
      data: {
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        code: `IINV-${suffix}`,
        name: 'Butter Murukku 200g Pouch',
        uomId: pcsUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('30.0000'),
      },
    });
    invItemId = invItem.id;

    // Seed 500 PCS stock in WH-FG-01
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: invItemId,
        warehouseId: whFGId,
        quantityOnHand: new Prisma.Decimal('500.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('30.0000'),
        totalValue: new Prisma.Decimal('15000.0000'),
      },
    });

    const tnCust = await prisma.customer.create({
      data: {
        code: `ICUST-TN-${suffix}`,
        legalName: 'Trichy Retail Mart',
        customerType: 'RETAILER',
        gstin: `33AABCT${suffix.slice(0, 4)}1Z5`,
        creditPeriodDays: 15,
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '12 Main Road',
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
    tnCustomerId = tnCust.id;
    tnAddressId = tnCust.addresses[0].id;

    const kaCust = await prisma.customer.create({
      data: {
        code: `ICUST-KA-${suffix}`,
        legalName: 'Bengaluru Distributors',
        customerType: 'DISTRIBUTOR',
        gstin: `29AABCB${suffix.slice(0, 4)}1Z2`,
        creditPeriodDays: 30,
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '88 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: '29',
            pincode: '560001',
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
    kaCustomerId = kaCust.id;
    kaAddressId = kaCust.addresses[0].id;
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      await prisma.salesInvoice.deleteMany({ where: { salesOrderId: orderId } });
      await prisma.salesOrderFulfillment.deleteMany({ where: { salesOrderId: orderId } });
      await prisma.salesOrder.deleteMany({ where: { id: orderId } });
    }
    await prisma.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryTransaction.deleteMany({
      where: { postedById: adminUserId },
    });
    await prisma.inventoryIssue.deleteMany({ where: { createdById: adminUserId } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: invItemId } });
    await prisma.inventoryItem.deleteMany({ where: { id: invItemId } });
    await prisma.productVariant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    await prisma.customer.deleteMany({ where: { id: { in: [tnCustomerId, kaCustomerId] } } });
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
  });

  async function createAndFulfillOrder(customerId: string, shippingAddressId: string, qty: string) {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        shippingAddressId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: qty }],
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;
    const lineId = createRes.body.data.lines[0].id as string;
    createdOrderIds.push(orderId);

    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);

    const fulRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'INV-TEST fulfillment', lines: [{ salesOrderLineId: lineId, quantity: qty }] });
    expect(fulRes.status).toBe(200);

    return { orderId, lineId };
  }

  it('1. Creates intra-state invoice from fulfilled order with CGST/SGST, round-off, and sequential numbering', async () => {
    const { orderId } = await createAndFulfillOrder(tnCustomerId, tnAddressId, '15');

    const invRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({ notes: 'Intra-state invoice' });

    expect(invRes.status).toBe(201);
    const inv = invRes.body.data;
    expect(inv.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{5}$/);
    expect(inv.status).toBe('DRAFT');
    expect(inv.isInterState).toBe(false);
    // 15 * 50 = 750.00; GST 5% => CGST 2.5% = 18.75, SGST 2.5% = 18.75, Total = 787.50 -> roundOff 0.50 -> 788.00
    expect(Number(inv.taxableAmount)).toBe(750);
    expect(Number(inv.cgstAmount)).toBe(18.75);
    expect(Number(inv.sgstAmount)).toBe(18.75);
    expect(Number(inv.igstAmount)).toBe(0);
    expect(Number(inv.roundOffAmount)).toBe(0.5);
    expect(Number(inv.grandTotal)).toBe(788);

    // Retrieve by invoice number
    const byNumRes = await request(app)
      .get(`/api/v1/sales/invoices/number/${encodeURIComponent(inv.invoiceNumber)}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(byNumRes.status).toBe(200);
    expect(byNumRes.body.data.id).toBe(inv.id);
  });

  it('2. Supports partial fulfillment, multiple invoices, and prevents over-invoicing or duplicate invoicing', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: tnCustomerId,
        shippingAddressId: tnAddressId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '20' }],
      });
    const orderId = createRes.body.data.id as string;
    const lineId = createRes.body.data.lines[0].id as string;
    createdOrderIds.push(orderId);

    // Unfulfilled order cannot be invoiced
    const unfulInv = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(unfulInv.status).toBe(400);

    await request(app).post(`/api/v1/sales/orders/${orderId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${orderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${orderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);

    // Fulfill 8 of 20
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'INV-TEST partial 1', lines: [{ salesOrderLineId: lineId, quantity: '8' }] });

    // Trying to invoice 10 (> 8 fulfilled) fails
    const overInv = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ lines: [{ salesOrderLineId: lineId, quantity: '10' }] });
    expect(overInv.status).toBe(400);

    // Invoice 5 of 8
    const inv1 = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ lines: [{ salesOrderLineId: lineId, quantity: '5' }] });
    expect(inv1.status).toBe(201);

    // Fulfill remaining 12
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'INV-TEST partial 2', lines: [{ salesOrderLineId: lineId, quantity: '12' }] });

    // Invoice remaining 15 (3 from first fulfillment + 12 from second)
    const inv2 = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(inv2.status).toBe(201);
    expect(Number(inv2.body.data.lines[0].quantity)).toBe(15);

    // Duplicate invoice attempt when 0 uninvoiced remains fails
    const dupInv = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(dupInv.status).toBe(400);
  });

  it('3. Computes inter-state IGST and preserves historical tax snapshot if product tax rate changes later', async () => {
    const { orderId } = await createAndFulfillOrder(kaCustomerId, kaAddressId, '10');

    const invRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(invRes.status).toBe(201);
    const inv = invRes.body.data;
    expect(inv.isInterState).toBe(true);
    expect(Number(inv.cgstAmount)).toBe(0);
    expect(Number(inv.sgstAmount)).toBe(0);
    expect(Number(inv.igstAmount)).toBe(25); // 500 * 5% = 25
    expect(Number(inv.grandTotal)).toBe(525);

    // Mutate product tax rate to 12%
    await prisma.product.update({ where: { id: productId }, data: { taxRateId: taxRate12Id } });
    const fetched = await request(app)
      .get(`/api/v1/sales/invoices/${inv.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(Number(fetched.body.data.igstAmount)).toBe(25);
    expect(Number(fetched.body.data.lines[0].gstRate)).toBe(5);
    // Restore
    await prisma.product.update({ where: { id: productId }, data: { taxRateId: taxRate5Id } });
  });

  it('4. Concurrent invoice creation produces unique sequential numbers and prevents double-invoicing', async () => {
    const { orderId, lineId } = await createAndFulfillOrder(tnCustomerId, tnAddressId, '10');

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/v1/sales/orders/${orderId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({ lines: [{ salesOrderLineId: lineId, quantity: '5' }] }),
      request(app)
        .post(`/api/v1/sales/orders/${orderId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({ lines: [{ salesOrderLineId: lineId, quantity: '5' }] }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.data.invoiceNumber).not.toBe(r2.body.data.invoiceNumber);
  });

  it('5. Enforces draft editing, issue locking, cancellation with reason, PDF download, and RBAC', async () => {
    const { orderId } = await createAndFulfillOrder(tnCustomerId, tnAddressId, '4');

    // PRODUCTION cannot create invoice
    const prodDeny = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({});
    expect(prodDeny.status).toBe(403);

    const createRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({});
    const invId = createRes.body.data.id as string;

    // Draft edit works
    const patchRes = await request(app)
      .patch(`/api/v1/sales/invoices/${invId}`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({ notes: 'Updated draft notes' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.notes).toBe('Updated draft notes');

    // SALESMAN cannot issue
    const salesmanIssue = await request(app)
      .post(`/api/v1/sales/invoices/${invId}/issue`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({});
    expect(salesmanIssue.status).toBe(403);

    // ADMIN issues
    const issueRes = await request(app)
      .post(`/api/v1/sales/invoices/${invId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe('ISSUED');

    // Issued invoice cannot be edited
    const editIssued = await request(app)
      .patch(`/api/v1/sales/invoices/${invId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'Tamper attempt' });
    expect(editIssued.status).toBe(400);

    // AUDITOR can download PDF
    const pdfRes = await request(app)
      .get(`/api/v1/sales/invoices/${invId}/pdf`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdfRes.body).toString('utf8', 0, 4)).toBe('%PDF');

    // Cancel without reason fails
    const badCancel = await request(app)
      .post(`/api/v1/sales/invoices/${invId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: '' });
    expect(badCancel.status).toBe(400);

    // Cancel with reason succeeds and records audit + status history
    const cancelRes = await request(app)
      .post(`/api/v1/sales/invoices/${invId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Customer requested billing address correction' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const auditCount = await prisma.auditLog.count({
      where: { entityType: 'SalesInvoice', entityId: invId },
    });
    expect(auditCount).toBeGreaterThanOrEqual(4); // CREATE, UPDATE, ISSUE, DOWNLOAD, CANCEL
  });
});
