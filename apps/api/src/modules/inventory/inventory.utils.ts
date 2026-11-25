import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';

export const ZERO = new Prisma.Decimal(0);

export interface UserContext {
  userId: string;
  roles: string[];
}

export const isGlobalWarehouseRole = (roles: string[]): boolean => {
  return roles.includes('OWNER') || roles.includes('ADMIN');
};

/**
 * Returns the list of warehouse IDs a user is allowed to access.
 * Returns null if the user has global warehouse access (OWNER / ADMIN).
 */
export const getAuthorizedWarehouseIds = async (
  user: UserContext,
  requiredLevel: 'READ' | 'READ_WRITE' = 'READ',
): Promise<string[] | null> => {
  if (isGlobalWarehouseRole(user.roles)) {
    return null;
  }

  const accessList = await prisma.userWarehouseAccess.findMany({
    where: { userId: user.userId },
    select: { warehouseId: true, accessLevel: true },
  });

  if (requiredLevel === 'READ_WRITE') {
    return accessList.filter(a => a.accessLevel !== 'READ').map(a => a.warehouseId);
  }
  return accessList.map(a => a.warehouseId);
};

/**
 * Enforces warehouse access inside services for documents whose warehouseId is fetched from DB.
 */
export const assertWarehouseAccess = async (
  user: UserContext,
  warehouseId: string,
  requiredLevel: 'READ' | 'READ_WRITE' = 'READ',
): Promise<void> => {
  if (isGlobalWarehouseRole(user.roles)) {
    return;
  }

  const access = await prisma.userWarehouseAccess.findUnique({
    where: {
      userId_warehouseId: {
        userId: user.userId,
        warehouseId,
      },
    },
  });

  if (!access) {
    throw new AppError('Access denied: You are not authorized for this warehouse facility.', 403);
  }

  if (requiredLevel === 'READ_WRITE' && access.accessLevel === 'READ') {
    throw new AppError('Access denied: You have read-only access to this warehouse facility.', 403);
  }
};

/**
 * Generate unique human-readable document/transaction number.
 */
export const generateDocNumber = (prefix: string): string => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
};

/**
 * Convert quantity from fromUomId to toUomId using active UnitConversion rules and Prisma.Decimal.
 */
export const convertQuantityDecimal = async (
  tx: Prisma.TransactionClient,
  quantity: Prisma.Decimal,
  fromUomId: string,
  toUomId: string,
): Promise<{ converted: Prisma.Decimal; multiplier: Prisma.Decimal }> => {
  if (fromUomId === toUomId) {
    return { converted: quantity.toDecimalPlaces(4), multiplier: new Prisma.Decimal(1) };
  }

  const direct = await tx.unitConversion.findUnique({
    where: {
      fromUomId_toUomId: { fromUomId, toUomId },
    },
  });

  if (direct && direct.isActive) {
    const converted = quantity.mul(direct.multiplier).toDecimalPlaces(4);
    return { converted, multiplier: direct.multiplier };
  }

  const inverse = await tx.unitConversion.findUnique({
    where: {
      fromUomId_toUomId: { fromUomId: toUomId, toUomId: fromUomId },
    },
  });

  if (inverse && inverse.isActive) {
    const multiplier = new Prisma.Decimal(1).div(inverse.multiplier);
    const converted = quantity.div(inverse.multiplier).toDecimalPlaces(4);
    return { converted, multiplier };
  }

  throw new AppError('No active unit conversion rule found between the specified units.', 400);
};

export interface LockedInventoryItem {
  id: string;
  item_type: string;
  uom_id: string;
  valuation_method: string;
  moving_average_cost: string;
  code: string;
  name: string;
  is_active: boolean;
}

/**
 * Acquire PostgreSQL FOR UPDATE row locks on inventory_items in deterministic ID order
 * to prevent deadlocks and race conditions during MWAC and stock mutations.
 */
export const lockInventoryItems = async (
  tx: Prisma.TransactionClient,
  itemIds: string[],
): Promise<Map<string, LockedInventoryItem>> => {
  const uniqueSorted = [...new Set(itemIds)].sort();
  if (uniqueSorted.length === 0) return new Map();

  const rows = await tx.$queryRaw<LockedInventoryItem[]>`
    SELECT id, item_type, uom_id, valuation_method, moving_average_cost::text, code, name, is_active
    FROM inventory_items
    WHERE id = ANY(${uniqueSorted}::text[])
    ORDER BY id ASC
    FOR UPDATE
  `;

  const map = new Map<string, LockedInventoryItem>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
};

export interface LockedBalanceRow {
  id: string;
  warehouse_id: string;
  inventory_item_id: string;
  batch_id: string | null;
  quantity_on_hand: string;
  quantity_reserved: string;
  unit_cost: string;
  total_value: string;
}

/**
 * Lock or create an InventoryBalance row for (warehouseId, inventoryItemId, batchId) using SELECT FOR UPDATE.
 */
export const lockOrCreateBalance = async (
  tx: Prisma.TransactionClient,
  warehouseId: string,
  inventoryItemId: string,
  batchId: string | null,
): Promise<LockedBalanceRow> => {
  const findLocked = async () => {
    if (batchId) {
      return tx.$queryRaw<LockedBalanceRow[]>`
        SELECT id, warehouse_id, inventory_item_id, batch_id, quantity_on_hand::text, quantity_reserved::text, unit_cost::text, total_value::text
        FROM inventory_balances
        WHERE warehouse_id = ${warehouseId} AND inventory_item_id = ${inventoryItemId} AND batch_id = ${batchId}
        FOR UPDATE
      `;
    }
    return tx.$queryRaw<LockedBalanceRow[]>`
      SELECT id, warehouse_id, inventory_item_id, batch_id, quantity_on_hand::text, quantity_reserved::text, unit_cost::text, total_value::text
      FROM inventory_balances
      WHERE warehouse_id = ${warehouseId} AND inventory_item_id = ${inventoryItemId} AND batch_id IS NULL
      FOR UPDATE
    `;
  };

  let rows = await findLocked();
  if (rows.length > 0) {
    return rows[0];
  }

  // Create row if it doesn't exist, handling concurrent insert race via savepoint/retry
  try {
    await tx.inventoryBalance.create({
      data: {
        warehouseId,
        inventoryItemId,
        batchId,
        quantityOnHand: ZERO,
        quantityReserved: ZERO,
        unitCost: ZERO,
        totalValue: ZERO,
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      throw err;
    }
  }

  rows = await findLocked();
  if (rows.length === 0) {
    throw new AppError('Failed to lock inventory balance row.', 500);
  }
  return rows[0];
};

/**
 * Check if a date-only or timestamp expiry date is strictly before today's UTC date.
 */
export const isBatchExpired = (expiryDate: Date | null | undefined, refDate = new Date()): boolean => {
  if (!expiryDate) return false;
  const exp = new Date(Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate()));
  const today = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate()));
  return exp.getTime() < today.getTime();
};
