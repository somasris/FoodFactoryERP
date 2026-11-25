import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.4: Batch Production Execution Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `pb_admin_${suffix}`,
    `pb_prod_${suffix}`,
    `pb_sales_${suffix}`,
    `pb_audit_${suffix}`,
  ];

  let adminToken: string;
  let prodToken: string;
  let salesToken: string;
  let auditorToken: string;

  let adminUserId: string;
  let prodUserId: string;
  let salesUserId: string;
  let auditorUserId: string;

  let whFGId: string;
  let whRMId: string;
  let kgUomId: string;
  let gUomId: string;
  let pcsUomId: string;
  let ltrUomId: string;
  let tax5Id: string;

  let rmCatId: string;
  let prodCatId: string;
  let flourRmId: string;
  let flourInvId: string;
  let rmBatchId: string;
  let productId: string;
  let variantId: string;
  let fgInvId: string;
  let bomId: string;
  let bomVersionId: string;
  let planId: string;
  let planItemId: string;

  let draftWoId: string;
  let releasedWo1Id: string;
  let releasedWo2Id: string;

  const createdBatchIds: string[] = [];

  beforeAll(async () => {
    const pw = await hashPassword('BatchTest2026!');
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

    const admin = await makeUser(`pb_admin_${suffix}`, 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const prod = await makeUser(`pb_prod_${suffix}`, 'PRODUCTION');
    prodUserId = prod.user.id;
    prodToken = prod.token;

    const sales = await makeUser(`pb_sales_${suffix}`, 'SALESMAN');
    salesUserId = sales.user.id;
    salesToken = sales.token;

    const audit = await makeUser(`pb_audit_${suffix}`, 'AUDITOR');
    auditorUserId = audit.user.id;
    auditorToken = audit.token;

    const [whFG, whRM, kg, g, pcs, ltr, tax5] = await Promise.all([
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'G' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'L' } }),
      prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } }),
    ]);
    whFGId = whFG.id;
    whRMId = whRM.id;
    kgUomId = kg.id;
    gUomId = g.id;
    pcsUomId = pcs.id;
    ltrUomId = ltr.id;
    tax5Id = tax5.id;

    await prisma.userWarehouseAccess.createMany({
      data: [
        { userId: prodUserId, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
        { userId: prodUserId, warehouseId: whRMId, accessLevel: 'READ_WRITE' },
        { userId: salesUserId, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
        { userId: auditorUserId, warehouseId: whFGId, accessLevel: 'READ' },
        { userId: auditorUserId, warehouseId: whRMId, accessLevel: 'READ' },
      ],
    });

    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `BRC-${suffix}`, name: `PB RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `BPC-${suffix}`, name: `PB Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const flour = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `BRM-FLR-${suffix}`,
        name: 'Batch Rice Flour',
        materialType: 'RAW_INGREDIENT',
        uom: { connect: { id: kgUomId } },
        hsnCode: '11029090',
        taxRate: { connect: { id: tax5Id } },
      },
    });
    flourRmId = flour.id;

    const flourInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'RAW_MATERIAL',
        rawMaterialId: flourRmId,
        code: `BINV-FLR-${suffix}`,
        name: 'Batch Rice Flour',
        uomId: kgUomId,
        movingAverageCost: new Prisma.Decimal('40.0000'),
      },
    });
    flourInvId = flourInv.id;

    const rmBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `RM-LOT-${suffix}`,
        unitCost: new Prisma.Decimal('40.0000'),
        expiryDate: new Date('2028-12-31'),
      },
    });
    rmBatchId = rmBatch.id;

    // Seed 50 KG of flour in WH-RM-01
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: flourInvId,
        warehouseId: whRMId,
        batchId: rmBatchId,
        quantityOnHand: new Prisma.Decimal('50.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('40.0000'),
        totalValue: new Prisma.Decimal('2000.0000'),
      },
    });

    const product = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `BPRD-${suffix}`,
        name: 'Batch Murukku',
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: tax5Id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `BSKU-${suffix}`,
        name: '200g Pack',
        netWeightGrams: new Prisma.Decimal('200.00'),
        uomId: pcsUomId,
        defaultSellingPrice: new Prisma.Decimal('50.00'),
      },
    });
    variantId = variant.id;

    const fgInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        code: `BINV-FG-${suffix}`,
        name: 'Batch Murukku 200g',
        uomId: pcsUomId,
        movingAverageCost: new Prisma.Decimal('30.0000'),
      },
    });
    fgInvId = fgInv.id;

    const bom = await prisma.bOM.create({
      data: {
        code: `BBOM-${suffix}`,
        name: 'Batch Murukku Recipe',
        productVariantId: variantId,
        baseOutputQuantity: new Prisma.Decimal('100.0000'),
        outputUomId: pcsUomId,
        versions: {
          create: {
            versionNumber: 1,
            status: 'ACTIVE',
            expectedGoodOutput: new Prisma.Decimal('100.0000'),
            outputUomId: pcsUomId,
            yieldPercentage: new Prisma.Decimal('100.00'),
            expectedWastagePercent: new Prisma.Decimal('0.00'),
            items: {
              create: {
                inventoryItemId: flourInvId,
                itemType: 'RAW_MATERIAL',
                standardQuantity: new Prisma.Decimal('50000.0000'), // 50 KG per 100 pcs
                uomId: gUomId,
                scrapTolerancePercent: new Prisma.Decimal('0.00'),
              },
            },
          },
        },
      },
      include: { versions: true },
    });
    bomId = bom.id;
    bomVersionId = bom.versions[0].id;

    const plan = await prisma.productionPlan.create({
      data: {
        planNumber: `PP-PB-${suffix}`,
        name: 'Batch Execution Plan',
        warehouseId: whFGId,
        planDate: new Date(),
        status: 'RELEASED',
        createdById: adminUserId,
        items: {
          create: {
            lineNumber: 1,
            productVariantId: variantId,
            inventoryItemId: fgInvId,
            bomId,
            bomVersionId,
            uomId: pcsUomId,
            demandQuantity: new Prisma.Decimal('100'),
            availableFgQuantity: new Prisma.Decimal('0'),
            existingPlannedQuantity: new Prisma.Decimal('0'),
            netRequirementQuantity: new Prisma.Decimal('100'),
            plannedQuantity: new Prisma.Decimal('100'),
            workOrderedQuantity: new Prisma.Decimal('80'),
            yieldPercentage: new Prisma.Decimal('100'),
            expectedWastagePercent: new Prisma.Decimal('0'),
            estimatedMaterialCost: new Prisma.Decimal('0'),
            estimatedOverheadCost: new Prisma.Decimal('0'),
            estimatedTotalCost: new Prisma.Decimal('0'),
          },
        },
      },
      include: { items: true },
    });
    planId = plan.id;
    planItemId = plan.items[0].id;

    const makeWo = async (woNum: string, status: 'DRAFT' | 'RELEASED', qty: string) =>
      prisma.workOrder.create({
        data: {
          workOrderNumber: woNum,
          financialYear: '2026-27',
          productionPlanId: planId,
          productionPlanItemId: planItemId,
          productVariantId: variantId,
          inventoryItemId: fgInvId,
          bomId,
          bomVersionId,
          warehouseId: whFGId,
          uomId: pcsUomId,
          plannedQuantity: new Prisma.Decimal(qty),
          status,
          createdById: adminUserId,
        },
      });

    draftWoId = (await makeWo(`WO-DRF-${suffix}`, 'DRAFT', '20')).id;
    releasedWo1Id = (await makeWo(`WO-REL1-${suffix}`, 'RELEASED', '40')).id;
    releasedWo2Id = (await makeWo(`WO-REL2-${suffix}`, 'RELEASED', '20')).id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean) } },
    });
    if (createdBatchIds.length > 0) {
      await prisma.inventoryTransactionLine.deleteMany({
        where: { transaction: { referenceType: 'PRODUCTION_BATCH', referenceId: { in: createdBatchIds } } },
      });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceType: 'PRODUCTION_BATCH', referenceId: { in: createdBatchIds } },
      });
      await prisma.inventoryIssueLine.deleteMany({
        where: { inventoryItemId: flourInvId },
      });
      await prisma.inventoryIssue.deleteMany({
        where: { departmentRef: { startsWith: 'PB/' } },
      });
      await prisma.inventoryReceiptLine.deleteMany({
        where: { inventoryItemId: fgInvId },
      });
      await prisma.inventoryReceipt.deleteMany({
        where: { supplierRef: { startsWith: 'PB/' } },
      });
      await prisma.productionExecutionEntry.deleteMany({
        where: { productionBatchId: { in: createdBatchIds } },
      });
      await prisma.productionBatchStatusHistory.deleteMany({
        where: { productionBatchId: { in: createdBatchIds } },
      });
      await prisma.productionBatchConsumption.deleteMany({
        where: { productionBatchId: { in: createdBatchIds } },
      });
      await prisma.productionBatch.deleteMany({
        where: { id: { in: createdBatchIds } },
      });
    }
    const woIds = [draftWoId, releasedWo1Id, releasedWo2Id].filter(Boolean);
    if (woIds.length > 0) {
      await prisma.workOrderStatusHistory.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.workOrder.deleteMany({ where: { id: { in: woIds } } });
    }
    if (planId) {
      await prisma.productionPlanStatusHistory.deleteMany({ where: { productionPlanId: planId } });
      await prisma.productionPlanItem.deleteMany({ where: { productionPlanId: planId } });
      await prisma.productionPlan.deleteMany({ where: { id: planId } });
    }
    if (bomId) {
      await prisma.bOMItem.deleteMany({ where: { bomVersion: { bomId } } });
      await prisma.bOMVersion.deleteMany({ where: { bomId } });
      await prisma.bOM.deleteMany({ where: { id: bomId } });
    }
    await prisma.inventoryBalance.deleteMany({
      where: { inventoryItemId: { in: [flourInvId, fgInvId].filter(Boolean) } },
    });
    await prisma.inventoryBatch.deleteMany({
      where: { inventoryItemId: { in: [flourInvId, fgInvId].filter(Boolean) } },
    });
    await prisma.inventoryItem.deleteMany({
      where: { id: { in: [flourInvId, fgInvId].filter(Boolean) } },
    });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (flourRmId) await prisma.rawMaterial.deleteMany({ where: { id: flourRmId } });
    if (rmCatId) await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });
    if (prodCatId) await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    await prisma.userWarehouseAccess.deleteMany({
      where: { userId: { in: [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
  });

  it('rejects creating a batch from an unreleased (DRAFT) work order', async () => {
    const res = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: draftWoId, plannedQuantity: '10' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/RELEASED or IN_PROGRESS/i);
  });

  it('supports partial batches, multiple batches per WO, concurrent creation, and overproduction prevention', async () => {
    const [b1, b2] = await Promise.all([
      request(app)
        .post('/api/v1/production/batches')
        .set('Authorization', `Bearer ${prodToken}`)
        .set(CSRF)
        .send({ workOrderId: releasedWo1Id, plannedQuantity: '15' }),
      request(app)
        .post('/api/v1/production/batches')
        .set('Authorization', `Bearer ${prodToken}`)
        .set(CSRF)
        .send({ workOrderId: releasedWo1Id, plannedQuantity: '25' }),
    ]);

    expect(b1.status).toBe(201);
    expect(b2.status).toBe(201);
    expect(b1.body.data.batchNumber).toMatch(/^PB\/\d{4}-\d{2}\/\d{5}$/);
    expect(b1.body.data.batchNumber).not.toBe(b2.body.data.batchNumber);
    createdBatchIds.push(b1.body.data.id, b2.body.data.id);

    // Total allocated = 40 -> attempting another batch must fail
    const overRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: releasedWo1Id, plannedQuantity: '1' });

    expect(overRes.status).toBe(400);
    expect(overRes.body.message).toMatch(/No remaining unallocated quantity/i);
  });

  it('executes lifecycle (start -> pause -> resume), reserves & consumes materials idempotently, and validates UOM/stock', async () => {
    const batchId = createdBatchIds[0]; // 15 pcs -> 7.5 KG expected

    const startRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('IN_PROGRESS');

    const woAfterStart = await prisma.workOrder.findUniqueOrThrow({ where: { id: releasedWo1Id } });
    expect(woAfterStart.status).toBe('IN_PROGRESS');

    // Reserve materials in WH-RM-01
    const resMat = await request(app)
      .post(`/api/v1/production/batches/${batchId}/reserve-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ warehouseId: whRMId });
    expect(resMat.status).toBe(200);
    expect(resMat.body.data.materialsReserved).toBe(true);

    // Pause & resume
    const pauseRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/pause`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ reason: 'Shift changeover' });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('PAUSED');

    const resumeRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/resume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.status).toBe('IN_PROGRESS');

    // Incompatible UOM rejected
    const badUomRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [{ inventoryItemId: flourInvId, warehouseId: whRMId, uomId: ltrUomId, quantity: '1' }],
      });
    expect(badUomRes.status).toBe(400);

    // Insufficient stock rejected (500 KG > 50 KG on hand)
    const shortRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [{ inventoryItemId: flourInvId, warehouseId: whRMId, uomId: kgUomId, quantity: '500' }],
      });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.message).toMatch(/Insufficient available/i);

    // Idempotent consumption: 7500 G = 7.5 KG from RM-LOT
    const idemKey = `cons-${suffix}-1`;
    const cons1 = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: idemKey,
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: gUomId,
            quantity: '7500',
            batchId: rmBatchId,
          },
        ],
      });
    expect(cons1.status).toBe(200);

    // Retry with same idempotencyKey -> must NOT deduct again
    const cons2 = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: idemKey,
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: gUomId,
            quantity: '7500',
            batchId: rmBatchId,
          },
        ],
      });
    expect(cons2.status).toBe(200);

    const rmBal = await prisma.inventoryBalance.findFirstOrThrow({
      where: { inventoryItemId: flourInvId, warehouseId: whRMId, batchId: rmBatchId },
    });
    expect(Number(rmBal.quantityOnHand)).toBe(42.5);
    expect(Number(rmBal.quantityReserved)).toBe(0);
  });

  it('records output/wastage, completes batches idempotently, receives FG batch, and completes WorkOrder', async () => {
    const b1Id = createdBatchIds[0]; // 15 planned
    const b2Id = createdBatchIds[1]; // 25 planned

    // Wastage > 0 without reason fails
    const noReasonRes = await request(app)
      .post(`/api/v1/production/batches/${b1Id}/output`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ goodQuantity: '12', rejectedQuantity: '1', wastageQuantity: '2' });
    expect(noReasonRes.status).toBe(400);

    // Record 12 good, 1 rejected, 2 wastage -> yield = 12/15 = 80.00%, completion = 80.00%
    const outRes = await request(app)
      .post(`/api/v1/production/batches/${b1Id}/output`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        goodQuantity: '12',
        rejectedQuantity: '1',
        wastageQuantity: '2',
        wastageReason: 'Over-roasted edge pieces',
      });
    expect(outRes.status).toBe(200);
    expect(Number(outRes.body.data.actualYieldPercent)).toBe(80);
    expect(Number(outRes.body.data.completionPercent)).toBe(80);

    // Complete b1 idempotently
    const compKey = `comp-${suffix}-1`;
    const comp1 = await request(app)
      .post(`/api/v1/production/batches/${b1Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: compKey,
        manufacturingDate: '2026-11-25',
        expiryDate: '2027-05-25',
      });
    expect(comp1.status).toBe(200);
    expect(comp1.body.data.status).toBe('COMPLETED');
    expect(comp1.body.data.finishedGoodsBatch.batchNumber).toBe(comp1.body.data.batchNumber);

    // Duplicate completion request with same idempotencyKey -> no double receipt
    const compDup = await request(app)
      .post(`/api/v1/production/batches/${b1Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ idempotencyKey: compKey });
    expect(compDup.status).toBe(200);

    const fgBalAfterB1 = await prisma.inventoryBalance.findFirstOrThrow({
      where: { inventoryItemId: fgInvId, warehouseId: whFGId },
    });
    expect(Number(fgBalAfterB1.quantityOnHand)).toBe(12);

    // Start and complete b2 (25 good) -> WorkOrder should auto-complete!
    await request(app)
      .post(`/api/v1/production/batches/${b2Id}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    const comp2 = await request(app)
      .post(`/api/v1/production/batches/${b2Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ goodQuantity: '25' });
    expect(comp2.status).toBe(200);
    expect(comp2.body.data.status).toBe('COMPLETED');

    const woFinal = await prisma.workOrder.findUniqueOrThrow({ where: { id: releasedWo1Id } });
    expect(woFinal.status).toBe('COMPLETED');
    expect(Number(woFinal.actualGoodQuantity)).toBe(37);
    expect(Number(woFinal.actualScrapQuantity)).toBe(3);
  });

  it('cancels a batch releasing work order allocation and enforces RBAC for SALESMAN/AUDITOR', async () => {
    const createRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: releasedWo2Id, plannedQuantity: '10' });
    expect(createRes.status).toBe(201);
    const bId = createRes.body.data.id;
    createdBatchIds.push(bId);

    const cancelRes = await request(app)
      .post(`/api/v1/production/batches/${bId}/cancel`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ reason: 'Line maintenance' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const wo2 = await prisma.workOrder.findUniqueOrThrow({ where: { id: releasedWo2Id } });
    expect(Number(wo2.allocatedBatchQuantity)).toBe(0);

    const salesRes = await request(app)
      .get('/api/v1/production/batches')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesRes.status).toBe(403);

    const auditGet = await request(app)
      .get('/api/v1/production/batches/dashboard')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(auditGet.status).toBe(200);

    const auditPost = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ workOrderId: releasedWo2Id, plannedQuantity: '5' });
    expect(auditPost.status).toBe(403);
  });
});
