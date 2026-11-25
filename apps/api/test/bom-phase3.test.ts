import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 3.1: BOM & Recipe Management Suite', () => {
  const suffix = Date.now().toString().slice(-6);
  const createdUsernames = [
    `bom_admin_${suffix}`,
    `bom_prod_${suffix}`,
    `bom_sales_${suffix}`,
    `bom_audit_${suffix}`,
  ];

  let adminToken: string;
  let prodToken: string;
  let salesToken: string;
  let auditorToken: string;

  let kgUomId: string;
  let gUomId: string;
  let pcsUomId: string;
  let tax5Id: string;

  let rmCatId: string;
  let prodCatId: string;
  let flourRmId: string;
  let pouchRmId: string;
  let flourInvId: string;
  let pouchInvId: string;
  let fgInvId: string;
  let productId: string;
  let variantId: string;
  let conversionId: string | null = null;
  let bomId: string;

  beforeAll(async () => {
    const pw = await hashPassword('BomTest2026!');
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
      return generateAccessToken({
        userId: user.id,
        username: user.username,
        roles: [role.code],
        permissions: role.permissions.map(p => p.permission.code),
      });
    };

    adminToken = await makeUser(`bom_admin_${suffix}`, 'ADMIN');
    prodToken = await makeUser(`bom_prod_${suffix}`, 'PRODUCTION');
    salesToken = await makeUser(`bom_sales_${suffix}`, 'SALESMAN');
    auditorToken = await makeUser(`bom_audit_${suffix}`, 'AUDITOR');

    const [kg, g, pcs, tax5] = await Promise.all([
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'KG' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'G' } }),
      prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } }),
      prisma.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } }),
    ]);
    kgUomId = kg.id;
    gUomId = g.id;
    pcsUomId = pcs.id;
    tax5Id = tax5.id;

    // Ensure G -> KG conversion exists (1 G = 0.001 KG)
    const existingConv = await prisma.unitConversion.findUnique({
      where: { fromUomId_toUomId: { fromUomId: gUomId, toUomId: kgUomId } },
    });
    if (!existingConv) {
      const conv = await prisma.unitConversion.create({
        data: {
          fromUomId: gUomId,
          toUomId: kgUomId,
          multiplier: new Prisma.Decimal('0.001000'),
        },
      });
      conversionId = conv.id;
    }

    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `BRC-${suffix}`, name: `BOM RM Cat ${suffix}` },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `BPC-${suffix}`, name: `BOM Prod Cat ${suffix}` },
    });
    prodCatId = prodCat.id;

    const flour = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `BRM-FLR-${suffix}`,
        name: 'Rice Flour',
        materialType: 'RAW_INGREDIENT',
        uom: { connect: { id: kgUomId } },
        hsnCode: '11029090',
        taxRate: { connect: { id: tax5Id } },
      },
    });
    flourRmId = flour.id;

    const pouch = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `BRM-PCH-${suffix}`,
        name: 'Printed Pouch 200g',
        materialType: 'PACKAGING_PRIMARY',
        uom: { connect: { id: pcsUomId } },
        hsnCode: '39232100',
        taxRate: { connect: { id: tax5Id } },
      },
    });
    pouchRmId = pouch.id;

    const flourInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'RAW_MATERIAL',
        rawMaterialId: flourRmId,
        code: `BINV-FLR-${suffix}`,
        name: 'Rice Flour',
        uomId: kgUomId,
        movingAverageCost: new Prisma.Decimal('50.0000'), // ₹50/kg
      },
    });
    flourInvId = flourInv.id;

    const pouchInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'PACKAGING',
        rawMaterialId: pouchRmId,
        code: `BINV-PCH-${suffix}`,
        name: 'Printed Pouch 200g',
        uomId: pcsUomId,
        movingAverageCost: new Prisma.Decimal('2.5000'), // ₹2.50/pcs
      },
    });
    pouchInvId = pouchInv.id;

    const product = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `BPRD-${suffix}`,
        name: 'Recipe Murukku',
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
        defaultSellingPrice: new Prisma.Decimal('45.00'),
      },
    });
    variantId = variant.id;

    const fgInv = await prisma.inventoryItem.create({
      data: {
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        code: `BINV-FG-${suffix}`,
        name: 'Recipe Murukku 200g',
        uomId: pcsUomId,
      },
    });
    fgInvId = fgInv.id;
  });

  afterAll(async () => {
    if (bomId) {
      await prisma.bOM.deleteMany({ where: { id: bomId } });
    }
    const invIds = [flourInvId, pouchInvId, fgInvId].filter(Boolean);
    if (invIds.length > 0) {
      await prisma.inventoryItem.deleteMany({ where: { id: { in: invIds } } });
    }
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    const rmIds = [flourRmId, pouchRmId].filter(Boolean);
    if (rmIds.length > 0) await prisma.rawMaterial.deleteMany({ where: { id: { in: rmIds } } });
    if (prodCatId) await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    if (rmCatId) await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });
    if (conversionId) {
      await prisma.unitConversion.deleteMany({ where: { id: conversionId } });
    }
    await prisma.user.deleteMany({ where: { username: { in: createdUsernames } } });
  });

  it('1. Creates BOM with UOM conversion, yield/wastage, and calculates Decimal cost estimate & explosion', async () => {
    const res = await request(app)
      .post('/api/v1/production/boms')
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({
        productVariantId: variantId,
        code: `BOM-${suffix}`,
        name: 'Standard Murukku Recipe',
        baseOutputQuantity: '100',
        outputUomId: pcsUomId,
        initialVersion: {
          expectedGoodOutput: '100',
          yieldPercentage: '95.00',
          expectedWastagePercent: '5.00',
          outputUomId: pcsUomId,
          remarks: 'Initial recipe v1',
          items: [
            {
              inventoryItemId: flourInvId,
              standardQuantity: '20000', // 20,000 G = 20 KG @ ₹50 = ₹1,000
              uomId: gUomId,
              scrapTolerancePercent: '5', // +5% = 21 KG = ₹1,050
            },
            {
              inventoryItemId: pouchInvId,
              standardQuantity: '100', // 100 PCS @ ₹2.50 = ₹250
              uomId: pcsUomId,
              scrapTolerancePercent: '2', // +2% = 102 PCS = ₹255
            },
          ],
          overheads: [
            { costType: 'LABOUR', description: 'Frying & Packing Labour', standardAmount: '500.00' },
          ],
        },
      });

    expect(res.status).toBe(201);
    bomId = res.body.data.id;
    const v1 = res.body.data.versions[0];
    expect(v1.yieldPercentage).toBe('95');
    expect(v1.expectedWastagePercent).toBe('5');

    // Cost estimate for base batch (100 PCS)
    const costRes = await request(app)
      .get(`/api/v1/production/boms/${bomId}/versions/${v1.id}/cost-estimate`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(costRes.status).toBe(200);
    expect(costRes.body.data.totalStandardMaterialCost).toBe('1250.00');
    expect(costRes.body.data.totalEffectiveMaterialCost).toBe('1305.00');
    expect(costRes.body.data.totalOverheadCost).toBe('500.00');
    expect(costRes.body.data.totalEstimatedCost).toBe('1805.00');
    expect(costRes.body.data.estimatedUnitCost).toBe('18.0500');

    // Scaled recipe explosion for 200 PCS
    const scaledRes = await request(app)
      .get(`/api/v1/production/boms/${bomId}/versions/${v1.id}/cost-estimate?batchQuantity=200`)
      .set('Authorization', `Bearer ${prodToken}`);
    expect(scaledRes.status).toBe(200);
    expect(scaledRes.body.data.totalEstimatedCost).toBe('3610.00');
    expect(scaledRes.body.data.estimatedUnitCost).toBe('18.0500');
  });

  it('2. Rejects incompatible UOM conversion, circular BOM, and inactive ingredients', async () => {
    // Incompatible UOM (PCS vs KG without conversion)
    const badUomRes = await request(app)
      .post(`/api/v1/master-data/boms/${bomId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '100',
        outputUomId: pcsUomId,
        items: [
          {
            inventoryItemId: flourInvId, // base UOM is KG
            standardQuantity: '10',
            uomId: pcsUomId, // incompatible!
            scrapTolerancePercent: '0',
          },
        ],
      });
    expect(badUomRes.status).toBe(400);

    // Circular BOM (referencing own finished goods inventory item)
    const circularRes = await request(app)
      .post(`/api/v1/master-data/boms/${bomId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '100',
        outputUomId: pcsUomId,
        items: [
          {
            inventoryItemId: fgInvId,
            standardQuantity: '1',
            uomId: pcsUomId,
            scrapTolerancePercent: '0',
          },
        ],
      });
    expect(circularRes.status).toBe(400);
    expect(circularRes.body.message).toMatch(/Circular BOM/i);

    // Inactive ingredient rejected
    await prisma.inventoryItem.update({ where: { id: pouchInvId }, data: { isActive: false } });
    const inactiveRes = await request(app)
      .post(`/api/v1/master-data/boms/${bomId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '100',
        outputUomId: pcsUomId,
        items: [
          {
            inventoryItemId: pouchInvId,
            standardQuantity: '100',
            uomId: pcsUomId,
            scrapTolerancePercent: '0',
          },
        ],
      });
    expect(inactiveRes.status).toBe(400);
    await prisma.inventoryItem.update({ where: { id: pouchInvId }, data: { isActive: true } });
  });

  it('3. Enforces RBAC, version immutability, activation, obsolescence, and audit history', async () => {
    const detail = await request(app)
      .get(`/api/v1/master-data/boms/${bomId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const v1Id = detail.body.data.versions[0].id as string;

    // SALESMAN denied
    const salesDeny = await request(app)
      .get(`/api/v1/production/boms/${bomId}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesDeny.status).toBe(403);

    // AUDITOR read-only
    const auditorWrite = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ expectedGoodOutput: '10', outputUomId: pcsUomId, items: [] });
    expect(auditorWrite.status).toBe(403);

    // PRODUCTION cannot activate (requires bom.approve)
    const prodActivate = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions/${v1Id}/activate`)
      .set('Authorization', `Bearer ${prodToken}`)
      .set(CSRF)
      .send({});
    expect(prodActivate.status).toBe(403);

    // ADMIN activates v1
    const actRes = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions/${v1Id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.status).toBe('ACTIVE');

    // Active version is immutable
    const editActive = await request(app)
      .patch(`/api/v1/production/boms/${bomId}/versions/${v1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '120',
        outputUomId: pcsUomId,
        items: [
          { inventoryItemId: pouchInvId, standardQuantity: '120', uomId: pcsUomId, scrapTolerancePercent: '0' },
        ],
      });
    expect(editActive.status).toBe(400);

    // Explicit obsolete transition
    const obsRes = await request(app)
      .post(`/api/v1/production/boms/${bomId}/versions/${v1Id}/obsolete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Superseded by reformulated recipe' });
    expect(obsRes.status).toBe(200);
    expect(obsRes.body.data.status).toBe('OBSOLETE');

    // Audit history contains CREATE, APPROVE, and UPDATE entries
    const histRes = await request(app)
      .get(`/api/v1/production/boms/${bomId}/history`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.length).toBeGreaterThanOrEqual(3);
  });
});
