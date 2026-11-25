import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.7: Production Reports & Analytics Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `rep_admin_${suffix}`,
    `rep_prod_${suffix}`,
    `rep_sales_${suffix}`,
    `rep_audit_${suffix}`,
  ];

  let adminToken: string;
  let prodToken: string;
  let salesToken: string;
  let auditorToken: string;

  let adminUserId: string;
  let prodUserId: string;

  let whFGId: string;
  let whRMId: string;
  let kgUomId: string;
  let pcsUomId: string;

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
  let woCompletedId: string;
  let woOverdueId: string;
  let batchId: string;

  beforeAll(async () => {
    const pw = await hashPassword('RepTest2026!');
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    const roleMap = new Map(roles.map(r => [r.code, r]));

    const makeUser = async (username: string, roleCode: string, fullName: string) => {
      const role = roleMap.get(roleCode)!;
      const u = await prisma.user.create({
        data: {
          username,
          email: `${username}@test.local`,
          passwordHash: pw,
          fullName,
          userRoles: { create: { roleId: role.id } },
        },
      });
      const perms = role.permissions.map(p => p.permission.code);
      const token = generateAccessToken({
        userId: u.id,
        username: u.username,
        roles: [roleCode],
        permissions: perms,
      });
      return { id: u.id, token };
    };

    const [adm, prd, sls, aud] = await Promise.all([
      makeUser(createdUsernames[0], 'ADMIN', 'Rep Admin'),
      makeUser(createdUsernames[1], 'PRODUCTION', 'Rep Operator'),
      makeUser(createdUsernames[2], 'SALESMAN', 'Rep Salesman'),
      makeUser(createdUsernames[3], 'AUDITOR', 'Rep Auditor'),
    ]);
    adminUserId = adm.id;
    adminToken = adm.token;
    prodUserId = prd.id;
    prodToken = prd.token;
    salesToken = sls.token;
    auditorToken = aud.token;

    const [whFG, whRM, kgUom, pcsUom, tax5] = await Promise.all([
      prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findFirstOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findFirstOrThrow({ where: { code: 'PCS' } }),
      prisma.taxRate.findFirstOrThrow(),
    ]);
    whFGId = whFG.id;
    whRMId = whRM.id;
    kgUomId = kgUom.id;
    pcsUomId = pcsUom.id;

    for (const uid of [adminUserId, prodUserId]) {
      await prisma.userWarehouseAccess.createMany({
        data: [
          { userId: uid, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
          { userId: uid, warehouseId: whRMId, accessLevel: 'READ_WRITE' },
        ],
        skipDuplicates: true,
      });
    }

    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `RMC-REP-${suffix}`, name: `Rep RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;
    const prodCat = await prisma.productCategory.create({
      data: { code: `PRC-REP-${suffix}`, name: `Rep Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const rm = await prisma.rawMaterial.create({
      data: {
        code: `RM-REP-${suffix}`,
        name: `Rep Flour ${suffix}`,
        materialType: 'RAW_INGREDIENT',
        hsnCode: '11029090',
        taxRateId: tax5.id,
        categoryId: rmCatId,
        uomId: kgUomId,
      },
    });
    flourRmId = rm.id;

    const flourInv = await prisma.inventoryItem.create({
      data: {
        code: `INV-REP-RM-${suffix}`,
        name: `Rep Flour Inv ${suffix}`,
        itemType: 'RAW_MATERIAL',
        rawMaterialId: flourRmId,
        uomId: kgUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('40.0000'),
      },
    });
    flourInvId = flourInv.id;

    const rmBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `RMB-REP-${suffix}`,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        unitCost: new Prisma.Decimal('40.0000'),
      },
    });
    rmBatchId = rmBatch.id;

    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRMId,
        inventoryItemId: flourInvId,
        batchId: rmBatchId,
        quantityOnHand: new Prisma.Decimal('200.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('40.0000'),
        totalValue: new Prisma.Decimal('8000.0000'),
      },
    });

    const prod = await prisma.product.create({
      data: {
        code: `PRD-REP-${suffix}`,
        name: `Rep Mixture ${suffix}`,
        categoryId: prodCatId,
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: tax5.id,
      },
    });
    productId = prod.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `SKU-REP-${suffix}`,
        name: `Rep Mixture 250g ${suffix}`,
        netWeightGrams: new Prisma.Decimal('250.00'),
        uomId: pcsUomId,
        defaultSellingPrice: new Prisma.Decimal('90.00'),
        shelfLifeDays: 120,
      },
    });
    variantId = variant.id;

    const fgInv = await prisma.inventoryItem.create({
      data: {
        code: `INV-REP-FG-${suffix}`,
        name: `Rep Mixture FG ${suffix}`,
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        uomId: pcsUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('0.0000'),
      },
    });
    fgInvId = fgInv.id;

    const bom = await prisma.bOM.create({
      data: {
        productVariantId: variantId,
        code: `BOM-REP-${suffix}`,
        name: `Rep BOM ${suffix}`,
        baseOutputQuantity: new Prisma.Decimal('10.0000'),
        outputUomId: pcsUomId,
        versions: {
          create: {
            versionNumber: 1,
            status: 'ACTIVE',
            expectedGoodOutput: new Prisma.Decimal('10.0000'),
            yieldPercentage: new Prisma.Decimal('95.00'),
            expectedWastagePercent: new Prisma.Decimal('5.00'),
            outputUomId: pcsUomId,
            items: {
              create: {
                inventoryItemId: flourInvId,
                itemType: 'RAW_MATERIAL',
                standardQuantity: new Prisma.Decimal('10.0000'),
                uomId: kgUomId,
                scrapTolerancePercent: new Prisma.Decimal('5.00'),
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
        planNumber: `PP-REP-${suffix}`,
        name: 'Rep Plan',
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
            demandQuantity: new Prisma.Decimal('20'),
            availableFgQuantity: new Prisma.Decimal('0'),
            existingPlannedQuantity: new Prisma.Decimal('0'),
            netRequirementQuantity: new Prisma.Decimal('20'),
            plannedQuantity: new Prisma.Decimal('20'),
            workOrderedQuantity: new Prisma.Decimal('20'),
            yieldPercentage: new Prisma.Decimal('95'),
            expectedWastagePercent: new Prisma.Decimal('5'),
            estimatedMaterialCost: new Prisma.Decimal('0'),
            estimatedOverheadCost: new Prisma.Decimal('0'),
            estimatedTotalCost: new Prisma.Decimal('0'),
          },
        },
      },
      include: { items: true },
    });
    planId = plan.id;

    const wo1 = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-REP1-${suffix}`,
        financialYear: '2026-27',
        productionPlanId: planId,
        productionPlanItemId: plan.items[0].id,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFGId,
        uomId: pcsUomId,
        plannedQuantity: new Prisma.Decimal('10.0000'),
        status: 'RELEASED',
        plannedEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        createdById: adminUserId,
      },
    });
    woCompletedId = wo1.id;

    // Overdue released WO
    const wo2 = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-REP2-${suffix}`,
        financialYear: '2026-27',
        productionPlanId: planId,
        productionPlanItemId: plan.items[0].id,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFGId,
        uomId: pcsUomId,
        plannedQuantity: new Prisma.Decimal('10.0000'),
        status: 'RELEASED',
        priority: 'HIGH',
        plannedEndDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        createdById: adminUserId,
      },
    });
    woOverdueId = wo2.id;

    // Execute batch on wo1
    const bRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: woCompletedId, warehouseId: whFGId, plannedQuantity: '10' });
    batchId = bRes.body.data.id;

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            batchId: rmBatchId,
            uomId: kgUomId,
            quantity: '11',
          },
        ],
      });

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            batchId: rmBatchId,
            uomId: kgUomId,
            quantity: '1',
            reason: 'Unused return',
          },
        ],
      });

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/output`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ goodQuantity: '9', rejectedQuantity: '0', wastageQuantity: '1', wastageReason: 'Trimming loss' });

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    const qi = await prisma.qualityInspection.findUniqueOrThrow({
      where: { productionBatchId: batchId },
    });
    await request(app)
      .post(`/api/v1/production/quality-inspections/${qi.id}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ decision: 'ACCEPTED' });

    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: false });
    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `REP-FIN-${suffix}` });
  });

  afterAll(async () => {
    if (batchId) {
      await prisma.productionBatchCosting.deleteMany({ where: { productionBatchId: batchId } });
      await prisma.qualityInspection.deleteMany({ where: { productionBatchId: batchId } });
      await prisma.productionBatchReturn.deleteMany({ where: { productionBatchId: batchId } });
      await prisma.productionBatchConsumption.deleteMany({ where: { productionBatchId: batchId } });
      await prisma.productionBatch.deleteMany({ where: { id: batchId } });
    }
    const invIds = [flourInvId, fgInvId].filter(Boolean);
    if (invIds.length > 0) {
      await prisma.inventoryTransactionLine.deleteMany({ where: { inventoryItemId: { in: invIds } } });
      await prisma.inventoryTransaction.deleteMany({ where: { lines: { none: {} } } });
      await prisma.inventoryReceiptLine.deleteMany({ where: { inventoryItemId: { in: invIds } } });
      await prisma.inventoryIssueLine.deleteMany({ where: { inventoryItemId: { in: invIds } } });
    }
    await prisma.workOrder.deleteMany({ where: { id: { in: [woCompletedId, woOverdueId].filter(Boolean) } } });
    if (planId) await prisma.productionPlan.deleteMany({ where: { id: planId } });
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: invIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: invIds } } });
    if (fgInvId) await prisma.inventoryItem.deleteMany({ where: { id: fgInvId } });
    if (flourInvId) await prisma.inventoryItem.deleteMany({ where: { id: flourInvId } });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (flourRmId) await prisma.rawMaterial.deleteMany({ where: { id: flourRmId } });
    if (prodCatId) await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    if (rmCatId) await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });

    const users = await prisma.user.findMany({
      where: { username: { in: createdUsernames } },
      select: { id: true },
    });
    const uids = users.map(u => u.id);
    if (uids.length > 0) {
      await prisma.userWarehouseAccess.deleteMany({ where: { userId: { in: uids } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: uids } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: uids } } });
      await prisma.user.deleteMany({ where: { id: { in: uids } } });
    }
  });

  it('1. returns accurate dashboard KPIs, trends, and enforces cost-access RBAC', async () => {
    const adminDash = await request(app)
      .get('/api/v1/production/reports/dashboard?period=fy')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDash.status).toBe(200);
    expect(adminDash.body.data.kpis.costAccess).toBe(true);
    expect(adminDash.body.data.kpis.totalActualProductionCost).not.toBeNull();

    // PRODUCTION role gets operational KPIs but NOT sensitive cost KPIs
    const prodDash = await request(app)
      .get('/api/v1/production/reports/dashboard?period=month')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(prodDash.status).toBe(200);
    expect(prodDash.body.data.kpis.costAccess).toBe(false);
    expect(prodDash.body.data.kpis.totalActualProductionCost).toBeNull();

    const trendsRes = await request(app)
      .get('/api/v1/production/reports/trends?period=fy&granularity=monthly')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(trendsRes.status).toBe(200);
    expect(Array.isArray(trendsRes.body.data.series)).toBe(true);
  });

  it('2. serves plan-vs-actual, work-order-performance, batch-yield, material-consumption, quality, and costing reports', async () => {
    const pva = await request(app)
      .get(`/api/v1/production/reports/plan-vs-actual?period=fy&search=PP-REP-${suffix}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(pva.status).toBe(200);
    expect(pva.body.data.items.length).toBe(1);
    expect(pva.body.data.items[0].varianceClassification).toBe('UNDERPRODUCED');

    const wop = await request(app)
      .get(`/api/v1/production/reports/work-order-performance?period=fy&search=WO-REP2-${suffix}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(wop.status).toBe(200);
    expect(wop.body.data.items[0].isOverdue).toBe(true);
    expect(wop.body.data.items[0].delayDays).toBeGreaterThanOrEqual(2);

    const byr = await request(app)
      .get(`/api/v1/production/reports/batch-yield?period=fy&productionBatchId=${batchId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(byr.status).toBe(200);
    expect(byr.body.data.items[0].expectedYieldPercent).toBe('95.00');
    expect(byr.body.data.items[0].actualYieldPercent).toBe('90.00');

    const mcr = await request(app)
      .get(`/api/v1/production/reports/material-consumption?period=fy&productionBatchId=${batchId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(mcr.status).toBe(200);
    expect(Number(mcr.body.data.items[0].actualConsumedQuantity)).toBe(11);
    expect(Number(mcr.body.data.items[0].returnedQuantity)).toBe(1);
    expect(Number(mcr.body.data.items[0].netConsumption)).toBe(10);

    const qr = await request(app)
      .get(`/api/v1/production/reports/quality?period=fy&productionBatchId=${batchId}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(qr.status).toBe(200);
    expect(qr.body.data.items[0].decision).toBe('ACCEPTED');

    const cr = await request(app)
      .get(`/api/v1/production/reports/costing?period=fy&productionBatchId=${batchId}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(cr.status).toBe(200);
    expect(cr.body.data.items[0].isFinalized).toBe(true);
    expect(Number(cr.body.data.items[0].actualMaterialCost)).toBe(400);
  });

  it('3. enforces RBAC and exports CSV, Excel, and PDF reports', async () => {
    // Unauthenticated rejected
    const unauth = await request(app).get('/api/v1/production/reports/dashboard');
    expect(unauth.status).toBe(401);

    // SALESMAN rejected
    const salesRes = await request(app)
      .get('/api/v1/production/reports/dashboard')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesRes.status).toBe(403);

    // PRODUCTION cannot access sensitive costing report or export costing
    const prodCost = await request(app)
      .get('/api/v1/production/reports/costing')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(prodCost.status).toBe(403);

    const prodCostExport = await request(app)
      .get('/api/v1/production/reports/export/costing?format=csv')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(prodCostExport.status).toBe(403);

    // CSV, Excel, PDF exports succeed for authorized roles
    const csvRes = await request(app)
      .get('/api/v1/production/reports/export/plan-vs-actual?format=csv&period=fy')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Production Plan vs Actual Report');

    const xlsRes = await request(app)
      .get('/api/v1/production/reports/export/costing?format=excel&period=fy')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(xlsRes.status).toBe(200);
    expect(xlsRes.headers['content-type']).toContain('application/vnd.ms-excel');

    const pdfRes = await request(app)
      .get('/api/v1/production/reports/export/quality?format=pdf&period=fy')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
  });
});
