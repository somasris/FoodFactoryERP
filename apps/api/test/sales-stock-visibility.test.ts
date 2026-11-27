import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Sales Order List Stock Visibility Suite', () => {
  let adminToken: string;
  let noInvToken: string;
  let adminUserId: string;
  let noInvUserId: string;
  let salesOnlyRoleId: string;

  let wh1Id: string;
  let wh2Id: string;
  let pcsUomId: string;
  let boxUomId: string;
  let taxRate5Id: string;
  let prodCatId: string;
  let customerId: string;

  let itemSufficientId: string;
  let variantSufficientId: string;
  let itemPartialId: string;
  let variantPartialId: string;
  let itemZeroId: string;
  let variantZeroId: string;
  let itemExpiredId: string;
  let variantExpiredId: string;

  const createdOrderIds: string[] = [];
  const createdBatchIds: string[] = [];

  beforeAll(async () => {
    const suffix = Date.now().toString().slice(-6);
    const pw = await hashPassword('StockVisTest2026!');
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    const adminUser = await prisma.user.create({
      data: {
        email: `so_stock_admin_${suffix}@foodfactory.com`,
        username: `so_stock_admin_${suffix}`,
        passwordHash: pw,
        fullName: 'Stock Admin',
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

    // Role & user with sales.orders.read ONLY (no inventory.read)
    const salesReadPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'sales.orders.read' },
    });
    const salesOnlyRole = await prisma.role.create({
      data: {
        code: `SO_ONLY_${suffix}`,
        name: `Sales Only ${suffix}`,
        isActive: true,
        permissions: { create: { permissionId: salesReadPerm.id } },
      },
    });
    salesOnlyRoleId = salesOnlyRole.id;

    const noInvUser = await prisma.user.create({
      data: {
        email: `so_stock_no_inv_${suffix}@foodfactory.com`,
        username: `so_stock_no_inv_${suffix}`,
        passwordHash: pw,
        fullName: 'Sales Viewer Only',
        isActive: true,
        userRoles: { create: { roleId: salesOnlyRole.id } },
      },
    });
    noInvUserId = noInvUser.id;
    noInvToken = generateAccessToken({
      userId: noInvUser.id,
      username: noInvUser.username,
      roles: [salesOnlyRole.code],
      permissions: ['sales.orders.read'],
    });

    const wh1 = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    wh1Id = wh1.id;

    // Second warehouse for warehouse isolation test
    const wh2 =
      (await prisma.warehouse.findFirst({ where: { id: { not: wh1Id }, isActive: true } })) ?? wh1;
    wh2Id = wh2.id;

    await prisma.userWarehouseAccess.createMany({
      data: [
        { userId: noInvUserId, warehouseId: wh1Id, accessLevel: 'READ' },
        ...(wh2Id !== wh1Id
          ? [{ userId: noInvUserId, warehouseId: wh2Id, accessLevel: 'READ' as const }]
          : []),
      ],
      skipDuplicates: true,
    });

    const pcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    pcsUomId = pcs.id;

    const boxUom = await prisma.unitOfMeasure.create({
      data: {
        code: `BX${suffix}`,
        name: `Box 10 ${suffix}`,
        symbol: 'box',
        category: 'COUNT',
        isBaseUnit: false,
      },
    });
    boxUomId = boxUom.id;

    await prisma.unitConversion.create({
      data: {
        fromUomId: boxUomId,
        toUomId: pcsUomId,
        multiplier: new Prisma.Decimal(10),
        isActive: true,
      },
    });

    const tax5 = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
    taxRate5Id = tax5.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `SCAT-${suffix}`, name: `Stock Vis Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const makeProduct = async (tag: string) => {
      const product = await prisma.product.create({
        data: {
          code: `SP-${tag}-${suffix}`,
          name: `StockVis ${tag} ${suffix}`,
          categoryId: prodCatId,
          baseUomId: pcsUomId,
          taxRateId: taxRate5Id,
          hsnCode: '21069099',
          variants: {
            create: {
              sku: `SKU-${tag}-${suffix}`,
              name: `StockVis ${tag} Variant`,
              netWeightGrams: '200.00',
              uomId: pcsUomId,
              defaultSellingPrice: new Prisma.Decimal('60.00'),
              inventoryItem: {
                create: {
                  code: `SV-${tag}-${suffix}`,
                  name: `StockVis ${tag} ${suffix}`,
                  itemType: 'FINISHED_GOODS',
                  uomId: pcsUomId,
                  valuationMethod: 'MWAC',
                  isActive: true,
                },
              },
            },
          },
        },
        include: { variants: { include: { inventoryItem: true } } },
      });
      return {
        invItemId: product.variants[0].inventoryItem!.id,
        variantId: product.variants[0].id,
      };
    };

    const suf = await makeProduct('SUF');
    itemSufficientId = suf.invItemId;
    variantSufficientId = suf.variantId;

    const part = await makeProduct('PART');
    itemPartialId = part.invItemId;
    variantPartialId = part.variantId;

    const zero = await makeProduct('ZERO');
    itemZeroId = zero.invItemId;
    variantZeroId = zero.variantId;

    const exp = await makeProduct('EXP');
    itemExpiredId = exp.invItemId;
    variantExpiredId = exp.variantId;

    // Seed stock via InventoryBalance & InventoryBatch:
    // 1. itemSufficientId: 200 pcs in WH1
    const b1 = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemSufficientId,
        batchNumber: `B-SUF-${suffix}`,
        qualityStatus: 'ACCEPTED',
        expiryDate: new Date('2028-12-31T00:00:00Z'),
        unitCost: new Prisma.Decimal('30.0000'),
      },
    });
    createdBatchIds.push(b1.id);
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: wh1Id,
        inventoryItemId: itemSufficientId,
        batchId: b1.id,
        quantityOnHand: new Prisma.Decimal('200.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('30.0000'),
        totalValue: new Prisma.Decimal('6000.0000'),
      },
    });

    // 2. itemPartialId: 65 pcs in WH1
    const b2 = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemPartialId,
        batchNumber: `B-PART-${suffix}`,
        qualityStatus: 'ACCEPTED',
        expiryDate: new Date('2028-12-31T00:00:00Z'),
        unitCost: new Prisma.Decimal('30.0000'),
      },
    });
    createdBatchIds.push(b2.id);
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: wh1Id,
        inventoryItemId: itemPartialId,
        batchId: b2.id,
        quantityOnHand: new Prisma.Decimal('65.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('30.0000'),
        totalValue: new Prisma.Decimal('1950.0000'),
      },
    });

    // Put stock for itemZeroId in WH2 (if different) to test warehouse isolation
    if (wh2Id !== wh1Id) {
      const bZeroWh2 = await prisma.inventoryBatch.create({
        data: {
          inventoryItemId: itemZeroId,
          batchNumber: `B-ZERO-W2-${suffix}`,
          qualityStatus: 'ACCEPTED',
          expiryDate: new Date('2028-12-31T00:00:00Z'),
          unitCost: new Prisma.Decimal('30.0000'),
        },
      });
      createdBatchIds.push(bZeroWh2.id);
      await prisma.inventoryBalance.create({
        data: {
          warehouseId: wh2Id,
          inventoryItemId: itemZeroId,
          batchId: bZeroWh2.id,
          quantityOnHand: new Prisma.Decimal('500.0000'),
          quantityReserved: new Prisma.Decimal('0.0000'),
          unitCost: new Prisma.Decimal('30.0000'),
          totalValue: new Prisma.Decimal('15000.0000'),
        },
      });
    }

    // 3. itemExpiredId: 100 pcs expired (yesterday) + 10 pcs valid
    const bExp = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemExpiredId,
        batchNumber: `B-EXP-${suffix}`,
        qualityStatus: 'ACCEPTED',
        expiryDate: new Date('2020-01-01T00:00:00Z'),
        unitCost: new Prisma.Decimal('30.0000'),
      },
    });
    const bExpValid = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemExpiredId,
        batchNumber: `B-EXP-OK-${suffix}`,
        qualityStatus: 'ACCEPTED',
        expiryDate: new Date('2028-12-31T00:00:00Z'),
        unitCost: new Prisma.Decimal('30.0000'),
      },
    });
    createdBatchIds.push(bExp.id, bExpValid.id);
    await prisma.inventoryBalance.createMany({
      data: [
        {
          warehouseId: wh1Id,
          inventoryItemId: itemExpiredId,
          batchId: bExp.id,
          quantityOnHand: new Prisma.Decimal('100.0000'),
          quantityReserved: new Prisma.Decimal('0.0000'),
          unitCost: new Prisma.Decimal('30.0000'),
          totalValue: new Prisma.Decimal('3000.0000'),
        },
        {
          warehouseId: wh1Id,
          inventoryItemId: itemExpiredId,
          batchId: bExpValid.id,
          quantityOnHand: new Prisma.Decimal('10.0000'),
          quantityReserved: new Prisma.Decimal('0.0000'),
          unitCost: new Prisma.Decimal('30.0000'),
          totalValue: new Prisma.Decimal('300.0000'),
        },
      ],
    });

    const cust = await prisma.customer.create({
      data: {
        code: `SVC-${suffix}`,
        legalName: `StockVis Customer ${suffix}`,
        customerType: 'RETAILER',
        isActive: true,
      },
    });
    customerId = cust.id;
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await prisma.salesOrder.delete({ where: { id } }).catch(() => {});
    }
    const itemIds = [itemSufficientId, itemPartialId, itemZeroId, itemExpiredId].filter(Boolean);
    if (itemIds.length > 0) {
      await prisma.inventoryBalance.deleteMany({
        where: { inventoryItemId: { in: itemIds } },
      });
    }
    await prisma.inventoryBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
    await prisma.userWarehouseAccess.deleteMany({
      where: { userId: { in: [adminUserId, noInvUserId].filter(Boolean) } },
    });
    if (noInvUserId) await prisma.user.delete({ where: { id: noInvUserId } }).catch(() => {});
    if (salesOnlyRoleId) await prisma.role.delete({ where: { id: salesOnlyRoleId } }).catch(() => {});
    if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
  });

  const createOrder = async (
    lines: Array<{ productVariantId: string; uomId: string; orderedQuantity: string }>,
    warehouseId = wh1Id,
  ) => {
    const res = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ customerId, warehouseId, lines });
    expect(res.status).toBe(201);
    createdOrderIds.push(res.body.data.id);
    return res.body.data;
  };

  it('1-4. Classifies SUFFICIENT, INSUFFICIENT, PARTIAL and reports exact line-level shortages', async () => {
    const sufOrder = await createOrder([
      { productVariantId: variantSufficientId, uomId: pcsUomId, orderedQuantity: '50' },
    ]);
    const zeroOrder = await createOrder([
      { productVariantId: variantZeroId, uomId: pcsUomId, orderedQuantity: '25' },
    ]);
    const partialOrder = await createOrder([
      { productVariantId: variantPartialId, uomId: pcsUomId, orderedQuantity: '100' }, // avail 65, short 35
      { productVariantId: variantSufficientId, uomId: pcsUomId, orderedQuantity: '50' }, // avail 200, short 0
    ]);

    const listRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}&limit=20`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);

    const byId = new Map<string, any>(listRes.body.data.items.map((o: any) => [o.id, o]));

    expect(byId.get(sufOrder.id).stockAvailability.status).toBe('SUFFICIENT');
    expect(byId.get(zeroOrder.id).stockAvailability.status).toBe('INSUFFICIENT');

    const pStock = byId.get(partialOrder.id).stockAvailability;
    expect(pStock.status).toBe('PARTIAL');
    expect(pStock.sufficientLines).toBe(1);
    expect(pStock.insufficientLines).toBe(1);
    expect(pStock.lines[0].requestedQuantity).toBe('100');
    expect(pStock.lines[0].availableQuantity).toBe('65');
    expect(pStock.lines[0].shortageQuantity).toBe('35');
    expect(pStock.lines[0].uomSymbol).toBe('pcs');
    expect(pStock.lines[1].shortageQuantity).toBe('0');
  });

  it('5-6 & 11-12. Active reservations reduce available stock, cancelling releases it, and preview does not mutate inventory', async () => {
    const balBefore = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemSufficientId },
    });

    // Order A reserves 160 of 200 pcs
    const orderA = await createOrder([
      { productVariantId: variantSufficientId, uomId: pcsUomId, orderedQuantity: '160' },
    ]);
    // Order B requests 60 pcs (unconfirmed) -> initially SUFFICIENT (200 >= 60)
    const orderB = await createOrder([
      { productVariantId: variantSufficientId, uomId: pcsUomId, orderedQuantity: '60' },
    ]);

    // Preview does not mutate inventory
    await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const balAfterPreview = await prisma.inventoryBalance.findFirstOrThrow({
      where: { warehouseId: wh1Id, inventoryItemId: itemSufficientId },
    });
    expect(balAfterPreview.quantityOnHand.toString()).toBe(balBefore.quantityOnHand.toString());
    expect(balAfterPreview.quantityReserved.toString()).toBe(balBefore.quantityReserved.toString());

    // Submit -> Approve -> Confirm Order A (reserves 160, leaving 40 unreserved)
    await request(app)
      .post(`/api/v1/sales/orders/${orderA.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${orderA.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    const confRes = await request(app)
      .post(`/api/v1/sales/orders/${orderA.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(confRes.status).toBe(200);

    // Now Order A (CONFIRMED, has own reservation) is SUFFICIENT, while Order B sees only 40 available -> INSUFFICIENT (short 20)
    const listDuringRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const mapDuring = new Map<string, any>(
      listDuringRes.body.data.items.map((o: any) => [o.id, o]),
    );
    expect(mapDuring.get(orderA.id).stockAvailability.status).toBe('SUFFICIENT');
    expect(mapDuring.get(orderB.id).stockAvailability.status).toBe('INSUFFICIENT');
    expect(mapDuring.get(orderB.id).stockAvailability.lines[0].availableQuantity).toBe('40');
    expect(mapDuring.get(orderB.id).stockAvailability.lines[0].shortageQuantity).toBe('20');

    // Cancel Order A -> reservation released, Order A becomes NOT_APPLICABLE, Order B becomes SUFFICIENT again
    await request(app)
      .post(`/api/v1/sales/orders/${orderA.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Test release reservation' });

    const listAfterCancel = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const mapAfter = new Map<string, any>(
      listAfterCancel.body.data.items.map((o: any) => [o.id, o]),
    );
    expect(mapAfter.get(orderA.id).stockAvailability.status).toBe('NOT_APPLICABLE');
    expect(mapAfter.get(orderB.id).stockAvailability.status).toBe('SUFFICIENT');
  });

  it('7. Fulfilled quantities are not counted twice for PARTIALLY_FULFILLED orders', async () => {
    const order = await createOrder([
      { productVariantId: variantSufficientId, uomId: pcsUomId, orderedQuantity: '50' },
    ]);
    await request(app)
      .post(`/api/v1/sales/orders/${order.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${order.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});

    // Fulfill 30 of 50 -> remaining 20
    const fulRes = await request(app)
      .post(`/api/v1/sales/orders/${order.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ lines: [{ salesOrderLineId: order.lines[0].id, quantity: '30' }] });
    expect(fulRes.status).toBe(200);

    const detailRes = await request(app)
      .get(`/api/v1/sales/orders/${order.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.stockAvailability.status).toBe('SUFFICIENT');
    expect(detailRes.body.data.stockAvailability.lines[0].requestedQuantity).toBe('20');
  });

  it('8-10. Excludes expired stock, respects warehouse, and converts UOM accurately', async () => {
    // Expired item has 100 expired + 10 valid -> requesting 20 sees only 10 available (short 10)
    const expOrder = await createOrder([
      { productVariantId: variantExpiredId, uomId: pcsUomId, orderedQuantity: '20' },
    ]);
    // UOM conversion: 8 BOX (80 PCS) on itemPartialId (65 PCS available = 6.5 BOX, short 1.5 BOX)
    const uomOrder = await createOrder([
      { productVariantId: variantPartialId, uomId: boxUomId, orderedQuantity: '8' },
    ]);

    const listRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}&limit=50`)
      .set('Authorization', `Bearer ${adminToken}`);
    const byId = new Map<string, any>(listRes.body.data.items.map((o: any) => [o.id, o]));

    const expStock = byId.get(expOrder.id).stockAvailability;
    expect(expStock.status).toBe('INSUFFICIENT');
    expect(expStock.lines[0].availableQuantity).toBe('10');
    expect(expStock.lines[0].shortageQuantity).toBe('10');

    const uomStock = byId.get(uomOrder.id).stockAvailability;
    expect(uomStock.status).toBe('INSUFFICIENT');
    expect(uomStock.lines[0].uomSymbol).toBe('box');
    expect(uomStock.lines[0].requestedQuantity).toBe('8');
    expect(uomStock.lines[0].availableQuantity).toBe('6.5');
    expect(uomStock.lines[0].shortageQuantity).toBe('1.5');
  });

  it('13-14. Enforces RBAC (hides inventory from roles without inventory.read) and supports filtered/sorted pagination', async () => {
    const noInvRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}`)
      .set('Authorization', `Bearer ${noInvToken}`);
    expect(noInvRes.status).toBe(200);
    expect(noInvRes.body.data.items.length).toBeGreaterThan(0);
    expect(noInvRes.body.data.items[0].stockAvailability).toBeNull();

    const forbiddenFilter = await request(app)
      .get(`/api/v1/sales/orders?stockAvailability=INSUFFICIENT`)
      .set('Authorization', `Bearer ${noInvToken}`);
    expect(forbiddenFilter.status).toBe(403);

    // Filter by PARTIAL with pagination
    const partialRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}&stockAvailability=PARTIAL&page=1&limit=2`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of partialRes.body.data.items) {
      expect(item.stockAvailability.status).toBe('PARTIAL');
    }

    // Sort by stockAvailability asc -> INSUFFICIENT before SUFFICIENT
    const sortedRes = await request(app)
      .get(`/api/v1/sales/orders?customerId=${customerId}&sortBy=stockAvailability&sortOrder=asc&limit=50`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sortedRes.status).toBe(200);
    const statuses = sortedRes.body.data.items.map((o: any) => o.stockAvailability.status);
    const firstInsufficient = statuses.indexOf('INSUFFICIENT');
    const firstSufficient = statuses.indexOf('SUFFICIENT');
    if (firstInsufficient !== -1 && firstSufficient !== -1) {
      expect(firstInsufficient).toBeLessThan(firstSufficient);
    }
  });
});
