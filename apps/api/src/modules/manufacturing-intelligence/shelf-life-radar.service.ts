import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { getAuthorizedWarehouseIds, UserContext, ZERO } from '../inventory/inventory.utils';
import { ShelfLifeRadarQuery } from './mi.types';

export type ExpiryRiskWindow =
  | 'EXPIRED'
  | 'EXPIRING_7D'
  | 'EXPIRING_15D'
  | 'EXPIRING_30D'
  | 'LONGER_SHELF_LIFE'
  | 'NO_EXPIRY';

const MS_PER_DAY = 86_400_000;

/**
 * Deterministic UTC-date boundary classification for batch expiry risk.
 * Uses UTC midnight comparison so timezone offsets do not shift calendar expiry dates.
 */
export function classifyExpiryRiskWindow(expiryDate: Date | null, referenceDate = new Date()): {
  riskWindow: ExpiryRiskWindow;
  daysToExpiry: number | null;
} {
  if (!expiryDate) {
    return { riskWindow: 'NO_EXPIRY', daysToExpiry: null };
  }
  const todayUtcMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  const expUtcMs = Date.UTC(
    expiryDate.getUTCFullYear(),
    expiryDate.getUTCMonth(),
    expiryDate.getUTCDate(),
  );
  const daysToExpiry = Math.floor((expUtcMs - todayUtcMs) / MS_PER_DAY);

  if (daysToExpiry < 0) return { riskWindow: 'EXPIRED', daysToExpiry };
  if (daysToExpiry <= 7) return { riskWindow: 'EXPIRING_7D', daysToExpiry };
  if (daysToExpiry <= 15) return { riskWindow: 'EXPIRING_15D', daysToExpiry };
  if (daysToExpiry <= 30) return { riskWindow: 'EXPIRING_30D', daysToExpiry };
  return { riskWindow: 'LONGER_SHELF_LIFE', daysToExpiry };
}

export class ShelfLifeRadarService {
  /**
   * Read-only Shelf-Life Risk Radar using InventoryBalance (unique per warehouse+item+batch)
   * and InventoryBatch. Never double-counts stock and never mutates inventory balances.
   */
  static async getRadar(user: UserContext, query: ShelfLifeRadarQuery, referenceDate = new Date()) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    const where: Prisma.InventoryBalanceWhereInput = {
      quantityOnHand: { gt: ZERO },
      ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.factoryId ? { warehouse: { factoryId: query.factoryId } } : {}),
      ...(query.itemType ? { inventoryItem: { itemType: query.itemType } } : {}),
      ...(query.search
        ? {
            OR: [
              { batch: { batchNumber: { contains: query.search, mode: 'insensitive' } } },
              { inventoryItem: { code: { contains: query.search, mode: 'insensitive' } } },
              { inventoryItem: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            factory: { select: { id: true, code: true, name: true } },
          },
        },
        inventoryItem: {
          select: {
            id: true,
            code: true,
            name: true,
            itemType: true,
            uom: { select: { code: true, symbol: true } },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            manufacturingDate: true,
            expiryDate: true,
            qualityStatus: true,
          },
        },
      },
      orderBy: [{ batch: { expiryDate: 'asc' } }, { updatedAt: 'desc' }],
    });

    const summaryBuckets: Record<
      ExpiryRiskWindow,
      {
        batchRowCount: number;
        totalOnHand: Prisma.Decimal;
        availableQty: Prisma.Decimal;
        reservedQty: Prisma.Decimal;
        quarantinedQty: Prisma.Decimal;
        rejectedQty: Prisma.Decimal;
      }
    > = {
      EXPIRED: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
      EXPIRING_7D: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
      EXPIRING_15D: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
      EXPIRING_30D: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
      LONGER_SHELF_LIFE: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
      NO_EXPIRY: { batchRowCount: 0, totalOnHand: ZERO, availableQty: ZERO, reservedQty: ZERO, quarantinedQty: ZERO, rejectedQty: ZERO },
    };

    const enrichedRows = balances.map(bal => {
      const { riskWindow, daysToExpiry } = classifyExpiryRiskWindow(
        bal.batch?.expiryDate ?? null,
        referenceDate,
      );
      const onHand = new Prisma.Decimal(bal.quantityOnHand);
      const reserved = new Prisma.Decimal(bal.quantityReserved);
      const qStatus = bal.batch?.qualityStatus ?? 'ACCEPTED';

      // Only ACCEPTED stock minus reserved is freely available; QUARANTINED / REJECTED are never freely available
      const rawAvailable = onHand.sub(reserved);
      const available =
        qStatus === 'ACCEPTED' && rawAvailable.gt(ZERO) ? rawAvailable : ZERO;
      const quarantined = qStatus === 'QUARANTINED' ? onHand : ZERO;
      const rejected = qStatus === 'REJECTED' ? onHand : ZERO;

      const bucket = summaryBuckets[riskWindow];
      bucket.batchRowCount += 1;
      bucket.totalOnHand = bucket.totalOnHand.add(onHand);
      bucket.availableQty = bucket.availableQty.add(available);
      bucket.reservedQty = bucket.reservedQty.add(reserved);
      bucket.quarantinedQty = bucket.quarantinedQty.add(quarantined);
      bucket.rejectedQty = bucket.rejectedQty.add(rejected);

      return {
        balanceId: bal.id,
        batchId: bal.batch?.id ?? null,
        batchNumber: bal.batch?.batchNumber ?? 'UNBATCHED',
        itemCode: bal.inventoryItem.code,
        itemName: bal.inventoryItem.name,
        itemType: bal.inventoryItem.itemType,
        uomSymbol: bal.inventoryItem.uom.symbol,
        warehouseId: bal.warehouse.id,
        warehouseCode: bal.warehouse.code,
        warehouseName: bal.warehouse.name,
        factoryName: bal.warehouse.factory.name,
        manufacturingDate: bal.batch?.manufacturingDate ?? null,
        expiryDate: bal.batch?.expiryDate ?? null,
        qualityStatus: qStatus,
        riskWindow,
        daysToExpiry,
        totalOnHandQty: onHand.toFixed(4),
        availableQty: available.toFixed(4),
        reservedQty: reserved.toFixed(4),
        quarantinedQty: quarantined.toFixed(4),
        rejectedQty: rejected.toFixed(4),
      };
    });

    const filtered =
      query.riskWindow === 'ALL'
        ? enrichedRows
        : enrichedRows.filter(r => r.riskWindow === query.riskWindow);

    const total = filtered.length;
    const skip = (query.page - 1) * query.limit;
    const items = filtered.slice(skip, skip + query.limit);

    return {
      summary: Object.entries(summaryBuckets).map(([window, stats]) => ({
        riskWindow: window as ExpiryRiskWindow,
        batchRowCount: stats.batchRowCount,
        totalOnHandQty: stats.totalOnHand.toFixed(4),
        availableQty: stats.availableQty.toFixed(4),
        reservedQty: stats.reservedQty.toFixed(4),
        quarantinedQty: stats.quarantinedQty.toFixed(4),
        rejectedQty: stats.rejectedQty.toFixed(4),
      })),
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
