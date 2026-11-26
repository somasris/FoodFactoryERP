import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 8: Smart Batch Label Designer Backend Suite', () => {
  let prodToken: string;
  let auditorToken: string;
  let otherFactoryToken: string;
  let prodUserId: string;
  let whFgId: string;
  let otherWhId: string;
  let productId: string;
  let variantId: string;
  let invItemId: string;
  let bomId: string;
  let bomVersionId: string;
  let planId: string;
  let workOrderId: string;
  let missingDatesBatchId: string;
  let pendingQcBatchId: string;
  let acceptedBatchId: string;
  let fgInvBatchId: string;
  let templateId: string;
  let generatedLabelId: string;
  let qrToken: string;

  const suf = Date.now().toString().slice(-6);
  const prodUsername = `p8_prod_${suf}`;
  const auditorUsername = `p8_aud_${suf}`;
  const otherUsername = `p8_oth_${suf}`;

  beforeAll(async () => {
    const pw = await hashPassword('Phase8Pass2026!');

    const prodRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PRODUCTION' },
      include: { permissions: { include: { permission: true } } },
    });
    const auditorRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'AUDITOR' },
      include: { permissions: { include: { permission: true } } },
    });

    const whFg = await prisma.warehouse.findUniqueOrThrow({
      where: { code: 'WH-FG-01' },
      include: { factory: true },
    });
    whFgId = whFg.id;

    const otherWh = await prisma.warehouse.create({
      data: {
        factoryId: whFg.factoryId,
        code: `WH-P8-OTH-${Date.now().toString().slice(-4)}`,
        name: 'Other Isolated Warehouse',
        warehouseType: 'FINISHED_GOODS',
      },
    });
    otherWhId = otherWh.id;

    const uomKg = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } });
    const tax = await prisma.taxRate.findFirstOrThrow();
    const prodCat = await prisma.productCategory.findFirstOrThrow();

    const prodUser = await prisma.user.create({
      data: {
        email: `${prodUsername}@foodfactory.com`,
        username: prodUsername,
        fullName: 'Phase 8 Production User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: prodRole.id } },
        warehouseAccess: {
          create: { warehouseId: whFgId, accessLevel: 'READ_WRITE' },
        },
      },
    });
    prodUserId = prodUser.id;
    prodToken = generateAccessToken({
      userId: prodUser.id,
      email: prodUser.email,
      roles: ['PRODUCTION'],
      permissions: prodRole.permissions.map((p) => p.permission.code),
    });

    const auditorUser = await prisma.user.create({
      data: {
        email: `${auditorUsername}@foodfactory.com`,
        username: auditorUsername,
        fullName: 'Phase 8 Auditor',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: auditorRole.id } },
      },
    });
    auditorToken = generateAccessToken({
      userId: auditorUser.id,
      email: auditorUser.email,
      roles: ['AUDITOR'],
      permissions: auditorRole.permissions.map((p) => p.permission.code),
    });

    const otherUser = await prisma.user.create({
      data: {
        email: `${otherUsername}@foodfactory.com`,
        username: otherUsername,
        fullName: 'Phase 8 Other Warehouse User',
        passwordHash: pw,
        isActive: true,
        userRoles: { create: { roleId: prodRole.id } },
        warehouseAccess: {
          create: { warehouseId: otherWhId, accessLevel: 'READ_WRITE' },
        },
      },
    });
    otherFactoryToken = generateAccessToken({
      userId: otherUser.id,
      email: otherUser.email,
      roles: ['PRODUCTION'],
      permissions: prodRole.permissions.map((p) => p.permission.code),
    });

    const suf = Date.now().toString().slice(-5);
    const product = await prisma.product.create({
      data: {
        categoryId: prodCat.id,
        code: `P8-PROD-${suf}`,
        name: 'Roasted Cashew Cookies',
        baseUomId: uomKg.id,
        hsnCode: '19053100',
        taxRateId: tax.id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `P8-SKU-${suf}`,
        name: '250g Box',
        netWeightGrams: 250,
        uomId: uomKg.id,
        defaultSellingPrice: 180,
        shelfLifeDays: 180,
        barcode: `89012345${suf}`,
      },
    });
    variantId = variant.id;

    const invItem = await prisma.inventoryItem.create({
      data: {
        itemType: 'FINISHED_GOODS',
        productVariantId: variant.id,
        code: variant.sku,
        name: `${product.name} - ${variant.name}`,
        uomId: uomKg.id,
      },
    });
    invItemId = invItem.id;

    const bom = await prisma.bOM.create({
      data: {
        productVariantId: variant.id,
        code: `BOM-P8-${suf}`,
        name: 'Cashew Cookies Recipe',
        baseOutputQuantity: 100,
        outputUomId: uomKg.id,
      },
    });
    bomId = bom.id;

    const bv = await prisma.bOMVersion.create({
      data: {
        bom: { connect: { id: bom.id } },
        outputUom: { connect: { id: uomKg.id } },
        versionNumber: 1,
        status: 'ACTIVE',
        yieldPercentage: 98,
        expectedGoodOutput: 98,
        effectiveFrom: new Date(),
      },
    });
    bomVersionId = bv.id;

    const plan = await prisma.productionPlan.create({
      data: {
        planNumber: `PP-P8-${suf}`,
        planDate: new Date(),
        targetStartDate: new Date(),
        targetEndDate: new Date(),
        warehouseId: whFgId,
        status: 'APPROVED',
        createdById: prodUserId,
        items: {
          create: {
            lineNumber: 1,
            productVariant: { connect: { id: variant.id } },
            inventoryItem: { connect: { id: invItem.id } },
            bom: { connect: { id: bom.id } },
            bomVersion: { connect: { id: bv.id } },
            uom: { connect: { id: uomKg.id } },
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
        workOrderNumber: `WO-P8-${suf}`,
        financialYear: '2026-27',
        productionPlanId: plan.id,
        productionPlanItemId: plan.items[0].id,
        productVariantId: variant.id,
        inventoryItemId: invItem.id,
        bomId: bom.id,
        bomVersionId: bv.id,
        warehouseId: whFgId,
        uomId: uomKg.id,
        plannedQuantity: 100,
        plannedStartDate: new Date(),
        plannedEndDate: new Date(),
        status: 'IN_PROGRESS',
        createdById: prodUserId,
      },
    });
    workOrderId = wo.id;

    const missingDatesBatch = await prisma.productionBatch.create({
      data: {
        batchNumber: `PB-P8-NODATE-${suf}`,
        financialYear: '2026-27',
        workOrderId: wo.id,
        productId: product.id,
        productVariantId: variant.id,
        inventoryItemId: invItem.id,
        bomId: bom.id,
        bomVersionId: bv.id,
        warehouseId: whFgId,
        uomId: uomKg.id,
        plannedQuantity: 50,
        actualGoodQuantity: 50,
        status: 'COMPLETED',
        operatorId: prodUserId,
      },
    });
    missingDatesBatchId = missingDatesBatch.id;

    const mfg = new Date('2026-11-20T00:00:00.000Z');
    const exp = new Date('2027-05-19T00:00:00.000Z');

    const pendingQcBatch = await prisma.productionBatch.create({
      data: {
        batchNumber: `PB-P8-PEND-${suf}`,
        financialYear: '2026-27',
        workOrderId: wo.id,
        productId: product.id,
        productVariantId: variant.id,
        inventoryItemId: invItem.id,
        bomId: bom.id,
        bomVersionId: bv.id,
        warehouseId: whFgId,
        uomId: uomKg.id,
        plannedQuantity: 50,
        actualGoodQuantity: 48,
        manufacturingDate: mfg,
        expiryDate: exp,
        status: 'COMPLETED',
        operatorId: prodUserId,
        allergenSnapshot: {
          bomId: bom.id,
          bomVersionId: bv.id,
          bomVersionNumber: 1,
          derivedAt: mfg.toISOString(),
          isHistoricalSnapshot: true,
          overallStatus: 'CONTAINS_ALLERGENS',
          hasUnknownIngredients: false,
          confirmedAllergens: ['TREE_NUTS', 'WHEAT'],
          crossContactAllergens: ['MILK'],
          unknownIngredients: [],
          ingredientBreakdown: [],
        },
      },
    });
    pendingQcBatchId = pendingQcBatch.id;

    const fgInvBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: invItem.id,
        batchNumber: `FG-P8-${suf}`,
        manufacturingDate: mfg,
        expiryDate: exp,
        unitCost: 100,
      },
    });
    fgInvBatchId = fgInvBatch.id;

    const acceptedBatch = await prisma.productionBatch.create({
      data: {
        batchNumber: `PB-P8-ACC-${suf}`,
        financialYear: '2026-27',
        workOrderId: wo.id,
        productId: product.id,
        productVariantId: variant.id,
        inventoryItemId: invItem.id,
        bomId: bom.id,
        bomVersionId: bv.id,
        warehouseId: whFgId,
        uomId: uomKg.id,
        plannedQuantity: 100,
        actualGoodQuantity: 96,
        manufacturingDate: mfg,
        expiryDate: exp,
        finishedGoodsBatchId: fgInvBatch.id,
        status: 'COMPLETED',
        operatorId: prodUserId,
        allergenSnapshot: {
          bomId: bom.id,
          bomVersionId: bv.id,
          bomVersionNumber: 1,
          derivedAt: mfg.toISOString(),
          isHistoricalSnapshot: true,
          overallStatus: 'CONTAINS_ALLERGENS',
          hasUnknownIngredients: false,
          confirmedAllergens: ['TREE_NUTS', 'WHEAT'],
          crossContactAllergens: ['MILK'],
          unknownIngredients: [],
          ingredientBreakdown: [],
        },
      },
    });
    acceptedBatchId = acceptedBatch.id;

    await prisma.qualityInspection.create({
      data: {
        inspectionNumber: `QC-P8-${suf}`,
        productionBatchId: acceptedBatch.id,
        inventoryBatchId: fgInvBatch.id,
        warehouseId: whFgId,
        inspectedQuantity: 96,
        goodQuantity: 95,
        rejectedQuantity: 1,
        decision: 'ACCEPTED',
        inspectorId: prodUserId,
        inspectedAt: new Date(),
        releasedById: prodUserId,
        releasedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.batchLabelRecord.deleteMany({
      where: { productionBatchId: { in: [missingDatesBatchId, pendingQcBatchId, acceptedBatchId].filter(Boolean) } },
    });
    await prisma.batchQrReference.deleteMany({
      where: { productionBatchId: { in: [missingDatesBatchId, pendingQcBatchId, acceptedBatchId].filter(Boolean) } },
    });
    await prisma.qualityInspection.deleteMany({ where: { productionBatchId: acceptedBatchId } });
    await prisma.productionBatch.deleteMany({
      where: { id: { in: [missingDatesBatchId, pendingQcBatchId, acceptedBatchId].filter(Boolean) } },
    });
    if (fgInvBatchId) await prisma.inventoryBatch.deleteMany({ where: { id: fgInvBatchId } });
    if (workOrderId) await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
    if (planId) await prisma.productionPlan.deleteMany({ where: { id: planId } });
    if (bomVersionId) await prisma.bOMVersion.deleteMany({ where: { id: bomVersionId } });
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    if (invItemId) await prisma.inventoryItem.deleteMany({ where: { id: invItemId } });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.batchLabelTemplate.deleteMany({ where: { code: { startsWith: 'P8-TPL-' } } });
    if (otherWhId) await prisma.warehouse.deleteMany({ where: { id: otherWhId } });
    await prisma.user.deleteMany({
      where: { username: { in: [prodUsername, auditorUsername, otherUsername] } },
    });
  });

  it('1. Lists default templates, creates custom template, increments version on edit, and enforces RBAC', async () => {
    const listRes = await request(app)
      .get('/api/v1/labels/templates')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(3);

    const audRes = await request(app)
      .post('/api/v1/labels/templates')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        code: `P8-TPL-AUD-${Date.now()}`,
        name: 'Auditor Blocked',
        widthMm: 100,
        heightMm: 70,
      });
    expect(audRes.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/labels/templates')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        code: `P8-TPL-${Date.now().toString().slice(-4)}`,
        name: 'Export Carton Label',
        sizePreset: 'LARGE_CARTON',
        widthMm: 148,
        heightMm: 105,
        includeQr: true,
        includeBarcode: true,
      });
    expect(createRes.status).toBe(201);
    templateId = createRes.body.data.id;
    expect(createRes.body.data.versionNumber).toBe(1);

    const updateRes = await request(app)
      .patch(`/api/v1/labels/templates/${templateId}`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ name: 'Export Carton Label v2' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.versionNumber).toBe(2);
    expect(updateRes.body.data.versions.length).toBe(2);
  });

  it('2. Blocks label generation when manufacturing/expiry dates are missing or QC is not ACCEPTED for RELEASED mode', async () => {
    const missingDatesRes = await request(app)
      .post('/api/v1/labels/generate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        productionBatchId: missingDatesBatchId,
        templateId,
        copies: 2,
        labelMode: 'RELEASED',
      });
    expect(missingDatesRes.status).toBe(400);
    expect(missingDatesRes.body.message).toMatch(/manufacturing date/i);

    const pendingQcRes = await request(app)
      .post('/api/v1/labels/generate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        productionBatchId: pendingQcBatchId,
        templateId,
        copies: 2,
        labelMode: 'RELEASED',
      });
    expect(pendingQcRes.status).toBe(409);
    expect(pendingQcRes.body.message).toMatch(/PENDING/);
  });

  it('3. Generates authoritative RELEASED label with allergen snapshot, QR token, idempotency, and zero mutation', async () => {
    const idemKey = `p8-idem-${Date.now()}`;
    const genRes = await request(app)
      .post('/api/v1/labels/generate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        productionBatchId: acceptedBatchId,
        templateId,
        copies: 3,
        labelMode: 'RELEASED',
        idempotencyKey: idemKey,
      });
    expect(genRes.status).toBe(201);
    generatedLabelId = genRes.body.data.id;
    qrToken = genRes.body.data.qrReferenceToken;
    expect(qrToken).toBeTruthy();

    const snap = genRes.body.data.labelSnapshot;
    expect(snap.netQuantity).toBe('95.00');
    expect(snap.allergenSummary.confirmedAllergens).toContain('TREE_NUTS');
    expect(snap.allergenSummary.declarationText).not.toMatch(/allergen-free/i);

    // Idempotent retry returns same record
    const retryRes = await request(app)
      .post('/api/v1/labels/generate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        productionBatchId: acceptedBatchId,
        templateId,
        copies: 3,
        labelMode: 'RELEASED',
        idempotencyKey: idemKey,
      });
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.id).toBe(generatedLabelId);

    // QR lookup requires auth and resolves safely
    const unauthQr = await request(app).get(`/api/v1/production/traceability/qr/${qrToken}`);
    expect(unauthQr.status).toBe(401);

    const authQr = await request(app)
      .get(`/api/v1/production/traceability/qr/${qrToken}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(authQr.status).toBe(200);
    expect(authQr.body.data.batchIdentity.id).toBe(acceptedBatchId);
  });

  it('4. Enforces cross-warehouse access, copy validation, PDF rendering, and immutable reprint history', async () => {
    // Cross-warehouse user blocked
    const crossRes = await request(app)
      .get(`/api/v1/labels/${generatedLabelId}/pdf`)
      .set('Authorization', `Bearer ${otherFactoryToken}`);
    expect(crossRes.status).toBe(403);

    // Copy validation (>200 rejected)
    const badCopies = await request(app)
      .post(`/api/v1/labels/${generatedLabelId}/reprint`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ copies: 250 });
    expect(badCopies.status).toBe(400);

    // Valid PDF download
    const pdfRes = await request(app)
      .get(`/api/v1/labels/${generatedLabelId}/pdf`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdfRes.body).toString('utf8', 0, 5)).toBe('%PDF-');

    // Reprint creates REPRINT history record without altering batch quantities
    const reprintRes = await request(app)
      .post(`/api/v1/labels/${generatedLabelId}/reprint`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ copies: 2 });
    expect(reprintRes.status).toBe(201);
    expect(reprintRes.body.data.generationType).toBe('REPRINT');
    expect(reprintRes.body.data.parentLabelId).toBe(generatedLabelId);

    const histRes = await request(app)
      .get(`/api/v1/labels/history?productionBatchId=${acceptedBatchId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.length).toBeGreaterThanOrEqual(2);

    const batchAfter = await prisma.productionBatch.findUniqueOrThrow({
      where: { id: acceptedBatchId },
    });
    expect(Number(batchAfter.actualGoodQuantity)).toBe(96);
  });
});
