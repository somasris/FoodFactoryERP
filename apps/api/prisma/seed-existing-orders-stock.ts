import { Prisma, PrismaClient, SalesOrderStatus } from '@prisma/client';
import { InventoryReceiptService } from '../src/modules/inventory/inventory-receipt.service';
import { InventoryReservationService } from '../src/modules/inventory/inventory-reservation.service';
import { ZERO } from '../src/modules/inventory/inventory.utils';

const prisma = new PrismaClient();

// Target existing eligible orders (diverse customers, products, warehouses, quantities, including multi-line)
const PREFERRED_EXISTING_ORDER_NUMBERS = [
  'SO-261127-871C61', // APPROVED, ECUST-E2E177838, wh=SC, BAN-200 x 1
  'SO-261127-BE3C1A', // CONFIRMED, ECUST-E2E775676, wh=WH-FG-01, ESKU-E2E775676 x 50
  'SO-261127-C5AE2A', // CONFIRMED, ECUST-E2E337546, wh=WH-FG-01, ESKU-E2E337546 x 50
  'SO-261127-8885D4', // CONFIRMED, ECUST-E2E608894, wh=WH-FG-01, ESKU-E2E608894 x 50
  'SO-261127-2FF5F3', // APPROVED, OTC-CUST-712227, wh=WH-FG-01, multi-line (OTC-MUR-712227 x 10 + OTC-LIM-712227 x 100)
  'SO-261127-0B6424', // APPROVED, OTC-CUST-712227, wh=WH-FG-01, OTC-LIM-712227 x 100
  'SO-261127-28C4DA', // APPROVED, CB-P0761305, wh=FGWH-P0761305, MUR200-P0761305 x 120
];

const SAFETY_BUFFER = new Prisma.Decimal(10);

export interface ExistingOrderSeedReport {
  inspectedCount: number;
  selectedOrders: Array<{ id: string; orderNumber: string; status: string; warehouseCode: string }>;
  receiptsPosted: Array<{ warehouseCode: string; items: Array<{ sku: string; addedQty: string; batchNumber: string }> }>;
  skippedItems: Array<{ warehouseCode: string; sku: string; reason: string }>;
}

export async function seedExistingOrdersStock(
  client: PrismaClient = prisma,
): Promise<ExistingOrderSeedReport> {
  const adminUser = await client.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) {
    throw new Error('No active user found to post inventory receipts.');
  }

  const [queueOrders, recentApproved] = await Promise.all([
    client.salesOrder.findMany({
      where: { status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.PARTIALLY_FULFILLED] } },
      include: {
        warehouse: { select: { id: true, code: true, name: true, factoryId: true } },
        lines: {
          include: {
            productVariant: { select: { sku: true, name: true } },
            inventoryItem: { select: { id: true, code: true, uomId: true, movingAverageCost: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    client.salesOrder.findMany({
      where: {
        status: SalesOrderStatus.APPROVED,
        orderNumber: { in: PREFERRED_EXISTING_ORDER_NUMBERS },
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true, factoryId: true } },
        lines: {
          include: {
            productVariant: { select: { sku: true, name: true } },
            inventoryItem: { select: { id: true, code: true, uomId: true, movingAverageCost: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const allEligible = [...queueOrders, ...recentApproved];
  const selected = allEligible;

  // Group demand by (warehouseId, inventoryItemId) without double-counting own reservations
  const demandMap = new Map<
    string,
    {
      warehouseId: string;
      warehouseCode: string;
      inventoryItemId: string;
      uomId: string;
      sku: string;
      unitCost: string;
      remainingNeeded: Prisma.Decimal;
      ownReserved: Prisma.Decimal;
    }
  >();

  const pairs: Array<{ warehouseId: string; inventoryItemId: string }> = [];
  for (const ord of selected) {
    for (const line of ord.lines) {
      const remaining = Prisma.Decimal.max(
        ZERO,
        new Prisma.Decimal(line.baseQuantity).sub(line.fulfilledBaseQuantity),
      );
      if (remaining.lte(ZERO)) continue;
      const ownRes =
        ord.status === SalesOrderStatus.CONFIRMED ||
        ord.status === SalesOrderStatus.PARTIALLY_FULFILLED
          ? Prisma.Decimal.max(ZERO, new Prisma.Decimal(line.reservedBaseQuantity))
          : ZERO;

      const key = `${ord.warehouseId}:${line.inventoryItemId}`;
      const prev = demandMap.get(key);
      if (prev) {
        prev.remainingNeeded = prev.remainingNeeded.add(remaining);
        prev.ownReserved = prev.ownReserved.add(ownRes);
      } else {
        pairs.push({ warehouseId: ord.warehouseId, inventoryItemId: line.inventoryItemId });
        const cost = new Prisma.Decimal(line.inventoryItem.movingAverageCost);
        demandMap.set(key, {
          warehouseId: ord.warehouseId,
          warehouseCode: ord.warehouse.code,
          inventoryItemId: line.inventoryItemId,
          uomId: line.inventoryItem.uomId,
          sku: line.productVariant.sku,
          unitCost: cost.gt(ZERO) ? cost.toFixed(4) : '35.0000',
          remainingNeeded: remaining,
          ownReserved: ownRes,
        });
      }
    }
  }

  const stockSummary = await InventoryReservationService.getEligibleStockSummaryByWarehouseAndItem(
    pairs,
  );

  // Group receipt lines per warehouse
  const receiptLinesByWh = new Map<
    string,
    {
      warehouseCode: string;
      lines: Array<{
        sku: string;
        inventoryItemId: string;
        uomId: string;
        quantity: string;
        unitCost: string;
        batchNumber: string;
        manufacturingDate: string;
        expiryDate: string;
        notes: string;
      }>;
    }
  >();

  const skippedItems: ExistingOrderSeedReport['skippedItems'] = [];
  const mfgDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const [key, demand] of demandMap.entries()) {
    const summary = stockSummary.get(key);
    const currentAvail = summary?.available ?? ZERO;
    const effectiveAvail = currentAvail.add(demand.ownReserved);
    const targetRequired = demand.remainingNeeded.add(SAFETY_BUFFER);
    const deficit = targetRequired.sub(effectiveAvail);

    const batchNum = `SEED-FQ-${demand.warehouseCode}-${demand.sku}-B01`.slice(0, 60);
    const existingBatch = await client.inventoryBatch.findUnique({
      where: {
        inventoryItemId_batchNumber: {
          inventoryItemId: demand.inventoryItemId,
          batchNumber: batchNum,
        },
      },
    });

    if (deficit.lte(ZERO)) {
      skippedItems.push({
        warehouseCode: demand.warehouseCode,
        sku: demand.sku,
        reason: `Already sufficient (effectiveAvail=${effectiveAvail.toString()} >= target=${targetRequired.toString()})`,
      });
      continue;
    }

    if (existingBatch) {
      skippedItems.push({
        warehouseCode: demand.warehouseCode,
        sku: demand.sku,
        reason: `Batch ${batchNum} already exists`,
      });
      continue;
    }

    const whEntry = receiptLinesByWh.get(demand.warehouseId) ?? {
      warehouseCode: demand.warehouseCode,
      lines: [],
    };
    whEntry.lines.push({
      sku: demand.sku,
      inventoryItemId: demand.inventoryItemId,
      uomId: demand.uomId,
      quantity: deficit.toDecimalPlaces(0, Prisma.Decimal.ROUND_CEIL).toString(),
      unitCost: demand.unitCost,
      batchNumber: batchNum,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      notes: `Stock for existing Sales Orders (${demand.sku})`,
    });
    receiptLinesByWh.set(demand.warehouseId, whEntry);
  }

  const actor = {
    userId: adminUser.id,
    username: adminUser.username,
    roles: ['OWNER'],
  };
  const meta = {
    userId: adminUser.id,
    ipAddress: '127.0.0.1',
    userAgent: 'seed-existing-orders-stock',
  };

  const receiptsPosted: ExistingOrderSeedReport['receiptsPosted'] = [];

  for (const [warehouseId, whEntry] of receiptLinesByWh.entries()) {
    const idemKey = `SEED-FQ-STOCK-${warehouseId}-V2`;
    const existingReceipt = await client.inventoryReceipt.findFirst({
      where: { idempotencyKey: idemKey },
    });
    if (existingReceipt) {
      for (const l of whEntry.lines) {
        skippedItems.push({
          warehouseCode: whEntry.warehouseCode,
          sku: l.sku,
          reason: `Receipt ${idemKey} already posted`,
        });
      }
      continue;
    }

    const created = await InventoryReceiptService.create(
      {
        warehouseId,
        supplierRef: 'EXISTING-ORDERS-STOCK-SEED',
        notes: `Idempotent finished-goods stock for existing eligible Sales Orders in ${whEntry.warehouseCode}`,
        lines: whEntry.lines.map(({ sku: _sku, ...rest }) => rest),
      },
      actor,
      meta,
    );
    await InventoryReceiptService.submit(created.id, actor, meta);
    await InventoryReceiptService.approve(created.id, actor, meta);
    await InventoryReceiptService.post(created.id, idemKey, actor, meta);

    receiptsPosted.push({
      warehouseCode: whEntry.warehouseCode,
      items: whEntry.lines.map(l => ({
        sku: l.sku,
        addedQty: l.quantity,
        batchNumber: l.batchNumber,
      })),
    });
  }

  return {
    inspectedCount: allEligible.length,
    selectedOrders: selected.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      warehouseCode: o.warehouse.code,
    })),
    receiptsPosted,
    skippedItems,
  };
}

if (require.main === module) {
  seedExistingOrdersStock(prisma)
    .then(report => {
      console.info('✅ Existing Orders Stock Seed completed:');
      console.info(JSON.stringify(report, null, 2));
    })
    .catch(err => {
      console.error('❌ Error seeding stock for existing orders:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
