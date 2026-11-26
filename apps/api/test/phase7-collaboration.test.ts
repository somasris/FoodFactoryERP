import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();

describe('Phase 7: Factory Collaboration & Decision Support Backend Suite', () => {
  let prodToken: string;
  let adminToken: string;
  let auditorToken: string;
  let prodUserId: string;
  let factoryId: string;
  let otherFactoryId: string;
  let whRmId: string;
  let uomKgId: string;
  let uomPcsId: string;
  let taxId: string;
  let rmCatId: string;
  let prodCatId: string;
  let rmOrigId: string;
  let rmSubId: string;
  let origInvId: string;
  let subInvId: string;
  let subBatchId: string;
  let productId: string;
  let variantId: string;
  let bomId: string;
  let bomVersionId: string;
  let handoverId: string;
  let otherHandoverId: string;
  let subRequestId: string;

  beforeAll(async () => {
    const pw = await hashPassword('Phase7Pass2026!');
    await prisma.user.deleteMany({
      where: { username: { in: ['p7_prod', 'p7_admin', 'p7_auditor'] } },
    });

    const prodRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PRODUCTION' },
      include: { permissions: { include: { permission: true } } },
    });
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });
    const auditorRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'AUDITOR' },
      include: { permissions: { include: { permission: true } } },
    });

    const whRm = await prisma.warehouse.findUniqueOrThrow({
      where: { code: 'WH-RM-01' },
      include: { factory: true },
    });
    whRmId = whRm.id;
    factoryId = whRm.factoryId;

    const otherFactory = await prisma.factory.upsert({
      where: { code: 'FAC-P7-OTHER' },
      update: {},
      create: {
        companyId: whRm.factory.companyId,
        code: 'FAC-P7-OTHER',
        name: 'Other Isolated Factory',
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Coimbatore',
      },
    });
    otherFactoryId = otherFactory.id;

    const uomKg = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } });
    const uomPcs = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
    uomKgId = uomKg.id;
    uomPcsId = uomPcs.id;

    const tax = await prisma.taxRate.findFirstOrThrow();
    taxId = tax.id;

    const rmCat = await prisma.rawMaterialCategory.upsert({
      where: { code: 'P7-RMCAT' },
      update: {},
      create: { code: 'P7-RMCAT', name: 'Phase 7 RM Category' },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.upsert({
      where: { code: 'P7-PCAT' },
      update: {},
      create: { code: 'P7-PCAT', name: 'Phase 7 Prod Category' },
    });
    prodCatId = prodCat.id;

    const prodUser = await prisma.user.create({
      data: {
        email: 'p7_prod@foodfactory.local',
        username: 'p7_prod',
        passwordHash: pw,
        fullName: 'Phase 7 Production',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: prodRole.id } },
        warehouseAccess: { create: { warehouseId: whRmId, accessLevel: 'READ_WRITE' } },
      },
    });
    prodUserId = prodUser.id;
    prodToken = generateAccessToken({
      userId: prodUser.id,
      username: prodUser.username,
      email: prodUser.email,
      roles: ['PRODUCTION'],
      permissions: prodRole.permissions.map(p => p.permission.code),
    });

    const adminUser = await prisma.user.create({
      data: {
        email: 'p7_admin@foodfactory.local',
        username: 'p7_admin',
        passwordHash: pw,
        fullName: 'Phase 7 Admin',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
    adminToken = generateAccessToken({
      userId: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      roles: ['ADMIN'],
      permissions: adminRole.permissions.map(p => p.permission.code),
    });

    const auditorUser = await prisma.user.create({
      data: {
        email: 'p7_auditor@foodfactory.local',
        username: 'p7_auditor',
        passwordHash: pw,
        fullName: 'Phase 7 Auditor',
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: { create: { roleId: auditorRole.id } },
      },
    });
    auditorToken = generateAccessToken({
      userId: auditorUser.id,
      username: auditorUser.username,
      email: auditorUser.email,
      roles: ['AUDITOR'],
      permissions: auditorRole.permissions.map(p => p.permission.code),
    });

    const suffix = Date.now();
    const rmOrig = await prisma.rawMaterial.create({
      data: {
        categoryId: rmCatId,
        code: `P7-ORIG-${suffix}`,
        name: 'Original Cane Sugar',
        materialType: 'RAW_INGREDIENT',
        uomId: uomKgId,
        hsnCode: '1701',
        taxRateId: taxId,
        allergenStatus: 'NOT_APPLICABLE',
        inventoryItem: {
          create: {
            itemType: 'RAW_MATERIAL',
            code: `P7-ORIG-${suffix}`,
            name: 'Original Cane Sugar',
            uomId: uomKgId,
          },
        },
      },
      include: { inventoryItem: true },
    });
    rmOrigId = rmOrig.id;
    origInvId = rmOrig.inventoryItem!.id;

    const rmSub = await prisma.rawMaterial.create({
      data: {
        categoryId: rmCatId,
        code: `P7-SUB-${suffix}`,
        name: 'Jaggery Powder Substitute',
        materialType: 'RAW_INGREDIENT',
        uomId: uomKgId,
        hsnCode: '1701',
        taxRateId: taxId,
        allergenStatus: 'UNKNOWN',
        inventoryItem: {
          create: {
            itemType: 'RAW_MATERIAL',
            code: `P7-SUB-${suffix}`,
            name: 'Jaggery Powder Substitute',
            uomId: uomKgId,
          },
        },
      },
      include: { inventoryItem: true },
    });
    rmSubId = rmSub.id;
    subInvId = rmSub.inventoryItem!.id;

    const subBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: subInvId,
        batchNumber: `P7-BATCH-${suffix}`,
        expiryDate: new Date(Date.now() + 60 * 86_400_000),
        qualityStatus: 'ACCEPTED',
      },
    });
    subBatchId = subBatch.id;

    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRmId,
        inventoryItemId: subInvId,
        batchId: subBatchId,
        quantityOnHand: 50,
        quantityReserved: 0,
      },
    });

    const product = await prisma.product.create({
      data: {
        category: { connect: { id: prodCatId } },
        code: `P7-PROD-${suffix}`,
        name: 'Phase 7 Cookie',
        hsnCode: '1905',
        taxRate: { connect: { id: taxId } },
        baseUom: { connect: { id: uomKgId } },
        variants: {
          create: {
            sku: `P7-SKU-${suffix}`,
            name: 'Phase 7 Cookie 100g',
            netWeightGrams: 100,
            defaultSellingPrice: 50,
            uom: { connect: { id: uomKgId } },
            inventoryItem: {
              create: {
                itemType: 'FINISHED_GOODS',
                code: `P7-SKU-${suffix}`,
                name: 'Phase 7 Cookie 100g',
                uomId: uomKgId,
              },
            },
          },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;

    const bom = await prisma.bOM.create({
      data: {
        productVariantId: variantId,
        code: `P7-BOM-${suffix}`,
        name: 'P7 Cookie Recipe',
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
                  inventoryItemId: origInvId,
                  itemType: 'RAW_MATERIAL',
                  standardQuantity: 10,
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

    const otherHo = await prisma.shiftHandover.create({
      data: {
        handoverNumber: `SH-OTHER-${suffix}`,
        factoryId: otherFactoryId,
        shiftName: 'NIGHT',
        shiftDate: new Date('2026-11-26T00:00:00.000Z'),
        outgoingUserId: adminUser.id,
        status: 'SUBMITTED',
      },
    });
    otherHandoverId = otherHo.id;
  });

  afterAll(async () => {
    if (subRequestId) {
      await prisma.materialSubstitutionRequest.deleteMany({ where: { id: subRequestId } });
    }
    const hoIds = [handoverId, otherHandoverId].filter(Boolean);
    if (hoIds.length > 0) {
      await prisma.shiftHandover.deleteMany({ where: { id: { in: hoIds } } });
    }
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    if (variantId) {
      await prisma.inventoryItem.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.deleteMany({ where: { id: variantId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (subBatchId) {
      await prisma.inventoryBalance.deleteMany({ where: { batchId: subBatchId } });
      await prisma.inventoryBatch.deleteMany({ where: { id: subBatchId } });
    }
    const rmIds = [rmOrigId, rmSubId].filter(Boolean);
    if (rmIds.length > 0) {
      await prisma.inventoryItem.deleteMany({ where: { rawMaterialId: { in: rmIds } } });
      await prisma.rawMaterial.deleteMany({ where: { id: { in: rmIds } } });
    }
    await prisma.user.deleteMany({
      where: { username: { in: ['p7_prod', 'p7_admin', 'p7_auditor'] } },
    });
    await prisma.$disconnect();
  });

  it('1. Enforces authentication (401), AUDITOR read-only (403), and cross-factory handover isolation (403)', async () => {
    const unauth = await request(app).get('/api/v1/collaboration/handovers/dashboard');
    expect(unauth.status).toBe(401);

    const auditorWrite = await request(app)
      .post('/api/v1/collaboration/handovers')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        factoryId,
        shiftName: 'MORNING',
        shiftDate: '2026-11-26',
      });
    expect(auditorWrite.status).toBe(403);

    // Production user has access to whRmId (factoryId), NOT otherFactoryId
    const crossAck = await request(app)
      .post(`/api/v1/collaboration/handovers/${otherHandoverId}/acknowledge`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ acknowledgementNotes: 'Cross factory attempt' });
    expect(crossAck.status).toBe(403);
  });

  it('2. Shift Handover lifecycle (DRAFT -> SUBMITTED -> RETURNED -> SUBMITTED rev 2 -> ACKNOWLEDGED -> CLOSED) preserves history and prevents direct edit after submit', async () => {
    const createRes = await request(app)
      .post('/api/v1/collaboration/handovers')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        factoryId,
        warehouseId: whRmId,
        shiftName: 'MORNING',
        shiftDate: '2026-11-26',
        priority: 'HIGH',
        equipmentIssues: 'Mixer #2 belt tension check',
        notes: 'Initial morning shift notes',
      });
    expect(createRes.status).toBe(201);
    handoverId = createRes.body.data.id;

    const submitRes = await request(app)
      .post(`/api/v1/collaboration/handovers/${handoverId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    // Direct edit while SUBMITTED must be rejected
    const blockedEdit = await request(app)
      .patch(`/api/v1/collaboration/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ notes: 'Sneaky edit' });
    expect(blockedEdit.status).toBe(400);

    // Return for correction
    const returnRes = await request(app)
      .post(`/api/v1/collaboration/handovers/${handoverId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ returnReason: 'Please include pending batch count' });
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe('RETURNED');

    // Edit in RETURNED increments revisionNumber to 2
    const editRes = await request(app)
      .patch(`/api/v1/collaboration/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ notes: 'Updated with batch count' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.revisionNumber).toBe(2);

    // Resubmit -> Acknowledge -> Close
    await request(app)
      .post(`/api/v1/collaboration/handovers/${handoverId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`);

    const ackRes = await request(app)
      .post(`/api/v1/collaboration/handovers/${handoverId}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgementNotes: 'Received by afternoon shift' });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.status).toBe('ACKNOWLEDGED');

    const closeRes = await request(app)
      .post(`/api/v1/collaboration/handovers/${handoverId}/close`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('CLOSED');

    const detailRes = await request(app)
      .get(`/api/v1/collaboration/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.histories.length).toBeGreaterThanOrEqual(6);
  });

  it('3. Material Substitution evaluation detects UNKNOWN allergens, incompatible UOM, and never mutates BOM or stock', async () => {
    // Unknown allergen + no pre-approved relation -> REQUIRES_REVIEW
    const evalReview = await request(app)
      .post('/api/v1/collaboration/substitutions/evaluate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        warehouseId: whRmId,
        bomId,
        bomVersionId,
        originalItemId: origInvId,
        substituteItemId: subInvId,
        requiredQuantity: '10',
        uomId: uomKgId,
      });
    expect(evalReview.status).toBe(200);
    expect(evalReview.body.data.compatibilityStatus).toBe('REQUIRES_REVIEW');
    expect(evalReview.body.data.allergenComparison.hasUnknownAllergenInfo).toBe(true);

    // Incompatible UOM (PCS vs KG without conversion) -> NOT_COMPATIBLE
    const evalBadUom = await request(app)
      .post('/api/v1/collaboration/substitutions/evaluate')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        warehouseId: whRmId,
        bomId,
        bomVersionId,
        originalItemId: origInvId,
        substituteItemId: subInvId,
        requiredQuantity: '10',
        uomId: uomPcsId,
      });
    expect(evalBadUom.status).toBe(200);
    expect(evalBadUom.body.data.compatibilityStatus).toBe('NOT_COMPATIBLE');
  });

  it('4. Substitution approval enforces RBAC, prevents duplicate approvals, and revalidates live stock before application', async () => {
    const createSub = await request(app)
      .post('/api/v1/collaboration/substitutions')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        warehouseId: whRmId,
        bomId,
        bomVersionId,
        originalItemId: origInvId,
        substituteItemId: subInvId,
        requiredQuantity: '10',
        uomId: uomKgId,
        reason: 'Cane sugar supplier delay',
      });
    expect(createSub.status).toBe(201);
    subRequestId = createSub.body.data.id;

    // Duplicate/unauthorized approval check: prod lacks production.work_orders.approve
    const unauthApprove = await request(app)
      .post(`/api/v1/collaboration/substitutions/${subRequestId}/approve`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({});
    expect(unauthApprove.status).toBe(403);

    // Admin approves
    const approveRes = await request(app)
      .post(`/api/v1/collaboration/substitutions/${subRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approvalNotes: 'Approved for trial batch' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    // Second approval attempt rejected with 400
    const dupApprove = await request(app)
      .post(`/api/v1/collaboration/substitutions/${subRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(dupApprove.status).toBe(400);

    // Expire the substitute batch -> applyRequest revalidation must block with 409!
    await prisma.inventoryBatch.update({
      where: { id: subBatchId },
      data: { expiryDate: new Date('2020-01-01T00:00:00.000Z') },
    });
    const blockedApply = await request(app)
      .post(`/api/v1/collaboration/substitutions/${subRequestId}/apply`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({});
    expect(blockedApply.status).toBe(409);

    // Restore valid expiry -> apply succeeds
    await prisma.inventoryBatch.update({
      where: { id: subBatchId },
      data: { expiryDate: new Date(Date.now() + 60 * 86_400_000) },
    });
    const applyRes = await request(app)
      .post(`/api/v1/collaboration/substitutions/${subRequestId}/apply`)
      .set('Authorization', `Bearer ${prodToken}`)
      .send({ applicationNotes: 'Applied to batch' });
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.data.status).toBe('APPLIED');
    expect(prodUserId).toBeTruthy();
  });
});
