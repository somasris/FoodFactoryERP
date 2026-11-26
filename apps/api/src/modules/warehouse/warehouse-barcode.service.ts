import { AuditAction, BarcodeEntityType } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  getAuthorizedWarehouseIds,
  UserContext,
} from '../inventory/inventory.utils';
import { WarehouseLocationService } from './warehouse-location.service';

const PREFIX_MAP: Record<BarcodeEntityType, string> = {
  RAW_MATERIAL: 'FF-RM',
  PACKAGING_MATERIAL: 'FF-PKG',
  FINISHED_PRODUCT: 'FF-FG',
  INVENTORY_BATCH: 'FF-BAT',
  WAREHOUSE_BIN: 'FF-BIN',
  PURCHASE_RECEIPT: 'FF-RCP',
  WORK_ORDER: 'FF-WO',
};

export class WarehouseBarcodeService {
  static async listBarcodes(
    filters: { entityType?: BarcodeEntityType; warehouseId?: string },
    user: UserContext,
  ) {
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.barcodeLabel.findMany({
      where: {
        isActive: true,
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(authWhIds
          ? { OR: [{ warehouseId: null }, { warehouseId: { in: authWhIds } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  static async createOrGetBarcode(
    input: {
      entityType: BarcodeEntityType;
      entityId: string;
      barcodeValue?: string;
      warehouseId?: string | null;
      labelFormat?: 'CODE128' | 'QR';
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.warehouseId) {
      await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    }

    const existingForEntity = await prisma.barcodeLabel.findUnique({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
    });
    if (existingForEntity) {
      return existingForEntity;
    }

    const shortId = input.entityId.replace(/-/g, '').slice(0, 10).toUpperCase();
    const barcodeValue = (
      input.barcodeValue?.trim() || `${PREFIX_MAP[input.entityType]}-${shortId}`
    ).toUpperCase();

    const duplicateValue = await prisma.barcodeLabel.findUnique({
      where: { barcodeValue },
    });
    if (duplicateValue) {
      throw new AppError(`Barcode value '${barcodeValue}' is already assigned to another entity.`, 409);
    }

    const qrPayload = JSON.stringify({
      v: 1,
      type: input.entityType,
      id: input.entityId,
      code: barcodeValue,
      wh: input.warehouseId ?? undefined,
    });

    const created = await prisma.barcodeLabel.create({
      data: {
        barcodeValue,
        qrPayload,
        entityType: input.entityType,
        entityId: input.entityId,
        warehouseId: input.warehouseId ?? null,
        labelFormat: input.labelFormat ?? 'CODE128',
        createdById: user.userId,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'BarcodeLabel',
      entityId: created.id,
      newState: { barcodeValue: created.barcodeValue, entityType: created.entityType },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  /**
   * Lookup an entity by scanned barcode, QR JSON payload, or manual entity code.
   * Strictly enforces UserWarehouseAccess so users cannot probe unauthorized warehouses/batches.
   */
  static async lookup(codeInput: string, user: UserContext) {
    let rawCode = codeInput.trim();
    if (!rawCode) throw new AppError('Barcode or code is required.', 400);

    // Support scanning QR JSON payloads directly
    if (rawCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawCode) as { code?: string };
        if (parsed.code) rawCode = parsed.code;
      } catch {
        // Treat as raw string
      }
    }

    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    const label = await prisma.barcodeLabel.findUnique({
      where: { barcodeValue: rawCode.toUpperCase() },
    });

    if (label) {
      if (label.warehouseId) {
        await assertWarehouseAccess(user, label.warehouseId, 'READ');
      }

      if (label.entityType === 'WAREHOUSE_BIN') {
        const bin = await prisma.warehouseBin.findUnique({
          where: { id: label.entityId },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            allocations: {
              where: { quantity: { gt: 0 } },
              include: {
                inventoryItem: { select: { id: true, code: true, name: true } },
                batch: { select: { id: true, batchNumber: true, qualityStatus: true, expiryDate: true } },
              },
            },
          },
        });
        if (!bin) throw new AppError('Linked warehouse bin not found.', 404);
        await assertWarehouseAccess(user, bin.warehouseId, 'READ');
        return { entityType: label.entityType, barcode: label, entity: bin };
      }

      if (label.entityType === 'INVENTORY_BATCH') {
        const batch = await prisma.inventoryBatch.findUnique({
          where: { id: label.entityId },
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, itemType: true } },
            balances: {
              where: authWhIds ? { warehouseId: { in: authWhIds } } : undefined,
              include: { warehouse: { select: { id: true, code: true, name: true } } },
            },
            binAllocations: {
              where: {
                quantity: { gt: 0 },
                ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
              },
              include: { bin: { select: { id: true, code: true, name: true } } },
            },
          },
        });
        if (!batch) throw new AppError('Linked batch not found.', 404);
        return { entityType: label.entityType, barcode: label, entity: batch };
      }

      if (
        label.entityType === 'RAW_MATERIAL' ||
        label.entityType === 'PACKAGING_MATERIAL' ||
        label.entityType === 'FINISHED_PRODUCT'
      ) {
        const item = await prisma.inventoryItem.findUnique({
          where: { id: label.entityId },
          include: {
            uom: { select: { id: true, code: true, symbol: true } },
            balances: {
              where: authWhIds ? { warehouseId: { in: authWhIds } } : undefined,
              include: { warehouse: { select: { id: true, code: true, name: true } } },
            },
          },
        });
        if (!item) throw new AppError('Linked inventory item not found.', 404);
        return { entityType: label.entityType, barcode: label, entity: item };
      }

      if (label.entityType === 'PURCHASE_RECEIPT') {
        const receipt = await prisma.inventoryReceipt.findUnique({
          where: { id: label.entityId },
          include: { warehouse: { select: { id: true, code: true, name: true } }, lines: true },
        });
        if (!receipt) throw new AppError('Linked receipt not found.', 404);
        await assertWarehouseAccess(user, receipt.warehouseId, 'READ');
        return { entityType: label.entityType, barcode: label, entity: receipt };
      }

      if (label.entityType === 'WORK_ORDER') {
        const wo = await prisma.workOrder.findUnique({
          where: { id: label.entityId },
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        });
        if (!wo) throw new AppError('Linked work order not found.', 404);
        await assertWarehouseAccess(user, wo.warehouseId, 'READ');
        return { entityType: label.entityType, barcode: label, entity: wo };
      }
    }

    // Fallback: manual lookup by Bin code, Item code, or Batch number
    const binByCode = await prisma.warehouseBin.findFirst({
      where: {
        code: rawCode.toUpperCase(),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
      },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (binByCode) {
      return { entityType: 'WAREHOUSE_BIN' as BarcodeEntityType, barcode: null, entity: binByCode };
    }

    const itemByCode = await prisma.inventoryItem.findUnique({
      where: { code: rawCode },
      include: { uom: { select: { id: true, code: true, symbol: true } } },
    });
    if (itemByCode) {
      const entityType: BarcodeEntityType =
        itemByCode.itemType === 'FINISHED_GOODS'
          ? 'FINISHED_PRODUCT'
          : itemByCode.itemType === 'PACKAGING'
            ? 'PACKAGING_MATERIAL'
            : 'RAW_MATERIAL';
      return { entityType, barcode: null, entity: itemByCode };
    }

    const batchByNumber = await prisma.inventoryBatch.findFirst({
      where: { batchNumber: rawCode },
      include: {
        inventoryItem: { select: { id: true, code: true, name: true } },
        balances: {
          where: authWhIds ? { warehouseId: { in: authWhIds } } : undefined,
        },
      },
    });
    if (batchByNumber) {
      return { entityType: 'INVENTORY_BATCH' as BarcodeEntityType, barcode: null, entity: batchByNumber };
    }

    throw new AppError(`No authorized warehouse entity found for barcode/code '${rawCode}'.`, 404);
  }

  /**
   * Execute a scan-based warehouse operation using the exact same validation & RBAC as manual APIs.
   */
  static async executeScanOperation(
    input: {
      operation: 'PUT_AWAY' | 'BIN_TRANSFER' | 'PICK';
      warehouseId: string;
      itemOrBatchBarcode: string;
      fromBinBarcode?: string;
      toBinBarcode?: string;
      quantity: string;
      idempotencyKey?: string;
      notes?: string;
    },
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const resolvedTarget = await this.lookup(input.itemOrBatchBarcode, user);
    let inventoryItemId: string;
    let batchId: string | null = null;

    if (resolvedTarget.entityType === 'INVENTORY_BATCH') {
      const batch = resolvedTarget.entity as { id: string; inventoryItemId: string };
      inventoryItemId = batch.inventoryItemId;
      batchId = batch.id;
    } else if (
      resolvedTarget.entityType === 'RAW_MATERIAL' ||
      resolvedTarget.entityType === 'PACKAGING_MATERIAL' ||
      resolvedTarget.entityType === 'FINISHED_PRODUCT'
    ) {
      const item = resolvedTarget.entity as { id: string };
      inventoryItemId = item.id;
    } else {
      throw new AppError('Scanned item barcode must resolve to an inventory item or batch.', 400);
    }

    const resolveBinId = async (code?: string) => {
      if (!code) return undefined;
      const binRes = await this.lookup(code, user);
      if (binRes.entityType !== 'WAREHOUSE_BIN') {
        throw new AppError(`Barcode '${code}' is not a warehouse bin.`, 400);
      }
      return (binRes.entity as { id: string }).id;
    };

    if (input.operation === 'PUT_AWAY') {
      const toBinId = await resolveBinId(input.toBinBarcode);
      if (!toBinId) throw new AppError('Destination bin barcode is required for put-away.', 400);
      return WarehouseLocationService.putAway(
        {
          warehouseId: input.warehouseId,
          toBinId,
          inventoryItemId,
          batchId,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
        },
        user,
        meta,
      );
    }

    if (input.operation === 'BIN_TRANSFER') {
      const fromBinId = await resolveBinId(input.fromBinBarcode);
      const toBinId = await resolveBinId(input.toBinBarcode);
      if (!fromBinId || !toBinId) {
        throw new AppError('Both source and destination bin barcodes are required for bin transfer.', 400);
      }
      return WarehouseLocationService.binTransfer(
        {
          warehouseId: input.warehouseId,
          fromBinId,
          toBinId,
          inventoryItemId,
          batchId,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
        },
        user,
        meta,
      );
    }

    const fromBinId = await resolveBinId(input.fromBinBarcode);
    if (!fromBinId) throw new AppError('Source bin barcode is required for picking.', 400);
    return WarehouseLocationService.pickFromBin(
      {
        warehouseId: input.warehouseId,
        fromBinId,
        inventoryItemId,
        batchId,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
      },
      user,
      meta,
    );
  }
}
