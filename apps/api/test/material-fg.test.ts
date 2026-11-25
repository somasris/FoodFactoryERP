import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.5: Material Consumption & Finished Goods Management Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `mfg_admin_${suffix}`,
    `mfg_prod_${suffix}`,
    `mfg_sales_${suffix}`,
    `mfg_audit_${suffix}`,
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
  let pcsUomId: string;
  let tax5Id: string;

  let rmCatId: string;
  let prodCatId: string;
  let flourRmId: string;
  let flourInvId: string;
  let rmBatchValidId: string;
  let rmBatchExpiredId: string;
  let productId: string;
  let variantId: string;
  let fgInvId: string;
  let bomId: string;
  let bomVersionId: string;
  let planId: string;
  let planItemId: string;
  let wo1Id: string;
  let wo2Id: string;
  let customerId: string;

  const createdBatchIds: string[] = [];
  const createdSalesOrderIds: string[] = [];

  beforeAll(async () => {
    const pw = await hashPassword('MfgTest2026!');
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

    const admin = await makeUser(`mfg_admin_${suffix}`, 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const prod = await makeUser(`mfg_prod_${suffix}`, 'PRODUCTION');
    prodUserId = prod.user.id;
    prodToken = prod.token;

    const sales = await makeUser(`mfg_sales_${suffix}`, 'SALESMAN');
    salesUserId = sales.user.id;
    salesToken = sales.token;

    const audit = await makeUser(`mfg_audit_${suffix}`, 'AUDITOR');
    auditorUserId = audit.user.id;
    auditorToken = audit.token;

    const [whFG, whRM, kg, pcs, tax5] = await Promise.all([
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } }),
      prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } }),
    ]);
    whFGId = whFG.id;
    whRMId = whRM.id;
    kgUomId = kg.id;
    pcsUomId = pcs.id;
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
      data: { code: `MRC-${suffix}`, name: `MFG RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `MPC-${suffix}`, name: `MFG Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const flour = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `MRM-FLR-${suffix}`,
        name: 'MFG Rice Flour',
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
        code: `MINV-FLR-${suffix}`,
        name: 'MFG Rice Flour',
        uomId: kgUomId,
        movingAverageCost: new Prisma.Decimal('40.0000'),
      },
    });
    flourInvId = flourInv.id;

    const rmBatchValid = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `MRM-LOT-${suffix}`,
        unitCost: new Prisma.Decimal('40.0000'),
        expiryDate: new Date('2028-12-31'),
      },
    });
    rmBatchValidId = rmBatchValid.id;

    const rmBatchExpired = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `MRM-EXP-${suffix}`,
        unitCost: new Prisma.Decimal('40.0000'),
        expiryDate: new Date('2020-01-01'),
      },
    });
    rmBatchExpiredId = rmBatchExpired.id;

    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: flourInvId,
        warehouseId: whRMId,
        batchId: rmBatchValidId,
        quantityOnHand: new Prisma.Decimal('100.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('40.0000'),
        totalValue: new Prisma.Decimal('4000.0000'),
      },
    });

    const product = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `MPRD-${suffix}`,
        name: 'MFG Murukku',
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: tax5Id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `MSKU-${suffix}`,
        name: '200g Pack',
        netWeightGrams: new Prisma.Decimal('200.00'),
        uomId: pcsUomId,
        defaultSellingPrice: new Prisma.Decimal('50.00'),
        shelfLifeDays: 180,
      },
    });
    variantId = variant.id;

    const fgInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        code: `MINV-FG-${suffix}`,
        name: 'MFG Murukku 200g',
        uomId: pcsUomId,
        movingAverageCost: new Prisma.Decimal('30.0000'),
      },
    });
    fgInvId = fgInv.id;

    const bom = await prisma.bOM.create({
      data: {
        code: `MBOM-${suffix}`,
        name: 'MFG Murukku Recipe',
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
                standardQuantity: new Prisma.Decimal('100.0000'), // 1 KG per pc
                uomId: kgUomId,
                scrapTolerancePercent: new Prisma.Decimal('10.00'), // +10% expected wastage => 1.1 KG/pc total
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
        planNumber: `PP-MFG-${suffix}`,
        name: 'MFG Plan',
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
            workOrderedQuantity: new Prisma.Decimal('40'),
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

    const makeWo = async (woNum: string, qty: string) =>
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
          status: 'RELEASED',
          createdById: adminUserId,
        },
      });

    wo1Id = (await makeWo(`MWO1-${suffix}`, '20')).id;
    wo2Id = (await makeWo(`MWO2-${suffix}`, '10')).id;

    const cust = await prisma.customer.create({
      data: {
        code: `MCUST-${suffix}`,
        legalName: 'MFG Test Customer Pvt Ltd',
        customerType: 'RETAILER',
        phone: '9999999999',
        creditPeriodDays: 30,
        creditLimit: new Prisma.Decimal('100000'),
      },
    });
    customerId = cust.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean) } },
    });
    if (createdSalesOrderIds.length > 0) {
      await prisma.salesOrderStatusHistory.deleteMany({ where: { salesOrderId: { in: createdSalesOrderIds } } });
      await prisma.salesOrderFulfillment.deleteMany({ where: { salesOrderId: { in: createdSalesOrderIds } } });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: createdSalesOrderIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: createdSalesOrderIds } } });
    }
    if (createdBatchIds.length > 0) {
      await prisma.qualityInspection.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionBatchVarianceApproval.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionBatchReturn.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionExecutionEntry.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionBatchStatusHistory.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionBatchConsumption.deleteMany({ where: { productionBatchId: { in: createdBatchIds } } });
      await prisma.productionBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
    }
    const userIds = [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean);
    await prisma.inventoryTransactionLine.deleteMany({
      where: {
        OR: [
          { inventoryItemId: { in: [flourInvId, fgInvId].filter(Boolean) } },
          { transaction: { postedById: { in: userIds } } },
        ],
      },
    });
    await prisma.inventoryTransaction.deleteMany({
      where: { postedById: { in: userIds } },
    });
    await prisma.inventoryIssueLine.deleteMany({ where: { inventoryItemId: { in: [flourInvId, fgInvId].filter(Boolean) } } });
    await prisma.inventoryIssue.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.inventoryReceiptLine.deleteMany({ where: { inventoryItemId: { in: [flourInvId, fgInvId].filter(Boolean) } } });
    await prisma.inventoryReceipt.deleteMany({ where: { createdById: { in: userIds } } });
    const woIds = [wo1Id, wo2Id].filter(Boolean);
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
    if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.userWarehouseAccess.deleteMany({
      where: { userId: { in: [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
  });

  it('reconciles planned vs actual, supports idempotent partial returns, rejects excess/expired returns, and enforces variance approval RBAC', async () => {
    // Create and start batch for 10 pcs -> BOM std = 10 KG, expected wastage = 1 KG, expected total = 11 KG
    const bRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: wo1Id, plannedQuantity: '10' });
    expect(bRes.status).toBe(201);
    const batchId = bRes.body.data.id;
    createdBatchIds.push(batchId);

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    // Consume 15 KG from valid RM batch (excess!)
    const consRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: kgUomId,
            quantity: '15',
            batchId: rmBatchValidId,
          },
        ],
      });
    expect(consRes.status).toBe(200);

    // Partial return of 2 KG (idempotent)
    const retKey = `ret-${suffix}-1`;
    const ret1 = await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: retKey,
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: kgUomId,
            quantity: '2',
            batchId: rmBatchValidId,
            reason: 'Unused flour returned',
          },
        ],
      });
    expect(ret1.status).toBe(200);

    // Duplicate return with same idempotencyKey -> no double return
    const retDup = await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: retKey,
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: kgUomId,
            quantity: '2',
            batchId: rmBatchValidId,
            reason: 'Unused flour returned',
          },
        ],
      });
    expect(retDup.status).toBe(200);

    // Returning more than remaining consumed (13) fails
    const excessRet = await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: kgUomId,
            quantity: '20',
            batchId: rmBatchValidId,
            reason: 'Too much',
          },
        ],
      });
    expect(excessRet.status).toBe(400);

    // Returning expired batch fails
    const expRet = await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            uomId: kgUomId,
            quantity: '1',
            batchId: rmBatchExpiredId,
            reason: 'Expired batch',
          },
        ],
      });
    expect(expRet.status).toBe(400);

    // Check reconciliation: std=10, expWastage=1, expTotal=11, consumed=15, returned=2, net=13, variance=+2 (18.18%) > 5%
    const recRes = await request(app)
      .get(`/api/v1/production/batches/${batchId}/reconciliation`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(recRes.status).toBe(200);
    const line = recRes.body.data.lines[0];
    expect(Number(line.bomStandardQuantity)).toBe(10);
    expect(Number(line.expectedWastage)).toBe(1);
    expect(Number(line.actualConsumedQuantity)).toBe(15);
    expect(Number(line.returnedQuantity)).toBe(2);
    expect(Number(line.netConsumedQuantity)).toBe(13);
    expect(Number(line.quantityVariance)).toBe(2);
    expect(line.exceedsThreshold).toBe(true);

    // PRODUCTION cannot approve variance (403)
    const prodApp = await request(app)
      .post(`/api/v1/production/batches/${batchId}/variance-approval`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ inventoryItemId: flourInvId, decision: 'APPROVED', reason: 'Self approve' });
    expect(prodApp.status).toBe(403);

    // ADMIN approves variance
    const adminApp = await request(app)
      .post(`/api/v1/production/batches/${batchId}/variance-approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ inventoryItemId: flourInvId, decision: 'APPROVED', reason: 'Moisture adjustment' });
    expect(adminApp.status).toBe(200);
    expect(adminApp.body.data.status).toBe('APPROVED');
  });

  it('enforces quality inspection & quarantine exclusion from Sales Orders until released, plus recall lookup', async () => {
    const batchId = createdBatchIds[0];

    // Complete batch with 10 good units -> shelfLifeDays=180 auto-computes expiryDate; FG batch starts PENDING_INSPECTION
    const compRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ goodQuantity: '10', manufacturingDate: '2026-11-25' });
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.finishedGoodsBatch.qualityStatus).toBe('PENDING_INSPECTION');
    expect(compRes.body.data.finishedGoodsBatch.expiryDate).toBeTruthy();
    const qiId = compRes.body.data.qualityInspection.id;

    // Create a DRAFT Sales Order for 5 pcs and try to submit/approve/confirm -> must FAIL because FG is PENDING_INSPECTION!
    const soRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '5' }],
      });
    expect(soRes.status).toBe(201);
    const soId = soRes.body.data.id;
    createdSalesOrderIds.push(soId);

    await request(app).post(`/api/v1/sales/orders/${soId}/submit`).set('Authorization', `Bearer ${salesToken}`).set(CSRF).send({});
    await request(app).post(`/api/v1/sales/orders/${soId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});

    const confirmPendingRes = await request(app)
      .post(`/api/v1/sales/orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(confirmPendingRes.status).toBe(400);
    expect(confirmPendingRes.body.message).toMatch(/Insufficient available/i);

    // Inspect as QUARANTINED
    const qiRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ decision: 'QUARANTINED', defectCategory: 'Seal Check', notes: 'Hold for lab' });
    expect(qiRes.status).toBe(200);
    expect(qiRes.body.data.decision).toBe('QUARANTINED');

    // Duplicate inspection decision must be rejected
    const dupQiRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ decision: 'ACCEPTED' });
    expect(dupQiRes.status).toBe(400);

    // PRODUCTION cannot release quarantined stock (403)
    const prodRelRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/release`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ releaseNotes: 'Release attempt' });
    expect(prodRelRes.status).toBe(403);

    // ADMIN releases quarantined stock -> qualityStatus = ACCEPTED
    const adminRelRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ releaseNotes: 'Lab cleared' });
    expect(adminRelRes.status).toBe(200);
    expect(adminRelRes.body.data.decision).toBe('ACCEPTED');
    expect(adminRelRes.body.data.inventoryBatch.qualityStatus).toBe('ACCEPTED');

    // Now Sales Order confirmation & fulfillment succeeds!
    const confirmOkRes = await request(app)
      .post(`/api/v1/sales/orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(confirmOkRes.status).toBe(200);
    expect(confirmOkRes.body.data.status).toBe('CONFIRMED');

    const fulfillRes = await request(app)
      .post(`/api/v1/sales/orders/${soId}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(fulfillRes.status).toBe(200);

    // Recall lookup by RM batch & FG batch
    const recallRmRes = await request(app)
      .get(`/api/v1/production/traceability/recall?batchNumber=MRM-LOT-${suffix}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(recallRmRes.status).toBe(200);
    expect(recallRmRes.body.data.matches.length).toBe(1);
    expect(recallRmRes.body.data.matches[0].consumedInBatches.length).toBeGreaterThanOrEqual(1);

    const fgBatchNum = compRes.body.data.batchNumber;
    const recallFgRes = await request(app)
      .get(`/api/v1/production/traceability/recall?batchNumber=${encodeURIComponent(fgBatchNum)}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(recallFgRes.status).toBe(200);
    expect(recallFgRes.body.data.matches[0].transactionLines.length).toBeGreaterThanOrEqual(1);
  });

  it('supports PARTIALLY_ACCEPTED quality inspection splitting rejected qty into REJECTED batch', async () => {
    const b2Res = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: wo2Id, plannedQuantity: '10' });
    expect(b2Res.status).toBe(201);
    const b2Id = b2Res.body.data.id;
    createdBatchIds.push(b2Id);

    await request(app).post(`/api/v1/production/batches/${b2Id}/start`).set('Authorization', `Bearer ${prodToken}`).set(CSRF).send({});
    const comp2 = await request(app)
      .post(`/api/v1/production/batches/${b2Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ goodQuantity: '10' });
    expect(comp2.status).toBe(200);

    const qi2Id = comp2.body.data.qualityInspection.id;
    const partRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qi2Id}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        decision: 'PARTIALLY_ACCEPTED',
        goodQuantity: '8',
        rejectedQuantity: '2',
        defectCategory: 'Crushed Packs',
      });
    expect(partRes.status).toBe(200);
    expect(partRes.body.data.decision).toBe('PARTIALLY_ACCEPTED');

    const rejBatch = await prisma.inventoryBatch.findUnique({
      where: {
        inventoryItemId_batchNumber: {
          inventoryItemId: fgInvId,
          batchNumber: `${comp2.body.data.batchNumber}-REJ`,
        },
      },
    });
    expect(rejBatch).toBeTruthy();
    expect(rejBatch!.qualityStatus).toBe('REJECTED');

    // RBAC checks: SALESMAN denied, AUDITOR read-only
    const salesDenied = await request(app)
      .get('/api/v1/production/quality-inspections')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesDenied.status).toBe(403);

    const auditDenied = await request(app)
      .post(`/api/v1/production/batches/${b2Id}/return-materials`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ lines: [] });
    expect(auditDenied.status).toBe(403);
  });
});
