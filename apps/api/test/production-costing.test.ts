import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.6: Production Costing & Variance Accounting Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `cost_admin_${suffix}`,
    `cost_prod_${suffix}`,
    `cost_sales_${suffix}`,
    `cost_audit_${suffix}`,
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
  let woId: string;

  let batch1Id: string;
  let batch2Id: string;
  const createdBatchIds: string[] = [];

  beforeAll(async () => {
    const pw = await hashPassword('CostTest2026!');
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
      makeUser(createdUsernames[0], 'ADMIN', 'Cost Admin'),
      makeUser(createdUsernames[1], 'PRODUCTION', 'Cost Operator'),
      makeUser(createdUsernames[2], 'SALESMAN', 'Cost Salesman'),
      makeUser(createdUsernames[3], 'AUDITOR', 'Cost Auditor'),
    ]);
    adminUserId = adm.id;
    adminToken = adm.token;
    prodUserId = prd.id;
    prodToken = prd.token;
    salesUserId = sls.id;
    salesToken = sls.token;
    auditorUserId = aud.id;
    auditorToken = aud.token;

    const [whFG, whRM, kgUom, pcsUom] = await Promise.all([
      prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findFirstOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findFirstOrThrow({ where: { code: 'PCS' } }),
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
      data: { code: `RMC-CST-${suffix}`, name: `Cost RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `PRC-CST-${suffix}`, name: `Cost Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const tax5 = await prisma.taxRate.findFirstOrThrow();

    const rm = await prisma.rawMaterial.create({
      data: {
        code: `RM-CST-${suffix}`,
        name: `Cost Flour ${suffix}`,
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
        code: `INV-CST-RM-${suffix}`,
        name: `Cost Flour Inv ${suffix}`,
        itemType: 'RAW_MATERIAL',
        rawMaterialId: flourRmId,
        uomId: kgUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('50.0000'),
      },
    });
    flourInvId = flourInv.id;

    const rmBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `RMB-CST-${suffix}`,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        unitCost: new Prisma.Decimal('50.0000'),
      },
    });
    rmBatchId = rmBatch.id;

    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRMId,
        inventoryItemId: flourInvId,
        batchId: rmBatchId,
        quantityOnHand: new Prisma.Decimal('500.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('50.0000'),
        totalValue: new Prisma.Decimal('25000.0000'),
      },
    });

    const prod = await prisma.product.create({
      data: {
        code: `PRD-CST-${suffix}`,
        name: `Cost Snack ${suffix}`,
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
        sku: `SKU-CST-${suffix}`,
        name: `Cost Snack 200g ${suffix}`,
        netWeightGrams: new Prisma.Decimal('200.00'),
        uomId: pcsUomId,
        defaultSellingPrice: new Prisma.Decimal('120.00'),
        shelfLifeDays: 180,
      },
    });
    variantId = variant.id;

    const fgInv = await prisma.inventoryItem.create({
      data: {
        code: `INV-CST-FG-${suffix}`,
        name: `Cost Snack FG ${suffix}`,
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
        code: `BOM-CST-${suffix}`,
        name: `Cost BOM ${suffix}`,
        baseOutputQuantity: new Prisma.Decimal('10.0000'),
        outputUomId: pcsUomId,
        versions: {
          create: {
            versionNumber: 1,
            status: 'ACTIVE',
            expectedGoodOutput: new Prisma.Decimal('10.0000'),
            yieldPercentage: new Prisma.Decimal('100.00'),
            expectedWastagePercent: new Prisma.Decimal('0.00'),
            outputUomId: pcsUomId,
            items: {
              create: {
                inventoryItemId: flourInvId,
                itemType: 'RAW_MATERIAL',
                standardQuantity: new Prisma.Decimal('10.0000'),
                uomId: kgUomId,
                scrapTolerancePercent: new Prisma.Decimal('0.00'),
              },
            },
            overheads: {
              create: [
                {
                  costType: 'LABOUR',
                  description: 'Standard Packing Labour',
                  standardAmount: new Prisma.Decimal('100.00'),
                },
                {
                  costType: 'UTILITY',
                  description: 'Standard Gas & Power',
                  standardAmount: new Prisma.Decimal('50.00'),
                },
              ],
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
        planNumber: `PP-CST-${suffix}`,
        name: 'Costing Plan',
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
            demandQuantity: new Prisma.Decimal('30'),
            availableFgQuantity: new Prisma.Decimal('0'),
            existingPlannedQuantity: new Prisma.Decimal('0'),
            netRequirementQuantity: new Prisma.Decimal('30'),
            plannedQuantity: new Prisma.Decimal('30'),
            workOrderedQuantity: new Prisma.Decimal('30'),
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

    const wo = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-CST-${suffix}`,
        financialYear: '2026-27',
        productionPlanId: planId,
        productionPlanItemId: plan.items[0].id,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFGId,
        uomId: pcsUomId,
        plannedQuantity: new Prisma.Decimal('30.0000'),
        status: 'RELEASED',
        createdById: adminUserId,
      },
    });
    woId = wo.id;
  });

  afterAll(async () => {
    for (const bId of createdBatchIds) {
      await prisma.productionBatchCosting.deleteMany({ where: { productionBatchId: bId } });
      await prisma.qualityInspection.deleteMany({ where: { productionBatchId: bId } });
      await prisma.productionBatchReturn.deleteMany({ where: { productionBatchId: bId } });
      await prisma.productionBatchConsumption.deleteMany({ where: { productionBatchId: bId } });
      await prisma.productionBatch.deleteMany({ where: { id: bId } });
    }
    if (createdBatchIds.length > 0) {
      await prisma.inventoryTransactionLine.deleteMany({
        where: { transaction: { referenceId: { in: createdBatchIds } } },
      });
      await prisma.inventoryTransaction.deleteMany({
        where: { referenceId: { in: createdBatchIds } },
      });
    }
    if (woId) await prisma.workOrder.deleteMany({ where: { id: woId } });
    if (planId) await prisma.productionPlan.deleteMany({ where: { id: planId } });
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    const invIds = [flourInvId, fgInvId].filter(Boolean);
    if (invIds.length > 0) {
      await prisma.inventoryTransactionLine.deleteMany({
        where: { inventoryItemId: { in: invIds } },
      });
      await prisma.inventoryTransaction.deleteMany({
        where: { lines: { none: {} } },
      });
      await prisma.inventoryReceiptLine.deleteMany({
        where: { inventoryItemId: { in: invIds } },
      });
      await prisma.inventoryIssueLine.deleteMany({
        where: { inventoryItemId: { in: invIds } },
      });
    }
    await prisma.inventoryBalance.deleteMany({
      where: { inventoryItemId: { in: invIds } },
    });
    await prisma.inventoryBatch.deleteMany({
      where: { inventoryItemId: { in: invIds } },
    });
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

  it('1. computes material, return, labour, machine, overhead, variance & FG valuation lifecycle', async () => {
    // Create and start batch 1 (planned 10 pcs)
    const createRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: woId, warehouseId: whFGId, plannedQuantity: '10' });
    expect(createRes.status).toBe(201);
    batch1Id = createRes.body.data.id;
    createdBatchIds.push(batch1Id);

    await request(app)
      .post(`/api/v1/production/batches/${batch1Id}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    // Consume 12 kg @ ₹50 = ₹600
    const consRes = await request(app)
      .post(`/api/v1/production/batches/${batch1Id}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            batchId: rmBatchId,
            uomId: kgUomId,
            quantity: '12',
          },
        ],
      });
    expect(consRes.status).toBe(200);

    // Return 2 kg @ ₹50 = ₹100 -> Net Material Cost = ₹500
    const retRes = await request(app)
      .post(`/api/v1/production/batches/${batch1Id}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            batchId: rmBatchId,
            uomId: kgUomId,
            quantity: '2',
            reason: 'Unused flour returned',
          },
        ],
      });
    expect(retRes.status).toBe(200);

    // Record output 10 good pcs, 0 rejected, 0 wastage, then complete batch
    const outRes = await request(app)
      .post(`/api/v1/production/batches/${batch1Id}/output`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        goodQuantity: '10',
        rejectedQuantity: '0',
        wastageQuantity: '0',
      });
    expect(outRes.status).toBe(200);

    const compRes = await request(app)
      .post(`/api/v1/production/batches/${batch1Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(compRes.status).toBe(200);

    // Record labour entry as PRODUCTION (creates PENDING entry)
    const labEntryRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/entries`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        entryType: 'DIRECT_LABOUR',
        description: 'Mixing & Frying Shift',
        quantityOrHours: '4',
        rate: '30',
      });
    expect(labEntryRes.status).toBe(201);
    expect(labEntryRes.body.data.approvalStatus).toBe('PENDING');
    expect(labEntryRes.body.data.totalAmount).toBe('120');

    // Approve labour entry as ADMIN
    const approveEntryRes = await request(app)
      .post(`/api/v1/production/costing/entries/${labEntryRes.body.data.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ decision: 'APPROVED' });
    expect(approveEntryRes.status).toBe(200);
    expect(approveEntryRes.body.data.approvalStatus).toBe('APPROVED');

    // Add machine cost as ADMIN (auto-approved)
    const machEntryRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        entryType: 'MACHINE_COST',
        description: 'Fryer Runtime',
        quantityOrHours: '2',
        rate: '40',
      });
    expect(machEntryRes.status).toBe(201);
    expect(machEntryRes.body.data.approvalStatus).toBe('APPROVED');

    // Add manual overhead: 10% of net material cost (10% of 500 = 50)
    const ohRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/overheads`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        costType: 'DIRECT_OVERHEAD',
        description: 'Packaging Overhead 10%',
        allocationMethod: 'PERCENT_OF_MATERIAL',
        rateOrAmount: '10',
      });
    expect(ohRes.status).toBe(201);
    expect(Number(ohRes.body.data.allocatedAmount)).toBe(50);

    // Calculate costing (imports BOM overheads: 100 + 50 = 150, plus manual 50 = 200)
    const calcRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/calculate`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: true });
    expect(calcRes.status).toBe(200);

    const c = calcRes.body.data;
    expect(Number(c.grossMaterialCost)).toBe(600);
    expect(Number(c.materialReturnCost)).toBe(100);
    expect(Number(c.netMaterialCost)).toBe(500);
    expect(Number(c.actualLabourCost)).toBe(120);
    expect(Number(c.actualMachineCost)).toBe(80);
    expect(Number(c.actualOverheadCost)).toBe(200);
    // Total actual = 500 + 120 + 80 + 200 = 900
    expect(Number(c.totalActualCost)).toBe(900);
    // Cost per unit = 900 / 10 = 90
    expect(Number(c.costPerAcceptedUnit)).toBe(90);
    // Standard: Mat 500 + Lab 100 + OH 50 = 650; Total Var = 900 - 650 = 250
    expect(Number(c.standardTotalCost)).toBe(650);
    expect(Number(c.totalVarianceAmount)).toBe(250);

    // Recalculate again -> BOM overheads must NOT be double-counted
    const recalcRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/calculate`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: true });
    expect(recalcRes.status).toBe(200);
    expect(Number(recalcRes.body.data.actualOverheadCost)).toBe(200);

    // Review & Finalize as ADMIN
    const revRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'Verified' });
    expect(revRes.status).toBe(200);
    expect(revRes.body.data.status).toBe('REVIEWED');

    const finRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `FIN-${suffix}` });
    expect(finRes.status).toBe(200);
    expect(finRes.body.data.status).toBe('FINALIZED');
    expect(finRes.body.data.fgValuationApplied).toBe(true);
    expect(Number(finRes.body.data.fgValuationUnitCost)).toBe(90);

    // Idempotent finalize retry returns same finalized record
    const finRetryRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `FIN-${suffix}` });
    expect(finRetryRes.status).toBe(200);

    // Verify FG InventoryItem MWAC updated to 90.0000
    const updatedFg = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fgInvId } });
    expect(Number(updatedFg.movingAverageCost)).toBe(90);

    // Immutability: cannot add entry or recalculate after FINALIZED
    const mutRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        entryType: 'DIRECT_LABOUR',
        description: 'Late entry',
        quantityOrHours: '1',
        rate: '10',
      });
    expect(mutRes.status).toBe(400);

    // Post-finalization note works without mutating costs
    const noteRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch1Id}/post-finalization-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ note: 'Late electricity adjustment noted for next period' });
    expect(noteRes.status).toBe(200);

    // Ledger reconciliation check
    const detailRes = await request(app)
      .get(`/api/v1/production/costing/batches/${batch1Id}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.materialBreakdown.isLedgerReconciled).toBe(true);
  });

  it('2. handles zero accepted output & wastage separation safely and enforces RBAC', async () => {
    const createRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId: woId, warehouseId: whFGId, plannedQuantity: '10' });
    expect(createRes.status).toBe(201);
    batch2Id = createRes.body.data.id;
    createdBatchIds.push(batch2Id);

    await request(app)
      .post(`/api/v1/production/batches/${batch2Id}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    await request(app)
      .post(`/api/v1/production/batches/${batch2Id}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [
          {
            inventoryItemId: flourInvId,
            warehouseId: whRMId,
            batchId: rmBatchId,
            uomId: kgUomId,
            quantity: '5',
          },
        ],
      });

    await request(app)
      .post(`/api/v1/production/batches/${batch2Id}/output`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        goodQuantity: '5',
        rejectedQuantity: '0',
        wastageQuantity: '0',
      });

    await request(app)
      .post(`/api/v1/production/batches/${batch2Id}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    const qi = await prisma.qualityInspection.findUniqueOrThrow({
      where: { productionBatchId: batch2Id },
    });
    const qiRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qi.id}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        decision: 'REJECTED',
        defectCategory: 'BURNT',
        notes: 'Entire batch rejected by QC',
      });
    expect(qiRes.status).toBe(200);

    const calcRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batch2Id}/calculate`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: false });
    expect(calcRes.status).toBe(200);
    expect(Number(calcRes.body.data.costPerAcceptedUnit)).toBe(0);
    expect(Number(calcRes.body.data.wastageAndRejectionCost)).toBe(250);

    // RBAC checks:
    // SALESMAN cannot read or write costing
    const salesRead = await request(app)
      .get('/api/v1/production/costing/dashboard')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesRead.status).toBe(403);

    // AUDITOR can read dashboard/variance report, cannot write
    const audDash = await request(app)
      .get('/api/v1/production/costing/variance-report')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audDash.status).toBe(200);

    const audWrite = await request(app)
      .post(`/api/v1/production/costing/batches/${batch2Id}/calculate`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({});
    expect(audWrite.status).toBe(403);

    // PRODUCTION cannot review or finalize costing
    const prodRev = await request(app)
      .post(`/api/v1/production/costing/batches/${batch2Id}/review`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(prodRev.status).toBe(403);

    const prodFin = await request(app)
      .post(`/api/v1/production/costing/batches/${batch2Id}/finalize`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(prodFin.status).toBe(403);
  });
});
