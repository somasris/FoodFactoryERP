import { Prisma, PrismaClient, SalesOrderStatus } from '@prisma/client';
import { InventoryReceiptService } from '../src/modules/inventory/inventory-receipt.service';
import { InventoryReservationService } from '../src/modules/inventory/inventory-reservation.service';
import { ZERO } from '../src/modules/inventory/inventory.utils';
import { seedDemoSalesProfile } from './seed-demo-sales';

const prisma = new PrismaClient();

export interface FulfillmentDemoTarget {
  code: string;
  sku: string;
  name: string;
  variantName: string;
  uomCode: 'PCS' | 'KG';
  netWeightGrams: string;
  sellingPrice: string;
  unitCost: string;
  targetAvailable: number;
}

export const FULFILLMENT_DEMO_TARGETS: FulfillmentDemoTarget[] = [
  {
    code: 'MUR-200',
    sku: 'MUR-200',
    name: 'Murukku 200 g',
    variantName: 'Murukku 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '60.00',
    unitCost: '32.0000',
    targetAvailable: 1000,
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
    targetAvailable: 1000,
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
    targetAvailable: 1000,
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
    targetAvailable: 1000,
  },
  {
    code: 'GRN-200',
    sku: 'GRN-200',
    name: 'Groundnut 200 g',
    variantName: 'Groundnut 200 g Pack',
    uomCode: 'PCS',
    netWeightGrams: '200.00',
    sellingPrice: '52.00',
    unitCost: '28.0000',
    targetAvailable: 1000,
  },
];

interface DemoOrderSpec {
  orderNumber: string;
  idempotencyKey: string;
  status: SalesOrderStatus;
  notes: string;
  reserveStock: boolean;
  lines: Array<{ sku: string; qty: number }>;
}

const DEMO_ORDERS: DemoOrderSpec[] = [
  {
    orderNumber: 'SO-DEMO-FUL-001',
    idempotencyKey: 'DEMO-FULFILL-ORDER-001',
    status: SalesOrderStatus.CONFIRMED,
    notes: 'Demo Single-Product Order (Sufficient Stock)',
    reserveStock: true,
    lines: [{ sku: 'MUR-200', qty: 25 }],
  },
  {
    orderNumber: 'SO-DEMO-FUL-002',
    idempotencyKey: 'DEMO-FULFILL-ORDER-002',
    status: SalesOrderStatus.CONFIRMED,
    notes: 'Demo Multi-Line Order (Sufficient Stock)',
    reserveStock: true,
    lines: [
      { sku: 'MUR-200', qty: 30 },
      { sku: 'MIX-200', qty: 20 },
      { sku: 'BAN-200', qty: 15 },
      { sku: 'RIB-200', qty: 10 },
      { sku: 'GRN-200', qty: 25 },
    ],
  },
  {
    orderNumber: 'SO-DEMO-FUL-003',
    idempotencyKey: 'DEMO-FULFILL-ORDER-003',
    status: SalesOrderStatus.APPROVED,
    notes: 'Demo Partial-Availability Order (MIX-200 available, COC-200 out of stock)',
    reserveStock: false,
    lines: [
      { sku: 'MIX-200', qty: 15 },
      { sku: 'COC-200', qty: 40 },
    ],
  },
  {
    orderNumber: 'SO-DEMO-FUL-004',
    idempotencyKey: 'DEMO-FULFILL-ORDER-004',
    status: SalesOrderStatus.CONFIRMED,
    notes: 'Demo Intentionally Insufficient-Stock Order (must reject fulfillment)',
    reserveStock: false,
    lines: [{ sku: 'COC-200', qty: 50 }],
  },
];

export interface SeedReport {
  factoryCode: string;
  warehouseCode: string;
  products: { created: string[]; skipped: string[] };
  stockReceipts: { created: string[]; skipped: string[] };
  orders: { created: string[]; skipped: string[] };
}

export async function seedFulfillmentDemoProfile(client: PrismaClient = prisma): Promise<SeedReport> {
  // 1. Ensure baseline demo sales products & customer exist
  await seedDemoSalesProfile(client);

  // 2. Resolve existing active factory & finished goods warehouse
  const factory =
    (await client.factory.findFirst({ where: { code: 'FAC-TRICHY-01', isActive: true } })) ??
    (await client.factory.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!factory) {
    throw new Error('No active factory found. Run baseline seed first.');
  }

  const whFG =
    (await client.warehouse.findFirst({
      where: { code: 'WH-FG-01', factoryId: factory.id, isActive: true },
    })) ??
    (await client.warehouse.findFirst({
      where: { factoryId: factory.id, warehouseType: 'FINISHED_GOODS', isActive: true },
      orderBy: { createdAt: 'asc' },
    }));
  if (!whFG) {
    throw new Error(`No active FINISHED_GOODS warehouse found for factory ${factory.code}.`);
  }

  const adminUser = await client.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) {
    throw new Error('No active user found to post demo receipts and orders.');
  }

  const uomPcs = await client.unitOfMeasure.findUniqueOrThrow({ where: { code: 'PCS' } });
  const gst5 = await client.taxRate.findUniqueOrThrow({ where: { code: 'GST_5' } });
  const prodCat = await client.productCategory.findUniqueOrThrow({ where: { code: 'DEMO-SAVOURIES' } });
  const customer = await client.customer.findUniqueOrThrow({
    where: { code: 'DEMO-CUST-01' },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
  });

  const report: SeedReport = {
    factoryCode: factory.code,
    warehouseCode: whFG.code,
    products: { created: [], skipped: [] },
    stockReceipts: { created: [], skipped: [] },
    orders: { created: [], skipped: [] },
  };

  // 3. Ensure all target products, variants, and inventory items exist
  const itemBySku = new Map<
    string,
    {
      inventoryItemId: string;
      productVariantId: string;
      uomId: string;
      sellingPrice: Prisma.Decimal;
      unitCost: string;
      taxRateId: string;
      taxPercentage: Prisma.Decimal;
      targetAvailable: number;
    }
  >();

  for (const spec of FULFILLMENT_DEMO_TARGETS) {
    const existingVariant = await client.productVariant.findUnique({ where: { sku: spec.sku } });
    if (existingVariant) {
      report.products.skipped.push(spec.sku);
    } else {
      report.products.created.push(spec.sku);
    }

    const product = await client.product.upsert({
      where: { code: spec.code },
      update: {},
      create: {
        categoryId: prodCat.id,
        code: spec.code,
        name: spec.name,
        baseUomId: uomPcs.id,
        hsnCode: '21069099',
        taxRateId: gst5.id,
        isActive: true,
      },
    });

    const variant = await client.productVariant.upsert({
      where: { sku: spec.sku },
      update: {},
      create: {
        productId: product.id,
        sku: spec.sku,
        name: spec.variantName,
        netWeightGrams: new Prisma.Decimal(spec.netWeightGrams),
        uomId: uomPcs.id,
        defaultSellingPrice: new Prisma.Decimal(spec.sellingPrice),
        shelfLifeDays: 120,
        isActive: true,
      },
    });

    const invItem = await client.inventoryItem.upsert({
      where: { code: spec.sku },
      update: {},
      create: {
        code: spec.sku,
        name: spec.name,
        itemType: 'FINISHED_GOODS',
        productVariantId: variant.id,
        uomId: uomPcs.id,
        valuationMethod: 'MWAC',
        movingAverageCost: new Prisma.Decimal(spec.unitCost),
        isActive: true,
      },
    });

    itemBySku.set(spec.sku, {
      inventoryItemId: invItem.id,
      productVariantId: variant.id,
      uomId: uomPcs.id,
      sellingPrice: new Prisma.Decimal(spec.sellingPrice),
      unitCost: spec.unitCost,
      taxRateId: gst5.id,
      taxPercentage: gst5.ratePercentage,
      targetAvailable: spec.targetAvailable,
    });
  }

  // Also load COC-200 for partial & insufficient demo orders
  const cocVariant = await client.productVariant.findUniqueOrThrow({ where: { sku: 'COC-200' } });
  const cocInv = await client.inventoryItem.findUniqueOrThrow({ where: { code: 'COC-200' } });
  itemBySku.set('COC-200', {
    inventoryItemId: cocInv.id,
    productVariantId: cocVariant.id,
    uomId: uomPcs.id,
    sellingPrice: cocVariant.defaultSellingPrice,
    unitCost: '38.0000',
    taxRateId: gst5.id,
    taxPercentage: gst5.ratePercentage,
    targetAvailable: 0,
  });

  // 4. Calculate current eligible available stock and top up only what is needed
  const pairs = FULFILLMENT_DEMO_TARGETS.map(t => ({
    warehouseId: whFG.id,
    inventoryItemId: itemBySku.get(t.sku)!.inventoryItemId,
  }));
  const currentSummary = await InventoryReservationService.getEligibleStockSummaryByWarehouseAndItem(
    pairs,
  );

  // Account for unreserved demand of pending demo orders we are about to create
  const pendingOrderDemand = new Map<string, number>();
  for (const ord of DEMO_ORDERS) {
    if (!ord.reserveStock) continue;
    const exists = await client.salesOrder.findUnique({ where: { orderNumber: ord.orderNumber } });
    if (exists) continue;
    for (const l of ord.lines) {
      pendingOrderDemand.set(l.sku, (pendingOrderDemand.get(l.sku) ?? 0) + l.qty);
    }
  }

  const receiptLines: Array<{
    inventoryItemId: string;
    uomId: string;
    quantity: string;
    unitCost: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    notes: string;
  }> = [];

  const mfgDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expDate = new Date(Date.now() + 117 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const spec of FULFILLMENT_DEMO_TARGETS) {
    const info = itemBySku.get(spec.sku)!;
    const key = `${whFG.id}:${info.inventoryItemId}`;
    const currentAvail = currentSummary.get(key)?.available ?? ZERO;
    const neededTotal = new Prisma.Decimal(spec.targetAvailable + (pendingOrderDemand.get(spec.sku) ?? 0));
    const deficit = neededTotal.sub(currentAvail);

    let batchNum = `DEMO-FUL-${spec.sku}-B01`;
    const existingBatch = await client.inventoryBatch.findUnique({
      where: {
        inventoryItemId_batchNumber: {
          inventoryItemId: info.inventoryItemId,
          batchNumber: batchNum,
        },
      },
    });

    if (deficit.gt(ZERO)) {
      if (existingBatch) {
        batchNum = `DEMO-INV-${spec.sku}-1000`;
        const existingReconcile = await client.inventoryBatch.findUnique({
          where: {
            inventoryItemId_batchNumber: {
              inventoryItemId: info.inventoryItemId,
              batchNumber: batchNum,
            },
          },
        });
        if (existingReconcile) {
          report.stockReceipts.skipped.push(batchNum);
          continue;
        }
      }
      receiptLines.push({
        inventoryItemId: info.inventoryItemId,
        uomId: info.uomId,
        quantity: deficit.toDecimalPlaces(0).toString(),
        unitCost: info.unitCost,
        batchNumber: batchNum,
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        notes: `Fulfillment demo finished goods stock (${spec.sku})`,
      });
    } else {
      report.stockReceipts.skipped.push(batchNum);
    }
  }

  const receiptIdemKey = 'DEMO-INVENTORY-TARGET-1000-WH-FG-01';
  const existingReceipt = await client.inventoryReceipt.findFirst({
    where: { idempotencyKey: receiptIdemKey },
  });

  if (receiptLines.length > 0 && !existingReceipt) {
    const actor = {
      userId: adminUser.id,
      username: adminUser.username,
      roles: ['OWNER'],
    };
    const meta = {
      userId: adminUser.id,
      ipAddress: '127.0.0.1',
      userAgent: 'fulfillment-demo-seed',
    };

    const created = await InventoryReceiptService.create(
      {
        warehouseId: whFG.id,
        supplierRef: 'DEMO-FULFILLMENT-FG',
        notes: 'Idempotent fulfillment demo finished goods stock',
        lines: receiptLines,
      },
      actor,
      meta,
    );
    await InventoryReceiptService.submit(created.id, actor, meta);
    await InventoryReceiptService.approve(created.id, actor, meta);
    await InventoryReceiptService.post(created.id, receiptIdemKey, actor, meta);
    for (const l of receiptLines) {
      report.stockReceipts.created.push(`${l.batchNumber} (+${l.quantity})`);
    }
  }

  // 5. Seed demo Sales Orders idempotently
  for (const ordSpec of DEMO_ORDERS) {
    const existingOrder = await client.salesOrder.findFirst({
      where: {
        OR: [{ orderNumber: ordSpec.orderNumber }, { idempotencyKey: ordSpec.idempotencyKey }],
      },
    });

    if (existingOrder) {
      report.orders.skipped.push(ordSpec.orderNumber);
      continue;
    }

    await client.$transaction(async tx => {
      let subtotal = ZERO;
      let taxTotal = ZERO;
      const lineCreates: Prisma.SalesOrderLineCreateWithoutSalesOrderInput[] = [];

      for (let i = 0; i < ordSpec.lines.length; i++) {
        const l = ordSpec.lines[i];
        const info = itemBySku.get(l.sku)!;
        const qty = new Prisma.Decimal(l.qty);
        const taxable = qty.mul(info.sellingPrice).toDecimalPlaces(2);
        const taxAmt = taxable.mul(info.taxPercentage).div(100).toDecimalPlaces(2);
        const lineTotal = taxable.add(taxAmt);

        subtotal = subtotal.add(taxable);
        taxTotal = taxTotal.add(taxAmt);

        lineCreates.push({
          lineNumber: i + 1,
          productVariant: { connect: { id: info.productVariantId } },
          inventoryItem: { connect: { id: info.inventoryItemId } },
          uom: { connect: { id: info.uomId } },
          orderedQuantity: qty,
          baseQuantity: qty,
          reservedBaseQuantity: ordSpec.reserveStock ? qty : ZERO,
          fulfilledBaseQuantity: ZERO,
          unitPrice: info.sellingPrice,
          discountPercent: ZERO,
          taxRate: { connect: { id: info.taxRateId } },
          taxPercentage: info.taxPercentage,
          taxableAmount: taxable,
          taxAmount: taxAmt,
          lineTotal,
        });
      }

      if (ordSpec.reserveStock) {
        await InventoryReservationService.reserveStockInTx(
          tx,
          whFG.id,
          ordSpec.lines.map(l => ({
            inventoryItemId: itemBySku.get(l.sku)!.inventoryItemId,
            baseQuantity: new Prisma.Decimal(l.qty),
          })),
        );
      }

      const grandTotal = subtotal.add(taxTotal);

      await tx.salesOrder.create({
        data: {
          orderNumber: ordSpec.orderNumber,
          idempotencyKey: ordSpec.idempotencyKey,
          customerId: customer.id,
          shippingAddressId: customer.addresses[0]?.id ?? null,
          warehouseId: whFG.id,
          salesmanId: adminUser.id,
          status: ordSpec.status,
          subtotal,
          discountAmount: ZERO,
          taxAmount: taxTotal,
          totalAmount: grandTotal,
          notes: ordSpec.notes,
          createdById: adminUser.id,
          approvedById: adminUser.id,
          approvedAt: new Date(),
          confirmedById: ordSpec.status === SalesOrderStatus.CONFIRMED ? adminUser.id : null,
          confirmedAt: ordSpec.status === SalesOrderStatus.CONFIRMED ? new Date() : null,
          lines: { create: lineCreates },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: ordSpec.status,
              changedById: adminUser.id,
              reason: 'Seeded by fulfillment demo profile',
            },
          },
        },
      });
    });

    report.orders.created.push(ordSpec.orderNumber);
  }

  return report;
}

if (require.main === module) {
  seedFulfillmentDemoProfile(prisma)
    .then(report => {
      console.info('✅ Fulfillment Demo Seed completed:');
      console.info(JSON.stringify(report, null, 2));
    })
    .catch(err => {
      console.error('❌ Error during fulfillment demo seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
