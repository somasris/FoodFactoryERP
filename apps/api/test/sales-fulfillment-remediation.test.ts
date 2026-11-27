import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';
import { InventoryReceiptService } from '../src/modules/inventory/inventory-receipt.service';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sales Order Fulfillment Remediation Integration Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  let adminToken: string;
  let adminUserId: string;
  let wh1Id: string;
  let wh2Id: string;
  let pcsUomId: string;
  let boxUomId: string;
  let taxRate5Id: string;
  let prodCatId: string;
  let customerId: string;

  let itemAId: string;
  let variantAId: string;
  let itemBId: string;
  let variantBId: string;
  let itemExpiredId: string;
  let variantExpiredId: string;
  let itemBlockedId: string;
  let variantBlockedId: string;
  let itemWh2Id: string;
  let variantWh2Id: string;

  const createdOrderIds: string[] = [];

  async function receiveStock(params: {
    warehouseId: string;
    inventoryItemId: string;
    uomId: string;
    quantity: string;
    batchNumber: string;
    expiryDate: string;
    qualityStatus?: 'ACCEPTED' | 'PENDING_INSPECTION' | 'REJECTED';
    idemKey: string;
  }) {
    const actor = { userId: adminUserId, username: `ful_admin_${suffix}`, roles: ['ADMIN'] };
    const meta = { userId: adminUserId, ipAddress: '127.0.0.1', userAgent: 'vitest' };
    const created = await InventoryReceiptService.create(
      {
        warehouseId: params.warehouseId,
        supplierRef: `TEST-${suffix}`,
        lines: [
          {
            inventoryItemId: params.inventoryItemId,
            uomId: params.uomId,
            quantity: params.quantity,
            unitCost: '30.0000',
            batchNumber: params.batchNumber,
            manufacturingDate: params.expiryDate < '2026-01-01' ? '2019-01-01' : '2026-01-01',
            expiryDate: params.expiryDate,
          },
        ],
      },
      actor,
      meta,
    );
    await InventoryReceiptService.submit(created.id, actor, meta);
    await InventoryReceiptService.approve(created.id, actor, meta);
    await InventoryReceiptService.post(created.id, params.idemKey, actor, meta);

    if (params.qualityStatus && params.qualityStatus !== 'ACCEPTED') {
      await prisma.inventoryBatch.updateMany({
        where: { inventoryItemId: params.inventoryItemId, batchNumber: params.batchNumber },
        data: { qualityStatus: params.qualityStatus },
      });
    }
  }

  async function createAndConfirmOrder(params: {
    warehouseId: string;
    lines: Array<{ productVariantId: string; uomId: string; orderedQuantity: string }>;
    confirm?: boolean;
  }) {
    const createRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: params.warehouseId,
        lines: params.lines,
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

    if (params.confirm !== false) {
      const confRes = await request(app)
        .post(`/api/v1/sales/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({});
      return { orderId, confirmRes: confRes };
    }
    return { orderId, confirmRes: null };
  }

  beforeAll(async () => {
    const pw = await hashPassword('FulTest2026!');
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    const adminUser = await prisma.user.create({
      data: {
        email: `ful_admin_${suffix}@foodfactory.com`,
        username: `ful_admin_${suffix}`,
        passwordHash: pw,
        fullName: 'Fulfillment Test Admin',
        isActive: true,
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateAccessToken({
      userId: adminUser.id,
      username: adminUser.username,
      roles: ['ADMIN'],
      permissions: adminRole.permissions.map(p => p.permission.code),
    });

    const wh1 = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    wh1Id = wh1.id;

    // Second warehouse under a different factory
    const company = await prisma.company.findFirstOrThrow();
    const otherFactory = await prisma.factory.create({
      data: {
        companyId: company.id,
        code: `FAC-FUL-${suffix}`,
        name: `Other Factory ${suffix}`,
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Test Industrial Estate',
        isActive: true,
      },
    });
    const wh2 = await prisma.warehouse.create({
      data: {
        factoryId: otherFactory.id,
        code: `WH-FUL2-${suffix}`,
        name: `Other FG Warehouse ${suffix}`,
        warehouseType: 'FINISHED_GOODS',
        isActive: true,
      },
    });
    wh2Id = wh2.id;

    const pcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    pcsUomId = pcs.id;

    const boxUom = await prisma.unitOfMeasure.create({
      data: {
        code: `BXF${suffix}`,
        name: `Box 10 ${suffix}`,
        symbol: 'box',
        category: 'COUNT',
        isBaseUnit: false,
        decimalPlaces: 0,
      },
    });
    boxUomId = boxUom.id;
    await prisma.unitConversion.create({
      data: {
        fromUomId: boxUomId,
        toUomId: pcsUomId,
        multiplier: new Prisma.Decimal('10'),
        isActive: true,
      },
    });

    const tax5 = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
    taxRate5Id = tax5.id;
    const cat = await prisma.productCategory.findFirstOrThrow();
    prodCatId = cat.id;

    const cust = await prisma.customer.create({
      data: {
        code: `FCUST-${suffix}`,
        legalName: `Fulfillment Customer ${suffix}`,
        customerType: 'DISTRIBUTOR',
        isActive: true,
      },
    });
    customerId = cust.id;

    async function makeProduct(tag: string) {
      const prod = await prisma.product.create({
        data: {
          categoryId: prodCatId,
          code: `FP-${tag}-${suffix}`,
          name: `FulProd ${tag}`,
          baseUomId: pcsUomId,
          hsnCode: '21069099',
          taxRateId: taxRate5Id,
          isActive: true,
        },
      });
      const variant = await prisma.productVariant.create({
        data: {
          productId: prod.id,
          sku: `FSKU-${tag}-${suffix}`,
          name: `FulVariant ${tag}`,
          uomId: pcsUomId,
          netWeightGrams: new Prisma.Decimal('200.00'),
          defaultSellingPrice: new Prisma.Decimal('50.00'),
          isActive: true,
        },
      });
      const inv = await prisma.inventoryItem.create({
        data: {
          code: `FINV-${tag}-${suffix}`,
          name: `FulItem ${tag}`,
          itemType: 'FINISHED_GOODS',
          productVariantId: variant.id,
          uomId: pcsUomId,
          valuationMethod: 'MWAC',
          movingAverageCost: new Prisma.Decimal('30.0000'),
          isActive: true,
        },
      });
      return { variantId: variant.id, itemId: inv.id };
    }

    const a = await makeProduct('A');
    variantAId = a.variantId;
    itemAId = a.itemId;

    const b = await makeProduct('B');
    variantBId = b.variantId;
    itemBId = b.itemId;

    const exp = await makeProduct('EXP');
    variantExpiredId = exp.variantId;
    itemExpiredId = exp.itemId;

    const blk = await makeProduct('BLK');
    variantBlockedId = blk.variantId;
    itemBlockedId = blk.itemId;

    const w2 = await makeProduct('W2');
    variantWh2Id = w2.variantId;
    itemWh2Id = w2.itemId;

    // Receive valid stock for A (100 pcs) and B (50 pcs) in wh1
    await receiveStock({
      warehouseId: wh1Id,
      inventoryItemId: itemAId,
      uomId: pcsUomId,
      quantity: '100',
      batchNumber: `FB-A-${suffix}`,
      expiryDate: '2027-12-31',
      idemKey: `FRCP-A-${suffix}`,
    });
    await receiveStock({
      warehouseId: wh1Id,
      inventoryItemId: itemBId,
      uomId: pcsUomId,
      quantity: '50',
      batchNumber: `FB-B-${suffix}`,
      expiryDate: '2027-12-31',
      idemKey: `FRCP-B-${suffix}`,
    });

    // Expired batch in wh1
    await receiveStock({
      warehouseId: wh1Id,
      inventoryItemId: itemExpiredId,
      uomId: pcsUomId,
      quantity: '100',
      batchNumber: `FB-EXP-${suffix}`,
      expiryDate: '2020-01-01',
      idemKey: `FRCP-EXP-${suffix}`,
    });

    // Quality-blocked batch in wh1
    await receiveStock({
      warehouseId: wh1Id,
      inventoryItemId: itemBlockedId,
      uomId: pcsUomId,
      quantity: '100',
      batchNumber: `FB-BLK-${suffix}`,
      expiryDate: '2027-12-31',
      qualityStatus: 'REJECTED',
      idemKey: `FRCP-BLK-${suffix}`,
    });

    // Stock in wh2 (different factory/warehouse)
    await receiveStock({
      warehouseId: wh2Id,
      inventoryItemId: itemWh2Id,
      uomId: pcsUomId,
      quantity: '100',
      batchNumber: `FB-W2-${suffix}`,
      expiryDate: '2027-12-31',
      idemKey: `FRCP-W2-${suffix}`,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Sufficient stock fulfillment updates balance, ledger, and order status', async () => {
    const { orderId, confirmRes } = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantAId, uomId: pcsUomId, orderedQuantity: '20' }],
    });
    expect(confirmRes?.status).toBe(200);

    const fulRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `FUL-1-${suffix}` });
    expect(fulRes.status).toBe(200);
    expect(fulRes.body.data.order.status).toBe('FULFILLED');

    const bal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemAId },
    });
    expect(Number(bal.quantityOnHand)).toBe(80);
    expect(Number(bal.quantityReserved)).toBe(0);

    const tx = await prisma.inventoryTransaction.findFirst({
      where: { referenceId: orderId, referenceType: 'SALES_ORDER_FULFILLMENT' },
      include: { lines: true },
    });
    expect(tx).toBeTruthy();
    expect(tx?.transactionType).toBe('ISSUE');
    expect(Number(tx?.lines[0].baseQuantity)).toBe(-20);
  });

  it('2. Insufficient stock order cannot be fulfilled and does not mutate inventory', async () => {
    // Create APPROVED order and force status to CONFIRMED with 0 reservation to simulate unreserved shortage
    const { orderId } = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantBId, uomId: pcsUomId, orderedQuantity: '500' }],
      confirm: false,
    });
    await prisma.salesOrder.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });

    const beforeBal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemBId },
    });

    const fulRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(fulRes.status).toBe(400);
    expect(fulRes.body.message).toMatch(/Insufficient available stock/i);

    const afterBal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemBId },
    });
    expect(afterBal.quantityOnHand.toString()).toBe(beforeBal.quantityOnHand.toString());
    expect(afterBal.quantityReserved.toString()).toBe(beforeBal.quantityReserved.toString());
  });

  it('3. Multi-line fulfillment & UOM conversion (BOX -> PCS) succeed atomically', async () => {
    const { orderId, confirmRes } = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [
        { productVariantId: variantAId, uomId: boxUomId, orderedQuantity: '2' }, // 20 pcs
        { productVariantId: variantBId, uomId: pcsUomId, orderedQuantity: '15' }, // 15 pcs
      ],
    });
    expect(confirmRes?.status).toBe(200);

    const fulRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `FUL-MULTI-${suffix}` });
    expect(fulRes.status).toBe(200);
    expect(fulRes.body.data.order.status).toBe('FULFILLED');

    const balA = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemAId },
    });
    const balB = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemBId },
    });
    expect(Number(balA.quantityOnHand)).toBe(60); // 80 - 20
    expect(Number(balB.quantityOnHand)).toBe(35); // 50 - 15
  });

  it('4. Warehouse & Factory mismatch, Expired batch, and Quality-blocked batch are excluded', async () => {
    // Warehouse / Factory mismatch: itemWh2 has 100 in wh2, 0 in wh1
    const whMismatch = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantWh2Id, uomId: pcsUomId, orderedQuantity: '10' }],
    });
    expect(whMismatch.confirmRes?.status).toBe(400);

    // Expired batch excluded
    const expRes = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantExpiredId, uomId: pcsUomId, orderedQuantity: '10' }],
    });
    expect(expRes.confirmRes?.status).toBe(400);

    // Quality-blocked batch excluded
    const blkRes = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantBlockedId, uomId: pcsUomId, orderedQuantity: '10' }],
    });
    expect(blkRes.confirmRes?.status).toBe(400);
  });

  it('5. Reservation isolation: unreserved order fulfillment never steals another order reservation', async () => {
    // Order 1 reserves 30 of itemB (leaving 5 out of 35 available)
    const ord1 = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantBId, uomId: pcsUomId, orderedQuantity: '30' }],
    });
    expect(ord1.confirmRes?.status).toBe(200);

    // Order 2 is forced CONFIRMED with 0 reservation requesting 10 of itemB (only 5 unreserved!)
    const ord2 = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantBId, uomId: pcsUomId, orderedQuantity: '10' }],
      confirm: false,
    });
    await prisma.salesOrder.update({ where: { id: ord2.orderId }, data: { status: 'CONFIRMED' } });

    const ful2 = await request(app)
      .post(`/api/v1/sales/orders/${ord2.orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(ful2.status).toBe(400);

    // Order 1's 30 reservation must still be intact and fulfillable!
    const balB = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemBId },
    });
    expect(Number(balB.quantityReserved)).toBe(30);

    const ful1 = await request(app)
      .post(`/api/v1/sales/orders/${ord1.orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(ful1.status).toBe(200);
    expect(ful1.body.data.order.status).toBe('FULFILLED');
  });

  it('6. Partial fulfillment, duplicate idempotency, and concurrent fulfillment safety', async () => {
    const { orderId, confirmRes } = await createAndConfirmOrder({
      warehouseId: wh1Id,
      lines: [{ productVariantId: variantAId, uomId: pcsUomId, orderedQuantity: '20' }],
    });
    expect(confirmRes?.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/sales/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const lineId = detail.body.data.lines[0].id as string;

    // Partial fulfill 8 pcs
    const partRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: `PART-1-${suffix}`,
        lines: [{ salesOrderLineId: lineId, quantity: '8' }],
      });
    expect(partRes.status).toBe(200);
    expect(partRes.body.data.order.status).toBe('PARTIALLY_FULFILLED');

    // Duplicate idempotency key returns same result without extra deduction
    const dupRes = await request(app)
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: `PART-1-${suffix}`,
        lines: [{ salesOrderLineId: lineId, quantity: '8' }],
      });
    expect(dupRes.status).toBe(200);

    // Concurrent fulfill remaining 12 pcs
    const [c1, c2] = await Promise.all([
      request(app)
        .post(`/api/v1/sales/orders/${orderId}/fulfill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({}),
      request(app)
        .post(`/api/v1/sales/orders/${orderId}/fulfill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({}),
    ]);

    const statuses = [c1.status, c2.status].sort();
    expect(statuses).toEqual([200, 400]);

    const balA = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemAId },
    });
    expect(Number(balA.quantityOnHand)).toBe(40); // 60 - 20
    expect(Number(balA.quantityReserved)).toBe(0);
  });
});
