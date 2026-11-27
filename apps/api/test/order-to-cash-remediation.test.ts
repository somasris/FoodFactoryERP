import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { generateAccessToken } from '../src/utils/token';
import { seedDemoSalesProfile } from '../prisma/seed-demo-sales';
import { InventoryReceiptService } from '../src/modules/inventory/inventory-receipt.service';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Order-to-Cash Flow Remediation (Inventory, Fulfilment, Invoicing & Payments)', () => {
  const suffix = Date.now().toString().slice(-6);
  let adminToken = '';
  let adminUserId = '';
  let warehouseId = '';
  let customerId = '';
  let uomPcsId = '';
  let tax5Id = '';

  // Isolated test product variants & inventory items
  let sufficientVariantId = '';
  let sufficientItemId = '';
  let limitedVariantId = '';
  let limitedItemId = '';
  let multiBatchVariantId = '';
  let multiBatchItemId = '';

  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: {
        isActive: true,
        userRoles: { some: { role: { code: 'OWNER' } } },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    adminUserId = ownerUser.id;
    const roles = ownerUser.userRoles.map(ur => ur.role.code);
    const permissions = Array.from(
      new Set(
        ownerUser.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code)),
      ),
    );
    adminToken = generateAccessToken({
      userId: ownerUser.id,
      username: ownerUser.username,
      email: ownerUser.email,
      roles,
      permissions,
    });

    const whFG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    warehouseId = whFG.id;

    const uomPcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    uomPcsId = uomPcs.id;

    const gst5 = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
    tax5Id = gst5.id;

    const prodCat = await prisma.productCategory.upsert({
      where: { code: `OTC-CAT-${suffix}` },
      update: {},
      create: { code: `OTC-CAT-${suffix}`, name: `OTC Test Category ${suffix}` },
    });

    const customer = await prisma.customer.create({
      data: {
        code: `OTC-CUST-${suffix}`,
        legalName: `OTC Test Retail ${suffix}`,
        customerType: 'RETAILER',
        gstin: `33AABCU${suffix.slice(0, 4)}1Z5`,
        creditPeriodDays: 15,
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '10 Test Market Road',
            city: 'Chennai',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '600001',
            isDefault: true,
          },
        },
      },
    });
    customerId = customer.id;

    const createTestFg = async (code: string, name: string, price: string, qty: number, batchSuffix = 'B1', expiryDays = 90) => {
      const p = await prisma.product.create({
        data: {
          categoryId: prodCat.id,
          code,
          name,
          baseUomId: uomPcsId,
          hsnCode: '21069099',
          taxRateId: tax5Id,
        },
      });
      const v = await prisma.productVariant.create({
        data: {
          productId: p.id,
          sku: code,
          name,
          netWeightGrams: new Prisma.Decimal('200.00'),
          uomId: uomPcsId,
          defaultSellingPrice: new Prisma.Decimal(price),
          shelfLifeDays: 90,
        },
      });
      const item = await prisma.inventoryItem.create({
        data: {
          code,
          name,
          itemType: 'FINISHED_GOODS',
          productVariantId: v.id,
          uomId: uomPcsId,
          valuationMethod: 'MWAC',
          movingAverageCost: new Prisma.Decimal('30.0000'),
        },
      });
      if (qty > 0) {
        const actor = { userId: adminUserId, username: 'admin', roles: ['OWNER'] };
        const meta = { userId: adminUserId, ipAddress: '127.0.0.1', userAgent: 'vitest' };
        const expDate = new Date(Date.now() + expiryDays * 86400000).toISOString().slice(0, 10);
        const rec = await InventoryReceiptService.create(
          {
            warehouseId,
            supplierRef: `TEST-${code}`,
            lines: [
              {
                inventoryItemId: item.id,
                uomId: uomPcsId,
                quantity: String(qty),
                unitCost: '30.0000',
                batchNumber: `${code}-${batchSuffix}`,
                expiryDate: expDate,
              },
            ],
          },
          actor,
          meta,
        );
        await InventoryReceiptService.submit(rec.id, actor, meta);
        await InventoryReceiptService.approve(rec.id, actor, meta);
        await InventoryReceiptService.post(rec.id, `OTC-REC-${code}-${batchSuffix}`, actor, meta);
      }
      return { variantId: v.id, itemId: item.id };
    };

    const suf = await createTestFg(`OTC-MUR-${suffix}`, 'Murukku 200 g', '60.00', 500);
    sufficientVariantId = suf.variantId;
    sufficientItemId = suf.itemId;

    const lim = await createTestFg(`OTC-LIM-${suffix}`, 'Limited Mixture 200 g', '50.00', 65);
    limitedVariantId = lim.variantId;
    limitedItemId = lim.itemId;

    // Multi-batch product: Batch 1 (50 pcs, expires in 30 days), Batch 2 (50 pcs, expires in 120 days)
    const mb = await createTestFg(`OTC-MB-${suffix}`, 'MultiBatch Ribbon 200 g', '55.00', 50, 'EARLY', 30);
    multiBatchVariantId = mb.variantId;
    multiBatchItemId = mb.itemId;

    const actor = { userId: adminUserId, username: 'admin', roles: ['OWNER'] };
    const meta = { userId: adminUserId, ipAddress: '127.0.0.1', userAgent: 'vitest' };
    const rec2 = await InventoryReceiptService.create(
      {
        warehouseId,
        supplierRef: `TEST-MB-LATE`,
        lines: [
          {
            inventoryItemId: multiBatchItemId,
            uomId: uomPcsId,
            quantity: '50',
            unitCost: '30.0000',
            batchNumber: `OTC-MB-${suffix}-LATE`,
            expiryDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
          },
        ],
      },
      actor,
      meta,
    );
    await InventoryReceiptService.submit(rec2.id, actor, meta);
    await InventoryReceiptService.approve(rec2.id, actor, meta);
    await InventoryReceiptService.post(rec2.id, `OTC-REC-MB-LATE-${suffix}`, actor, meta);
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createApprovedOrder(lines: Array<{ productVariantId: string; quantity: string; unitPrice?: string }>) {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId,
        lines: lines.map(l => ({
          productVariantId: l.productVariantId,
          uomId: uomPcsId,
          orderedQuantity: l.quantity,
          ...(l.unitPrice ? { unitPrice: l.unitPrice } : {}),
        })),
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id as string;
    createdOrderIds.push(orderId);

    const subRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    expect(subRes.status).toBe(200);

    const appRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    expect(appRes.status).toBe(200);

    return orderId;
  }

  it('Phase 2: idempotent demo sales seed creates products & opening stock once without duplicating', async () => {
    const first = await seedDemoSalesProfile(prisma);
    expect(first.productCount).toBe(7);

    const murukkuItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { code: 'MUR-200' } });
    const balBefore = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: murukkuItem.id },
      _sum: { quantityOnHand: true },
    });

    const second = await seedDemoSalesProfile(prisma);
    expect(second.receiptPosted).toBe(false);

    const balAfter = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: murukkuItem.id },
      _sum: { quantityOnHand: true },
    });
    expect(Number(balAfter._sum.quantityOnHand)).toBe(Number(balBefore._sum.quantityOnHand));
  });

  it('Scenarios 1, 2, 3, 6 & 8: Full Order-to-Cash, Partial Payment (₹7,875 -> ₹4,000), Full Payment, Reversal & Idempotency', async () => {
    // 125 pcs @ ₹60 + 5% GST = ₹7,500 + ₹375 = ₹7,875.00
    const orderId = await createApprovedOrder([{ productVariantId: sufficientVariantId, quantity: '125' }]);

    // Confirm & reserve
    const confirmRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `CONF-${orderId}` });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');
    expect(Number(confirmRes.body.data.lines[0].reservedBaseQuantity)).toBe(125);

    // Fulfil
    const fulfillKey = `FUL-${orderId}`;
    const fulfillRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: fulfillKey });
    expect(fulfillRes.status).toBe(200);
    expect(fulfillRes.body.data.order.status).toBe('FULFILLED');

    // Scenario 8: Repeated fulfilment with same key does not deduct twice
    const repeatFulfill = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: fulfillKey });
    expect(repeatFulfill.status).toBe(200);

    const balAfterFulfill = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: sufficientItemId },
      _sum: { quantityOnHand: true, quantityReserved: true },
    });
    expect(Number(balAfterFulfill._sum.quantityOnHand)).toBe(375); // 500 - 125
    expect(Number(balAfterFulfill._sum.quantityReserved)).toBe(0);

    // Create & Issue GST Invoice
    const invCreateRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(invCreateRes.status).toBe(201);
    const invoiceId = invCreateRes.body.data.id as string;
    expect(Number(invCreateRes.body.data.grandTotal)).toBe(7875);

    const issueRes = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe('ISSUED');
    expect(issueRes.body.data.paymentStatus).toBe('UNPAID');

    // Scenario 2: Partial Payment (₹4,000 of ₹7,875)
    const payIdemp = `PAY-PART-${suffix}`;
    const partPayRes = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        paymentDate: '2026-10-15',
        amount: '4000.00',
        paymentMode: 'BANK_TRANSFER',
        transactionReference: 'UTR-PART-01',
        idempotencyKey: payIdemp,
        allocations: [{ salesInvoiceId: invoiceId, allocatedAmount: '4000.00' }],
      });
    expect(partPayRes.status).toBe(201);
    const partPayId = partPayRes.body.data.id as string;

    // Scenario 8: Repeated payment with same idempotencyKey does not duplicate
    const repeatPayRes = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        amount: '4000.00',
        paymentMode: 'BANK_TRANSFER',
        idempotencyKey: payIdemp,
        allocations: [{ salesInvoiceId: invoiceId, allocatedAmount: '4000.00' }],
      });
    expect(repeatPayRes.status).toBe(201);
    expect(repeatPayRes.body.data.id).toBe(partPayId);

    // Check invoice payment history -> PARTIALLY_PAID, outstanding ₹3,875.00
    const hist1 = await request(app)
      .get(`/api/v1/sales/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hist1.status).toBe(200);
    expect(hist1.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(hist1.body.data.outstandingAmount).toBe('3875.00');

    // Check receivables ageing reflects ₹3,875.00
    const ageingRes = await request(app)
      .get(`/api/v1/sales/ageing?customerId=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ageingRes.status).toBe(200);
    expect(Number(ageingRes.body.data.bucketTotals.totalOutstanding)).toBe(3875);

    // Scenario 3: Full Payment (remaining ₹3,875.00)
    const fullPayRes = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        paymentDate: '2026-10-15',
        amount: '3875.00',
        paymentMode: 'UPI',
        transactionReference: 'UPI-FULL-01',
        allocations: [{ salesInvoiceId: invoiceId, allocatedAmount: '3875.00' }],
      });
    expect(fullPayRes.status).toBe(201);
    const fullPayId = fullPayRes.body.data.id as string;

    const hist2 = await request(app)
      .get(`/api/v1/sales/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hist2.body.data.paymentStatus).toBe('PAID');
    expect(hist2.body.data.outstandingAmount).toBe('0.00');

    // Scenario 6: Reverse second payment -> PARTIALLY_PAID, outstanding ₹3,875.00
    const revRes = await request(app)
      .post(`/api/v1/sales/payments/${fullPayId}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'UPI settlement failed' });
    expect(revRes.status).toBe(200);

    const hist3 = await request(app)
      .get(`/api/v1/sales/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hist3.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(hist3.body.data.outstandingAmount).toBe('3875.00');
  });

  it('Scenarios 4 & 5: Genuine Insufficient Stock & Multi-Line Atomic Rollback with Item-Level Shortages', async () => {
    // Scenario 4: Available 65, Requested 100 -> Shortage 35
    const order1 = await createApprovedOrder([{ productVariantId: limitedVariantId, quantity: '100' }]);
    const confirm1 = await request(app)
      .post(`/api/v1/sales/orders/${order1}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(confirm1.status).toBe(400);
    expect(confirm1.body.message).toContain('Requested: 100 pcs');
    expect(confirm1.body.message).toContain('Available: 65 pcs');
    expect(confirm1.body.message).toContain('Shortage: 35 pcs');

    // Scenario 5: Line 1 sufficient (10 pcs), Line 2 insufficient (100 > 65) -> atomic rollback
    const balBefore = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: sufficientItemId },
      _sum: { quantityReserved: true },
    });
    const order2 = await createApprovedOrder([
      { productVariantId: sufficientVariantId, quantity: '10' },
      { productVariantId: limitedVariantId, quantity: '100' },
    ]);
    const confirm2 = await request(app)
      .post(`/api/v1/sales/orders/${order2}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(confirm2.status).toBe(400);
    expect(confirm2.body.message).toContain('Limited Mixture 200 g');

    const balAfter = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: sufficientItemId },
      _sum: { quantityReserved: true },
    });
    expect(Number(balAfter._sum.quantityReserved)).toBe(Number(balBefore._sum.quantityReserved));
  });

  it('Scenario 7: Credit Note interaction reduces outstanding without altering physical stock', async () => {
    const orderId = await createApprovedOrder([{ productVariantId: sufficientVariantId, quantity: '20' }]);
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});

    const invRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    const invoiceId = invRes.body.data.id as string;
    const lineId = invRes.body.data.lines[0].id as string;
    const grandTotal = Number(invRes.body.data.grandTotal); // 20 * 60 * 1.05 = 1260

    await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);

    // Partial payment ₹500
    await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        paymentDate: '2026-10-15',
        amount: '500.00',
        paymentMode: 'CASH',
        allocations: [{ salesInvoiceId: invoiceId, allocatedAmount: '500.00' }],
      });

    const stockBeforeCn = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: sufficientItemId },
      _sum: { quantityOnHand: true },
    });

    // Issue Credit Note for 5 pcs (₹315.00)
    const cnCreate = await request(app)
      .post('/api/v1/sales/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        salesInvoiceId: invoiceId,
        reason: 'Damaged outer carton allowance',
        lines: [{ originalInvoiceLineId: lineId, quantity: '5' }],
      });
    expect(cnCreate.status).toBe(201);
    const cnId = cnCreate.body.data.id as string;

    const cnIssue = await request(app)
      .post(`/api/v1/sales/credit-notes/${cnId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    expect(cnIssue.status).toBe(200);

    const hist = await request(app)
      .get(`/api/v1/sales/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hist.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(Number(hist.body.data.outstandingAmount)).toBeCloseTo(grandTotal - 500 - 315, 2);

    // Physical stock unchanged by financial credit note
    const stockAfterCn = await prisma.inventoryBalance.aggregate({
      where: { warehouseId, inventoryItemId: sufficientItemId },
      _sum: { quantityOnHand: true },
    });
    expect(Number(stockAfterCn._sum.quantityOnHand)).toBe(Number(stockBeforeCn._sum.quantityOnHand));
  });

  it('FEFO Multi-Batch Reservation & Release: fulfilling Order 1 releases EARLY batch first without locking', async () => {
    const order1 = await createApprovedOrder([{ productVariantId: multiBatchVariantId, quantity: '50' }]);
    const order2 = await createApprovedOrder([{ productVariantId: multiBatchVariantId, quantity: '50' }]);

    await request(app)
      .post(`/api/v1/sales/orders/${order1}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${order2}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});

    // Fulfilling Order 1 must release & pick EARLY batch cleanly (not LIFO LATE batch)
    const f1 = await request(app)
      .post(`/api/v1/sales/orders/${order1}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(f1.status).toBe(200);

    const earlyBatch = await prisma.inventoryBatch.findUniqueOrThrow({
      where: {
        inventoryItemId_batchNumber: {
          inventoryItemId: multiBatchItemId,
          batchNumber: `OTC-MB-${suffix}-EARLY`,
        },
      },
    });
    const earlyBal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId, inventoryItemId: multiBatchItemId, batchId: earlyBatch.id },
    });
    expect(Number(earlyBal.quantityOnHand)).toBe(0);
    expect(Number(earlyBal.quantityReserved)).toBe(0);

    // Fulfilling Order 2 also succeeds on LATE batch
    const f2 = await request(app)
      .post(`/api/v1/sales/orders/${order2}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(f2.status).toBe(200);
  });
});
