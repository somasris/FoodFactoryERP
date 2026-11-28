import { MaterialType, Prisma, PrismaClient } from '@prisma/client';
import { BomsService } from '../../src/modules/master-data/boms/boms.service';
import type { AuditMeta } from '../../src/modules/master-data/master-data.utils';

export const PITCH_PREFIX = 'PITCH-';

export interface PitchMasterContext {
  companyId: string;
  factoryId: string;
  whRmId: string;
  whPkgId: string;
  whFgId: string;
  uomKgId: string;
  uomLId: string;
  uomPcsId: string;
  taxGst0Id: string;
  taxGst5Id: string;
  taxGst12Id: string;
  taxGst18Id: string;
  rawMaterials: Record<string, { id: string; inventoryItemId: string; uomId: string; code: string; name: string }>;
  products: Record<
    string,
    {
      productId: string;
      variantId: string;
      inventoryItemId: string;
      uomId: string;
      code: string;
      sku: string;
      name: string;
      bomId: string;
      activeBomVersionId: string;
    }
  >;
  suppliers: Record<string, { id: string; code: string; legalName: string }>;
  customers: Record<string, { id: string; code: string; legalName: string }>;
}

/**
 * Seeds idempotent, realistic South Indian food manufacturing master data
 * into the existing COMP-01 / FAC-TRICHY-01 organization.
 */
export async function seedPitchMasterData(
  prisma: PrismaClient,
  adminMeta: AuditMeta,
): Promise<PitchMasterContext> {
  const company = await prisma.company.findUnique({ where: { code: 'COMP-01' } });
  if (!company) throw new Error('Baseline company COMP-01 not found. Run `pnpm --filter @foodfactory/api db:seed` first.');

  const factory = await prisma.factory.findUnique({ where: { code: 'FAC-TRICHY-01' } });
  if (!factory) throw new Error('Baseline factory FAC-TRICHY-01 not found.');

  const whRM = await prisma.warehouse.findUnique({ where: { code: 'WH-RM-01' } });
  const whPKG = await prisma.warehouse.findUnique({ where: { code: 'WH-PKG-01' } });
  const whFG = await prisma.warehouse.findUnique({ where: { code: 'WH-FG-01' } });
  if (!whRM || !whPKG || !whFG) {
    throw new Error('Required warehouses (WH-RM-01, WH-PKG-01, WH-FG-01) not found.');
  }

  // 1. UOMs & Conversions
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
    create: { fromUomId: uomKg.id, toUomId: uomG.id, multiplier: new Prisma.Decimal('1000.000000') },
  });

  // 2. Tax Rates
  const upsertTax = (code: string, name: string, rate: string, half: string) =>
    prisma.taxRate.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        ratePercentage: new Prisma.Decimal(rate),
        cgstPercentage: new Prisma.Decimal(half),
        sgstPercentage: new Prisma.Decimal(half),
        igstPercentage: new Prisma.Decimal(rate),
      },
    });

  const taxGst0 = await upsertTax('GST_0', 'GST 0% (Exempt)', '0.00', '0.00');
  const taxGst5 = await upsertTax('GST_5', 'GST 5%', '5.00', '2.50');
  const taxGst12 = await upsertTax('GST_12', 'GST 12%', '12.00', '6.00');
  const taxGst18 = await upsertTax('GST_18', 'GST 18%', '18.00', '9.00');

  // 3. Categories (3 Raw Material Categories, 3 Product Categories)
  const rmCatGrain = await prisma.rawMaterialCategory.upsert({
    where: { code: 'PITCH-RMC-GRAIN' },
    update: {},
    create: { code: 'PITCH-RMC-GRAIN', name: 'Flours & Grains', description: 'Rice, urad, gram and ragi flours' },
  });
  const rmCatOilSpice = await prisma.rawMaterialCategory.upsert({
    where: { code: 'PITCH-RMC-OILSP' },
    update: {},
    create: { code: 'PITCH-RMC-OILSP', name: 'Oils, Spices & Produce', description: 'Edible oils, spices and raw produce' },
  });
  const rmCatPkg = await prisma.rawMaterialCategory.upsert({
    where: { code: 'PITCH-RMC-PKG' },
    update: {},
    create: { code: 'PITCH-RMC-PKG', name: 'Packaging Materials', description: 'Food-grade pouches and master cartons' },
  });

  const prodCatTrad = await prisma.productCategory.upsert({
    where: { code: 'PITCH-PC-TRAD' },
    update: {},
    create: { code: 'PITCH-PC-TRAD', name: 'Traditional Snacks', description: 'Authentic South Indian fried savouries' },
  });
  const prodCatChips = await prisma.productCategory.upsert({
    where: { code: 'PITCH-PC-CHIPS' },
    update: {},
    create: { code: 'PITCH-PC-CHIPS', name: 'Savoury Chips & Mixtures', description: 'Crispy mixtures and banana chips' },
  });
  const prodCatHealth = await prisma.productCategory.upsert({
    where: { code: 'PITCH-PC-HEALTH' },
    update: {},
    create: { code: 'PITCH-PC-HEALTH', name: 'Healthy Snacks', description: 'Millet and sprouted grain health mixes' },
  });

  // 4. Raw Materials & Packaging (8 items)
  const rmDefs: Array<{
    key: string;
    code: string;
    name: string;
    catId: string;
    materialType: MaterialType;
    uomId: string;
    hsn: string;
    taxId: string;
    cost: string;
    minAlert: string;
    reorderQty: string;
  }> = [
    { key: 'FLOUR', code: 'PITCH-RM-FLOUR', name: 'Flour (Rice & Urad Blend)', catId: rmCatGrain.id, materialType: 'RAW_INGREDIENT', uomId: uomKg.id, hsn: '1101', taxId: taxGst5.id, cost: '42.0000', minAlert: '30', reorderQty: '100' },
    { key: 'OIL', code: 'PITCH-RM-OIL', name: 'Cooking Oil (Refined Sunflower)', catId: rmCatOilSpice.id, materialType: 'RAW_INGREDIENT', uomId: uomL.id, hsn: '1512', taxId: taxGst5.id, cost: '140.0000', minAlert: '15', reorderQty: '50' },
    { key: 'SPICE', code: 'PITCH-RM-SPICE', name: 'Traditional Spice Mix', catId: rmCatOilSpice.id, materialType: 'RAW_INGREDIENT', uomId: uomKg.id, hsn: '0910', taxId: taxGst5.id, cost: '200.0000', minAlert: '3', reorderQty: '20' },
    { key: 'BESAN', code: 'PITCH-RM-BESAN', name: 'Bengal Gram Flour (Besan)', catId: rmCatGrain.id, materialType: 'RAW_INGREDIENT', uomId: uomKg.id, hsn: '1106', taxId: taxGst5.id, cost: '78.0000', minAlert: '20', reorderQty: '60' },
    { key: 'RAGI', code: 'PITCH-RM-RAGI', name: 'Sprouted Ragi Flour', catId: rmCatGrain.id, materialType: 'RAW_INGREDIENT', uomId: uomKg.id, hsn: '1102', taxId: taxGst5.id, cost: '65.0000', minAlert: '15', reorderQty: '50' },
    { key: 'BANANA', code: 'PITCH-RM-BANANA', name: 'Raw Nendran Banana', catId: rmCatOilSpice.id, materialType: 'RAW_INGREDIENT', uomId: uomKg.id, hsn: '0803', taxId: taxGst0.id, cost: '48.0000', minAlert: '15', reorderQty: '50' },
    { key: 'POUCH', code: 'PITCH-PKG-POUCH', name: 'Food-Grade Printed Pouch (200g)', catId: rmCatPkg.id, materialType: 'PACKAGING_PRIMARY', uomId: uomPcs.id, hsn: '3923', taxId: taxGst18.id, cost: '2.5000', minAlert: '150', reorderQty: '500' },
    { key: 'CARTON', code: 'PITCH-PKG-CARTON', name: 'Corrugated Master Carton', catId: rmCatPkg.id, materialType: 'PACKAGING_SECONDARY', uomId: uomPcs.id, hsn: '4819', taxId: taxGst18.id, cost: '15.0000', minAlert: '10', reorderQty: '50' },
  ];

  const rawMaterials: PitchMasterContext['rawMaterials'] = {};
  for (const r of rmDefs) {
    const rm = await prisma.rawMaterial.upsert({
      where: { code: r.code },
      update: {},
      create: {
        categoryId: r.catId,
        code: r.code,
        name: r.name,
        materialType: r.materialType,
        uomId: r.uomId,
        hsnCode: r.hsn,
        taxRateId: r.taxId,
        minStockAlert: new Prisma.Decimal(r.minAlert),
        reorderQuantity: new Prisma.Decimal(r.reorderQty),
        allergenStatus: r.key === 'BESAN' ? 'KNOWN' : 'NOT_APPLICABLE',
        allergens: r.key === 'BESAN' ? ['LEGUMES'] : [],
      },
    });
    const invItem = await prisma.inventoryItem.upsert({
      where: { code: r.code },
      update: {},
      create: {
        code: r.code,
        name: r.name,
        itemType: r.materialType === 'RAW_INGREDIENT' ? 'RAW_MATERIAL' : 'PACKAGING',
        rawMaterialId: rm.id,
        uomId: r.uomId,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal(r.cost),
      },
    });
    rawMaterials[r.key] = { id: rm.id, inventoryItemId: invItem.id, uomId: r.uomId, code: r.code, name: r.name };
  }

  // 5. Suppliers (4)
  const supDefs = [
    { key: 'FLOUR_MILL', code: 'PITCH-SUP-01', legalName: 'Sri Lakshmi Flour Mills', tradeName: 'Sri Lakshmi Mills', contactName: 'R. Sundaram', email: 'orders@lakshmiflour.example.com', phone: '+91 431 2401001', gstin: '33AABCS1111M1Z5', pan: 'AABCS1111M', city: 'Tiruchirappalli', state: 'Tamil Nadu', stateCode: '33', pincode: '620001' },
    { key: 'EDIBLE_OIL', code: 'PITCH-SUP-02', legalName: 'Southern Edible Oils Pvt Ltd', tradeName: 'Southern Oils', contactName: 'M. Karthikeyan', email: 'sales@southernoils.example.com', phone: '+91 424 2202002', gstin: '33AABCS2222N1Z3', pan: 'AABCS2222N', city: 'Erode', state: 'Tamil Nadu', stateCode: '33', pincode: '638001' },
    { key: 'PACKAGING', code: 'PITCH-SUP-03', legalName: 'Annapoorna Packaging Solutions', tradeName: 'Annapoorna Pack', contactName: 'V. Meenakshi', email: 'dispatch@annapoornapack.example.com', phone: '+91 4562 2703003', gstin: '33AABCA3333P1Z1', pan: 'AABCA3333P', city: 'Sivakasi', state: 'Tamil Nadu', stateCode: '33', pincode: '626123' },
    { key: 'SPICES', code: 'PITCH-SUP-04', legalName: 'Kongu Spices & Ingredients', tradeName: 'Kongu Spices', contactName: 'S. Palanisamy', email: 'supply@konguspices.example.com', phone: '+91 427 2304004', gstin: '33AABCK4444Q1Z9', pan: 'AABCK4444Q', city: 'Salem', state: 'Tamil Nadu', stateCode: '33', pincode: '636001' },
  ];

  const suppliers: PitchMasterContext['suppliers'] = {};
  for (const s of supDefs) {
    const sup = await prisma.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: {
        code: s.code,
        legalName: s.legalName,
        tradeName: s.tradeName,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        gstin: s.gstin,
        pan: s.pan,
        paymentTermsDays: 30,
        addresses: {
          create: {
            addressType: 'OFFICE',
            addressLine1: `Industrial Estate, ${s.city}`,
            city: s.city,
            state: s.state,
            stateCode: s.stateCode,
            pincode: s.pincode,
            isDefault: true,
          },
        },
      },
    });
    suppliers[s.key] = { id: sup.id, code: sup.code, legalName: sup.legalName };
  }

  // 6. Customers (5)
  const custDefs = [
    { key: 'RETAILER_A', code: 'PITCH-CUST-01', legalName: 'Sri Annapoorna Stores', tradeName: 'Annapoorna Stores', customerType: 'RETAILER' as const, contactName: 'K. Natarajan', email: 'accounts@annapoornastores.example.com', phone: '+91 452 2345001', gstin: '33AABCA5555R1Z2', city: 'Madurai', state: 'Tamil Nadu', stateCode: '33', pincode: '625001', creditPeriodDays: 15, creditLimit: '50000' },
    { key: 'DIST_B', code: 'PITCH-CUST-02', legalName: 'Kaveri Wholesale Mart', tradeName: 'Kaveri Mart', customerType: 'DISTRIBUTOR' as const, contactName: 'B. Raghavendra', email: 'procurement@kaverimart.example.com', phone: '+91 80 26785002', gstin: '29AABCK6666S1Z4', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001', creditPeriodDays: 30, creditLimit: '150000' },
    { key: 'GREEN_BASKET', code: 'PITCH-CUST-03', legalName: 'Green Basket Retailers', tradeName: 'Green Basket', customerType: 'RETAILER' as const, contactName: 'P. Kavitha', email: 'billing@greenbasket.example.com', phone: '+91 422 2456003', gstin: '33AABCG7777T1Z6', city: 'Coimbatore', state: 'Tamil Nadu', stateCode: '33', pincode: '641001', creditPeriodDays: 15, creditLimit: '40000' },
    { key: 'LAKSHMI_MART', code: 'PITCH-CUST-04', legalName: 'Lakshmi Supermarket', tradeName: 'Lakshmi Super', customerType: 'RETAILER' as const, contactName: 'T. Venkatesh', email: 'finance@lakshmisuper.example.com', phone: '+91 44 28156004', gstin: '33AABCL8888U1Z8', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', pincode: '600017', creditPeriodDays: 21, creditLimit: '75000' },
    { key: 'CHENNAI_DIST', code: 'PITCH-CUST-05', legalName: 'Chennai Food Distributors', tradeName: 'Chennai Foods', customerType: 'WHOLESALER' as const, contactName: 'A. Balasubramanian', email: 'orders@chennaifoods.example.com', phone: '+91 44 25226005', gstin: '33AABCC9999V1Z0', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', pincode: '600001', creditPeriodDays: 30, creditLimit: '200000' },
  ];

  const customers: PitchMasterContext['customers'] = {};
  for (const c of custDefs) {
    const cust = await prisma.customer.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        legalName: c.legalName,
        tradeName: c.tradeName,
        customerType: c.customerType,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        gstin: c.gstin,
        creditPeriodDays: c.creditPeriodDays,
        creditLimit: new Prisma.Decimal(c.creditLimit),
        addresses: {
          create: {
            addressType: 'BILLING',
            addressLine1: `Main Market Road, ${c.city}`,
            city: c.city,
            state: c.state,
            stateCode: c.stateCode,
            pincode: c.pincode,
            isDefault: true,
          },
        },
      },
    });
    customers[c.key] = { id: cust.id, code: cust.code, legalName: cust.legalName };
  }

  // 7. Finished Products, Variants, InventoryItems & BOMs (5)
  const prodDefs = [
    {
      key: 'MURUKKU',
      code: 'PITCH-FG-MUR200',
      sku: 'PITCH-MUR-200G',
      name: 'Murukku 200g',
      variantName: 'Murukku 200g Packet',
      description: 'Traditional South Indian hand-twisted rice & urad dal murukku (200g pouch)',
      catId: prodCatTrad.id,
      netWeightGrams: '200.00',
      price: '50.00',
      hsn: '21069099',
      taxId: taxGst5.id,
      shelfLife: 90,
      bomCode: 'PITCH-BOM-MUR200',
      bomName: 'Murukku 200g Standard Recipe',
      baseOutput: '200',
      yieldPct: '94.00',
      wastagePct: '6.00',
      items: [
        { rmKey: 'FLOUR', qty: '40' },
        { rmKey: 'OIL', qty: '10' },
        { rmKey: 'SPICE', qty: '1.2' },
        { rmKey: 'POUCH', qty: '194' },
        { rmKey: 'CARTON', qty: '9' },
      ],
    },
    {
      key: 'RIBBON',
      code: 'PITCH-FG-RIB200',
      sku: 'PITCH-RIB-200G',
      name: 'Ribbon Pakoda 200g',
      variantName: 'Ribbon Pakoda 200g Packet',
      description: 'Crispy gram flour and rice flour ribbon pakoda (200g pouch)',
      catId: prodCatTrad.id,
      netWeightGrams: '200.00',
      price: '55.00',
      hsn: '21069099',
      taxId: taxGst5.id,
      shelfLife: 90,
      bomCode: 'PITCH-BOM-RIB200',
      bomName: 'Ribbon Pakoda 200g Recipe',
      baseOutput: '150',
      yieldPct: '96.67',
      wastagePct: '3.33',
      items: [
        { rmKey: 'BESAN', qty: '22' },
        { rmKey: 'FLOUR', qty: '10' },
        { rmKey: 'OIL', qty: '7' },
        { rmKey: 'SPICE', qty: '1' },
        { rmKey: 'POUCH', qty: '150' },
        { rmKey: 'CARTON', qty: '7' },
      ],
      hasRevision2: true,
    },
    {
      key: 'MIXTURE',
      code: 'PITCH-FG-MIX200',
      sku: 'PITCH-MIX-200G',
      name: 'Spicy Mixture 200g',
      variantName: 'Spicy Mixture 200g Packet',
      description: 'Madurai-style spicy boondi and sev mixture (200g pouch)',
      catId: prodCatChips.id,
      netWeightGrams: '200.00',
      price: '65.00',
      hsn: '21069099',
      taxId: taxGst5.id,
      shelfLife: 90,
      bomCode: 'PITCH-BOM-MIX200',
      bomName: 'Spicy Mixture 200g Recipe',
      baseOutput: '120',
      yieldPct: '96.67',
      wastagePct: '3.33',
      items: [
        { rmKey: 'BESAN', qty: '20' },
        { rmKey: 'OIL', qty: '6' },
        { rmKey: 'SPICE', qty: '1.5' },
        { rmKey: 'POUCH', qty: '120' },
        { rmKey: 'CARTON', qty: '6' },
      ],
    },
    {
      key: 'RAGI',
      code: 'PITCH-FG-RAG500',
      sku: 'PITCH-RAG-500G',
      name: 'Ragi Health Mix 500g',
      variantName: 'Ragi Health Mix 500g Pack',
      description: 'Roasted sprouted finger millet health mix (500g pack)',
      catId: prodCatHealth.id,
      netWeightGrams: '500.00',
      price: '140.00',
      hsn: '19019090',
      taxId: taxGst5.id,
      shelfLife: 180,
      bomCode: 'PITCH-BOM-RAG500',
      bomName: 'Ragi Health Mix 500g Recipe',
      baseOutput: '100',
      yieldPct: '98.00',
      wastagePct: '2.00',
      items: [
        { rmKey: 'RAGI', qty: '45' },
        { rmKey: 'FLOUR', qty: '5' },
        { rmKey: 'POUCH', qty: '100' },
        { rmKey: 'CARTON', qty: '5' },
      ],
    },
    {
      key: 'BANANA',
      code: 'PITCH-FG-BAN200',
      sku: 'PITCH-BAN-200G',
      name: 'Banana Chips 200g',
      variantName: 'Banana Chips 200g Packet',
      description: 'Thinly sliced Nendran banana chips (200g pouch)',
      catId: prodCatChips.id,
      netWeightGrams: '200.00',
      price: '75.00',
      hsn: '20089919',
      taxId: taxGst12.id,
      shelfLife: 60,
      bomCode: 'PITCH-BOM-BAN200',
      bomName: 'Banana Chips 200g Recipe',
      baseOutput: '100',
      yieldPct: '95.00',
      wastagePct: '5.00',
      items: [
        { rmKey: 'BANANA', qty: '40' },
        { rmKey: 'OIL', qty: '6' },
        { rmKey: 'SPICE', qty: '0.8' },
        { rmKey: 'POUCH', qty: '100' },
        { rmKey: 'CARTON', qty: '5' },
      ],
    },
  ];

  const products: PitchMasterContext['products'] = {};
  for (const p of prodDefs) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        categoryId: p.catId,
        code: p.code,
        name: p.name,
        description: p.description,
        baseUomId: uomPcs.id,
        hsnCode: p.hsn,
        taxRateId: p.taxId,
      },
    });
    const variant = await prisma.productVariant.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        productId: product.id,
        sku: p.sku,
        name: p.variantName,
        netWeightGrams: new Prisma.Decimal(p.netWeightGrams),
        uomId: uomPcs.id,
        defaultSellingPrice: new Prisma.Decimal(p.price),
        shelfLifeDays: p.shelfLife,
      },
    });
    const invItem = await prisma.inventoryItem.upsert({
      where: { code: p.sku },
      update: {},
      create: {
        code: p.sku,
        name: p.variantName,
        itemType: 'FINISHED_GOODS',
        productVariantId: variant.id,
        uomId: uomPcs.id,
        valuationMethod: 'MWAC',
      },
    });

    let bom = await prisma.bOM.findUnique({
      where: { code: p.bomCode },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    if (!bom) {
      const createdBom = await BomsService.createBom(
        {
          productVariantId: variant.id,
          code: p.bomCode,
          name: p.bomName,
          baseOutputQuantity: p.baseOutput,
          outputUomId: uomPcs.id,
          initialVersion: {
            effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
            expectedGoodOutput: p.baseOutput,
            yieldPercentage: p.yieldPct,
            expectedWastagePercent: p.wastagePct,
            outputUomId: uomPcs.id,
            remarks: `Initial standard recipe v1 for ${p.name}`,
            items: p.items.map(it => ({
              inventoryItemId: rawMaterials[it.rmKey].inventoryItemId,
              uomId: rawMaterials[it.rmKey].uomId,
              standardQuantity: it.qty,
              scrapTolerancePercent: '2',
            })),
            overheads: [],
          },
        },
        adminMeta,
      );

      await BomsService.activateVersion(createdBom.id, createdBom.versions[0].id, adminMeta);

      // Demonstrate BOM revision history on Ribbon Pakoda (v1 -> v2)
      if (p.hasRevision2) {
        const v2 = await BomsService.createVersion(
          createdBom.id,
          {
            effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
            expectedGoodOutput: p.baseOutput,
            yieldPercentage: p.yieldPct,
            expectedWastagePercent: p.wastagePct,
            outputUomId: uomPcs.id,
            remarks: 'Revised spice ratio (+0.2 kg) for crispier finish',
            items: p.items.map(it => ({
              inventoryItemId: rawMaterials[it.rmKey].inventoryItemId,
              uomId: rawMaterials[it.rmKey].uomId,
              standardQuantity: it.rmKey === 'SPICE' ? '1.2' : it.qty,
              scrapTolerancePercent: '2',
            })),
            overheads: [],
          },
          adminMeta,
        );
        await BomsService.activateVersion(createdBom.id, v2.id, adminMeta);
      }

      bom = await prisma.bOM.findUniqueOrThrow({
        where: { id: createdBom.id },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });
    }

    const activeVer = bom.versions.find(v => v.status === 'ACTIVE') ?? bom.versions[0];
    products[p.key] = {
      productId: product.id,
      variantId: variant.id,
      inventoryItemId: invItem.id,
      uomId: uomPcs.id,
      code: p.code,
      sku: p.sku,
      name: p.name,
      bomId: bom.id,
      activeBomVersionId: activeVer.id,
    };
  }

  return {
    companyId: company.id,
    factoryId: factory.id,
    whRmId: whRM.id,
    whPkgId: whPKG.id,
    whFgId: whFG.id,
    uomKgId: uomKg.id,
    uomLId: uomL.id,
    uomPcsId: uomPcs.id,
    taxGst0Id: taxGst0.id,
    taxGst5Id: taxGst5.id,
    taxGst12Id: taxGst12.id,
    taxGst18Id: taxGst18.id,
    rawMaterials,
    products,
    suppliers,
    customers,
  };
}
