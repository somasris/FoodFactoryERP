import { AuditAction, BinMovementType, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';

export class WarehouseLocationService {
  // ---------------------------------------------------------------------------
  // 1. HIERARCHY: FACTORY -> WAREHOUSE -> ZONE -> RACK -> SHELF -> BIN
  // ---------------------------------------------------------------------------

  static async getWarehouseLayout(warehouseId: string, user: UserContext) {
    await assertWarehouseAccess(user, warehouseId, 'READ');

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        factory: { select: { id: true, code: true, name: true, state: true } },
        zones: {
          orderBy: { code: 'asc' },
          include: {
            racks: {
              orderBy: { code: 'asc' },
              include: {
                shelves: {
                  orderBy: [{ levelNumber: 'asc' }, { code: 'asc' }],
                  include: {
                    bins: {
                      orderBy: { code: 'asc' },
                      include: {
                        allocations: {
                          where: { quantity: { gt: 0 } },
                          select: {
                            id: true,
                            inventoryItemId: true,
                            batchId: true,
                            quantity: true,
                            reservedQuantity: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!warehouse) throw new AppError('Warehouse not found.', 404);

    return {
      ...warehouse,
      zones: warehouse.zones.map(z => ({
        ...z,
        racks: z.racks.map(r => ({
          ...r,
          shelves: r.shelves.map(s => ({
            ...s,
            bins: s.bins.map(b => {
              const usedQuantity = b.allocations.reduce(
                (acc, a) => acc.add(a.quantity),
                ZERO,
              );
              const cap = new Prisma.Decimal(b.capacityQuantity);
              const utilizationPercent = cap.gt(0)
                ? Number(usedQuantity.div(cap).mul(100).toFixed(1))
                : 0;
              return {
                ...b,
                usedQuantity: usedQuantity.toString(),
                utilizationPercent,
                allocationsCount: b.allocations.length,
              };
            }),
          })),
        })),
      })),
    };
  }

  static async listZones(warehouseId: string | undefined, user: UserContext) {
    if (warehouseId) {
      await assertWarehouseAccess(user, warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');
    return prisma.warehouseZone.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
      },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
      orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
    });
  }

  static async createZone(
    input: {
      warehouseId: string;
      code: string;
      name: string;
      zoneType?: any;
      storageCondition?: any;
      isTemperatureControlled?: boolean;
      temperatureMinC?: number | null;
      temperatureMaxC?: number | null;
      allergenProfile?: string | null;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    const wh = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!wh) throw new AppError('Warehouse not found.', 404);

    const created = await prisma.warehouseZone.create({
      data: {
        warehouseId: input.warehouseId,
        code: input.code.toUpperCase(),
        name: input.name,
        zoneType: input.zoneType,
        storageCondition: input.storageCondition,
        isTemperatureControlled: Boolean(input.isTemperatureControlled),
        temperatureMinC: input.temperatureMinC ?? null,
        temperatureMaxC: input.temperatureMaxC ?? null,
        allergenProfile: input.allergenProfile ?? null,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'WarehouseZone',
      entityId: created.id,
      newState: { code: created.code, warehouseId: created.warehouseId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async updateZone(id: string, input: Record<string, unknown>, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.warehouseZone.findUnique({ where: { id } });
    if (!existing) throw new AppError('Warehouse zone not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    const updated = await prisma.warehouseZone.update({
      where: { id },
      data: {
        ...(input.code ? { code: String(input.code).toUpperCase() } : {}),
        ...(input.name ? { name: String(input.name) } : {}),
        ...(input.zoneType ? { zoneType: input.zoneType as any } : {}),
        ...(input.storageCondition ? { storageCondition: input.storageCondition as any } : {}),
        ...(input.isTemperatureControlled !== undefined
          ? { isTemperatureControlled: Boolean(input.isTemperatureControlled) }
          : {}),
        ...(input.allergenProfile !== undefined
          ? { allergenProfile: (input.allergenProfile as string | null) ?? null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'WarehouseZone',
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async createRack(
    input: { warehouseId: string; zoneId: string; code: string; name: string; aisle?: string | null },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    const zone = await prisma.warehouseZone.findUnique({ where: { id: input.zoneId } });
    if (!zone) throw new AppError('Parent zone not found.', 404);
    if (zone.warehouseId !== input.warehouseId) {
      throw new AppError('Cross-warehouse error: Zone belongs to a different warehouse.', 400);
    }

    const created = await prisma.warehouseRack.create({
      data: {
        warehouseId: input.warehouseId,
        zoneId: input.zoneId,
        code: input.code.toUpperCase(),
        name: input.name,
        aisle: input.aisle ?? null,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'WarehouseRack',
      entityId: created.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async createShelf(
    input: { warehouseId: string; rackId: string; code: string; name: string; levelNumber?: number },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    const rack = await prisma.warehouseRack.findUnique({ where: { id: input.rackId } });
    if (!rack) throw new AppError('Parent rack not found.', 404);
    if (rack.warehouseId !== input.warehouseId) {
      throw new AppError('Cross-warehouse error: Rack belongs to a different warehouse.', 400);
    }

    const created = await prisma.warehouseShelf.create({
      data: {
        warehouseId: input.warehouseId,
        rackId: input.rackId,
        code: input.code.toUpperCase(),
        name: input.name,
        levelNumber: input.levelNumber ?? 1,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'WarehouseShelf',
      entityId: created.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async listBins(
    filters: { warehouseId?: string; isActive?: boolean; storageCondition?: string },
    user: UserContext,
  ) {
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.warehouseBin.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters.storageCondition ? { storageCondition: filters.storageCondition as any } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        shelf: {
          include: {
            rack: { include: { zone: { select: { id: true, code: true, name: true } } } },
          },
        },
        allocations: { where: { quantity: { gt: 0 } } },
      },
      orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
    });
  }

  static async createBin(
    input: {
      warehouseId: string;
      shelfId: string;
      code: string;
      name: string;
      locationType?: any;
      storageCondition?: any;
      capacityQuantity?: string;
      capacityUomId?: string | null;
      isTemperatureControlled?: boolean;
      allergenRestriction?: string | null;
      allowMixedItems?: boolean;
      allowMixedBatches?: boolean;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    const shelf = await prisma.warehouseShelf.findUnique({ where: { id: input.shelfId } });
    if (!shelf) throw new AppError('Parent shelf not found.', 404);
    if (shelf.warehouseId !== input.warehouseId) {
      throw new AppError('Cross-warehouse error: Shelf belongs to a different warehouse.', 400);
    }

    const created = await prisma.warehouseBin.create({
      data: {
        warehouseId: input.warehouseId,
        shelfId: input.shelfId,
        code: input.code.toUpperCase(),
        name: input.name,
        locationType: input.locationType,
        storageCondition: input.storageCondition,
        capacityQuantity: new Prisma.Decimal(input.capacityQuantity ?? '0'),
        capacityUomId: input.capacityUomId ?? null,
        isTemperatureControlled: Boolean(input.isTemperatureControlled),
        allergenRestriction: input.allergenRestriction ?? null,
        allowMixedItems: input.allowMixedItems ?? true,
        allowMixedBatches: input.allowMixedBatches ?? true,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'WarehouseBin',
      entityId: created.id,
      newState: { code: created.code, warehouseId: created.warehouseId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async updateBin(id: string, input: Record<string, unknown>, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.warehouseBin.findUnique({ where: { id } });
    if (!existing) throw new AppError('Warehouse bin not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    const updated = await prisma.warehouseBin.update({
      where: { id },
      data: {
        ...(input.code ? { code: String(input.code).toUpperCase() } : {}),
        ...(input.name ? { name: String(input.name) } : {}),
        ...(input.locationType ? { locationType: input.locationType as any } : {}),
        ...(input.storageCondition ? { storageCondition: input.storageCondition as any } : {}),
        ...(input.capacityQuantity !== undefined
          ? { capacityQuantity: new Prisma.Decimal(String(input.capacityQuantity)) }
          : {}),
        ...(input.isTemperatureControlled !== undefined
          ? { isTemperatureControlled: Boolean(input.isTemperatureControlled) }
          : {}),
        ...(input.allergenRestriction !== undefined
          ? { allergenRestriction: (input.allergenRestriction as string | null) ?? null }
          : {}),
        ...(input.allowMixedItems !== undefined ? { allowMixedItems: Boolean(input.allowMixedItems) } : {}),
        ...(input.allowMixedBatches !== undefined
          ? { allowMixedBatches: Boolean(input.allowMixedBatches) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'WarehouseBin',
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 2. INVENTORY LOCATION TRACKING & BALANCED BIN MOVEMENTS
  // ---------------------------------------------------------------------------

  static async listLocationStock(
    filters: { warehouseId?: string; binId?: string; inventoryItemId?: string; batchId?: string },
    user: UserContext,
  ) {
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.binStockAllocation.findMany({
      where: {
        quantity: { gt: 0 },
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
        ...(filters.binId ? { binId: filters.binId } : {}),
        ...(filters.inventoryItemId ? { inventoryItemId: filters.inventoryItemId } : {}),
        ...(filters.batchId ? { batchId: filters.batchId } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: {
          select: {
            id: true,
            code: true,
            name: true,
            locationType: true,
            storageCondition: true,
            capacityQuantity: true,
          },
        },
        inventoryItem: {
          select: { id: true, code: true, name: true, itemType: true, uom: { select: { symbol: true } } },
        },
        batch: {
          select: { id: true, batchNumber: true, expiryDate: true, qualityStatus: true },
        },
      },
      orderBy: [{ warehouseId: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  static async listLocationMovements(
    filters: { warehouseId?: string; binId?: string; inventoryItemId?: string },
    user: UserContext,
  ) {
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.binMovement.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
        ...(filters.inventoryItemId ? { inventoryItemId: filters.inventoryItemId } : {}),
        ...(filters.binId
          ? { OR: [{ fromBinId: filters.binId }, { toBinId: filters.binId }] }
          : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        inventoryItem: { select: { id: true, code: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
        fromBin: { select: { id: true, code: true, name: true } },
        toBin: { select: { id: true, code: true, name: true } },
        performedBy: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private static async validateBinTargetInTx(
    tx: Prisma.TransactionClient,
    binId: string,
    warehouseId: string,
    inventoryItemId: string,
    batchId: string | null,
    addQty: Prisma.Decimal,
  ) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM warehouse_bins WHERE id = ${binId} FOR UPDATE
    `;
    if (locked.length === 0) throw new AppError('Target bin not found.', 404);

    const bin = await tx.warehouseBin.findUniqueOrThrow({
      where: { id: binId },
      include: { allocations: { where: { quantity: { gt: 0 } } } },
    });

    if (bin.warehouseId !== warehouseId) {
      throw new AppError('Cross-warehouse error: Bin does not belong to the specified warehouse.', 400);
    }
    if (!bin.isActive) {
      throw new AppError(`Bin ${bin.code} is inactive and cannot receive stock.`, 400);
    }

    const currentUsed = bin.allocations.reduce((acc, a) => acc.add(a.quantity), ZERO);
    const capacity = new Prisma.Decimal(bin.capacityQuantity);
    if (capacity.gt(0) && currentUsed.add(addQty).gt(capacity)) {
      throw new AppError(
        `Bin ${bin.code} capacity exceeded. Available capacity: ${capacity.sub(currentUsed).toString()}, requested: ${addQty.toString()}.`,
        400,
      );
    }

    if (!bin.allowMixedItems) {
      const otherItem = bin.allocations.find(a => a.inventoryItemId !== inventoryItemId);
      if (otherItem) {
        throw new AppError(`Bin ${bin.code} does not allow mixed items.`, 400);
      }
    }

    if (!bin.allowMixedBatches) {
      const otherBatch = bin.allocations.find(
        a => a.inventoryItemId === inventoryItemId && (a.batchId ?? null) !== batchId,
      );
      if (otherBatch) {
        throw new AppError(`Bin ${bin.code} does not allow mixed batches.`, 400);
      }
    }

    return bin;
  }

  private static async adjustAllocationInTx(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    binId: string,
    inventoryItemId: string,
    batchId: string | null,
    delta: Prisma.Decimal,
  ) {
    const existing = await tx.binStockAllocation.findFirst({
      where: { binId, inventoryItemId, batchId },
    });

    if (!existing) {
      if (delta.lt(0)) {
        throw new AppError('Insufficient stock in source bin.', 400);
      }
      return tx.binStockAllocation.create({
        data: { warehouseId, binId, inventoryItemId, batchId, quantity: delta },
      });
    }

    const nextQty = new Prisma.Decimal(existing.quantity).add(delta);
    if (nextQty.lt(existing.reservedQuantity)) {
      throw new AppError(
        `Insufficient unreserved stock in bin (available: ${new Prisma.Decimal(existing.quantity).sub(existing.reservedQuantity).toString()}).`,
        400,
      );
    }

    return tx.binStockAllocation.update({
      where: { id: existing.id },
      data: { quantity: nextQty },
    });
  }

  /**
   * Put-away stock into a warehouse bin without altering authoritative InventoryBalance.
   * Ensures allocated bin quantities do not exceed InventoryBalance.quantityOnHand.
   */
  static async putAway(
    input: {
      warehouseId: string;
      toBinId: string;
      inventoryItemId: string;
      batchId?: string | null;
      quantity: string;
      referenceType?: string;
      referenceId?: string;
      idempotencyKey?: string;
      notes?: string;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    if (input.idempotencyKey) {
      const existing = await prisma.binMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const qty = new Prisma.Decimal(input.quantity);
    const batchId = input.batchId ?? null;

    const movement = await prisma.$transaction(async tx => {
      // Check authoritative InventoryBalance on-hand vs already allocated across bins
      const balances = await tx.inventoryBalance.findMany({
        where: {
          warehouseId: input.warehouseId,
          inventoryItemId: input.inventoryItemId,
          ...(batchId ? { batchId } : {}),
        },
      });
      const totalOnHand = balances.reduce((acc, b) => acc.add(b.quantityOnHand), ZERO);

      const existingAllocs = await tx.binStockAllocation.findMany({
        where: {
          warehouseId: input.warehouseId,
          inventoryItemId: input.inventoryItemId,
          ...(batchId ? { batchId } : {}),
        },
      });
      const totalAllocated = existingAllocs.reduce((acc, a) => acc.add(a.quantity), ZERO);
      const unallocated = totalOnHand.sub(totalAllocated);

      if (qty.gt(unallocated)) {
        throw new AppError(
          `Put-away quantity (${qty.toString()}) exceeds unallocated warehouse stock (${unallocated.toString()}).`,
          400,
        );
      }

      await this.validateBinTargetInTx(tx, input.toBinId, input.warehouseId, input.inventoryItemId, batchId, qty);
      await this.adjustAllocationInTx(tx, input.warehouseId, input.toBinId, input.inventoryItemId, batchId, qty);

      return tx.binMovement.create({
        data: {
          movementNumber: generateDocNumber('BMV'),
          warehouseId: input.warehouseId,
          movementType: BinMovementType.PUT_AWAY,
          inventoryItemId: input.inventoryItemId,
          batchId,
          toBinId: input.toBinId,
          quantity: qty,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          performedById: user.userId,
          notes: input.notes ?? null,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'BinMovement',
      entityId: movement.id,
      newState: { movementNumber: movement.movementNumber, type: 'PUT_AWAY', quantity: qty.toString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return movement;
  }

  /**
   * Balanced zero-sum bin-to-bin stock movement within the same warehouse.
   */
  static async binTransfer(
    input: {
      warehouseId: string;
      fromBinId: string;
      toBinId: string;
      inventoryItemId: string;
      batchId?: string | null;
      quantity: string;
      idempotencyKey?: string;
      notes?: string;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    if (input.fromBinId === input.toBinId) {
      throw new AppError('Source and destination bins must be different.', 400);
    }

    if (input.idempotencyKey) {
      const existing = await prisma.binMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const qty = new Prisma.Decimal(input.quantity);
    const batchId = input.batchId ?? null;

    const movement = await prisma.$transaction(async tx => {
      // Lock both bins in deterministic ID order to prevent deadlocks
      const lockIds = [input.fromBinId, input.toBinId].sort();
      for (const id of lockIds) {
        await tx.$queryRaw`SELECT id FROM warehouse_bins WHERE id = ${id} FOR UPDATE`;
      }

      const fromBin = await tx.warehouseBin.findUnique({ where: { id: input.fromBinId } });
      if (!fromBin || fromBin.warehouseId !== input.warehouseId) {
        throw new AppError('Source bin not found in specified warehouse.', 404);
      }

      await this.validateBinTargetInTx(tx, input.toBinId, input.warehouseId, input.inventoryItemId, batchId, qty);

      await this.adjustAllocationInTx(
        tx,
        input.warehouseId,
        input.fromBinId,
        input.inventoryItemId,
        batchId,
        qty.neg(),
      );
      await this.adjustAllocationInTx(
        tx,
        input.warehouseId,
        input.toBinId,
        input.inventoryItemId,
        batchId,
        qty,
      );

      return tx.binMovement.create({
        data: {
          movementNumber: generateDocNumber('BMV'),
          warehouseId: input.warehouseId,
          movementType: BinMovementType.BIN_TRANSFER,
          inventoryItemId: input.inventoryItemId,
          batchId,
          fromBinId: input.fromBinId,
          toBinId: input.toBinId,
          quantity: qty,
          idempotencyKey: input.idempotencyKey ?? null,
          performedById: user.userId,
          notes: input.notes ?? null,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'BinMovement',
      entityId: movement.id,
      newState: { movementNumber: movement.movementNumber, type: 'BIN_TRANSFER', quantity: qty.toString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return movement;
  }

  /**
   * Record picking from a specific bin.
   */
  static async pickFromBin(
    input: {
      warehouseId: string;
      fromBinId: string;
      inventoryItemId: string;
      batchId?: string | null;
      quantity: string;
      referenceType?: string;
      referenceId?: string;
      idempotencyKey?: string;
      notes?: string;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    if (input.idempotencyKey) {
      const existing = await prisma.binMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const qty = new Prisma.Decimal(input.quantity);
    const batchId = input.batchId ?? null;

    const movement = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM warehouse_bins WHERE id = ${input.fromBinId} FOR UPDATE`;
      const fromBin = await tx.warehouseBin.findUnique({ where: { id: input.fromBinId } });
      if (!fromBin || fromBin.warehouseId !== input.warehouseId) {
        throw new AppError('Source bin not found in specified warehouse.', 404);
      }

      await this.adjustAllocationInTx(
        tx,
        input.warehouseId,
        input.fromBinId,
        input.inventoryItemId,
        batchId,
        qty.neg(),
      );

      return tx.binMovement.create({
        data: {
          movementNumber: generateDocNumber('BMV'),
          warehouseId: input.warehouseId,
          movementType: BinMovementType.PICK,
          inventoryItemId: input.inventoryItemId,
          batchId,
          fromBinId: input.fromBinId,
          quantity: qty,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          performedById: user.userId,
          notes: input.notes ?? null,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'BinMovement',
      entityId: movement.id,
      newState: { movementNumber: movement.movementNumber, type: 'PICK', quantity: qty.toString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return movement;
  }
}
