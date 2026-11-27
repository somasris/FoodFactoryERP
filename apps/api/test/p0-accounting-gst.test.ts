import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('P0 Accounting & GST Remediation + Exact Section 7 Benchmark', () => {
  const suf = `P0${Date.now().toString().slice(-6)}`;

  let ownerToken: string;
  let adminToken: string;
  let salesmanToken: string;
  let productionToken: string;
  let auditorToken: string;

  const userIds: string[] = [];
  let companyId: string;
  let factoryId: string;
  let rmWhId: string;
  let fgWhId: string;
  let uomKgId: string;
  let uomLId: string;
  let uomPcsId: string;
  let taxRate5Id: string;
  let rmCatId: string;
  let prodCatId: string;
  let supplierId: string;
  let custAId: string;
  let custBId: string;
  let productId: string;
  let variantId: string;
  let bomId: string;

  const itemIds: string[] = [];
  const rmIds: string[] = [];
  let receiptFlourId: string;
  let woId: string;
  let batchId: string;
  let invoiceAId: string;
  let invoiceA2Id: string;

  async function createRoleUser(roleCode: string, uname: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const perms = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    // Ensure new P0 permissions exist in DB even if seed hasn't been re-run
    const p0Perms = [
      'sales.payments.read',
      'sales.payments.create',
      'sales.payments.allocate',
      'sales.payments.reverse',
      'sales.credit_notes.read',
      'sales.credit_notes.create',
      'sales.credit_notes.issue',
      'sales.credit_notes.cancel',
      'sales.credit_notes.download',
      'purchases.invoices.read',
      'purchases.invoices.create',
      'purchases.invoices.update',
      'purchases.invoices.post',
      'purchases.invoices.cancel',
      'purchases.invoices.match',
    ];
    for (const code of p0Perms) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          module: code.split('.')[0],
          action: code.split('.').pop()!.toUpperCase(),
          description: code,
        },
      });
      const shouldGrant =
        roleCode === 'OWNER' ||
        roleCode === 'ADMIN' ||
        (roleCode === 'SALESMAN' &&
          [
            'sales.payments.read',
            'sales.payments.create',
            'sales.payments.allocate',
            'sales.credit_notes.read',
            'sales.credit_notes.download',
          ].includes(code)) ||
        (roleCode === 'AUDITOR' &&
          [
            'sales.payments.read',
            'sales.credit_notes.read',
            'sales.credit_notes.download',
            'purchases.invoices.read',
          ].includes(code));
      if (shouldGrant) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
          update: {},
          create: { roleId: role.id, permissionId: p.id },
        });
      }
    }

    const roleAllowed = new Set(perms.map(p => p.permission.code));
    if (roleCode === 'OWNER' || roleCode === 'ADMIN') {
      p0Perms.forEach(c => roleAllowed.add(c));
    } else if (roleCode === 'SALESMAN') {
      [
        'sales.payments.read',
        'sales.payments.create',
        'sales.payments.allocate',
        'sales.credit_notes.read',
        'sales.credit_notes.download',
      ].forEach(c => roleAllowed.add(c));
    } else if (roleCode === 'AUDITOR') {
      [
        'sales.payments.read',
        'sales.credit_notes.read',
        'sales.credit_notes.download',
        'purchases.invoices.read',
      ].forEach(c => roleAllowed.add(c));
    }

    const user = await prisma.user.create({
      data: {
        email: `${uname}@test.local`,
        username: uname,
        passwordHash: await hashPassword('Test@1234'),
        fullName: uname,
        registrationStatus: 'APPROVED',
        isActive: true,
        companyId,
        userRoles: { create: { roleId: role.id } },
      },
    });
    userIds.push(user.id);

    return generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [roleCode],
      permissions: Array.from(roleAllowed),
    });
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        code: `CMP-${suf}`,
        legalName: `Benchmark Foods ${suf}`,
        gstin: `33AABCB${suf.slice(-4)}1Z5`,
        pan: `AABCB${suf.slice(-4)}F`,
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Trichy, Tamil Nadu',
      },
    });
    companyId = company.id;

    const factory = await prisma.factory.create({
      data: {
        companyId,
        code: `FAC-${suf}`,
        name: `Trichy Plant ${suf}`,
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Trichy, Tamil Nadu',
      },
    });
    factoryId = factory.id;

    const rmWh = await prisma.warehouse.create({
      data: { factoryId, code: `RMWH-${suf}`, name: 'RM Store', warehouseType: 'RAW_MATERIAL' },
    });
    rmWhId = rmWh.id;

    const fgWh = await prisma.warehouse.create({
      data: { factoryId, code: `FGWH-${suf}`, name: 'FG Store', warehouseType: 'FINISHED_GOODS' },
    });
    fgWhId = fgWh.id;

    ownerToken = await createRoleUser('OWNER', `p0_owner_${suf}`);
    adminToken = await createRoleUser('ADMIN', `p0_admin_${suf}`);
    salesmanToken = await createRoleUser('SALESMAN', `p0_sales_${suf}`);
    productionToken = await createRoleUser('PRODUCTION', `p0_prod_${suf}`);
    auditorToken = await createRoleUser('AUDITOR', `p0_auditor_${suf}`);

    for (const uid of userIds) {
      await prisma.userWarehouseAccess.createMany({
        data: [
          { userId: uid, warehouseId: rmWhId, accessLevel: 'READ_WRITE' },
          { userId: uid, warehouseId: fgWhId, accessLevel: 'READ_WRITE' },
        ],
      });
    }

    const uomKg = await prisma.unitOfMeasure.create({
      data: { code: `KG${suf.slice(-4)}`, name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBaseUnit: true },
    });
    uomKgId = uomKg.id;
    const uomL = await prisma.unitOfMeasure.create({
      data: { code: `L${suf.slice(-4)}`, name: 'Litre', symbol: 'L', category: 'VOLUME', isBaseUnit: true },
    });
    uomLId = uomL.id;
    const uomPcs = await prisma.unitOfMeasure.create({
      data: { code: `PC${suf.slice(-4)}`, name: 'Pieces', symbol: 'pcs', category: 'COUNT', isBaseUnit: true },
    });
    uomPcsId = uomPcs.id;

    const tax5 = await prisma.taxRate.create({
      data: {
        code: `GST5-${suf}`,
        name: 'GST 5%',
        ratePercentage: new Prisma.Decimal('5.00'),
        cgstPercentage: new Prisma.Decimal('2.50'),
        sgstPercentage: new Prisma.Decimal('2.50'),
        igstPercentage: new Prisma.Decimal('5.00'),
      },
    });
    taxRate5Id = tax5.id;

    const rmCat = await prisma.rawMaterialCategory.create({
      data: { code: `RMC-${suf}`, name: 'RM Category' },
    });
    rmCatId = rmCat.id;

    const prodCat = await prisma.productCategory.create({
      data: { code: `PRC-${suf}`, name: 'Savouries' },
    });
    prodCatId = prodCat.id;

    const sup = await prisma.supplier.create({
      data: {
        code: `SUP-${suf}`,
        legalName: 'Cauvery Flour Mills',
        gstin: `33AAACC${suf.slice(-4)}1Z2`,
        addresses: {
          create: {
            addressType: 'OFFICE',
            addressLine1: '1 Mill Rd',
            city: 'Trichy',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '620001',
            isDefault: true,
          },
        },
      },
    });
    supplierId = sup.id;

    const custA = await prisma.customer.create({
      data: {
        code: `CA-${suf}`,
        legalName: 'Retailer A',
        customerType: 'RETAILER',
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '12 Bazaar St',
            city: 'Madurai',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '625001',
            isDefault: true,
          },
        },
      },
    });
    custAId = custA.id;

    const custB = await prisma.customer.create({
      data: {
        code: `CB-${suf}`,
        legalName: 'Distributor B',
        customerType: 'DISTRIBUTOR',
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '45 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: '29',
            pincode: '560001',
            isDefault: true,
          },
        },
      },
    });
    custBId = custB.id;
  });

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { customerId: { in: [custAId, custBId].filter(Boolean) } } },
    });
    await prisma.customerPayment.deleteMany({
      where: { customerId: { in: [custAId, custBId].filter(Boolean) } },
    });
    await prisma.creditNote.deleteMany({
      where: { customerId: { in: [custAId, custBId].filter(Boolean) } },
    });
    await prisma.supplierInvoiceReceiptMatch.deleteMany({
      where: { supplierInvoice: { supplierId } },
    });
    await prisma.supplierInvoice.deleteMany({ where: { supplierId } });
    await prisma.salesInvoice.deleteMany({
      where: { customerId: { in: [custAId, custBId].filter(Boolean) } },
    });
    await prisma.salesOrder.deleteMany({
      where: { customerId: { in: [custAId, custBId].filter(Boolean) } },
    });
    if (batchId) {
      await prisma.productionBatchCosting.deleteMany({ where: { productionBatchId: batchId } });
      await prisma.productionBatch.deleteMany({ where: { id: batchId } });
    }
    if (woId) await prisma.workOrder.deleteMany({ where: { id: woId } });
    if (rmWhId || fgWhId) {
      await prisma.productionPlan.deleteMany({
        where: { warehouseId: { in: [rmWhId, fgWhId].filter(Boolean) } },
      });
    }
    if (bomId) await prisma.bOM.deleteMany({ where: { id: bomId } });
    if (itemIds.length > 0) {
      await prisma.inventoryTransactionLine.deleteMany({
        where: { inventoryItemId: { in: itemIds } },
      });
      await prisma.inventoryTransaction.deleteMany({
        where: { warehouseId: { in: [rmWhId, fgWhId].filter(Boolean) } },
      });
      await prisma.inventoryReceipt.deleteMany({ where: { warehouseId: { in: [rmWhId, fgWhId] } } });
      await prisma.inventoryIssue.deleteMany({ where: { warehouseId: { in: [rmWhId, fgWhId] } } });
      await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    }
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (rmIds.length > 0) await prisma.rawMaterial.deleteMany({ where: { id: { in: rmIds } } });
    if (custAId || custBId) {
      await prisma.customer.deleteMany({ where: { id: { in: [custAId, custBId].filter(Boolean) } } });
    }
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    if (prodCatId) await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    if (rmCatId) await prisma.rawMaterialCategory.deleteMany({ where: { id: rmCatId } });
    if (taxRate5Id) await prisma.taxRate.deleteMany({ where: { id: taxRate5Id } });
    await prisma.unitOfMeasure.deleteMany({
      where: { id: { in: [uomKgId, uomLId, uomPcsId].filter(Boolean) } },
    });
    await prisma.userWarehouseAccess.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (rmWhId || fgWhId) {
      await prisma.warehouse.deleteMany({ where: { id: { in: [rmWhId, fgWhId].filter(Boolean) } } });
    }
    if (factoryId) await prisma.factory.deleteMany({ where: { id: factoryId } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
  });

  async function makeRm(code: string, name: string, uomId: string, rate: string) {
    const rm = await prisma.rawMaterial.create({
      data: {
        category: { connect: { id: rmCatId } },
        code: `${code}-${suf}`,
        name,
        materialType: 'RAW_INGREDIENT',
        uom: { connect: { id: uomId } },
        hsnCode: '1101',
        taxRate: { connect: { id: taxRate5Id } },
      },
    });
    rmIds.push(rm.id);
    const item = await prisma.inventoryItem.create({
      data: {
        code: `${code}-${suf}`,
        name,
        itemType: 'RAW_MATERIAL',
        rawMaterialId: rm.id,
        uomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal(rate),
      },
    });
    itemIds.push(item.id);
    return item;
  }

  async function postReceipt(
    whId: string,
    itemId: string,
    uomId: string,
    qty: string,
    cost: string,
    key: string,
  ) {
    const cr = await request(app)
      .post('/api/v1/inventory/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        warehouseId: whId,
        idempotencyKey: key,
        lines: [{ inventoryItemId: itemId, uomId, quantity: qty, unitCost: cost, batchNumber: `LOT-${key}` }],
      });
    expect(cr.status).toBe(201);
    const rid = cr.body.data.id;
    await request(app).post(`/api/v1/inventory/receipts/${rid}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/inventory/receipts/${rid}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const post = await request(app).post(`/api/v1/inventory/receipts/${rid}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    expect(post.status).toBe(200);
    return rid as string;
  }

  it('1. Executes exact Section 7 Murukku 200 g Benchmark + P0.1 Payment + P0.3 Supplier Invoice', async () => {
    const flour = await makeRm('FLR', 'Flour', uomKgId, '42');
    const oil = await makeRm('OIL', 'Cooking Oil', uomLId, '140');
    const spice = await makeRm('SPC', 'Salt and Spice Mix', uomKgId, '200');
    const pouch = await makeRm('PCH', '200 g Pouch', uomPcsId, '2.50');
    const carton = await makeRm('CTN', 'Carton', uomPcsId, '15');

    const prod = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `MUR-${suf}`,
        name: 'Murukku 200 g',
        baseUomId: uomPcsId,
        hsnCode: '21069099',
        taxRateId: taxRate5Id,
      },
    });
    productId = prod.id;
    const variant = await prisma.productVariant.create({
      data: {
        productId: prod.id,
        sku: `MUR200-${suf}`,
        name: '200 g Packet',
        netWeightGrams: new Prisma.Decimal('200'),
        uomId: uomPcsId,
        defaultSellingPrice: new Prisma.Decimal('50.00'),
      },
    });
    variantId = variant.id;
    const fgItem = await prisma.inventoryItem.create({
      data: {
        code: `MUR200-${suf}`,
        name: 'Murukku 200 g - 200g Packet',
        itemType: 'FINISHED_GOODS',
        productVariantId: variant.id,
        uomId: uomPcsId,
        valuationMethod: 'MWAC',
      },
    });
    itemIds.push(fgItem.id);

    // 1. Opening stocks
    await postReceipt(rmWhId, flour.id, uomKgId, '100', '42', `op-flr-${suf}`);
    await postReceipt(rmWhId, oil.id, uomLId, '30', '140', `op-oil-${suf}`);
    await postReceipt(rmWhId, spice.id, uomKgId, '5', '200', `op-spc-${suf}`);
    await postReceipt(rmWhId, pouch.id, uomPcsId, '500', '2.50', `op-pch-${suf}`);
    await postReceipt(rmWhId, carton.id, uomPcsId, '30', '15', `op-ctn-${suf}`);
    await postReceipt(fgWhId, fgItem.id, uomPcsId, '50', '30', `op-fg-${suf}`);

    // 2. Flour purchase: 60 kg @ Rs 45/kg
    receiptFlourId = await postReceipt(rmWhId, flour.id, uomKgId, '60', '45', `pur-flr-${suf}`);

    // 3. BOM & Batch 1 (200 expected packets)
    const bomRes = await request(app)
      .post('/api/v1/production/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        productVariantId: variant.id,
        code: `BOM-${suf}`,
        name: 'Murukku 200 g BOM',
        baseOutputQuantity: '200',
        outputUomId: uomPcsId,
        initialVersion: {
          expectedGoodOutput: '200',
          yieldPercentage: '94.00',
          expectedWastagePercent: '6.00',
          outputUomId: uomPcsId,
          items: [
            { inventoryItemId: flour.id, uomId: uomKgId, standardQuantity: '40' },
            { inventoryItemId: oil.id, uomId: uomLId, standardQuantity: '10' },
            { inventoryItemId: spice.id, uomId: uomKgId, standardQuantity: '1.2' },
            { inventoryItemId: pouch.id, uomId: uomPcsId, standardQuantity: '194' },
            { inventoryItemId: carton.id, uomId: uomPcsId, standardQuantity: '9' },
          ],
        },
      });
    expect(bomRes.status).toBe(201);
    const bom = bomRes.body.data;
    bomId = bom.id;
    const bomVersionId = bom.versions[0].id;

    const plan = await prisma.productionPlan.create({
      data: {
        planNumber: `PP-${suf}`,
        name: 'Murukku Benchmark Plan',
        warehouseId: fgWhId,
        planDate: new Date(),
        status: 'RELEASED',
        createdById: userIds[0],
        items: {
          create: {
            lineNumber: 1,
            productVariantId: variant.id,
            inventoryItemId: fgItem.id,
            bomId: bom.id,
            bomVersionId,
            uomId: uomPcsId,
            demandQuantity: new Prisma.Decimal('200'),
            availableFgQuantity: new Prisma.Decimal('50'),
            existingPlannedQuantity: new Prisma.Decimal('0'),
            netRequirementQuantity: new Prisma.Decimal('200'),
            plannedQuantity: new Prisma.Decimal('200'),
            workOrderedQuantity: new Prisma.Decimal('200'),
            yieldPercentage: new Prisma.Decimal('94'),
            expectedWastagePercent: new Prisma.Decimal('6'),
            estimatedMaterialCost: new Prisma.Decimal('0'),
            estimatedOverheadCost: new Prisma.Decimal('0'),
            estimatedTotalCost: new Prisma.Decimal('0'),
          },
        },
      },
      include: { items: true },
    });

    const wo = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-${suf}`,
        financialYear: '2026-27',
        warehouseId: fgWhId,
        productVariantId: variant.id,
        inventoryItemId: fgItem.id,
        bomId: bom.id,
        bomVersionId,
        productionPlanId: plan.id,
        productionPlanItemId: plan.items[0].id,
        plannedQuantity: new Prisma.Decimal('200'),
        uomId: uomPcsId,
        status: 'RELEASED',
        createdById: userIds[0],
      },
    });
    woId = wo.id;

    const batchRes = await request(app)
      .post('/api/v1/production/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        workOrderId: wo.id,
        plannedQuantity: '200',
      });
    expect(batchRes.status).toBe(201);
    batchId = batchRes.body.data.id;
    await request(app).post(`/api/v1/production/batches/${batchId}/start`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);

    // Issue RM + Packaging
    const cRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/consume`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        lines: [
          { inventoryItemId: flour.id, warehouseId: rmWhId, uomId: uomKgId, quantity: '40' },
          { inventoryItemId: oil.id, warehouseId: rmWhId, uomId: uomLId, quantity: '10.5' },
          { inventoryItemId: spice.id, warehouseId: rmWhId, uomId: uomKgId, quantity: '1.2' },
          { inventoryItemId: pouch.id, warehouseId: rmWhId, uomId: uomPcsId, quantity: '194' },
          { inventoryItemId: carton.id, warehouseId: rmWhId, uomId: uomPcsId, quantity: '9' },
        ],
      });
    expect(cRes.status).toBe(200);

    // Record output (188 good + 6 damaged pouches) -> inspect ACCEPTED (posts FG to fgWhId)
    const outRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/output`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        goodQuantity: '188',
        rejectedQuantity: '0',
        wastageQuantity: '12',
        wastageReason: '6 damaged pouches and frying loss',
      });
    expect(outRes.status).toBe(200);
    // Complete batch (188 good packets) -> inspect ACCEPTED (releases FG in fgWhId for Sales Orders)
    const compRes = await request(app)
      .post(`/api/v1/production/batches/${batchId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ goodQuantity: '188', manufacturingDate: '2026-11-27' });
    expect(compRes.status).toBe(200);
    const qiId = compRes.body.data.qualityInspection.id;
    const inspRes = await request(app)
      .post(`/api/v1/production/quality-inspections/${qiId}/inspect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ decision: 'ACCEPTED', notes: 'Approved Murukku 200g batch' });
    expect(inspRes.status).toBe(200);

    // Verify exact stock balances after production
    const getBal = async (itemId: string, whId: string) => {
      const agg = await prisma.inventoryBalance.aggregate({
        where: { inventoryItemId: itemId, warehouseId: whId },
        _sum: { quantityOnHand: true },
      });
      return Number(agg._sum.quantityOnHand ?? 0);
    };
    expect(await getBal(flour.id, rmWhId)).toBe(120); // 100 + 60 - 40
    expect(await getBal(oil.id, rmWhId)).toBe(19.5); // 30 - 10.5
    expect(await getBal(spice.id, rmWhId)).toBe(3.8); // 5 - 1.2
    expect(await getBal(pouch.id, rmWhId)).toBe(306); // 500 - 188 - 6
    expect(await getBal(carton.id, rmWhId)).toBe(21); // 30 - 9
    expect(await getBal(fgItem.id, fgWhId)).toBe(238); // 50 + 188

    // Expenses: Labour 1200 + Gas/Power 600
    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ entryType: 'DIRECT_LABOUR', description: 'Labour', quantityOrHours: '1', rate: '1200' });
    await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ entryType: 'OTHER_DIRECT_EXPENSE', description: 'Gas/Power', quantityOrHours: '1', rate: '600' });
    const costRes = await request(app)
      .post(`/api/v1/production/costing/batches/${batchId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ includeBomOverheads: false });
    expect(costRes.status).toBe(200);
    expect(Number(costRes.body.data.totalActualCost)).toBe(5855); // 4055 + 1200 + 600

    // Retailer A: 150 packets
    const soA = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: custAId,
        warehouseId: fgWhId,
        lines: [{ productVariantId: variant.id, uomId: uomPcsId, orderedQuantity: '150' }],
      });
    expect(soA.status).toBe(201);
    const soAId = soA.body.data.id;
    const soALineId = soA.body.data.lines[0].id;
    await request(app).post(`/api/v1/sales/orders/${soAId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${soAId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${soAId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({ idempotencyKey: `ca-${suf}` });
    await request(app).post(`/api/v1/sales/orders/${soAId}/fulfill`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({
      idempotencyKey: `fa-${suf}`,
      lines: [{ salesOrderLineId: soALineId, quantity: '150' }],
    });
    expect(await getBal(fgItem.id, fgWhId)).toBe(88); // 238 - 150

    const invCR = await request(app)
      .post(`/api/v1/sales/orders/${soAId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ idempotencyKey: `inva-${suf}` });
    expect(invCR.status).toBe(201);
    invoiceAId = invCR.body.data.id;
    const invIss = await request(app).post(`/api/v1/sales/invoices/${invoiceAId}/issue`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    expect(invIss.status).toBe(200);
    expect(Number(invIss.body.data.taxableAmount)).toBe(7500);
    expect(Number(invIss.body.data.cgstAmount)).toBe(187.5);
    expect(Number(invIss.body.data.sgstAmount)).toBe(187.5);
    expect(Number(invIss.body.data.igstAmount)).toBe(0);
    expect(Number(invIss.body.data.grandTotal)).toBe(7875);

    // Distributor B: 120 packets -> blocked (88 available, short by 32)
    const soB = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: custBId,
        warehouseId: fgWhId,
        lines: [{ productVariantId: variant.id, uomId: uomPcsId, orderedQuantity: '120' }],
      });
    const soBId = soB.body.data.id;
    await request(app).post(`/api/v1/sales/orders/${soBId}/submit`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    await request(app).post(`/api/v1/sales/orders/${soBId}/approve`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const confB = await request(app).post(`/api/v1/sales/orders/${soBId}/confirm`).set('Authorization', `Bearer ${adminToken}`).set(CSRF).send({ idempotencyKey: `cb-${suf}` });
    expect(confB.status).toBe(400);
    expect(confB.body.message).toMatch(/Short by 32/i);

    // Retailer A Payment: Rs 4,000 -> Outstanding becomes Rs 3,875
    const payRes = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .set(CSRF)
      .send({
        customerId: custAId,
        amount: '4000',
        paymentMode: 'BANK_TRANSFER',
        transactionReference: `UTR-${suf}`,
        idempotencyKey: `pay-${suf}`,
        allocations: [{ salesInvoiceId: invoiceAId, allocatedAmount: '4000' }],
      });
    expect(payRes.status).toBe(201);

    const outStand = await request(app)
      .get(`/api/v1/sales/customers/${custAId}/outstanding`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(outStand.status).toBe(200);
    expect(outStand.body.data.outstandingAmount).toBe('3875.00');

    // Supplier Flour Invoice (60 kg @ 45, 5% GST) -> Post -> Match to flour receipt -> Verify Purchase Register
    const sinvRes = await request(app)
      .post('/api/v1/purchases/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        supplierId,
        factoryId,
        supplierInvoiceNumber: `CFM-${suf}`,
        invoiceDate: '2026-11-27',
        lines: [{ inventoryItemId: flour.id, uomId: uomKgId, quantity: '60', unitPrice: '45', taxRatePercent: '5' }],
      });
    expect(sinvRes.status).toBe(201);
    const sinvId = sinvRes.body.data.id;
    await request(app).post(`/api/v1/purchases/invoices/${sinvId}/post`).set('Authorization', `Bearer ${adminToken}`).set(CSRF);
    const matchRes = await request(app)
      .post(`/api/v1/purchases/invoices/${sinvId}/match-receipts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ receiptIds: [receiptFlourId] });
    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.matchingStatus).toBe('MATCHED');

    const regRes = await request(app)
      .get(`/api/v1/purchases/register?supplierId=${supplierId}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(regRes.status).toBe(200);
    expect(regRes.body.data.invoiceCount).toBe(1);
    expect(regRes.body.data.totals.taxableValue).toBe('2700.00');
    expect(regRes.body.data.totals.taxAmount).toBe('135.00');
  });

  it('2. Enforces Payment validation, cross-customer rejection, reversal, ageing, and RBAC', async () => {
    // PRODUCTION cannot read or create payments
    const prodDeny = await request(app).get('/api/v1/sales/payments').set('Authorization', `Bearer ${productionToken}`);
    expect(prodDeny.status).toBe(403);

    // AUDITOR is read-only (cannot create or reverse payments)
    const audCreate = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set(CSRF)
      .send({ customerId: custAId, amount: '100', paymentMode: 'CASH' });
    expect(audCreate.status).toBe(403);

    // Cross-customer allocation rejected
    const payB = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ customerId: custBId, amount: '500', paymentMode: 'UPI' });
    expect(payB.status).toBe(201);
    const crossAlloc = await request(app)
      .post(`/api/v1/sales/payments/${payB.body.data.id}/allocate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ allocations: [{ salesInvoiceId: invoiceAId, allocatedAmount: '100' }] });
    expect(crossAlloc.status).toBe(400);

    // Reversal updates invoice outstanding back properly
    const payRev = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: custAId,
        amount: '1000',
        paymentMode: 'CASH',
        allocations: [{ salesInvoiceId: invoiceAId, allocatedAmount: '1000' }],
      });
    expect(payRev.status).toBe(201);
    const revRes = await request(app)
      .post(`/api/v1/sales/payments/${payRev.body.data.id}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set(CSRF)
      .send({ reason: 'Cheque bounced' });
    expect(revRes.status).toBe(200);
    expect(revRes.body.data.status).toBe('REVERSED');

    const ageingRes = await request(app)
      .get('/api/v1/sales/ageing')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(ageingRes.status).toBe(200);
    expect(Number(ageingRes.body.data.bucketTotals.totalOutstanding)).toBeGreaterThanOrEqual(3875);
  });

  it('3. Enforces Credit Note lifecycle, Scenarios A/B/C, over-credit block, and PDF generation', async () => {
    const invRes = await request(app).get(`/api/v1/sales/invoices/${invoiceAId}`).set('Authorization', `Bearer ${adminToken}`);
    const lineId = invRes.body.data.lines[0].id;

    // Direct cancel of ISSUED invoice blocked
    const directCancel = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceAId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Direct cancel attempt' });
    expect(directCancel.status).toBe(400);

    // Over-crediting (> 150 packets) blocked
    const overCn = await request(app)
      .post('/api/v1/sales/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        salesInvoiceId: invoiceAId,
        reason: 'Too many packets',
        lines: [{ originalInvoiceLineId: lineId, quantity: '151' }],
      });
    expect(overCn.status).toBe(400);

    // Scenario B/C: Issue Credit Note for 80 packets (4000 taxable + 200 GST = 4200) -> 4000 paid + 4200 CN > 7875 -> excessCredit = 325.00
    const cnDraft = await request(app)
      .post('/api/v1/sales/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        salesInvoiceId: invoiceAId,
        reason: 'Quality allowance',
        lines: [{ originalInvoiceLineId: lineId, quantity: '80' }],
      });
    expect(cnDraft.status).toBe(201);
    const cnId = cnDraft.body.data.id;

    const cnIssue = await request(app)
      .post(`/api/v1/sales/credit-notes/${cnId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF);
    expect(cnIssue.status).toBe(200);
    expect(cnIssue.body.data.status).toBe('ISSUED');

    const credBal = await request(app)
      .get(`/api/v1/sales/customers/${custAId}/credit-balance`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(credBal.status).toBe(200);
    expect(credBal.body.data.invoiceExcessCredits).toBe('325.00');

    const pdfRes = await request(app)
      .get(`/api/v1/sales/credit-notes/${cnId}/pdf`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(pdfRes.status).toBe(200);
    expect(Buffer.from(pdfRes.body).toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('4. Enforces Supplier Invoice duplicate check, ITC classification, and Compliance Purchase GST', async () => {
    // Duplicate supplier invoice number blocked
    const dupRes = await request(app)
      .post('/api/v1/purchases/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        supplierId,
        factoryId,
        supplierInvoiceNumber: `CFM-${suf}`,
        invoiceDate: '2026-11-27',
        lines: [{ inventoryItemId: itemIds[0], uomId: uomKgId, quantity: '10', unitPrice: '45', taxRatePercent: '5' }],
      });
    expect(dupRes.status).toBe(409);

    // PRODUCTION cannot access purchases
    const prodPurch = await request(app).get('/api/v1/purchases/invoices').set('Authorization', `Bearer ${productionToken}`);
    expect(prodPurch.status).toBe(403);

    // Compliance purchase summary reports purchaseInvoicingSupported: true
    const compPurch = await request(app)
      .get('/api/v1/compliance/gst/purchase-summary')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(compPurch.status).toBe(200);
    expect(compPurch.body.data.purchaseInvoicingSupported).toBe(true);
    expect(Number(compPurch.body.data.totals.purchaseGstRecorded)).toBeGreaterThanOrEqual(135);
  });
});
