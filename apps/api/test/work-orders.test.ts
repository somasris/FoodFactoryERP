import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.3: Work Order Management Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `wo_admin_${suffix}`,
    `wo_prod_${suffix}`,
    `wo_sales_${suffix}`,
    `wo_audit_${suffix}`,
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
  let tax5Id: string;

  let rmCatId: string;
  let prodCatId: string;
  let flourRmId: string;
  let flourInvId: string;
  let productId: string;
  let variantId: string;
  let fgInvId: string;
  let bomId: string;
  let bomVersionId: string;

  let draftPlanId: string;
  let draftPlanItemId: string;
  let approvedPlanId: string;
  let approvedPlanItemId: string;
  let releasedPlanId: string;
  let releasedPlanItemId: string;

  const createdWorkOrderIds: string[] = [];

  beforeAll(async () => {
    const pw = await hashPassword('WoTest2026!');
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

    const admin = await makeUser(`wo_admin_${suffix}`, 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const prod = await makeUser(`wo_prod_${suffix}`, 'PRODUCTION');
    prodUserId = prod.user.id;
    prodToken = prod.token;

    const sales = await makeUser(`wo_sales_${suffix}`, 'SALESMAN');
    salesUserId = sales.user.id;
    salesToken = sales.token;

    const audit = await makeUser(`wo_audit_${suffix}`, 'AUDITOR');
    auditorUserId = audit.user.id;
    auditorToken = audit.token;

    const [whFG, whRM, kg, g, pcs, tax5] = await Promise.all([
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } }),
      prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'G' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } }),
      prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } }),
    ]);
    whFGId = whFG.id;
    whRMId = whRM.id;
    kgUomId = kg.id;
    gUomId = g.id;
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
      data: { code: `WRC-${suffix}`, name: `WO RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `WPC-${suffix}`, name: `WO Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const flour = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `WRM-FLR-${suffix}`,
        name: 'WO Rice Flour',
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
        code: `WINV-FLR-${suffix}`,
        name: 'WO Rice Flour',
        uomId: kgUomId,
        movingAverageCost: new Prisma.Decimal('40.0000'),
      },
    });
    flourInvId = flourInv.id;

    // Seed 5 KG raw material in WH-RM-01 so scaled orders > 5kg show a shortage
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: flourInvId,
        warehouseId: whRMId,
        quantityOnHand: new Prisma.Decimal('5.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('40.0000'),
        totalValue: new Prisma.Decimal('200.0000'),
      },
    });

    const product = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `WPRD-${suffix}`,
        name: 'WO Murukku',
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: tax5Id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `WSKU-${suffix}`,
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
        code: `WINV-FG-${suffix}`,
        name: 'WO Murukku 200g',
        uomId: pcsUomId,
        movingAverageCost: new Prisma.Decimal('30.0000'),
      },
    });
    fgInvId = fgInv.id;

    const bom = await prisma.bOM.create({
      data: {
        code: `WBOM-${suffix}`,
        name: 'WO Murukku Recipe',
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
                standardQuantity: new Prisma.Decimal('50000.0000'), // 50,000 G = 50 KG per 100 pcs (0.5 KG/pc)
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

    const createPlan = async (status: 'DRAFT' | 'APPROVED' | 'RELEASED', tag: string, qty: string) => {
      const plan = await prisma.productionPlan.create({
        data: {
          planNumber: `PP-WO-${tag}-${suffix}`,
          name: `Plan ${tag}`,
          warehouseId: whFGId,
          planDate: new Date(),
          status,
          createdById: adminUserId,
          items: {
            create: {
              lineNumber: 1,
              productVariantId: variantId,
              inventoryItemId: fgInvId,
              bomId,
              bomVersionId,
              uomId: pcsUomId,
              demandQuantity: new Prisma.Decimal(qty),
              availableFgQuantity: new Prisma.Decimal('0'),
              existingPlannedQuantity: new Prisma.Decimal('0'),
              netRequirementQuantity: new Prisma.Decimal(qty),
              plannedQuantity: new Prisma.Decimal(qty),
              yieldPercentage: new Prisma.Decimal('100.00'),
              expectedWastagePercent: new Prisma.Decimal('0.00'),
              estimatedMaterialCost: new Prisma.Decimal('0'),
              estimatedOverheadCost: new Prisma.Decimal('0'),
              estimatedTotalCost: new Prisma.Decimal('0'),
            },
          },
        },
        include: { items: true },
      });
      return plan;
    };

    const draftPlan = await createPlan('DRAFT', 'DRF', '20');
    draftPlanId = draftPlan.id;
    draftPlanItemId = draftPlan.items[0].id;

    const approvedPlan = await createPlan('APPROVED', 'APP', '100');
    approvedPlanId = approvedPlan.id;
    approvedPlanItemId = approvedPlan.items[0].id;

    const releasedPlan = await createPlan('RELEASED', 'REL', '20');
    releasedPlanId = releasedPlan.id;
    releasedPlanItemId = releasedPlan.items[0].id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [adminUserId, prodUserId, salesUserId, auditorUserId].filter(Boolean) } },
    });
    if (createdWorkOrderIds.length > 0) {
      await prisma.workOrderStatusHistory.deleteMany({
        where: { workOrderId: { in: createdWorkOrderIds } },
      });
      await prisma.workOrder.deleteMany({
        where: { id: { in: createdWorkOrderIds } },
      });
    }
    const planIds = [draftPlanId, approvedPlanId, releasedPlanId].filter(Boolean);
    if (planIds.length > 0) {
      await prisma.productionPlanStatusHistory.deleteMany({ where: { productionPlanId: { in: planIds } } });
      await prisma.productionPlanMaterialRequirement.deleteMany({ where: { productionPlanId: { in: planIds } } });
      await prisma.productionPlanItem.deleteMany({ where: { productionPlanId: { in: planIds } } });
      await prisma.productionPlan.deleteMany({ where: { id: { in: planIds } } });
    }
    if (bomId) {
      await prisma.bOMItem.deleteMany({ where: { bomVersion: { bomId } } });
      await prisma.bOMVersion.deleteMany({ where: { bomId } });
      await prisma.bOM.deleteMany({ where: { id: bomId } });
    }
    await prisma.inventoryBalance.deleteMany({
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

  it('rejects creating a work order from a DRAFT production plan', async () => {
    const res = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: draftPlanId,
        productionPlanItemId: draftPlanItemId,
        plannedQuantity: '10',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/APPROVED or RELEASED/i);
  });

  it('creates partial work orders from an APPROVED plan, locks BOM version, and rejects over-allocation', async () => {
    const res1 = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: approvedPlanId,
        productionPlanItemId: approvedPlanItemId,
        plannedQuantity: '40',
        priority: 'HIGH',
        plannedStartDate: '2026-12-01',
        plannedEndDate: '2026-12-03',
        productionLine: 'Line-A1',
        notes: 'Batch 1 split',
        instructions: 'Sift flour before mixing',
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.workOrderNumber).toMatch(/^WO\/\d{4}-\d{2}\/\d{5}$/);
    expect(res1.body.data.status).toBe('DRAFT');
    expect(res1.body.data.bomId).toBe(bomId);
    expect(res1.body.data.bomVersionId).toBe(bomVersionId);
    expect(Number(res1.body.data.plannedQuantity)).toBe(40);
    createdWorkOrderIds.push(res1.body.data.id);

    const res2 = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: approvedPlanId,
        productionPlanItemId: approvedPlanItemId,
        plannedQuantity: '60',
        priority: 'NORMAL',
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.workOrderNumber).not.toBe(res1.body.data.workOrderNumber);
    createdWorkOrderIds.push(res2.body.data.id);

    const planItemAfter = await prisma.productionPlanItem.findUniqueOrThrow({
      where: { id: approvedPlanItemId },
    });
    expect(Number(planItemAfter.workOrderedQuantity)).toBe(100);

    // Over-allocation must fail
    const overRes = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: approvedPlanId,
        productionPlanItemId: approvedPlanItemId,
        plannedQuantity: '1',
      });

    expect(overRes.status).toBe(400);
    expect(overRes.body.message).toMatch(/remaining unallocated quantity/i);
  });

  it('computes read-only BOM material requirements and shortages without mutating inventory', async () => {
    const woId = createdWorkOrderIds[0]; // 40 pcs -> 40 * 0.5 kg = 20 kg required, 5 kg available -> 15 kg shortage
    const reqRes = await request(app)
      .get(`/api/v1/production/work-orders/${woId}/material-requirements`)
      .set('Authorization', `Bearer ${prodToken}`);

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.data).toHaveLength(1);
    const reqLine = reqRes.body.data[0];
    expect(Number(reqLine.requiredQuantity)).toBe(20);
    expect(Number(reqLine.availableQuantity)).toBe(5);
    expect(Number(reqLine.shortageQuantity)).toBe(15);

    const balance = await prisma.inventoryBalance.findFirstOrThrow({
      where: { inventoryItemId: flourInvId, warehouseId: whRMId },
    });
    expect(Number(balance.quantityOnHand)).toBe(5);
    expect(Number(balance.quantityReserved)).toBe(0);

    const txCount = await prisma.inventoryTransactionLine.count({
      where: { inventoryItemId: flourInvId },
    });
    expect(txCount).toBe(0);
  });

  it('executes full lifecycle (edit DRAFT -> submit -> approve -> release) and detects schedule conflicts', async () => {
    const woId = createdWorkOrderIds[0];

    // Edit draft
    const patchRes = await request(app)
      .patch(`/api/v1/production/work-orders/${woId}`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ priority: 'URGENT', productionLine: 'Line-A1' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.priority).toBe('URGENT');

    // Submit (PRODUCTION allowed)
    const subRes = await request(app)
      .post(`/api/v1/production/work-orders/${woId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.status).toBe('SUBMITTED');

    // PRODUCTION cannot approve
    const prodApproveRes = await request(app)
      .post(`/api/v1/production/work-orders/${woId}/approve`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(prodApproveRes.status).toBe(403);

    // ADMIN approves
    const appRes = await request(app)
      .post(`/api/v1/production/work-orders/${woId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(appRes.status).toBe(200);
    expect(appRes.body.data.status).toBe('APPROVED');

    // Release
    const relRes = await request(app)
      .post(`/api/v1/production/work-orders/${woId}/release`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(relRes.status).toBe(200);
    expect(relRes.body.data.status).toBe('RELEASED');

    // Create a second WO on the RELEASED plan overlapping Line-A1 & dates -> must surface schedule conflict
    const conflictWoRes = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productionPlanId: releasedPlanId,
        productionPlanItemId: releasedPlanItemId,
        plannedQuantity: '8',
        plannedStartDate: '2026-12-02',
        plannedEndDate: '2026-12-04',
        productionLine: 'Line-A1',
      });
    expect(conflictWoRes.status).toBe(201);
    const conflictWoId = conflictWoRes.body.data.id;
    createdWorkOrderIds.push(conflictWoId);

    const detailRes = await request(app)
      .get(`/api/v1/production/work-orders/${conflictWoId}`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.scheduleConflicts.length).toBeGreaterThanOrEqual(1);
    expect(detailRes.body.data.scheduleConflicts[0].workOrderId).toBe(woId);
  });

  it('handles concurrent work order creation atomically and releases workOrderedQuantity on cancel', async () => {
    // releasedPlan has 20 total, 8 used => 12 remaining. Run two concurrent 5-unit creations = 10 <= 12.
    const [c1, c2] = await Promise.all([
      request(app)
        .post('/api/v1/production/work-orders')
        .set('Authorization', `Bearer ${prodToken}`)
        .set(CSRF)
        .send({
          productionPlanId: releasedPlanId,
          productionPlanItemId: releasedPlanItemId,
          plannedQuantity: '5',
        }),
      request(app)
        .post('/api/v1/production/work-orders')
        .set('Authorization', `Bearer ${prodToken}`)
        .set(CSRF)
        .send({
          productionPlanId: releasedPlanId,
          productionPlanItemId: releasedPlanItemId,
          plannedQuantity: '5',
        }),
    ]);

    expect(c1.status).toBe(201);
    expect(c2.status).toBe(201);
    expect(c1.body.data.workOrderNumber).not.toBe(c2.body.data.workOrderNumber);
    createdWorkOrderIds.push(c1.body.data.id, c2.body.data.id);

    const itemBeforeCancel = await prisma.productionPlanItem.findUniqueOrThrow({
      where: { id: releasedPlanItemId },
    });
    expect(Number(itemBeforeCancel.workOrderedQuantity)).toBe(18);

    // Cancel c1 -> workOrderedQuantity drops from 18 to 13
    const cancelRes = await request(app)
      .post(`/api/v1/production/work-orders/${c1.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({ reason: 'Reprioritized schedule' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.cancellationReason).toBe('Reprioritized schedule');

    const itemAfterCancel = await prisma.productionPlanItem.findUniqueOrThrow({
      where: { id: releasedPlanItemId },
    });
    expect(Number(itemAfterCancel.workOrderedQuantity)).toBe(13);
  });

  it('enforces RBAC for SALESMAN (denied) and AUDITOR (read-only) and serves dashboard/list', async () => {
    const salesRes = await request(app)
      .get('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesRes.status).toBe(403);

    const auditListRes = await request(app)
      .get('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(auditListRes.status).toBe(200);

    const auditDashRes = await request(app)
      .get('/api/v1/production/work-orders/dashboard')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(auditDashRes.status).toBe(200);
    expect(auditDashRes.body.data.totalWorkOrders).toBeGreaterThanOrEqual(4);

    const auditCreateRes = await request(app)
      .post('/api/v1/production/work-orders')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({
        productionPlanId: releasedPlanId,
        productionPlanItemId: releasedPlanItemId,
        plannedQuantity: '1',
      });
    expect(auditCreateRes.status).toBe(403);
  });
});
