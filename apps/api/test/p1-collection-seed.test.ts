import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma.service';
import { hashPassword } from '../src/utils/password';
import { generateAccessToken } from '../src/utils/token';
import { seedMurukkuBenchmarkProfile } from '../prisma/seed-murukku-benchmark';

const app = createApp();
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('P1.1 Collection Summary Report & P1.3 Benchmark Seed Profile', () => {
  const suf = `P1${Date.now().toString().slice(-6)}`;
  let adminToken: string;
  let auditorToken: string;
  let productionToken: string;

  const userIds: string[] = [];
  let companyId: string;
  let factoryId: string;
  let whId: string;
  let cust1Id: string;
  let cust2Id: string;
  let uomPcsId: string;
  let tax5Id: string;
  let prodCatId: string;
  let productId: string;
  let variantId: string;
  let invItemId: string;
  let inv1Id: string;
  let inv2Id: string;

  async function makeUser(roleCode: string, uname: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const perms = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
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
      permissions: perms.map(p => p.permission.code),
    });
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        code: `CMP-${suf}`,
        legalName: `P1 Foods ${suf}`,
        gstin: `33AABCP${suf.slice(-4)}1Z5`,
        pan: `AABCP${suf.slice(-4)}F`,
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Trichy',
      },
    });
    companyId = company.id;

    const factory = await prisma.factory.create({
      data: {
        companyId,
        code: `FAC-${suf}`,
        name: `P1 Plant ${suf}`,
        state: 'Tamil Nadu',
        stateCode: '33',
        address: 'Trichy',
      },
    });
    factoryId = factory.id;

    const wh = await prisma.warehouse.create({
      data: { factoryId, code: `WH-${suf}`, name: 'FG Store', warehouseType: 'FINISHED_GOODS' },
    });
    whId = wh.id;

    adminToken = await makeUser('ADMIN', `p1_adm_${suf}`);
    auditorToken = await makeUser('AUDITOR', `p1_aud_${suf}`);
    productionToken = await makeUser('PRODUCTION', `p1_prd_${suf}`);

    for (const uid of userIds) {
      await prisma.userWarehouseAccess.create({
        data: { userId: uid, warehouseId: whId, accessLevel: 'READ_WRITE' },
      });
    }

    const uom = await prisma.unitOfMeasure.create({
      data: { code: `U${suf.slice(-5)}`, name: 'Pieces', symbol: 'pcs', category: 'COUNT', isBaseUnit: true },
    });
    uomPcsId = uom.id;

    const tax = await prisma.taxRate.create({
      data: {
        code: `T5-${suf}`,
        name: 'GST 5%',
        ratePercentage: new Prisma.Decimal('5.00'),
        cgstPercentage: new Prisma.Decimal('2.50'),
        sgstPercentage: new Prisma.Decimal('2.50'),
        igstPercentage: new Prisma.Decimal('5.00'),
      },
    });
    tax5Id = tax.id;

    const pcat = await prisma.productCategory.create({
      data: { code: `PC-${suf}`, name: 'P1 Savouries' },
    });
    prodCatId = pcat.id;

    const prod = await prisma.product.create({
      data: {
        categoryId: prodCatId,
        code: `PR-${suf}`,
        name: 'P1 Snack',
        baseUomId: uomPcsId,
        hsnCode: '2106',
        taxRateId: tax5Id,
      },
    });
    productId = prod.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `SKU-${suf}`,
        name: '100g Pack',
        netWeightGrams: new Prisma.Decimal('100'),
        uomId: uomPcsId,
        defaultSellingPrice: new Prisma.Decimal('100.00'),
      },
    });
    variantId = variant.id;

    const item = await prisma.inventoryItem.create({
      data: {
        code: `SKU-${suf}`,
        name: 'P1 Snack 100g',
        itemType: 'FINISHED_GOODS',
        productVariantId: variantId,
        uomId: uomPcsId,
        valuationMethod: 'MWAC',
      },
    });
    invItemId = item.id;

    const c1 = await prisma.customer.create({
      data: {
        code: `C1-${suf}`,
        legalName: 'Alpha Stores',
        customerType: 'RETAILER',
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '1 Main St',
            city: 'Trichy',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '620001',
            isDefault: true,
          },
        },
      },
    });
    cust1Id = c1.id;

    const c2 = await prisma.customer.create({
      data: {
        code: `C2-${suf}`,
        legalName: 'Beta Distributors',
        customerType: 'DISTRIBUTOR',
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: '2 Cross Rd',
            city: 'Madurai',
            state: 'Tamil Nadu',
            stateCode: '33',
            pincode: '625001',
            isDefault: true,
          },
        },
      },
    });
    cust2Id = c2.id;

    // Seed 2 issued invoices for cust1 directly for payment allocation tests
    const so = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-${suf}`,
        customerId: cust1Id,
        warehouseId: whId,
        salesmanId: userIds[0],
        createdById: userIds[0],
        status: 'FULFILLED',
        subtotal: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('50.00'),
        totalAmount: new Prisma.Decimal('1050.00'),
      },
    });

    const mkInv = async (num: string, total: string) =>
      prisma.salesInvoice.create({
        data: {
          invoiceNumber: num,
          financialYear: '2026-27',
          salesOrderId: so.id,
          customerId: cust1Id,
          warehouseId: whId,
          companyId,
          status: 'ISSUED',
          companyLegalName: company.legalName,
          companyGstin: company.gstin,
          companyStateCode: '33',
          companyAddress: 'Trichy',
          customerLegalName: 'Alpha Stores',
          customerStateCode: '33',
          customerBillingAddress: 'Trichy',
          placeOfSupply: 'Tamil Nadu (33)',
          subtotal: new Prisma.Decimal(total),
          taxableAmount: new Prisma.Decimal(total),
          grandTotal: new Prisma.Decimal(total),
          createdById: userIds[0],
        },
      });

    inv1Id = (await mkInv(`INV1-${suf}`, '600.00')).id;
    inv2Id = (await mkInv(`INV2-${suf}`, '400.00')).id;
  });

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { customerId: { in: [cust1Id, cust2Id].filter(Boolean) } } },
    });
    await prisma.customerPayment.deleteMany({
      where: { customerId: { in: [cust1Id, cust2Id].filter(Boolean) } },
    });
    await prisma.salesInvoice.deleteMany({ where: { companyId } });
    await prisma.salesOrder.deleteMany({ where: { warehouseId: whId } });
    await prisma.customer.deleteMany({ where: { id: { in: [cust1Id, cust2Id].filter(Boolean) } } });
    await prisma.inventoryItem.deleteMany({ where: { id: invItemId } });
    await prisma.productVariant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productCategory.deleteMany({ where: { id: prodCatId } });
    await prisma.taxRate.deleteMany({ where: { id: tax5Id } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomPcsId } });
    await prisma.userWarehouseAccess.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.warehouse.deleteMany({ where: { id: whId } });
    await prisma.factory.deleteMany({ where: { id: factoryId } });
    await prisma.company.deleteMany({ where: { id: companyId } });

    // Clean up BM-* benchmark seed records created in test 2
    await prisma.bOM.deleteMany({ where: { code: 'BM-BOM-MURUKKU-200G' } });
    await prisma.inventoryItem.deleteMany({
      where: { code: { startsWith: 'BM-' } },
    });
    await prisma.productVariant.deleteMany({ where: { sku: 'BM-MURUKKU-200G-PKT' } });
    await prisma.product.deleteMany({ where: { code: 'BM-MURUKKU-200G' } });
    await prisma.rawMaterial.deleteMany({ where: { code: { startsWith: 'BM-' } } });
    await prisma.productCategory.deleteMany({ where: { code: 'BM-SAVOURIES' } });
    await prisma.rawMaterialCategory.deleteMany({ where: { code: 'BM-SAVOURY-RM' } });
    await prisma.supplier.deleteMany({ where: { code: 'BM-SUP-FLOUR' } });
    await prisma.customer.deleteMany({
      where: { code: { in: ['BM-CUST-RETAILER-A', 'BM-CUST-DIST-B'] } },
    });
  });

  it('1. Computes Collection Summary Report accurately (multi-allocations, advances, reversals, filters, RBAC, CSV)', async () => {
    // Payment 1 (cust1, UPI, 123.45 -> multi-allocated 100.00 to inv1 + 23.45 to inv2)
    const p1 = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: cust1Id,
        paymentDate: '2026-11-10',
        amount: '123.45',
        paymentMode: 'UPI',
        allocations: [
          { salesInvoiceId: inv1Id, allocatedAmount: '100.00' },
          { salesInvoiceId: inv2Id, allocatedAmount: '23.45' },
        ],
      });
    expect(p1.status).toBe(201);

    // Payment 2 (cust2, BANK_TRANSFER, 876.55 unallocated advance)
    const p2 = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: cust2Id,
        paymentDate: '2026-11-15',
        amount: '876.55',
        paymentMode: 'BANK_TRANSFER',
      });
    expect(p2.status).toBe(201);

    // Payment 3 (cust1, CASH, 250.00 -> reversed)
    const p3 = await request(app)
      .post('/api/v1/sales/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({
        customerId: cust1Id,
        paymentDate: '2026-11-15',
        amount: '250.00',
        paymentMode: 'CASH',
      });
    expect(p3.status).toBe(201);
    await request(app)
      .post(`/api/v1/sales/payments/${p3.body.data.id}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(CSRF)
      .send({ reason: 'Entered twice' });

    // RBAC: PRODUCTION denied
    const prodDeny = await request(app)
      .get('/api/v1/sales/collections')
      .set('Authorization', `Bearer ${productionToken}`);
    expect(prodDeny.status).toBe(403);

    // Monthly grouping for Nov 2026
    const monthlyRes = await request(app)
      .get('/api/v1/sales/collections?fromDate=2026-11-01&toDate=2026-11-30&groupBy=monthly')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(monthlyRes.status).toBe(200);
    const s = monthlyRes.body.data.summary;
    // 123.45 + 876.55 + 250.00 = 1250.00 gross; 250.00 reversed; 1000.00 net
    expect(s.totalGrossPaymentsReceived).toBe('1250.00');
    expect(s.totalReversedPayments).toBe('250.00');
    expect(s.netCollections).toBe('1000.00');
    expect(s.totalAllocatedAmount).toBe('123.45');
    expect(s.totalUnallocatedAdvances).toBe('876.55');
    expect(monthlyRes.body.data.byPeriod).toHaveLength(1);
    expect(monthlyRes.body.data.byPeriod[0].period).toBe('2026-11');

    // Daily grouping
    const dailyRes = await request(app)
      .get('/api/v1/sales/collections?fromDate=2026-11-01&toDate=2026-11-30&groupBy=daily')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(dailyRes.status).toBe(200);
    expect(dailyRes.body.data.byPeriod.map((r: { period: string }) => r.period)).toEqual([
      '2026-11-10',
      '2026-11-15',
    ]);

    // Filter by paymentMode=UPI & customerId
    const upiRes = await request(app)
      .get(`/api/v1/sales/collections?fromDate=2026-11-01&toDate=2026-11-30&paymentMode=UPI&customerId=${cust1Id}`)
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(upiRes.status).toBe(200);
    expect(upiRes.body.data.summary.netCollections).toBe('123.45');

    // Empty date range
    const emptyRes = await request(app)
      .get('/api/v1/sales/collections?fromDate=2025-01-01&toDate=2025-01-31')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data.summary.transactionCount).toBe(0);
    expect(emptyRes.body.data.summary.netCollections).toBe('0.00');

    // CSV export
    const csvRes = await request(app)
      .get('/api/v1/sales/collections?fromDate=2026-11-01&toDate=2026-11-30&format=csv')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('2026-11');
    expect(csvRes.text).toContain('1000.00');
  });

  it('2. Executes optional Murukku 200 g benchmark seed profile idempotently without creating business transactions', async () => {
    const beforeCounts = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesInvoice.count(),
      prisma.productionBatch.count(),
      prisma.inventoryReceipt.count(),
    ]);

    const run1 = await seedMurukkuBenchmarkProfile(prisma);
    const run2 = await seedMurukkuBenchmarkProfile(prisma);

    expect(run1.masterDataOnly).toBe(true);
    expect(run2.bomCode).toBe('BM-BOM-MURUKKU-200G');

    const bmBomCount = await prisma.bOM.count({ where: { code: 'BM-BOM-MURUKKU-200G' } });
    const bmItemCount = await prisma.inventoryItem.count({ where: { code: { startsWith: 'BM-' } } });
    expect(bmBomCount).toBe(1);
    expect(bmItemCount).toBe(6);

    const afterCounts = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesInvoice.count(),
      prisma.productionBatch.count(),
      prisma.inventoryReceipt.count(),
    ]);
    expect(afterCounts).toEqual(beforeCounts);
  });
});
