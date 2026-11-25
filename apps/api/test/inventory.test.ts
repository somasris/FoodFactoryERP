import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 1.5 Stage 3: Inventory Management Suite', () => {
  let adminToken: string;
  let auditorToken: string;
  let salesmanToken: string;
  let productionToken: string;
  let restrictedProdToken: string;

  let adminUserId: string;
  let auditorUserId: string;
  let salesmanUserId: string;
  let productionUserId: string;
  let restrictedProdUserId: string;

  let whRMId: string;
  let whPKGId: string;
  let whFGId: string;

  let kgUomId: string;
  let gUomId: string;
  let pcsUomId: string;
  let taxRateId: string;
  let rmCatId: string;
  let prodCatId: string;

  let rmId: string;
  let rmInvItemId: string;
  let fgProdId: string;
  let fgVarId: string;
  let fgInvItemId: string;

  const createdUsernames = [
    'inv_admin',
    'inv_auditor',
    'inv_salesman',
    'inv_production',
    'inv_restricted',
  ];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });

    const pw = await hashPassword('InventoryTest2026!');
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

    const admin = await makeUser('inv_admin', 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const auditor = await makeUser('inv_auditor', 'AUDITOR');
    auditorUserId = auditor.user.id;
    auditorToken = auditor.token;

    const salesman = await makeUser('inv_salesman', 'SALESMAN');
    salesmanUserId = salesman.user.id;
    salesmanToken = salesman.token;

    const prod = await makeUser('inv_production', 'PRODUCTION');
    productionUserId = prod.user.id;
    productionToken = prod.token;

    const restricted = await makeUser('inv_restricted', 'PRODUCTION');
    restrictedProdUserId = restricted.user.id;
    restrictedProdToken = restricted.token;

    const whRM = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } });
    const whPKG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-PKG-01' } });
    const whFG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whRMId = whRM.id;
    whPKGId = whPKG.id;
    whFGId = whFG.id;

    // Grant production user access to WH-RM-01 and WH-PKG-01 (not WH-FG-01)
    await prisma.userWarehouseAccess.createMany({
      data: [
        { userId: productionUserId, warehouseId: whRMId, accessLevel: 'READ_WRITE' },
        { userId: productionUserId, warehouseId: whPKGId, accessLevel: 'READ_WRITE' },
        { userId: restrictedProdUserId, warehouseId: whPKGId, accessLevel: 'READ' },
      ],
    });

    const kg = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } });
    const g = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'G' } });
    const pcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    kgUomId = kg.id;
    gUomId = g.id;
    pcsUomId = pcs.id;

    // Ensure KG -> G conversion exists (1 KG = 1000 G)
    await prisma.unitConversion.upsert({
      where: { fromUomId_toUomId: { fromUomId: kgUomId, toUomId: gUomId } },
      update: { multiplier: '1000.000000', isActive: true },
      create: { fromUomId: kgUomId, toUomId: gUomId, multiplier: '1000.000000', isActive: true },
    });

    const tax = await prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
    taxRateId = tax.id;

    const suffix = Date.now().toString().slice(-6);
    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `RMC-INV-${suffix}`, name: `Inv RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const rm = await prisma.rawMaterial.create({
      data: {
        categoryId: rmCatId,
        code: `RM-INV-${suffix}`,
        name: `Test Flour ${suffix}`,
        materialType: 'RAW_INGREDIENT',
        uomId: kgUomId,
        hsnCode: '11010000',
        taxRateId,
        inventoryItem: {
          create: {
            itemType: 'RAW_MATERIAL',
            code: `RM-INV-${suffix}`,
            name: `Test Flour ${suffix}`,
            uomId: kgUomId,
            valuationMethod: 'MWAC',
          },
        },
      },
      include: { inventoryItem: true },
    });
    rmId = rm.id;
    rmInvItemId = rm.inventoryItem!.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `PC-INV-${suffix}`, name: `Inv Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const prodEntity = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `PRD-INV-${suffix}`,
        name: `Test Chips ${suffix}`,
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId,
        variants: {
          create: {
            sku: `SKU-INV-${suffix}`,
            name: `Test Chips 100g ${suffix}`,
            netWeightGrams: '100.00',
            uomId: pcsUomId,
            defaultSellingPrice: '20.00',
            inventoryItem: {
              create: {
                itemType: 'FINISHED_GOODS',
                code: `SKU-INV-${suffix}`,
                name: `Test Chips 100g ${suffix}`,
                uomId: pcsUomId,
                valuationMethod: 'BATCH_ACTUAL',
              },
            },
          },
        },
      },
      include: { variants: { include: { inventoryItem: true } } },
    });
    fgProdId = prodEntity.id;
    fgVarId = prodEntity.variants[0].id;
    fgInvItemId = prodEntity.variants[0].inventoryItem!.id;
  });

  afterAll(async () => {
    const itemIds = [rmInvItemId, fgInvItemId];
    await prisma.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryTransaction.deleteMany({
      where: {
        OR: [
          { referenceId: { in: itemIds } },
          { lines: { none: {} } },
        ],
      },
    });
    await prisma.inventoryReceiptLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryReceipt.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryIssueLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryIssue.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryTransferLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryTransfer.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryAdjustmentLine.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryAdjustment.deleteMany({ where: { lines: { none: {} } } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: itemIds } } });

    await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    await prisma.productVariant.deleteMany({ where: { id: fgVarId } });
    await prisma.product.deleteMany({ where: { id: fgProdId } });
    await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    await prisma.rawMaterial.deleteMany({ where: { id: rmId } });
    await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });

    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, auditorUserId, salesmanUserId, productionUserId, restrictedProdUserId] },
      },
    });
  });

  it('1. Rejects unauthenticated requests with 401 and enforces RBAC for AUDITOR & SALESMAN', async () => {
    const unauth = await request(app).get('/api/v1/inventory/balances');
    expect(unauth.status).toBe(401);

    // AUDITOR can read balances and valuation
    const audBal = await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audBal.status).toBe(200);

    const audVal = await request(app)
      .get('/api/v1/inventory/valuation')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audVal.status).toBe(200);

    // AUDITOR cannot mutate
    const audCreate = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, quantity: '10', unitCost: '50' }],
      });
    expect(audCreate.status).toBe(403);

    // SALESMAN cannot create receipts
    const salesCreate = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, quantity: '10', unitCost: '50' }],
      });
    expect(salesCreate.status).toBe(403);
  });

  it('2. Receipt lifecycle with UOM conversion, batch creation, MWAC recalculation, idempotency & audit logs', async () => {
    // Receipt 1: 100 KG at 40.0000/KG -> MWAC = 40.0000
    const create1 = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        supplierRef: 'SUP-INV-01',
        lines: [
          {
            inventoryItemId: rmInvItemId,
            uomId: kgUomId,
            quantity: '100',
            unitCost: '40.00',
            batchNumber: 'BATCH-FLR-01',
            manufacturingDate: '2026-01-01',
            expiryDate: '2027-06-01',
          },
        ],
      });
    expect(create1.status).toBe(201);
    const rcp1Id = create1.body.data.id;
    expect(create1.body.data.status).toBe('DRAFT');

    // Submit -> Approve -> Post
    const sub1 = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp1Id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(sub1.status).toBe(200);
    expect(sub1.body.data.status).toBe('SUBMITTED');

    const app1 = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp1Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(app1.status).toBe(200);
    expect(app1.body.data.status).toBe('APPROVED');

    const post1 = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp1Id}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `RCP1-${rcp1Id}` });
    expect(post1.status).toBe(200);
    expect(post1.body.data.status).toBe('POSTED');

    // Idempotent retry with same key succeeds without double-posting
    const post1Retry = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp1Id}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `RCP1-${rcp1Id}` });
    expect(post1Retry.status).toBe(200);

    // Different idempotency key on already posted receipt returns 409
    const post1Dup = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp1Id}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `RCP1-OTHER-${rcp1Id}` });
    expect(post1Dup.status).toBe(409);

    // Receipt 2: 50,000 G (= 50 KG) at 0.07/G (= 70.00/KG) -> total 3500
    // New MWAC = (100*40 + 50*70) / 150 = 7500 / 150 = 50.0000
    const create2 = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        lines: [
          {
            inventoryItemId: rmInvItemId,
            uomId: gUomId,
            quantity: '50000',
            unitCost: '0.07',
            batchNumber: 'BATCH-FLR-02',
            manufacturingDate: '2026-02-01',
            expiryDate: '2027-01-01', // Earlier expiry than BATCH-FLR-01 for FEFO test!
          },
        ],
      });
    expect(create2.status).toBe(201);
    const rcp2Id = create2.body.data.id;

    await request(app)
      .post(`/api/v1/inventory/receipts/${rcp2Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});

    const post2 = await request(app)
      .post(`/api/v1/inventory/receipts/${rcp2Id}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(post2.status).toBe(200);

    const updatedItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: rmInvItemId } });
    expect(new Prisma.Decimal(updatedItem.movingAverageCost).toFixed(4)).toBe('50.0000');

    // Verify audit logs created
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'InventoryReceipt', entityId: rcp1Id },
    });
    expect(audits.some(a => a.action === 'CREATE')).toBe(true);
    expect(audits.some(a => a.action === 'APPROVE')).toBe(true);
    expect(audits.some(a => a.action === 'POST')).toBe(true);
  });

  it('3. FEFO picking selects earliest-expiring batch, excludes expired batches, and prevents negative stock', async () => {
    // Also seed an EXPIRED batch of 25 KG so we can verify it is excluded from FEFO picking
    const expiredRcp = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        lines: [
          {
            inventoryItemId: rmInvItemId,
            uomId: kgUomId,
            quantity: '25',
            unitCost: '50.00',
            batchNumber: 'BATCH-FLR-EXPIRED',
            manufacturingDate: '2024-01-01',
            expiryDate: '2025-01-01',
          },
        ],
      });
    const expId = expiredRcp.body.data.id;
    await request(app).post(`/api/v1/inventory/receipts/${expId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/inventory/receipts/${expId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});

    // Issue 60 KG using FEFO: should pick 50 KG from BATCH-FLR-02 (exp 2027-01-01) and 10 KG from BATCH-FLR-01 (exp 2027-06-01), skipping EXPIRED!
    const issueRes = await request(app)
      .post('/api/v1/inventory/issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        pickingStrategy: 'FEFO',
        purpose: 'Production Batch Mixing',
        lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, requestedQuantity: '60' }],
      });
    expect(issueRes.status).toBe(201);
    const issueId = issueRes.body.data.id;

    await request(app).post(`/api/v1/inventory/issues/${issueId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    const postIssue = await request(app)
      .post(`/api/v1/inventory/issues/${issueId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(postIssue.status).toBe(200);

    // Check remaining balances
    const b1 = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: rmInvItemId, batchNumber: 'BATCH-FLR-01' } },
      include: { balances: { where: { warehouseId: whRMId } } },
    });
    const b2 = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: rmInvItemId, batchNumber: 'BATCH-FLR-02' } },
      include: { balances: { where: { warehouseId: whRMId } } },
    });
    const bExp = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: rmInvItemId, batchNumber: 'BATCH-FLR-EXPIRED' } },
      include: { balances: { where: { warehouseId: whRMId } } },
    });

    expect(new Prisma.Decimal(b2.balances[0].quantityOnHand).toFixed(4)).toBe('0.0000');
    expect(new Prisma.Decimal(b1.balances[0].quantityOnHand).toFixed(4)).toBe('90.0000');
    expect(new Prisma.Decimal(bExp.balances[0].quantityOnHand).toFixed(4)).toBe('25.0000');

    // Attempt to issue more than available non-expired stock (e.g. 95 KG when only 90 KG is non-expired) -> 400
    const badIssue = await request(app)
      .post('/api/v1/inventory/issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        pickingStrategy: 'FEFO',
        lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, requestedQuantity: '95' }],
      });
    const badId = badIssue.body.data.id;
    await request(app).post(`/api/v1/inventory/issues/${badId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    const badPost = await request(app)
      .post(`/api/v1/inventory/issues/${badId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(badPost.status).toBe(400);
    expect(badPost.body.message).toContain('Insufficient available non-expired stock');
  });

  it('4. Finished goods BATCH_ACTUAL costing & Warehouse Transfer lifecycle (DRAFT -> APPROVED -> IN_TRANSIT -> RECEIVED)', async () => {
    // Receive 100 PCS of Finished Goods at 12.50/PCS into WH-FG-01
    const fgRcp = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whFGId,
        lines: [
          {
            inventoryItemId: fgInvItemId,
            uomId: pcsUomId,
            quantity: '100',
            unitCost: '12.50',
            batchNumber: 'BATCH-FG-01',
            manufacturingDate: '2026-03-01',
            expiryDate: '2026-12-31',
          },
        ],
      });
    const fgRcpId = fgRcp.body.data.id;
    await request(app).post(`/api/v1/inventory/receipts/${fgRcpId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/inventory/receipts/${fgRcpId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});

    const fgBatch = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: fgInvItemId, batchNumber: 'BATCH-FG-01' } },
    });

    // Transfer 20 KG of BATCH-FLR-01 from WH-RM-01 -> WH-PKG-01 (using PRODUCTION user!)
    const flrBatch1 = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: rmInvItemId, batchNumber: 'BATCH-FLR-01' } },
    });

    const trfCreate = await request(app)
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({
        sourceWarehouseId: whRMId,
        destinationWarehouseId: whPKGId,
        lines: [
          {
            inventoryItemId: rmInvItemId,
            uomId: kgUomId,
            quantity: '20',
            batchId: flrBatch1.id,
          },
        ],
      });
    expect(trfCreate.status).toBe(201);
    const trfId = trfCreate.body.data.id;

    // Approve (ADMIN)
    const trfApprove = await request(app)
      .post(`/api/v1/inventory/transfers/${trfId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(trfApprove.status).toBe(200);
    expect(trfApprove.body.data.status).toBe('APPROVED');

    // Dispatch (PRODUCTION)
    const trfDispatch = await request(app)
      .post(`/api/v1/inventory/transfers/${trfId}/dispatch`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `DISP-${trfId}` });
    expect(trfDispatch.status).toBe(200);
    expect(trfDispatch.body.data.status).toBe('IN_TRANSIT');

    // Duplicate dispatch with different key rejected (409)
    const dupDispatch = await request(app)
      .post(`/api/v1/inventory/transfers/${trfId}/dispatch`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `DISP-OTHER-${trfId}` });
    expect(dupDispatch.status).toBe(409);

    // Receive (PRODUCTION)
    const trfReceive = await request(app)
      .post(`/api/v1/inventory/transfers/${trfId}/receive`)
      .set('Authorization', `Bearer ${productionToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `RECV-${trfId}` });
    expect(trfReceive.status).toBe(200);
    expect(trfReceive.body.data.status).toBe('RECEIVED');

    // Verify destination warehouse has 20 KG of BATCH-FLR-01 and source has 70 KG
    const srcBal = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { warehouseId_inventoryItemId_batchId: { warehouseId: whRMId, inventoryItemId: rmInvItemId, batchId: flrBatch1.id } },
    });
    const dstBal = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { warehouseId_inventoryItemId_batchId: { warehouseId: whPKGId, inventoryItemId: rmInvItemId, batchId: flrBatch1.id } },
    });
    expect(new Prisma.Decimal(srcBal.quantityOnHand).toFixed(4)).toBe('70.0000');
    expect(new Prisma.Decimal(dstBal.quantityOnHand).toFixed(4)).toBe('20.0000');

    // Issue 10 PCS of FG using BATCH_ACTUAL
    const fgIssue = await request(app)
      .post('/api/v1/inventory/issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whFGId,
        pickingStrategy: 'FIFO',
        lines: [{ inventoryItemId: fgInvItemId, uomId: pcsUomId, requestedQuantity: '10', batchId: fgBatch.id }],
      });
    const fgIssId = fgIssue.body.data.id;
    await request(app).post(`/api/v1/inventory/issues/${fgIssId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    const fgIssPost = await request(app).post(`/api/v1/inventory/issues/${fgIssId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(fgIssPost.status).toBe(200);
    expect(new Prisma.Decimal(fgIssPost.body.data.lines[0].unitCost).toFixed(4)).toBe('12.5000');
  });

  it('5. Warehouse access restriction blocks unauthorized warehouse operations with 403', async () => {
    // restrictedProdToken only has READ access to WH-PKG-01, no access to WH-FG-01
    const res = await request(app)
      .get(`/api/v1/inventory/balances?warehouseId=${whFGId}`)
      .set('Authorization', `Bearer ${restrictedProdToken}`);
    expect(res.status).toBe(403);

    // READ-only access to WH-PKG-01 cannot create a transfer from WH-PKG-01
    const resWrite = await request(app)
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${restrictedProdToken}`)
      .set(CSRF)
      .send({
        sourceWarehouseId: whPKGId,
        destinationWarehouseId: whRMId,
        lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, quantity: '5' }],
      });
    expect(resWrite.status).toBe(403);
  });

  it('6. Adjustments, Reversal transactions, and Concurrent stock issue race condition prevention', async () => {
    const flrBatch1 = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { inventoryItemId_batchNumber: { inventoryItemId: rmInvItemId, batchNumber: 'BATCH-FLR-01' } },
    });

    // Negative adjustment (-10 KG for DAMAGE) in WH-RM-01 -> 70 -> 60 KG
    const adjCreate = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whRMId,
        reason: 'DAMAGE',
        notes: 'Water damage in bay A',
        lines: [
          {
            inventoryItemId: rmInvItemId,
            uomId: kgUomId,
            quantityDelta: '-10',
            batchId: flrBatch1.id,
          },
        ],
      });
    expect(adjCreate.status).toBe(201);
    const adjId = adjCreate.body.data.id;
    await request(app).post(`/api/v1/inventory/adjustments/${adjId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    const adjPost = await request(app).post(`/api/v1/inventory/adjustments/${adjId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(adjPost.status).toBe(200);

    // Find the ADJUSTMENT_OUT transaction and reverse it -> 60 -> 70 KG
    const adjTx = await prisma.inventoryTransaction.findFirstOrThrow({
      where: { referenceType: 'ADJUSTMENT', referenceId: adjId },
    });
    const revRes = await request(app)
      .post(`/api/v1/inventory/transactions/${adjTx.id}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Entered wrong warehouse bay' });
    expect(revRes.status).toBe(201);
    expect(revRes.body.data.transactionType).toBe('REVERSAL');

    // Double reversal blocked (409)
    const revDup = await request(app)
      .post(`/api/v1/inventory/transactions/${adjTx.id}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Second attempt', idempotencyKey: `DUP-REV-${adjTx.id}` });
    expect(revDup.status).toBe(409);

    // Concurrent race condition test: WH-PKG-01 has 20 KG of BATCH-FLR-01.
    // Create two separate approved issues each requesting 15 KG, and post them simultaneously!
    const makeApprovedIssue = async () => {
      const c = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(CSRF)
        .send({
          warehouseId: whPKGId,
          pickingStrategy: 'FEFO',
          lines: [{ inventoryItemId: rmInvItemId, uomId: kgUomId, requestedQuantity: '15', batchId: flrBatch1.id }],
        });
      const id = c.body.data.id;
      await request(app).post(`/api/v1/inventory/issues/${id}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
      return id;
    };

    const [issA, issB] = await Promise.all([makeApprovedIssue(), makeApprovedIssue()]);

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/v1/inventory/issues/${issA}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({}),
      request(app).post(`/api/v1/inventory/issues/${issB}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({}),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 400]);

    const finalPkgBal = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { warehouseId_inventoryItemId_batchId: { warehouseId: whPKGId, inventoryItemId: rmInvItemId, batchId: flrBatch1.id } },
    });
    expect(new Prisma.Decimal(finalPkgBal.quantityOnHand).toFixed(4)).toBe('5.0000');
  });
});
