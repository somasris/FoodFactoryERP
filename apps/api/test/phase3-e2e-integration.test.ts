import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3 End-to-End Cross-Module Integration & Regression Suite', () => {
  const suffix = `E2E${Date.now().toString().slice(-6)}`;
  const createdUsernames = [
    `e2e_owner_${suffix}`,
    `e2e_admin_${suffix}`,
    `e2e_prod_${suffix}`,
    `e2e_sales_${suffix}`,
    `e2e_audit_${suffix}`,
  ];

  let ownerToken: string;
  let adminToken: string;
  let prodToken: string;
  let salesToken: string;
  let auditorToken: string;

  let whFGId: string;
  let whRMId: string;
  let kgUomId: string;
  let gUomId: string;
  let pcsUomId: string;

  let rmCatId: string;
  let prodCatId: string;
  let flourRmId: string;
  let flourInvId: string;
  let pouchRmId: string;
  let pouchInvId: string;
  let rmGoodBatchId: string;
  let rmQuarantinedBatchId: string;
  let pouchBatchId: string;

  let productId: string;
  let variantId: string;
  let fgInvId: string;
  let customerId: string;

  let bomId: string;
  let bomVersionId: string;
  let salesOrderId: string;
  let planId: string;
  let planItemId: string;
  let workOrderId: string;
  let batchId: string;
  let batchNumber: string;
  let fgBatchId: string;
  let qiId: string;

  beforeAll(async () => {
    const pw = await hashPassword('E2eTest2026!');
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

    const [own, adm, prd, sls, aud] = await Promise.all([
      makeUser(createdUsernames[0], 'OWNER', 'E2E Owner'),
      makeUser(createdUsernames[1], 'ADMIN', 'E2E Admin'),
      makeUser(createdUsernames[2], 'PRODUCTION', 'E2E Operator'),
      makeUser(createdUsernames[3], 'SALESMAN', 'E2E Salesman'),
      makeUser(createdUsernames[4], 'AUDITOR', 'E2E Auditor'),
    ]);

    ownerToken = own.token;
    adminToken = adm.token;
    prodToken = prd.token;
    salesToken = sls.token;
    auditorToken = aud.token;

    const [whFG, whRM, kgUom, gUom, pcsUom, company, tax5] = await Promise.all([
      prisma.warehouse.findFirst({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findFirst({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findFirst({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findFirst({ where: { code: 'G' } }),
      prisma.unitOfMeasure.findFirst({ where: { code: 'PCS' } }),
      prisma.company.findFirst(),
      prisma.taxRate.findFirst({ where: { isActive: true } }),
    ]);

    whFGId = whFG!.id;
    whRMId = whRM!.id;
    kgUomId = kgUom!.id;
    gUomId = gUom!.id;
    pcsUomId = pcsUom!.id;

    for (const uid of [own.id, adm.id, prd.id, sls.id, aud.id]) {
      await prisma.userWarehouseAccess.createMany({
        data: [
          { userId: uid, warehouseId: whFGId, accessLevel: 'READ_WRITE' },
          { userId: uid, warehouseId: whRMId, accessLevel: 'READ_WRITE' },
        ],
        skipDuplicates: true,
      });
    }

    // Ensure G -> KG conversion exists
    const existingConv = await prisma.unitConversion.findUnique({
      where: { fromUomId_toUomId: { fromUomId: gUomId, toUomId: kgUomId } },
    });
    if (!existingConv) {
      await prisma.unitConversion.create({
        data: { fromUomId: gUomId, toUomId: kgUomId, multiplier: new Prisma.Decimal('0.001000') },
      });
    }

    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `ERMCAT-${suffix}`, name: `E2E RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `EPCAT-${suffix}`, name: `E2E Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    // Flour RM (KG, ₹50/KG)
    const flour = await prisma.rawMaterial.create({
      data: {
        code: `EFLR-${suffix}`,
        name: `E2E Flour ${suffix}`,
        categoryId: rmCatId,
        materialType: 'RAW_INGREDIENT',
        uomId: kgUomId,
        hsnCode: '11010000',
        taxRateId: tax5!.id,
      },
    });
    flourRmId = flour.id;
    const flourInv = await prisma.inventoryItem.create({
      data: {
        code: `EINV-FLR-${suffix}`,
        name: `E2E Flour ${suffix}`,
        itemType: 'RAW_MATERIAL',
        rawMaterialId: flourRmId,
        uomId: kgUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('50.0000'),
      },
    });
    flourInvId = flourInv.id;

    // Pouch Packaging (PCS, ₹5/PCS)
    const pouch = await prisma.rawMaterial.create({
      data: {
        code: `EPCH-${suffix}`,
        name: `E2E Pouch ${suffix}`,
        categoryId: rmCatId,
        materialType: 'PACKAGING_PRIMARY',
        uomId: pcsUomId,
        hsnCode: '39232100',
        taxRateId: tax5!.id,
      },
    });
    pouchRmId = pouch.id;
    const pouchInv = await prisma.inventoryItem.create({
      data: {
        code: `EINV-PCH-${suffix}`,
        name: `E2E Pouch ${suffix}`,
        itemType: 'PACKAGING',
        rawMaterialId: pouchRmId,
        uomId: pcsUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('5.0000'),
      },
    });
    pouchInvId = pouchInv.id;

    // RM Stock: 100 KG ACCEPTED + 50 KG QUARANTINED (must be excluded everywhere)
    const goodBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `ERM-OK-${suffix}`,
        unitCost: new Prisma.Decimal('50.0000'),
        qualityStatus: 'ACCEPTED',
        expiryDate: new Date(Date.now() + 90 * 86400_000),
      },
    });
    rmGoodBatchId = goodBatch.id;
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRMId,
        inventoryItemId: flourInvId,
        batchId: rmGoodBatchId,
        quantityOnHand: new Prisma.Decimal('100.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('50.0000'),
        totalValue: new Prisma.Decimal('5000.0000'),
      },
    });

    const qBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: flourInvId,
        batchNumber: `ERM-Q-${suffix}`,
        unitCost: new Prisma.Decimal('50.0000'),
        qualityStatus: 'QUARANTINED',
        expiryDate: new Date(Date.now() + 90 * 86400_000),
      },
    });
    rmQuarantinedBatchId = qBatch.id;
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRMId,
        inventoryItemId: flourInvId,
        batchId: rmQuarantinedBatchId,
        quantityOnHand: new Prisma.Decimal('50.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('50.0000'),
        totalValue: new Prisma.Decimal('2500.0000'),
      },
    });

    const pBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: pouchInvId,
        batchNumber: `EPCH-OK-${suffix}`,
        unitCost: new Prisma.Decimal('5.0000'),
        qualityStatus: 'ACCEPTED',
      },
    });
    pouchBatchId = pBatch.id;
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whRMId,
        inventoryItemId: pouchInvId,
        batchId: pouchBatchId,
        quantityOnHand: new Prisma.Decimal('500.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('5.0000'),
        totalValue: new Prisma.Decimal('2500.0000'),
      },
    });

    // FG Product & Variant (shelfLifeDays = 180)
    const prod = await prisma.product.create({
      data: {
        code: `EPRD-${suffix}`,
        name: `E2E Biscuit ${suffix}`,
        categoryId: prodCatId,
        baseUomId: pcsUomId,
        hsnCode: '19053100',
        taxRateId: tax5!.id,
      },
    });
    productId = prod.id;
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `ESKU-${suffix}`,
        name: `E2E Biscuit 100g ${suffix}`,
        uomId: pcsUomId,
        netWeightGrams: new Prisma.Decimal('100.00'),
        defaultSellingPrice: new Prisma.Decimal('30.00'),
        shelfLifeDays: 180,
      },
    });
    variantId = variant.id;
    const fgInv = await prisma.inventoryItem.create({
      data: {
        code: `EINV-FG-${suffix}`,
        name: `E2E Biscuit 100g ${suffix}`,
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        uomId: pcsUomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal('0.0000'),
      },
    });
    fgInvId = fgInv.id;

    // Seed a PENDING_INSPECTION FG batch in WH-FG-01 to verify Planning does NOT deduct unaccepted FG stock!
    const unacceptedFgBatch = await prisma.inventoryBatch.create({
      data: {
        inventoryItemId: fgInvId,
        batchNumber: `EFG-PEND-${suffix}`,
        unitCost: new Prisma.Decimal('15.0000'),
        qualityStatus: 'PENDING_INSPECTION',
        expiryDate: new Date(Date.now() + 180 * 86400_000),
      },
    });
    await prisma.inventoryBalance.create({
      data: {
        warehouseId: whFGId,
        inventoryItemId: fgInvId,
        batchId: unacceptedFgBatch.id,
        quantityOnHand: new Prisma.Decimal('50.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('15.0000'),
        totalValue: new Prisma.Decimal('750.0000'),
      },
    });

    // Customer for Sales Order
    const cust = await prisma.customer.create({
      data: {
        code: `ECUST-${suffix}`,
        legalName: `E2E Customer ${suffix}`,
        customerType: 'DISTRIBUTOR',
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '123 E2E Street',
            city: 'Chennai',
            state: 'Tamil Nadu',
            stateCode: company?.stateCode || '33',
            pincode: '600001',
            isDefault: true,
          },
        },
      },
    });
    customerId = cust.id;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
      if (customerId) {
        await prisma.salesOrder.deleteMany({ where: { customerId } });
        await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
      }
      if (variantId) {
        await prisma.bOM.deleteMany({ where: { productVariantId: variantId } });
      }
    } catch {
      // ignore cleanup FK order issues in test teardown
    }
  });

  it('executes complete Phase 3.1 -> 3.7 end-to-end workflow with quality isolation, costing finalization, and report reconciliation', async () => {
    // 1. Phase 3.1: Create BOM, configure yield/wastage, activate, and verify cost estimate
    const bomRes = await request(app)
      .post('/api/v1/production/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        code: `EBOM-${suffix}`,
        name: `E2E Biscuit Recipe ${suffix}`,
        productVariantId: variantId,
        baseOutputQuantity: 100,
        outputUomId: pcsUomId,
        initialVersion: {
          versionNumber: 1,
          effectiveFrom: '2026-01-01',
          expectedGoodOutput: 100,
          outputUomId: pcsUomId,
          yieldPercentage: 100,
          expectedWastagePercent: 2,
          items: [
            {
              inventoryItemId: flourInvId,
              itemType: 'RAW_MATERIAL',
              standardQuantity: 10,
              uomId: kgUomId,
              scrapTolerancePercent: 0,
            },
            {
              inventoryItemId: pouchInvId,
              itemType: 'PACKAGING',
              standardQuantity: 100,
              uomId: pcsUomId,
              scrapTolerancePercent: 0,
            },
          ],
          overheads: [
            {
              costType: 'UTILITY',
              description: 'Oven Power',
              standardAmount: 100,
            },
          ],
        },
      });
    expect(bomRes.status).toBe(201);
    bomId = bomRes.body.data.id;
    bomVersionId = bomRes.body.data.versions[0].id;

    const actRes = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions/${bomVersionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(actRes.status).toBe(200);

    const estRes = await request(app)
      .get(`/api/v1/production/boms/${bomId}/versions/${bomVersionId}/cost-estimate?batchQuantity=50`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(estRes.status).toBe(200);
    // 50 pcs = 5 KG flour (5 * 50 = 250) + 50 pouches (50 * 5 = 250) + 50 overhead = 550
    expect(Number(estRes.body.data.totalEstimatedCost)).toBe(550);

    // 2. Phase 3.2: Sales Order -> Demand -> Production Plan (verifying PENDING_INSPECTION FG stock is NOT deducted)
    const soRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        orderDate: new Date().toISOString().slice(0, 10),
        lines: [{ productVariantId: variantId, orderedQuantity: 50, uomId: pcsUomId, discountPercent: 0 }],
      });
    expect(soRes.status).toBe(201);
    salesOrderId = soRes.body.data.id;
    const soLineId = soRes.body.data.lines[0].id;

    await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/submit`)
      .set('Authorization', `Bearer ${salesToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    // Confirming SO fails if no ACCEPTED FG stock exists yet (50 pcs PENDING_INSPECTION must be ignored!)
    const failConfirm = await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(failConfirm.status).toBe(400);

    // Force SO to CONFIRMED in DB (backorder demand scenario) to test Production Planning demand generation
    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { status: 'CONFIRMED' },
    });

    const demandRes = await request(app)
      .get(`/api/v1/production/demand?warehouseId=${whFGId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(demandRes.status).toBe(200);
    const ourDemand = demandRes.body.data.productSummary.find(
      (i: { productVariantId: string }) => i.productVariantId === variantId,
    );
    expect(ourDemand).toBeDefined();
    // Net production required must be full 50 (PENDING_INSPECTION stock of 50 must NOT be deducted!)
    expect(Number(ourDemand.availableFgQuantity)).toBe(0);
    expect(Number(ourDemand.grossDemandQuantity)).toBe(50);

    const planRes = await request(app)
      .post('/api/v1/production/plans')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        name: `E2E Plan ${suffix}`,
        warehouseId: whFGId,
        planDate: new Date().toISOString().slice(0, 10),
        items: [
          {
            productVariantId: variantId,
            plannedQuantity: 50,
            uomId: pcsUomId,
            demandAllocations: [{ salesOrderId, salesOrderLineId: soLineId, allocatedQuantity: 50 }],
          },
        ],
      });
    expect(planRes.status).toBe(201);
    planId = planRes.body.data.id;
    planItemId = planRes.body.data.items[0].id;

    // Verify Planning Material Availability excludes 50 KG QUARANTINED flour (only 100 KG ACCEPTED shown)
    const flourReq = planRes.body.data.materialRequirements.find(
      (r: { inventoryItemId: string }) => r.inventoryItemId === flourInvId,
    );
    expect(Number(flourReq.availableQuantity)).toBe(100);

    await request(app)
      .post(`/api/v1/production/plans/${planId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/production/plans/${planId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    const relPlan = await request(app)
      .post(`/api/v1/production/plans/${planId}/release`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(relPlan.status).toBe(200);

    // 3. Phase 3.3: Work Order lifecycle
    const woRes = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: planId,
        productionPlanItemId: planItemId,
        plannedQuantity: 50,
        priority: 'HIGH',
      });
    expect(woRes.status).toBe(201);
    workOrderId = woRes.body.data.id;
    expect(woRes.body.data.bomVersionId).toBe(bomVersionId);

    // Verify WO material requirements also exclude QUARANTINED flour
    const woReqRes = await request(app)
      .get(`/api/v1/production/work-orders/${workOrderId}/material-requirements`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(woReqRes.status).toBe(200);
    const woFlourReq = woReqRes.body.data.find(
      (r: { inventoryItemId: string }) => r.inventoryItemId === flourInvId,
    );
    expect(Number(woFlourReq.availableQuantity)).toBe(100);

    await request(app)
      .post(`/api/v1/production/work-orders/${workOrderId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    await request(app)
      .post(`/api/v1/production/work-orders/${workOrderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    const relWo = await request(app)
      .post(`/api/v1/production/work-orders/${workOrderId}/release`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(relWo.status).toBe(200);

    // 4. Phase 3.4: Batch Creation, Reservation Cancel Check, Consumption & Completion
    // First create a small batch, reserve, and cancel to verify reservation release on cancel
    const tempBatchRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId, plannedQuantity: 10 });
    expect(tempBatchRes.status).toBe(201);
    const tempBatchId = tempBatchRes.body.data.id;

    const resMatRes = await request(app)
      .post(`/api/v1/production/batches/${tempBatchId}/reserve-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ warehouseId: whRMId });
    expect(resMatRes.status).toBe(200);

    const balAfterRes = await prisma.inventoryBalance.findFirst({
      where: { warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmGoodBatchId },
    });
    expect(Number(balAfterRes!.quantityReserved)).toBe(1);

    const cancelTempRes = await request(app)
      .post(`/api/v1/production/batches/${tempBatchId}/cancel`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ reason: 'E2E cancellation reservation release check' });
    expect(cancelTempRes.status).toBe(200);

    const balAfterCancel = await prisma.inventoryBalance.findFirst({
      where: { warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmGoodBatchId },
    });
    expect(Number(balAfterCancel!.quantityReserved)).toBe(0);

    // Now create the actual 50-unit batch
    const batchRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ workOrderId, plannedQuantity: 50 });
    expect(batchRes.status).toBe(201);
    batchId = batchRes.body.data.id;
    batchNumber = batchRes.body.data.batchNumber;

    await request(app)
      .post(`/api/v1/production/batches/${batchId}/start`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});

    // Attempt to consume QUARANTINED flour batch -> must fail with 400
    const badConsume = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        lines: [{ warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmQuarantinedBatchId, quantity: 1, uomId: kgUomId }],
      });
    expect(badConsume.status).toBe(400);

    // Consume 6 KG flour (in 6000 G to test UOM conversion) + 50 PCS pouches
    const consKey = `E2E-CONS-${suffix}`;
    const consRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: consKey,
        lines: [
          { warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmGoodBatchId, quantity: 6000, uomId: gUomId },
          { warehouseId: whRMId, inventoryItemId: pouchInvId, batchId: pouchBatchId, quantity: 50, uomId: pcsUomId },
        ],
      });
    expect(consRes.status).toBe(200);

    // Idempotent retry must not double-deduct
    const consRetry = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: consKey,
        lines: [
          { warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmGoodBatchId, quantity: 6000, uomId: gUomId },
          { warehouseId: whRMId, inventoryItemId: pouchInvId, batchId: pouchBatchId, quantity: 50, uomId: pcsUomId },
        ],
      });
    expect(consRetry.status).toBe(200);

    // 5. Phase 3.5: Return 1 KG unused flour (net flour = 5 KG = ₹250)
    const retRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/return-materials`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        idempotencyKey: `E2E-RET-${suffix}`,
        lines: [{ warehouseId: whRMId, inventoryItemId: flourInvId, batchId: rmGoodBatchId, quantity: 1, uomId: kgUomId, reason: 'Unused flour returned' }],
      });
    expect(retRes.status).toBe(200);

    // Complete batch: 48 good + 2 wastage = 50 total
    const compRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/complete`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        goodQuantity: 48,
        rejectedQuantity: 0,
        wastageQuantity: 2,
        wastageReason: 'Line trim loss',
        idempotencyKey: `E2E-COMP-${suffix}`,
      });
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.status).toBe('COMPLETED');
    fgBatchId = compRes.body.data.finishedGoodsBatchId;

    // Verify FG InventoryBatch is PENDING_INSPECTION, has expiryDate from shelfLifeDays, and net unit cost = (250 + 250) / 48 = 10.4167
    const fgBatch = await prisma.inventoryBatch.findUnique({ where: { id: fgBatchId } });
    expect(fgBatch!.qualityStatus).toBe('PENDING_INSPECTION');
    expect(fgBatch!.expiryDate).not.toBeNull();
    expect(Number(fgBatch!.unitCost)).toBeCloseTo(10.4167, 3);

    // 6. Phase 3.5: Quality Inspection -> PARTIALLY_ACCEPTED (45 accepted, 3 rejected)
    const qiListRes = await request(app)
      .get(`/api/v1/production/quality-inspections?search=${batchNumber}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(qiListRes.status).toBe(200);
    qiId = qiListRes.body.data.items[0].id;

    const inspectRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/inspect`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        decision: 'PARTIALLY_ACCEPTED',
        goodQuantity: 45,
        rejectedQuantity: 3,
        inspectionNotes: '3 damaged packs',
      });
    expect(inspectRes.status).toBe(200);

    // Verify main batch is now ACCEPTED (45 on hand) and -REJ batch is REJECTED (3 on hand)
    const [mainFgBal, rejBatch] = await Promise.all([
      prisma.inventoryBalance.findFirst({ where: { warehouseId: whFGId, batchId: fgBatchId } }),
      prisma.inventoryBatch.findFirst({ where: { batchNumber: `${batchNumber}-REJ` } }),
    ]);
    expect(Number(mainFgBal!.quantityOnHand)).toBe(45);
    expect(rejBatch!.qualityStatus).toBe('REJECTED');

    // 7. Phase 3.6: Production Costing -> Add Labour, Calculate, Review, Finalize
    const labourRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        entryType: 'DIRECT_LABOUR',
        description: 'Baking shift',
        quantityOrHours: 2,
        rate: 100,
      });
    expect(labourRes.status).toBe(201);

    const calcRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/calculate`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: true });
    expect(calcRes.status).toBe(200);

    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ notes: 'Reviewed' });

    const finRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/finalize`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `E2E-FIN-${suffix}` });
    expect(finRes.status).toBe(200);
    expect(finRes.body.data.status).toBe('FINALIZED');
    expect(finRes.body.data.fgValuationApplied).toBe(true);

    // 8. Phase 3.7: Reports & RBAC Isolation
    const repDash = await request(app)
      .get('/api/v1/production/reports/dashboard?period=fy')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(repDash.status).toBe(200);
    expect(repDash.body.data.costKpis).not.toBeNull();

    // PRODUCTION cannot access costing report or costing export
    const prodCostRep = await request(app)
      .get('/api/v1/production/reports/costing?period=fy')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(prodCostRep.status).toBe(403);

    const prodCostExp = await request(app)
      .get('/api/v1/production/reports/export/costing?format=csv&period=fy')
      .set('Authorization', `Bearer ${prodToken}`);
    expect(prodCostExp.status).toBe(403);

    // AUDITOR can read & export costing, but cannot mutate
    const audCostExp = await request(app)
      .get('/api/v1/production/reports/export/costing?format=csv&period=fy')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audCostExp.status).toBe(200);

    const audMutate = await request(app)
      .post('/api/v1/production/plans')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({});
    expect(audMutate.status).toBe(403);

    // SALESMAN cannot access production reports
    const salesRep = await request(app)
      .get('/api/v1/production/reports/dashboard')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesRep.status).toBe(403);
  });
});
