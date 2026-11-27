import { Prisma, PrismaClient } from '@prisma/client';
import { InventoryReceiptService } from '../src/modules/inventory/inventory-receipt.service';

export interface DemoProductSpec {
  code: string;
  sku: string;
  name: string;
  variantName: string;
  uomCode: 'PCS' | 'KG';
  netWeightGrams: string;
  sellingPrice: string;
  unitCost: string;
  demoStock: number;
}

export const DEMO_SALES_PRODUCTS: DemoProductSpec[] = [
  {
    code: 'MUR-200',
    sku: 'MUR-200',
    name: 'Murukku 200 g',
    variantName: 'Murukku 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '60.00',
    unitCost: '32.0000',
    demoStock: 500,
  },
  {
    code: 'MIX-200',
    sku: 'MIX-200',
    name: 'Mixture 200 g',
    variantName: 'Mixture 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '65.00',
    unitCost: '35.0000',
    demoStock: 300,
  },
  {
    code: 'RIB-200',
    sku: 'RIB-200',
    name: 'Ribbon Pakoda 200 g',
    variantName: 'Ribbon Pakoda 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '55.00',
    unitCost: '30.0000',
    demoStock: 250,
  },
  {
    code: 'THA-200',
    sku: 'THA-200',
    name: 'Thattai 200 g',
    variantName: 'Thattai 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '58.00',
    unitCost: '31.0000',
    demoStock: 180,
  },
  {
    code: 'BAN-200',
    sku: 'BAN-200',
    name: 'Banana Chips 200 g',
    variantName: 'Banana Chips 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '75.00',
    unitCost: '42.0000',
    demoStock: 120,
  },
  {
    code: 'COC-200',
    sku: 'COC-200',
    name: 'Coconut Biscuits 200 g',
    variantName: 'Coconut Biscuits 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '70.00',
    unitCost: '38.0000',
    demoStock: 0,
  },
  {
    code: 'CAS-COOK',
    sku: 'CAS-COOK',
    name: 'Roasted Cashew Cookies',
    variantName: 'Roasted Cashew Cookies (Bulk kg)',
    uomCode: 'KG',
    netWeightGrams: '1000.00',
    sellingPrice: '480.00',
    unitCost: '290.0000',
    demoStock: 0,
  },
];

const DEMO_RECEIPT_IDEMPOTENCY_KEY = 'DEMO-SALES-OPENING-RECEIPT-WH-FG-01';

/**
 * Optional, idempotent demo product and finished goods stock seed.
 * Uses InventoryReceiptService (create -> submit -> approve -> post) so all stock
 * is recorded through the official inventory ledger without direct balance edits.
 */
export async function seedDemoSalesProfile(prisma: PrismaClient) {
  const uomPcs = await prisma.unitOfMeasure.upsert({
    where: { code: 'PCS' },
    update: {},
    create: {
      code: 'PCS',
      name: 'Pieces',
      symbol: 'pcs',
      category: 'COUNT',
      isBaseUnit: true,
      decimalPlaces: 0,
    },
  });
  const uomKg = await prisma.unitOfMeasure.upsert({
    where: { code: 'KG' },
    update: {},
    create: {
      code: 'KG',
      name: 'Kilogram',
      symbol: 'kg',
      category: 'WEIGHT',
      isBaseUnit: true,
      decimalPlaces: 3,
    },
  });

  // Reuse existing GST 5% tax rate (or create standard GST_5 if missing)
  const gst5 = await prisma.taxRate.upsert({
    where: { code: 'GST_5' },
    update: {},
    create: {
      code: 'GST_5',
      name: 'GST 5%',
      ratePercentage: new Prisma.Decimal('5.00'),
      cgstPercentage: new Prisma.Decimal('2.50'),
      sgstPercentage: new Prisma.Decimal('2.50'),
      igstPercentage: new Prisma.Decimal('5.00'),
    },
  });

  const prodCat = await prisma.productCategory.upsert({
    where: { code: 'DEMO-SAVOURIES' },
    update: {},
    create: {
      code: 'DEMO-SAVOURIES',
      name: 'Traditional Snacks & Bakery',
    },
  });

  const whFG = await prisma.warehouse.findUnique({ where: { code: 'WH-FG-01' } });
  if (!whFG) {
    throw new Error('Finished Goods warehouse WH-FG-01 not found. Run baseline seed first.');
  }

  const seededItems: Array<{
    sku: string;
    inventoryItemId: string;
    uomId: string;
    demoStock: number;
    unitCost: string;
  }> = [];

  for (const spec of DEMO_SALES_PRODUCTS) {
    const uomId = spec.uomCode === 'KG' ? uomKg.id : uomPcs.id;
    const product = await prisma.product.upsert({
      where: { code: spec.code },
      update: {},
      create: {
        categoryId: prodCat.id,
        code: spec.code,
        name: spec.name,
        baseUomId: uomId,
        hsnCode: '21069099',
        taxRateId: gst5.id,
        isActive: true,
      },
    });

    const variant = await prisma.productVariant.upsert({
      where: { sku: spec.sku },
      update: {},
      create: {
        productId: product.id,
        sku: spec.sku,
        name: spec.variantName,
        netWeightGrams: new Prisma.Decimal(spec.netWeightGrams),
        uomId,
        defaultSellingPrice: new Prisma.Decimal(spec.sellingPrice),
        shelfLifeDays: 120,
        isActive: true,
      },
    });

    const invItem = await prisma.inventoryItem.upsert({
      where: { code: spec.sku },
      update: {},
      create: {
        code: spec.sku,
        name: spec.name,
        itemType: 'FINISHED_GOODS',
        productVariantId: variant.id,
        uomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal(spec.unitCost),
        isActive: true,
      },
    });

    seededItems.push({
      sku: spec.sku,
      inventoryItemId: invItem.id,
      uomId,
      demoStock: spec.demoStock,
      unitCost: spec.unitCost,
    });
  }

  // Idempotent demo customer
  await prisma.customer.upsert({
    where: { code: 'DEMO-CUST-01' },
    update: {},
    create: {
      code: 'DEMO-CUST-01',
      legalName: 'Sri Lakshmi Super Market',
      tradeName: 'Sri Lakshmi Mart',
      customerType: 'DISTRIBUTOR',
      gstin: '33AABCS9999K1Z5',
      creditPeriodDays: 30,
      isActive: true,
      addresses: {
        create: {
          addressType: 'BILLING',
          addressLine1: '45 Anna Salai, Teynampet',
          city: 'Chennai',
          state: 'Tamil Nadu',
          stateCode: '33',
          pincode: '600018',
          isDefault: true,
        },
      },
    },
  });

  // Idempotent opening stock receipt via InventoryReceiptService (only if never posted before)
  const existingReceipt = await prisma.inventoryReceipt.findFirst({
    where: { idempotencyKey: DEMO_RECEIPT_IDEMPOTENCY_KEY },
  });

  let receiptPosted = false;
  if (!existingReceipt) {
    const adminUser = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!adminUser) {
      throw new Error('No active user found to post demo opening inventory receipt.');
    }

    const actor = {
      userId: adminUser.id,
      username: adminUser.username,
      roles: ['OWNER'],
    };
    const meta = {
      userId: adminUser.id,
      ipAddress: '127.0.0.1',
      userAgent: 'demo-sales-seed',
    };

    const mfgDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const expDate = new Date(Date.now() + 115 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const stockLines = seededItems
      .filter(i => i.demoStock > 0)
      .map(i => ({
        inventoryItemId: i.inventoryItemId,
        uomId: i.uomId,
        quantity: String(i.demoStock),
        unitCost: i.unitCost,
        batchNumber: `DEMO-${i.sku}-B01`,
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        notes: 'Initial demo finished goods stock',
      }));

    if (stockLines.length > 0) {
      const created = await InventoryReceiptService.create(
        {
          warehouseId: whFG.id,
          supplierRef: 'DEMO-OPENING-FG',
          notes: 'Idempotent demo finished goods opening stock',
          lines: stockLines,
        },
        actor,
        meta,
      );
      await InventoryReceiptService.submit(created.id, actor, meta);
      await InventoryReceiptService.approve(created.id, actor, meta);
      await InventoryReceiptService.post(created.id, DEMO_RECEIPT_IDEMPOTENCY_KEY, actor, meta);
      receiptPosted = true;
    }
  }

  return {
    productCount: seededItems.length,
    receiptPosted,
    warehouseCode: whFG.code,
  };
}
