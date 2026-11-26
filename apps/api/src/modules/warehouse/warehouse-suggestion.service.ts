import { Prisma, QualityStatus, StorageCondition } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import {
  assertWarehouseAccess,
  isBatchExpired,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';

export class WarehouseSuggestionService {
  /**
   * Suggest picking bins and batches for an item in a warehouse using FEFO / FIFO,
   * filtering strictly to ACCEPTED, non-expired stock in non-quarantine active bins.
   * Suggestions are advisory and never automatically post stock transactions.
   */
  static async suggestPicking(
    params: { warehouseId: string; inventoryItemId: string; quantity: string },
    user: UserContext,
  ) {
    await assertWarehouseAccess(user, params.warehouseId, 'READ');

    const requestedQty = new Prisma.Decimal(params.quantity);
    if (requestedQty.lte(ZERO)) {
      throw new AppError('Requested picking quantity must be greater than zero.', 400);
    }

    const allocations = await prisma.binStockAllocation.findMany({
      where: {
        warehouseId: params.warehouseId,
        inventoryItemId: params.inventoryItemId,
        quantity: { gt: 0 },
        bin: {
          isActive: true,
          locationType: { not: 'QUARANTINE' },
        },
      },
      include: {
        bin: {
          select: {
            id: true,
            code: true,
            name: true,
            locationType: true,
            storageCondition: true,
            isTemperatureControlled: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            receivedDate: true,
            qualityStatus: true,
          },
        },
      },
    });

    const refDate = new Date();
    const eligible = allocations.filter(a => {
      const avail = new Prisma.Decimal(a.quantity).sub(a.reservedQuantity);
      if (avail.lte(ZERO)) return false;
      if (a.batch) {
        if (a.batch.qualityStatus !== QualityStatus.ACCEPTED) return false;
        if (isBatchExpired(a.batch.expiryDate, refDate)) return false;
      }
      return true;
    });

    // FEFO (earliest expiry first), then FIFO (earliest received/created first)
    eligible.sort((a, b) => {
      const expA = a.batch?.expiryDate ? a.batch.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
      const expB = b.batch?.expiryDate ? b.batch.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (expA !== expB) return expA - expB;
      const recA = a.batch?.receivedDate ? a.batch.receivedDate.getTime() : a.createdAt.getTime();
      const recB = b.batch?.receivedDate ? b.batch.receivedDate.getTime() : b.createdAt.getTime();
      return recA - recB;
    });

    let remaining = requestedQty;
    const suggestions = [];

    for (const alloc of eligible) {
      if (remaining.lte(ZERO)) break;
      const available = new Prisma.Decimal(alloc.quantity).sub(alloc.reservedQuantity);
      const take = available.gte(remaining) ? remaining : available;

      suggestions.push({
        binId: alloc.bin.id,
        binCode: alloc.bin.code,
        binName: alloc.bin.name,
        storageCondition: alloc.bin.storageCondition,
        batchId: alloc.batch?.id ?? null,
        batchNumber: alloc.batch?.batchNumber ?? null,
        expiryDate: alloc.batch?.expiryDate ?? null,
        availableQuantity: available.toString(),
        suggestedPickQuantity: take.toString(),
        strategy: alloc.batch?.expiryDate ? 'FEFO' : 'FIFO',
      });

      remaining = remaining.sub(take);
    }

    return {
      warehouseId: params.warehouseId,
      inventoryItemId: params.inventoryItemId,
      requestedQuantity: requestedQty.toString(),
      shortfallQuantity: remaining.gt(ZERO) ? remaining.toString() : '0',
      suggestions,
    };
  }

  /**
   * Suggest destination bins for put-away respecting quality status, storage condition,
   * allergen segregation, mixing rules, and remaining capacity.
   */
  static async suggestPutAway(
    params: {
      warehouseId: string;
      inventoryItemId: string;
      batchId?: string;
      quantity: string;
      storageCondition?: StorageCondition;
      allergen?: string;
    },
    user: UserContext,
  ) {
    await assertWarehouseAccess(user, params.warehouseId, 'READ');

    const qty = new Prisma.Decimal(params.quantity);
    if (qty.lte(ZERO)) {
      throw new AppError('Put-away quantity must be greater than zero.', 400);
    }

    let isQuarantined = false;
    if (params.batchId) {
      const batch = await prisma.inventoryBatch.findUnique({ where: { id: params.batchId } });
      if (batch && (batch.qualityStatus === 'QUARANTINED' || batch.qualityStatus === 'REJECTED')) {
        isQuarantined = true;
      }
    }

    const bins = await prisma.warehouseBin.findMany({
      where: {
        warehouseId: params.warehouseId,
        isActive: true,
        ...(isQuarantined
          ? { locationType: 'QUARANTINE' }
          : { locationType: { not: 'QUARANTINE' } }),
        ...(params.storageCondition ? { storageCondition: params.storageCondition } : {}),
      },
      include: {
        allocations: { where: { quantity: { gt: 0 } } },
        shelf: {
          include: { rack: { include: { zone: { select: { code: true, name: true } } } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    const candidates = bins
      .map(bin => {
        const used = bin.allocations.reduce((acc, a) => acc.add(a.quantity), ZERO);
        const cap = new Prisma.Decimal(bin.capacityQuantity);
        const remainingCap = cap.gt(0) ? cap.sub(used) : null;

        if (remainingCap !== null && remainingCap.lt(qty)) return null;

        if (!bin.allowMixedItems && bin.allocations.some(a => a.inventoryItemId !== params.inventoryItemId)) {
          return null;
        }
        if (
          !bin.allowMixedBatches &&
          bin.allocations.some(
            a => a.inventoryItemId === params.inventoryItemId && (a.batchId ?? null) !== (params.batchId ?? null),
          )
        ) {
          return null;
        }
        if (
          params.allergen &&
          bin.allergenRestriction &&
          !bin.allergenRestriction.toLowerCase().includes(params.allergen.toLowerCase())
        ) {
          return null;
        }

        const hasSameItem = bin.allocations.some(a => a.inventoryItemId === params.inventoryItemId);
        return {
          binId: bin.id,
          binCode: bin.code,
          binName: bin.name,
          zoneCode: bin.shelf.rack.zone.code,
          locationType: bin.locationType,
          storageCondition: bin.storageCondition,
          capacityQuantity: cap.toString(),
          usedQuantity: used.toString(),
          availableCapacity: remainingCap !== null ? remainingCap.toString() : 'UNLIMITED',
          consolidatesExistingStock: hasSameItem,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Prefer bins that already hold the same item (consolidation), then empty/available bins
    candidates.sort((a, b) => Number(b.consolidatesExistingStock) - Number(a.consolidatesExistingStock));

    return {
      warehouseId: params.warehouseId,
      inventoryItemId: params.inventoryItemId,
      isQuarantined,
      suggestions: candidates.slice(0, 10),
    };
  }
}
