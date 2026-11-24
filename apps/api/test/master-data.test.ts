import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('Phase 1.4 Master Data Management Suite', () => {
  let adminToken: string;
  let auditorToken: string;
  let salesmanToken: string;
  let productionToken: string;

  let adminUserId: string;
  let auditorUserId: string;
  let salesmanUserId: string;
  let productionUserId: string;

  let whRMId: string;
  let whFGId: string;
  let factoryId: string;

  // Created test entity IDs for cleanup
  const createdIds = {
    bomIds: [] as string[],
    variantIds: [] as string[],
    productIds: [] as string[],
    productCatIds: [] as string[],
    rawMaterialIds: [] as string[],
    rawMaterialCatIds: [] as string[],
    supplierIds: [] as string[],
    customerIds: [] as string[],
    taxConfigIds: [] as string[],
    taxRateIds: [] as string[],
    unitConversionIds: [] as string[],
    uomIds: [] as string[],
    warehouseIds: [] as string[],
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['md_admin', 'md_auditor', 'md_salesman', 'md_production'],
        },
      },
    });

    const pw = await hashPassword('MasterDataTest2026!');
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
          fullName: `Test ${roleCode}`,
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

    const admin = await makeUser('md_admin', 'ADMIN');
    adminUserId = admin.user.id;
    adminToken = admin.token;

    const auditor = await makeUser('md_auditor', 'AUDITOR');
    auditorUserId = auditor.user.id;
    auditorToken = auditor.token;

    const salesman = await makeUser('md_salesman', 'SALESMAN');
    salesmanUserId = salesman.user.id;
    salesmanToken = salesman.token;

    const production = await makeUser('md_production', 'PRODUCTION');
    productionUserId = production.user.id;
    productionToken = production.token;

    const whRM = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-RM-01' } });
    const whFG = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-FG-01' } });
    whRMId = whRM.id;
    whFGId = whFG.id;
    factoryId = whRM.factoryId;

    // Scope production user strictly to WH-RM-01
    await prisma.userWarehouseAccess.create({
      data: { userId: productionUserId, warehouseId: whRMId, accessLevel: 'READ_WRITE' },
    });
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    if (createdIds.bomIds.length) {
      await prisma.bOM.deleteMany({ where: { id: { in: createdIds.bomIds } } });
    }
    if (createdIds.variantIds.length) {
      await prisma.inventoryItem.deleteMany({
        where: { productVariantId: { in: createdIds.variantIds } },
      });
      await prisma.productVariant.deleteMany({ where: { id: { in: createdIds.variantIds } } });
    }
    if (createdIds.productIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: createdIds.productIds } } });
    }
    if (createdIds.productCatIds.length) {
      await prisma.productCategory.deleteMany({ where: { id: { in: createdIds.productCatIds } } });
    }
    if (createdIds.rawMaterialIds.length) {
      await prisma.inventoryItem.deleteMany({
        where: { rawMaterialId: { in: createdIds.rawMaterialIds } },
      });
      await prisma.rawMaterial.deleteMany({ where: { id: { in: createdIds.rawMaterialIds } } });
    }
    if (createdIds.rawMaterialCatIds.length) {
      await prisma.rawMaterialCategory.deleteMany({
        where: { id: { in: createdIds.rawMaterialCatIds } },
      });
    }
    if (createdIds.supplierIds.length) {
      await prisma.supplier.deleteMany({ where: { id: { in: createdIds.supplierIds } } });
    }
    if (createdIds.customerIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: createdIds.customerIds } } });
    }
    if (createdIds.taxConfigIds.length) {
      await prisma.taxConfiguration.deleteMany({ where: { id: { in: createdIds.taxConfigIds } } });
    }
    if (createdIds.taxRateIds.length) {
      await prisma.taxRate.deleteMany({ where: { id: { in: createdIds.taxRateIds } } });
    }
    if (createdIds.unitConversionIds.length) {
      await prisma.unitConversion.deleteMany({
        where: { id: { in: createdIds.unitConversionIds } },
      });
    }
    if (createdIds.uomIds.length) {
      await prisma.unitOfMeasure.deleteMany({ where: { id: { in: createdIds.uomIds } } });
    }
    if (createdIds.warehouseIds.length) {
      await prisma.warehouse.deleteMany({ where: { id: { in: createdIds.warehouseIds } } });
    }

    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, auditorUserId, salesmanUserId, productionUserId] },
      },
    });
  });

  it('1. Unauthenticated access to master data is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/master-data/products');
    expect(res.status).toBe(401);
  });

  it('2. Units of Measure & Unit Conversions enforce validation and exact decimal math', async () => {
    // Create two weight UoMs and one volume UoM
    const u1 = await request(app)
      .post('/api/v1/master-data/uoms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_KG', name: 'Test Kilogram', symbol: 'tkg', category: 'WEIGHT', isBaseUnit: true, decimalPlaces: 3 });
    expect(u1.status).toBe(201);
    createdIds.uomIds.push(u1.body.data.id);

    // Duplicate UoM code rejected with 409
    const dup = await request(app)
      .post('/api/v1/master-data/uoms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_KG', name: 'Dup', symbol: 'd', category: 'WEIGHT' });
    expect(dup.status).toBe(409);

    const u2 = await request(app)
      .post('/api/v1/master-data/uoms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_G', name: 'Test Gram', symbol: 'tg', category: 'WEIGHT', decimalPlaces: 2 });
    expect(u2.status).toBe(201);
    createdIds.uomIds.push(u2.body.data.id);

    const uVol = await request(app)
      .post('/api/v1/master-data/uoms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_L', name: 'Test Litre', symbol: 'tl', category: 'VOLUME', isBaseUnit: true });
    expect(uVol.status).toBe(201);
    createdIds.uomIds.push(uVol.body.data.id);

    // Self-conversion rejected
    const selfConv = await request(app)
      .post('/api/v1/master-data/unit-conversions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ fromUomId: u1.body.data.id, toUomId: u1.body.data.id, multiplier: '1' });
    expect(selfConv.status).toBe(400);

    // Incompatible dimension conversion rejected
    const incompat = await request(app)
      .post('/api/v1/master-data/unit-conversions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ fromUomId: u1.body.data.id, toUomId: uVol.body.data.id, multiplier: '1' });
    expect(incompat.status).toBe(400);

    // Valid conversion: 1 T_KG = 1000 T_G
    const conv = await request(app)
      .post('/api/v1/master-data/unit-conversions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ fromUomId: u1.body.data.id, toUomId: u2.body.data.id, multiplier: '1000.000000' });
    expect(conv.status).toBe(201);
    createdIds.unitConversionIds.push(conv.body.data.id);

    // Exact decimal calculation: 0.1 + 0.2 style precision test (1.2345 * 1000 = 1234.5)
    const calc = await request(app)
      .post('/api/v1/master-data/unit-conversions/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ fromUomId: u1.body.data.id, toUomId: u2.body.data.id, quantity: '1.2345' });
    expect(calc.status).toBe(200);
    expect(calc.body.data.convertedQuantity).toBe('1234.5');
  });

  it('3. Tax Rates & Tax Configurations validate splits and prevent overlapping HSN configs', async () => {
    // Invalid CGST+SGST split rejected
    const badTax = await request(app)
      .post('/api/v1/master-data/tax-rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        code: 'T_BAD',
        name: 'Bad Tax',
        ratePercentage: '18.00',
        cgstPercentage: '5.00',
        sgstPercentage: '5.00',
        igstPercentage: '18.00',
      });
    expect(badTax.status).toBe(400);

    const taxRes = await request(app)
      .post('/api/v1/master-data/tax-rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        code: 'T_GST5',
        name: 'Test GST 5%',
        ratePercentage: '5.00',
        cgstPercentage: '2.50',
        sgstPercentage: '2.50',
        igstPercentage: '5.00',
      });
    expect(taxRes.status).toBe(201);
    createdIds.taxRateIds.push(taxRes.body.data.id);

    const cfg1 = await request(app)
      .post('/api/v1/master-data/tax-configurations')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        hsnCode: '99990001',
        taxRateId: taxRes.body.data.id,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      });
    expect(cfg1.status).toBe(201);
    createdIds.taxConfigIds.push(cfg1.body.data.id);

    // Overlapping HSN configuration rejected with 409
    const cfgOverlap = await request(app)
      .post('/api/v1/master-data/tax-configurations')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        hsnCode: '99990001',
        taxRateId: taxRes.body.data.id,
        effectiveFrom: '2026-06-01',
      });
    expect(cfgOverlap.status).toBe(409);
  });

  it('4. Raw Materials, Products, Variants, and BOM Versioning (with immutability & circular check)', async () => {
    const uomId = createdIds.uomIds[0];
    const taxRateId = createdIds.taxRateIds[0];

    // Raw Material Category & Raw Material
    const rmCat = await request(app)
      .post('/api/v1/master-data/raw-material-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_FLOUR', name: 'Test Flours' });
    expect(rmCat.status).toBe(201);
    createdIds.rawMaterialCatIds.push(rmCat.body.data.id);

    const rm = await request(app)
      .post('/api/v1/master-data/raw-materials')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        categoryId: rmCat.body.data.id,
        code: 'T_RM_RICE',
        name: 'Test Rice Flour',
        materialType: 'RAW_INGREDIENT',
        uomId,
        hsnCode: '110290',
        taxRateId,
      });
    expect(rm.status).toBe(201);
    createdIds.rawMaterialIds.push(rm.body.data.id);
    const rmInvItemId = rm.body.data.inventoryItem.id;
    expect(rmInvItemId).toBeTruthy();

    // Product Category, Product, Variant
    const pCat = await request(app)
      .post('/api/v1/master-data/product-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_SNACKS', name: 'Test Snacks' });
    expect(pCat.status).toBe(201);
    createdIds.productCatIds.push(pCat.body.data.id);

    const prod = await request(app)
      .post('/api/v1/master-data/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        categoryId: pCat.body.data.id,
        code: 'T_PRD_MUR',
        name: 'Test Murukku',
        baseUomId: uomId,
        hsnCode: '21069099',
        taxRateId,
      });
    expect(prod.status).toBe(201);
    createdIds.productIds.push(prod.body.data.id);

    const variant = await request(app)
      .post('/api/v1/master-data/product-variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        productId: prod.body.data.id,
        sku: 'T_SKU_MUR_200',
        name: 'Test Murukku 200g',
        netWeightGrams: '200.00',
        uomId,
        defaultSellingPrice: '50.00',
      });
    expect(variant.status).toBe(201);
    createdIds.variantIds.push(variant.body.data.id);
    const variantInvItemId = variant.body.data.inventoryItem.id;

    // Circular BOM rejected (variant referencing itself)
    const circularBom = await request(app)
      .post('/api/v1/master-data/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        productVariantId: variant.body.data.id,
        code: 'T_BOM_CIRC',
        name: 'Circular BOM',
        baseOutputQuantity: '100',
        outputUomId: uomId,
        initialVersion: {
          expectedGoodOutput: '100',
          outputUomId: uomId,
          items: [{ inventoryItemId: variantInvItemId, standardQuantity: '1', uomId }],
        },
      });
    expect(circularBom.status).toBe(400);

    // Valid BOM with v1 DRAFT
    const bom = await request(app)
      .post('/api/v1/master-data/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        productVariantId: variant.body.data.id,
        code: 'T_BOM_MUR',
        name: 'Test Murukku Recipe',
        baseOutputQuantity: '100',
        outputUomId: uomId,
        initialVersion: {
          expectedGoodOutput: '98',
          outputUomId: uomId,
          items: [{ inventoryItemId: rmInvItemId, standardQuantity: '25', uomId }],
          overheads: [{ costType: 'LABOUR', description: 'Mixing & Frying', standardAmount: '500' }],
        },
      });
    expect(bom.status).toBe(201);
    createdIds.bomIds.push(bom.body.data.id);
    const v1Id = bom.body.data.versions[0].id;

    // Activate v1
    const act1 = await request(app)
      .post(`/api/v1/master-data/boms/${bom.body.data.id}/versions/${v1Id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(act1.status).toBe(200);
    expect(act1.body.data.status).toBe('ACTIVE');

    // Attempt to overwrite ACTIVE v1 -> rejected with 400
    const editActive = await request(app)
      .patch(`/api/v1/master-data/boms/${bom.body.data.id}/versions/${v1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '99',
        outputUomId: uomId,
        items: [{ inventoryItemId: rmInvItemId, standardQuantity: '26', uomId }],
      });
    expect(editActive.status).toBe(400);

    // Create v2 and activate it -> v1 becomes OBSOLETE, v2 becomes ACTIVE
    const v2 = await request(app)
      .post(`/api/v1/master-data/boms/${bom.body.data.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        expectedGoodOutput: '99',
        outputUomId: uomId,
        items: [{ inventoryItemId: rmInvItemId, standardQuantity: '24', uomId }],
      });
    expect(v2.status).toBe(201);
    expect(v2.body.data.versionNumber).toBe(2);

    const act2 = await request(app)
      .post(`/api/v1/master-data/boms/${bom.body.data.id}/versions/${v2.body.data.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({});
    expect(act2.status).toBe(200);

    const bomDetail = await request(app)
      .get(`/api/v1/master-data/boms/${bom.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const v1After = bomDetail.body.data.versions.find((v: { id: string }) => v.id === v1Id);
    expect(v1After.status).toBe('OBSOLETE');
  });

  it('5. Suppliers, Customers, RBAC (AUDITOR read-only, SALESMAN), Warehouse Scoping & Audit Logs', async () => {
    // AUDITOR can read products
    const audRead = await request(app)
      .get('/api/v1/master-data/products')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(audRead.status).toBe(200);

    // AUDITOR cannot create supplier
    const audWrite = await request(app)
      .post('/api/v1/master-data/suppliers')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ code: 'T_SUP_AUD', legalName: 'Blocked Supplier' });
    expect(audWrite.status).toBe(403);

    // ADMIN creates supplier
    const sup = await request(app)
      .post('/api/v1/master-data/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ code: 'T_SUP_01', legalName: 'Test Agro Suppliers' });
    expect(sup.status).toBe(201);
    createdIds.supplierIds.push(sup.body.data.id);

    // SALESMAN can create customer, but cannot create supplier
    const salesSup = await request(app)
      .post('/api/v1/master-data/suppliers')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({ code: 'T_SUP_FAIL', legalName: 'Nope' });
    expect(salesSup.status).toBe(403);

    const salesCust = await request(app)
      .post('/api/v1/master-data/customers')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({ code: 'T_CUST_01', legalName: 'Test Mart', customerType: 'RETAILER' });
    expect(salesCust.status).toBe(201);
    createdIds.customerIds.push(salesCust.body.data.id);

    // Warehouse scoping for PRODUCTION user (only assigned to WH-RM-01)
    const whList = await request(app)
      .get('/api/v1/master-data/warehouses')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(whList.status).toBe(200);
    expect(whList.body.data.items.length).toBe(1);
    expect(whList.body.data.items[0].id).toBe(whRMId);

    const whRmGet = await request(app)
      .get(`/api/v1/master-data/warehouses/${whRMId}`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(whRmGet.status).toBe(200);

    const whFgGet = await request(app)
      .get(`/api/v1/master-data/warehouses/${whFGId}`)
      .set('Authorization', `Bearer ${productionToken}`);
    expect(whFgGet.status).toBe(403);

    // ADMIN can create a warehouse
    const whNew = await request(app)
      .post('/api/v1/master-data/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        factoryId,
        code: 'T_WH_99',
        name: 'Test Temp Warehouse',
        warehouseType: 'GENERAL',
      });
    expect(whNew.status).toBe(201);
    createdIds.warehouseIds.push(whNew.body.data.id);

    // Verify AuditLog captured master data operations
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: 'Supplier', entityId: sup.body.data.id, action: 'CREATE' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry!.userId).toBe(adminUserId);
  });
});
