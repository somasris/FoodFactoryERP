import { Prisma, PrismaClient } from '@prisma/client';

/**
 * P1.3 Optional, Idempotent Murukku 200 g Benchmark Master Data Seed Profile.
 *
 * Strictly master-data only: does NOT execute opening stock receipts, purchases,
 * production runs, sales orders, dispatches, invoices, or payments.
 * Uses stable `BM-*` codes with idempotent `upsert` so existing production/customer
 * data is never overwritten.
 */
export async function seedMurukkuBenchmarkProfile(prisma: PrismaClient) {
  // 1. Ensure baseline UOMs & KG <-> G conversion
  const uomKg = await prisma.unitOfMeasure.upsert({
    where: { code: 'KG' },
    update: {},
    create: { code: 'KG', name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBaseUnit: true, decimalPlaces: 3 },
  });
  const uomG = await prisma.unitOfMeasure.upsert({
    where: { code: 'G' },
    update: {},
    create: { code: 'G', name: 'Gram', symbol: 'g', category: 'WEIGHT', isBaseUnit: false, decimalPlaces: 2 },
  });
  const uomL = await prisma.unitOfMeasure.upsert({
    where: { code: 'L' },
    update: {},
    create: { code: 'L', name: 'Litre', symbol: 'L', category: 'VOLUME', isBaseUnit: true, decimalPlaces: 3 },
  });
  const uomPcs = await prisma.unitOfMeasure.upsert({
    where: { code: 'PCS' },
    update: {},
    create: { code: 'PCS', name: 'Pieces', symbol: 'pcs', category: 'COUNT', isBaseUnit: true, decimalPlaces: 0 },
  });

  await prisma.unitConversion.upsert({
    where: { fromUomId_toUomId: { fromUomId: uomKg.id, toUomId: uomG.id } },
    update: {},
    create: {
      fromUomId: uomKg.id,
      toUomId: uomG.id,
      multiplier: new Prisma.Decimal('1000.000000'),
    },
  });

  // 2. Ensure GST 5% Tax Rate
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

  // 3. Benchmark Categories
  const rmCat = await prisma.rawMaterialCategory.upsert({
    where: { code: 'BM-SAVOURY-RM' },
    update: {},
    create: { code: 'BM-SAVOURY-RM', name: 'Benchmark Savoury Raw Materials & Packaging' },
  });
  const prodCat = await prisma.productCategory.upsert({
    where: { code: 'BM-SAVOURIES' },
    update: {},
    create: { code: 'BM-SAVOURIES', name: 'Benchmark Traditional Savouries' },
  });

  // 4. Raw Materials & Packaging
  const rmDefs = [
    { code: 'BM-RM-FLOUR', name: 'Flour', materialType: 'RAW_INGREDIENT' as const, uomId: uomKg.id, hsn: '1101', cost: '42.0000' },
    { code: 'BM-RM-OIL', name: 'Cooking Oil', materialType: 'RAW_INGREDIENT' as const, uomId: uomL.id, hsn: '1512', cost: '140.0000' },
    { code: 'BM-RM-SPICE', name: 'Salt & Spice Mix', materialType: 'RAW_INGREDIENT' as const, uomId: uomKg.id, hsn: '0910', cost: '200.0000' },
    { code: 'BM-PKG-POUCH', name: '200 g Pouch', materialType: 'PACKAGING_PRIMARY' as const, uomId: uomPcs.id, hsn: '3923', cost: '2.5000' },
    { code: 'BM-PKG-CARTON', name: 'Carton', materialType: 'PACKAGING_SECONDARY' as const, uomId: uomPcs.id, hsn: '4819', cost: '15.0000' },
  ];

  const invByCode = new Map<string, { id: string; uomId: string }>();
  for (const r of rmDefs) {
    const rm = await prisma.rawMaterial.upsert({
      where: { code: r.code },
      update: {},
      create: {
        categoryId: rmCat.id,
        code: r.code,
        name: r.name,
        materialType: r.materialType,
        uomId: r.uomId,
        hsnCode: r.hsn,
        taxRateId: gst5.id,
      },
    });
    const item = await prisma.inventoryItem.upsert({
      where: { code: r.code },
      update: {},
      create: {
        code: r.code,
        name: r.name,
        itemType: 'RAW_MATERIAL',
        rawMaterialId: rm.id,
        uomId: r.uomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal(r.cost),
      },
    });
    invByCode.set(r.code, { id: item.id, uomId: r.uomId });
  }

  // 5. Finished Good Product & Variant: Murukku 200 g
  const product = await prisma.product.upsert({
    where: { code: 'BM-MURUKKU-200G' },
    update: {},
    create: {
      categoryId: prodCat.id,
      code: 'BM-MURUKKU-200G',
      name: 'Murukku 200 g',
      baseUomId: uomPcs.id,
      hsnCode: '21069099',
      taxRateId: gst5.id,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { sku: 'BM-MURUKKU-200G-PKT' },
    update: {},
    create: {
      productId: product.id,
      sku: 'BM-MURUKKU-200G-PKT',
      name: 'Murukku 200 g Packet',
      netWeightGrams: new Prisma.Decimal('200.00'),
      uomId: uomPcs.id,
      defaultSellingPrice: new Prisma.Decimal('50.00'),
      shelfLifeDays: 90,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { code: 'BM-MURUKKU-200G-PKT' },
    update: {},
    create: {
      code: 'BM-MURUKKU-200G-PKT',
      name: 'Murukku 200 g - 200 g Packet',
      itemType: 'FINISHED_GOODS',
      productVariantId: variant.id,
      uomId: uomPcs.id,
      valuationMethod: 'MWAC',
    },
  });

  // 6. Standard BOM (1 batch = 200 expected packets)
  const existingBom = await prisma.bOM.findUnique({ where: { code: 'BM-BOM-MURUKKU-200G' } });
  if (!existingBom) {
    const flr = invByCode.get('BM-RM-FLOUR')!;
    const oil = invByCode.get('BM-RM-OIL')!;
    const spc = invByCode.get('BM-RM-SPICE')!;
    const pch = invByCode.get('BM-PKG-POUCH')!;
    const ctn = invByCode.get('BM-PKG-CARTON')!;

    await prisma.bOM.create({
      data: {
        productVariantId: variant.id,
        code: 'BM-BOM-MURUKKU-200G',
        name: 'Murukku 200 g Official Benchmark BOM',
        baseOutputQuantity: new Prisma.Decimal('200'),
        outputUomId: uomPcs.id,
        isActive: true,
        versions: {
          create: {
            versionNumber: 1,
            expectedGoodOutput: new Prisma.Decimal('200'),
            yieldPercentage: new Prisma.Decimal('94.00'),
            expectedWastagePercent: new Prisma.Decimal('6.00'),
            outputUomId: uomPcs.id,
            status: 'ACTIVE',
            items: {
              create: [
                { inventoryItemId: flr.id, itemType: 'RAW_MATERIAL', standardQuantity: new Prisma.Decimal('40'), uomId: flr.uomId },
                { inventoryItemId: oil.id, itemType: 'RAW_MATERIAL', standardQuantity: new Prisma.Decimal('10'), uomId: oil.uomId },
                { inventoryItemId: spc.id, itemType: 'RAW_MATERIAL', standardQuantity: new Prisma.Decimal('1.2'), uomId: spc.uomId },
                { inventoryItemId: pch.id, itemType: 'PACKAGING', standardQuantity: new Prisma.Decimal('194'), uomId: pch.uomId },
                { inventoryItemId: ctn.id, itemType: 'PACKAGING', standardQuantity: new Prisma.Decimal('9'), uomId: ctn.uomId },
              ],
            },
          },
        },
      },
    });
  }

  // 7. Benchmark Supplier & Customers
  await prisma.supplier.upsert({
    where: { code: 'BM-SUP-FLOUR' },
    update: {},
    create: {
      code: 'BM-SUP-FLOUR',
      legalName: 'Cauvery Flour Mills (Benchmark)',
      addresses: {
        create: {
          addressType: 'OFFICE',
          addressLine1: '1 Mill Road',
          city: 'Tiruchirappalli',
          state: 'Tamil Nadu',
          stateCode: '33',
          pincode: '620001',
          isDefault: true,
        },
      },
    },
  });

  await prisma.customer.upsert({
    where: { code: 'BM-CUST-RETAILER-A' },
    update: {},
    create: {
      code: 'BM-CUST-RETAILER-A',
      legalName: 'Retailer A (Benchmark)',
      customerType: 'RETAILER',
      addresses: {
        create: {
          addressType: 'BILLING',
          addressLine1: '12 Bazaar Street',
          city: 'Madurai',
          state: 'Tamil Nadu',
          stateCode: '33',
          pincode: '625001',
          isDefault: true,
        },
      },
    },
  });

  await prisma.customer.upsert({
    where: { code: 'BM-CUST-DIST-B' },
    update: {},
    create: {
      code: 'BM-CUST-DIST-B',
      legalName: 'Distributor B (Benchmark)',
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

  return {
    profile: 'murukku-200g',
    masterDataOnly: true,
    itemsSeeded: rmDefs.length + 1,
    bomCode: 'BM-BOM-MURUKKU-200G',
  };
}
