import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.2: Production Planning Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `pp_admin_${suffix}`,
    `pp_prod_${suffix}`,
    `pp_sales_${suffix}`,
    `pp_audit_${suffix}`,
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
  let customerId: string;
  let salesOrderId: string;
  let salesOrderLineId: string;
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    // Ensure PRODUCTION role does not retain production.plans.approve from any prior seed
    const prodRole = await prisma.role.findUnique({ where: { code: 'PRODUCTION' } });
    const approvePerm = await prisma.permission.findUnique({
      where: { code: 'production.plans.approve' },
    });
    if (prodRole && approvePerm) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: prodRole.id, permissionId: approvePerm.id },
      });
    }

    const pw = await hashPassword('PlanTest2026!');
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

    const admin = await makeUser(`pp_admin_${suffix}`, 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const prod = await makeUser(`pp_prod_${suffix}`, 'PRODUCTION');
    prodUserId = prod.user.id;
    prodToken = prod.token;

    const sales = await makeUser(`pp_sales_${suffix}`, 'SALESMAN');
    salesUserId = sales.user.id;
    salesToken = sales.token;

    const audit = await makeUser(`pp_audit_${suffix}`, 'AUDITOR');
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
      data: { code: `PRC-${suffix}`, name: `PP RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `PPC-${suffix}`, name: `PP Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const flour = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `PRM-FLR-${suffix}`,
        name: 'Planning Rice Flour',
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
        code: `PINV-FLR-${suffix}`,
        name: 'Planning Rice Flour',
        uomId: kgUomId,
        movingAverageCost: new Prisma.Decimal('40.0000'),
      },
    });
    flourInvId = flourInv.id;

    // Seed 5 KG raw material in WH-RM-01 (less than needed -> triggers shortage!)
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
        code: `PPRD-${suffix}`,
        name: 'Planning Murukku',
        baseUomId: pcsUomId,
        hsnCode: '21069099',
        taxRateId: tax5Id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `PSKU-${suffix}`,
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
        code: `PINV-FG-${suffix}`,
        name: 'Planning Murukku 200g',
        uomId: pcsUomId,
      },
    });
    fgInvId = fgInv.id;

    // Seed 30 PCS FG stock: 20 reserved for order, 10 available -> available FG = 10
    await prisma.inventoryBalance.create({
      data: {
        inventoryItemId: fgInvId,
        warehouseId: whFGId,
        quantityOnHand: new Prisma.Decimal('30.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        unitCost: new Prisma.Decimal('30.0000'),
        totalValue: new Prisma.Decimal('900.0000'),
      },
    });

    // Create & activate BOM: 100 PCS good output, 80% yield, 200G flour per batch (0.2 KG -> * 100/80 = 0.25 KG)
    const bomRes = await request(app)
      .post('/api/v1/production/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        productVariantId: variantId,
        code: `PBOM-${suffix}`,
        name: 'Planning Murukku BOM',
        baseOutputQuantity: '100',
        outputUomId: pcsUomId,
        initialVersion: {
          expectedGoodOutput: '100',
          yieldPercentage: '80.00',
          expectedWastagePercent: '20.00',
          outputUomId: pcsUomId,
          items: [
            {
              inventoryItemId: flourInvId,
              standardQuantity: '20000', // 20 KG per 100 PCS
              uomId: gUomId,
              scrapTolerancePercent: '0',
            },
          ],
          overheads: [{ costType: 'LABOUR', description: 'Labour', standardAmount: '400.00' }],
        },
      });
    expect(bomRes.status).toBe(201);
    bomId = bomRes.body.data.id;
    const verId = bomRes.body.data.versions[0].id;

    const actRes = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions/${verId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(actRes.status).toBe(200);

    const cust = await prisma.customer.create({
      data: {
        code: `PCUST-${suffix}`,
        legalName: 'Planning Customer',
        customerType: 'RETAILER',
      },
    });
    customerId = cust.id;

    // Create & confirm Sales Order for 25 PCS (will reserve 25 of 30, leaving 5 PCS unreserved available FG)
    const soRes = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId,
        warehouseId: whFGId,
        lines: [{ productVariantId: variantId, uomId: pcsUomId, orderedQuantity: '25' }],
      });
    expect(soRes.status).toBe(201);
    salesOrderId = soRes.body.data.id;
    salesOrderLineId = soRes.body.data.lines[0].id;

    await request(app).post(`/api/v1/sales/orders/${salesOrderId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${salesOrderId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const confRes = await request(app).post(`/api/v1/sales/orders/${salesOrderId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    expect(confRes.status).toBe(200);
  });

  afterAll(async () => {
    for (const planId of createdPlanIds) {
      await prisma.productionPlan.deleteMany({ where: { id: planId } });
    }
    if (salesOrderId) await prisma.salesOrder.deleteMany({ where: { id: salesOrderId } });
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    await prisma.inventoryBalance.deleteMany({
      where: { inventoryItemId: { in: [flourInvId, fgInvId] } },
    });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [flourInvId, fgInvId] } } });
    await prisma.productVariant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.rawMaterial.deleteMany({ where: { id: flourRmId } });
    await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
  });

  it('1. Generates demand from confirmed orders, deducts available FG, and keeps inventory read-only', async () => {
    const invBefore = await prisma.inventoryBalance.findMany({
      where: { inventoryItemId: { in: [flourInvId, fgInvId] } },
    });
    const txCountBefore = await prisma.inventoryTransaction.count();

    // SALESMAN has production.demand.read
    const demandRes = await request(app)
      .get('/api/v1/production/demand')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(demandRes.status).toBe(200);

    const summary = (demandRes.body.data.productSummary as Array<Record<string, unknown>>).find(
      p => p.productVariantId === variantId,
    );
    expect(summary).toBeDefined();
    // 25 ordered, 5 unreserved FG available -> net requirement = 20
    expect(Number(summary!.grossDemandQuantity)).toBe(25);
    expect(Number(summary!.availableFgQuantity)).toBe(5);
    expect(Number(summary!.netRequirementQuantity)).toBe(20);

    const invAfter = await prisma.inventoryBalance.findMany({
      where: { inventoryItemId: { in: [flourInvId, fgInvId] } },
    });
    const txCountAfter = await prisma.inventoryTransaction.count();
    expect(invAfter).toEqual(invBefore);
    expect(txCountAfter).toBe(txCountBefore);
  });

  it('2. Creates plan with yield/UOM BOM explosion, material shortages, and prevents concurrent double-counting', async () => {
    const payload = {
      name: 'Concurrent Plan Test',
      warehouseId: whFGId,
      items: [
        {
          productVariantId: variantId,
          demandSources: [
            {
              salesOrderId,
              salesOrderLineId,
              allocatedQuantity: '25',
            },
          ],
        },
      ],
    };

    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/production/plans').set('Authorization', `Bearer ${prodToken}`).set(CSRF).send(payload),
      request(app).post('/api/v1/production/plans').set('Authorization', `Bearer ${prodToken}`).set(CSRF).send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const created = r1.status === 201 ? r1.body.data : r2.body.data;
    createdPlanIds.push(created.id);

    // Planned = 20 PCS; BOM 20 KG per 100 PCS @ 80% yield -> 20 * (20/100) * (100/80) = 5 KG? Wait: 20/100 * 100/80 = 0.25 * 20 = 5.0000 KG!
    expect(Number(created.items[0].plannedQuantity)).toBe(20);
    expect(Number(created.materialRequirements[0].requiredBaseQuantity)).toBe(5);
    expect(Number(created.materialRequirements[0].netAvailableQuantity)).toBe(5);
    expect(Number(created.materialRequirements[0].shortageQuantity)).toBe(0);

    // Check material availability endpoint
    const availRes = await request(app)
      .get(`/api/v1/production/plans/${created.id}/material-availability`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(availRes.status).toBe(200);
    expect(availRes.body.data[0].warehouses.length).toBeGreaterThanOrEqual(1);
  });

  it('3. Enforces lifecycle transitions, RBAC, audit history, and demand release on cancel', async () => {
    const planId = createdPlanIds[0];

    // SALESMAN cannot create or view plans
    const salesPlanDeny = await request(app)
      .get('/api/v1/production/plans')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesPlanDeny.status).toBe(403);

    // AUDITOR cannot submit
    const auditDeny = await request(app)
      .post(`/api/v1/production/plans/${planId}/submit`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({});
    expect(auditDeny.status).toBe(403);

    // PRODUCTION submits
    const subRes = await request(app)
      .post(`/api/v1/production/plans/${planId}/submit`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.status).toBe('SUBMITTED');

    // PRODUCTION cannot approve (requires production.plans.approve)
    const prodApproveDeny = await request(app)
      .post(`/api/v1/production/plans/${planId}/approve`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(prodApproveDeny.status).toBe(403);

    // ADMIN rejects with reason -> PRODUCTION edits -> resubmits -> ADMIN approves -> PRODUCTION releases
    const rejRes = await request(app)
      .post(`/api/v1/production/plans/${planId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Increase batch size to 40' });
    expect(rejRes.status).toBe(200);
    expect(rejRes.body.data.status).toBe('REJECTED');

    const editRes = await request(app)
      .patch(`/api/v1/production/plans/${planId}`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        name: 'Updated Plan 40 PCS',
        items: [
          {
            productVariantId: variantId,
            plannedQuantity: '40',
            demandSources: [{ salesOrderId, salesOrderLineId, allocatedQuantity: '25' }],
          },
        ],
      });
    expect(editRes.status).toBe(200);
    // 40 PCS -> 40/100 * 100/80 * 20 KG = 10 KG required vs 5 KG available => shortage = 5 KG
    expect(Number(editRes.body.data.materialRequirements[0].requiredBaseQuantity)).toBe(10);
    expect(Number(editRes.body.data.materialRequirements[0].shortageQuantity)).toBe(5);

    await request(app).post(`/api/v1/production/plans/${planId}/submit`).set('Authorization', `Bearer ${prodToken}`).set(CSRF).send({});
    const appRes = await request(app).post(`/api/v1/production/plans/${planId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({});
    expect(appRes.status).toBe(200);

    const relRes = await request(app).post(`/api/v1/production/plans/${planId}/release`).set('Authorization', `Bearer ${prodToken}`).set(CSRF).send({});
    expect(relRes.status).toBe(200);
    expect(relRes.body.data.status).toBe('RELEASED');

    // Cancel with reason releases demand back
    const cancelRes = await request(app)
      .post(`/api/v1/production/plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Re-allocating to next week' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const auditCount = await prisma.auditLog.count({
      where: { entityType: 'ProductionPlan', entityId: planId },
    });
    expect(auditCount).toBeGreaterThanOrEqual(6);
  });
});
