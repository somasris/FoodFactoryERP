import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';
import { classifyExpiryRiskWindow } from '../src/modules/manufacturing-intelligence/shelf-life-radar.service';
import { AllergenService } from '../src/modules/manufacturing-intelligence/allergen.service';

const app = createApp();

describe('Phase 6: Manufacturing Intelligence Backend Suite', () => {
  let prodToken: string;
  let salesmanToken: string;
  let whRmId: string;
  let whFgId: string;
  let uomKgId: string;
  let taxId: string;
  let rmCatId: string;
  let prodCatId: string;
  let rmKnownId: string;
  let rmUnknownId: string;
  let bomId: string;
  let bomVersionId: string;
  let productId: string;
  let variantId: string;
  let planId: string;
  let woId: string;
  let batch1Id: string;
  let batch2Id: string;

  beforeAll(async () => {
    const pw = await hashPassword('Phase6MiPass2026!');
    await prisma.user.deleteMany({
      where: { username: { in: ['p6_prod', 'p6_salesman'] } },
    });

    const prodRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PRODUCTION' },
      include: { permissions: { include: { permission: true } } },
    });
    const salesmanRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'SALESMAN' },
      include: { permissions: { include: { permission: true } } },
    });

    const whRm = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } });
    const whFg = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whRmId = whRm.id;
    whFgId = whFg.id;

    const uomKg = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } });
    uomKgId = uomKg.id;
    const tax = await prisma.taxRate.findFirstOrThrow();
    taxId = tax.id;

    const rmCat = await prisma.rawMaterialCategory.upsert({
      where: { code: 'P6-RMCAT' },
      update: {},
      create: { code: 'P6-RMCAT', name: 'Phase 6 RM Category' },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.upsert({
      where: { code: 'P6-PCAT' },
      update: {},
      create: { code: 'P6-PCAT', name: 'Phase 6 Prod Category' },
    });
    prodCatId = prodCat.id;

    const prodUser = await prisma.user.create({
      data: {
        email: 'p6_prod@foodfactory.local',
        username: 'p6_prod',
        passwordHash: pw,
        fullName: 'Phase 6 Production',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: prodRole.id } },
        warehouseAccess: {
          create: [
            { warehouseId: whRmId, accessLevel: 'READ_WRITE' },
            { warehouseId: whFgId, accessLevel: 'READ_WRITE' },
          ],
        },
      },
    });
    prodToken = generateAccessToken({
      userId: prodUser.id,
      username: prodUser.username,
      email: prodUser.email,
      roles: ['PRODUCTION'],
      permissions: prodRole.permissions.map(p => p.permission.code),
    });

    const salesUser = await prisma.user.create({
      data: {
        email: 'p6_salesman@foodfactory.local',
        username: 'p6_salesman',
        passwordHash: pw,
        fullName: 'Phase 6 Salesman',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: salesmanRole.id } },
      },
    });
    salesmanToken = generateAccessToken({
      userId: salesUser.id,
      username: salesUser.username,
      email: salesUser.email,
      roles: ['SALESMAN'],
      permissions: salesmanRole.permissions.map(p => p.permission.code),
    });

    const suffix = Date.now();
    // Create KNOWN allergen raw material (MILK, cross-contact PEANUTS) & UNKNOWN raw material
    const rmKnown = await prisma.rawMaterial.create({
      data: {
        categoryId: rmCatId,
        code: `P6-MILK-${suffix}`,
        name: 'Skim Milk Powder P6',
        materialType: 'RAW_INGREDIENT',
        uomId: uomKgId,
        hsnCode: '0402',
        taxRateId: taxId,
        allergenStatus: 'KNOWN',
        allergens: ['MILK'],
        crossContactAllergens: ['PEANUTS'],
        inventoryItem: {
          create: {
            itemType: 'RAW_MATERIAL',
            code: `P6-MILK-${suffix}`,
            name: 'Skim Milk Powder P6',
            uomId: uomKgId,
          },
        },
      },
      include: { inventoryItem: true },
    });
    rmKnownId = rmKnown.id;

    const rmUnknown = await prisma.rawMaterial.create({
      data: {
        categoryId: rmCatId,
        code: `P6-SPICE-${suffix}`,
        name: 'Mystery Spice Blend P6',
        materialType: 'RAW_INGREDIENT',
        uomId: uomKgId,
        hsnCode: '0910',
        taxRateId: taxId,
        allergenStatus: 'UNKNOWN',
        inventoryItem: {
          create: {
            itemType: 'RAW_MATERIAL',
            code: `P6-SPICE-${suffix}`,
            name: 'Mystery Spice Blend P6',
            uomId: uomKgId,
          },
        },
      },
      include: { inventoryItem: true },
    });
    rmUnknownId = rmUnknown.id;

    const product = await prisma.product.create({
      data: {
        category: { connect: { id: prodCatId } },
        code: `P6-PROD-${suffix}`,
        name: 'Phase 6 Biscuits',
        hsnCode: '1905',
        taxRate: { connect: { id: taxId } },
        baseUom: { connect: { id: uomKgId } },
        variants: {
          create: {
            sku: `P6-SKU-${suffix}`,
            name: 'Phase 6 Biscuits 100g',
            netWeightGrams: 100,
            defaultSellingPrice: 50,
            uom: { connect: { id: uomKgId } },
            inventoryItem: {
              create: {
                itemType: 'FINISHED_GOODS',
                code: `P6-SKU-${suffix}`,
                name: 'Phase 6 Biscuits 100g',
                uomId: uomKgId,
              },
            },
          },
        },
      },
      include: { variants: { include: { inventoryItem: true } } },
    });
    productId = product.id;
    variantId = product.variants[0].id;
    const fgInvId = product.variants[0].inventoryItem!.id;

    const bom = await prisma.bOM.create({
      data: {
        productVariantId: variantId,
        code: `P6-BOM-${suffix}`,
        name: 'P6 Biscuit Recipe',
        baseOutputQuantity: 100,
        outputUomId: uomKgId,
        versions: {
          create: {
            versionNumber: 1,
            status: 'ACTIVE',
            expectedGoodOutput: 100,
            outputUomId: uomKgId,
            items: {
              create: [
                {
                  inventoryItemId: rmKnown.inventoryItem!.id,
                  itemType: 'RAW_MATERIAL',
                  standardQuantity: 10,
                  uomId: uomKgId,
                },
                {
                  inventoryItemId: rmUnknown.inventoryItem!.id,
                  itemType: 'RAW_MATERIAL',
                  standardQuantity: 2,
                  uomId: uomKgId,
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
        planNumber: `PP-P6-${suffix}`,
        planDate: new Date(),
        warehouseId: whFgId,
        status: 'RELEASED',
        createdById: prodUser.id,
        items: {
          create: {
            lineNumber: 1,
            productVariantId: variantId,
            inventoryItemId: fgInvId,
            bomId,
            bomVersionId,
            uomId: uomKgId,
            demandQuantity: 100,
            netRequirementQuantity: 100,
            plannedQuantity: 100,
          },
        },
      },
      include: { items: true },
    });
    planId = plan.id;

    const wo = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-P6-${suffix}`,
        financialYear: '2026-27',
        productionPlanId: planId,
        productionPlanItemId: plan.items[0].id,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFgId,
        uomId: uomKgId,
        plannedQuantity: 100,
        allocatedBatchQuantity: 100,
        status: 'IN_PROGRESS',
        createdById: prodUser.id,
      },
    });
    woId = wo.id;

    const snapshot = await AllergenService.deriveBomVersionAllergenProfile(bomVersionId);

    const b1 = await prisma.productionBatch.create({
      data: {
        batchNumber: `PB-P6-1-${suffix}`,
        financialYear: '2026-27',
        workOrderId: woId,
        productId,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFgId,
        uomId: uomKgId,
        plannedQuantity: 60,
        actualGoodQuantity: 58,
        rejectedQuantity: 2,
        wastageQuantity: 1,
        actualYieldPercent: 96.67,
        status: 'COMPLETED',
        operatorId: prodUser.id,
        startedAt: new Date(Date.now() - 2 * 3600_000),
        completedAt: new Date(),
        allergenSnapshot: snapshot as unknown as object,
      },
    });
    batch1Id = b1.id;

    const b2 = await prisma.productionBatch.create({
      data: {
        batchNumber: `PB-P6-2-${suffix}`,
        financialYear: '2026-27',
        workOrderId: woId,
        productId,
        productVariantId: variantId,
        inventoryItemId: fgInvId,
        bomId,
        bomVersionId,
        warehouseId: whFgId,
        uomId: uomKgId,
        plannedQuantity: 40,
        status: 'CREATED',
        operatorId: prodUser.id,
        allergenSnapshot: snapshot as unknown as object,
      },
    });
    batch2Id = b2.id;
  });

  afterAll(async () => {
    const batchIds = [batch1Id, batch2Id].filter(Boolean);
    if (batchIds.length > 0) {
      await prisma.productionBatch.deleteMany({ where: { id: { in: batchIds } } });
    }
    if (woId) await prisma.workOrder.deleteMany({ where: { id: woId } });
    if (planId) await prisma.productionPlan.deleteMany({ where: { id: planId } });
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    if (variantId) {
      await prisma.inventoryItem.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.deleteMany({ where: { id: variantId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    const rmIds = [rmKnownId, rmUnknownId].filter(Boolean);
    if (rmIds.length > 0) {
      await prisma.inventoryItem.deleteMany({ where: { rawMaterialId: { in: rmIds } } });
      await prisma.rawMaterial.deleteMany({ where: { id: { in: rmIds } } });
    }
    await prisma.user.deleteMany({ where: { username: { in: ['p6_prod', 'p6_salesman'] } } });
    await prisma.$disconnect();
  });

  it('1. Enforces authentication (401) and RBAC (403) on Manufacturing Intelligence routes', async () => {
    const unauth = await request(app).get('/api/v1/manufacturing-intelligence/shelf-life-radar');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/manufacturing-intelligence/efficiency-scorecard')
      .set('Authorization', `Bearer ${salesmanToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('2. Derives BOM allergens with unknown-ingredient handling and preserves historical batch snapshot', async () => {
    const bomRes = await request(app)
      .get(`/api/v1/manufacturing-intelligence/allergens/bom-version/${bomVersionId}`)
      .set('Authorization', `Bearer ${prodToken}`);

    expect(bomRes.status).toBe(200);
    expect(bomRes.body.data.confirmedAllergens).toEqual(['MILK']);
    expect(bomRes.body.data.crossContactAllergens).toEqual(['PEANUTS']);
    expect(bomRes.body.data.hasUnknownIngredients).toBe(true);
    expect(bomRes.body.data.unknownIngredients.length).toBe(1);

    // Mutate master data: remove MILK from rmKnown -> historical batch1 snapshot must remain unchanged!
    await prisma.rawMaterial.update({
      where: { id: rmKnownId },
      data: { allergenStatus: 'NOT_APPLICABLE', allergens: [], crossContactAllergens: [] },
    });

    const batchSnapRes = await request(app)
      .get(`/api/v1/manufacturing-intelligence/allergens/batches/${batch1Id}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(batchSnapRes.status).toBe(200);
    expect(batchSnapRes.body.data.isHistoricalSnapshot).toBe(true);
    expect(batchSnapRes.body.data.confirmedAllergens).toEqual(['MILK']);
  });

  it('3. Batch Journey Timeline shows occurred vs pending stages, split-batch siblings, and hides sales dispatch without sales.orders.read', async () => {
    const prodUser = await prisma.user.findUniqueOrThrow({ where: { username: 'p6_prod' } });
    const limitedProdToken = generateAccessToken({
      userId: prodUser.id,
      username: prodUser.username,
      email: prodUser.email,
      roles: ['PRODUCTION'],
      permissions: ['production.batches.read'],
    });
    // Temporarily verify RBAC via BatchJourneyService directly without sales.orders.read
    const { BatchJourneyService } = await import('../src/modules/manufacturing-intelligence/batch-journey.service');
    const limitedJourney = await BatchJourneyService.getBatchJourney(batch1Id, {
      userId: prodUser.id,
      username: prodUser.username,
      roles: ['PRODUCTION'],
      permissions: ['production.batches.read'],
    });
    expect(limitedJourney.stages.find(s => s.key === 'sales_dispatch')).toBeUndefined();
    expect(limitedProdToken).toBeTruthy();

    const res = await request(app)
      .get(`/api/v1/manufacturing-intelligence/batches/${batch1Id}/journey`)
      .set('Authorization', `Bearer ${prodToken}`);

    expect(res.status).toBe(200);
    const { stages, genealogy } = res.body.data;
    expect(stages.find((s: { key: string }) => s.key === 'bom_recipe').status).toBe('OCCURRED');
    expect(stages.find((s: { key: string }) => s.key === 'quality_inspection').status).toBe('PENDING');
    expect(genealogy.splitSiblingBatches.some((b: { id: string }) => b.id === batch2Id)).toBe(true);
  });

  it('4. Shelf-Life Risk Radar classifies UTC expiry boundaries accurately', async () => {
    const ref = new Date('2026-11-26T15:00:00.000Z');
    expect(classifyExpiryRiskWindow(new Date('2026-11-25T00:00:00.000Z'), ref).riskWindow).toBe('EXPIRED');
    expect(classifyExpiryRiskWindow(new Date('2026-11-26T00:00:00.000Z'), ref).riskWindow).toBe('EXPIRING_7D');
    expect(classifyExpiryRiskWindow(new Date('2026-12-03T00:00:00.000Z'), ref).riskWindow).toBe('EXPIRING_7D');
    expect(classifyExpiryRiskWindow(new Date('2026-12-11T00:00:00.000Z'), ref).riskWindow).toBe('EXPIRING_15D');
    expect(classifyExpiryRiskWindow(new Date('2026-12-26T00:00:00.000Z'), ref).riskWindow).toBe('EXPIRING_30D');
    expect(classifyExpiryRiskWindow(new Date('2027-01-15T00:00:00.000Z'), ref).riskWindow).toBe('LONGER_SHELF_LIFE');
    expect(classifyExpiryRiskWindow(null, ref).riskWindow).toBe('NO_EXPIRY');

    const radarRes = await request(app)
      .get('/api/v1/manufacturing-intelligence/shelf-life-radar')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(radarRes.status).toBe(200);
    expect(Array.isArray(radarRes.body.data.summary)).toBe(true);
  });

  it('5. Production Efficiency Scorecard computes decimal-safe metrics grouped by UOM and separates batch statuses', async () => {
    const res = await request(app)
      .get(`/api/v1/manufacturing-intelligence/efficiency-scorecard?period=month&productId=${productId}`)
      .set('Authorization', `Bearer ${prodToken}`);

    expect(res.status).toBe(200);
    const { recordCounts, quantityMetricsByUom, performance } = res.body.data;
    expect(recordCounts.COMPLETED).toBe(1);
    expect(recordCounts.CREATED).toBe(1);
    expect(quantityMetricsByUom[0].uomCode).toBe('KG');
    expect(quantityMetricsByUom[0].plannedQuantity).toBe('60.0000');
    expect(quantityMetricsByUom[0].actualGoodQuantity).toBe('58.0000');
    expect(quantityMetricsByUom[0].yieldPercentage).toBe('96.67');
    expect(performance.avgBatchCompletionHours).toBeTruthy();
  });
});
