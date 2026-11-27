import {
  InventoryDocumentStatus,
  InventoryTransactionType,
  PickingStrategy,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { prisma } from '../../services/prisma.service';
import { generateDocNumber, isBatchExpired, lockInventoryItems, ZERO } from './inventory.utils';

interface LockedCandidateBalance {
  id: string;
  batch_id: string | null;
  quantity_on_hand: string;
  quantity_reserved: string;
  unit_cost: string;
  expiry_date: Date | null;
  received_date: Date | null;
  batch_unit_cost: string | null;
  created_at: Date;
}

export interface ReservationItemRequest {
  inventoryItemId: string;
  baseQuantity: Prisma.Decimal;
}

export interface FulfillmentLineRequest {
  inventoryItemId: string;
  uomId: string;
  requestedQuantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
  reservedBaseQuantity?: Prisma.Decimal;
}

export interface WarehouseItemStockSummary {
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
  available: Prisma.Decimal;
}

function sortFefo(candidates: LockedCandidateBalance[]): LockedCandidateBalance[] {
  return [...candidates].sort((a, b) => {
    const expA = a.expiry_date ? a.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
    const expB = b.expiry_date ? b.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
    if (expA !== expB) return expA - expB;
    const recA = a.received_date ? a.received_date.getTime() : a.created_at.getTime();
    const recB = b.received_date ? b.received_date.getTime() : b.created_at.getTime();
    return recA - recB;
  });
}

async function getUomSymbolsByItem(
  tx: Prisma.TransactionClient,
  itemIds: string[],
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const rows = await tx.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, uom: { select: { symbol: true } } },
  });
  return new Map(rows.map(r => [r.id, r.uom.symbol]));
}

function formatShortageMessage(
  itemName: string,
  requested: Prisma.Decimal,
  available: Prisma.Decimal,
  uomSymbol: string,
): string {
  const shortage = Prisma.Decimal.max(ZERO, requested.sub(available));
  const unit = uomSymbol ? ` ${uomSymbol}` : '';
  return `Insufficient available stock for ${itemName}. Requested: ${requested.toString()}${unit}, Available: ${available.toString()}${unit}, Shortage: ${shortage.toString()}${unit} (Short by ${shortage.toString()}).`;
}

export class InventoryReservationService {
  /**
   * Read-only batch lookup of eligible available stock (on_hand - reserved) across
   * (warehouseId, inventoryItemId) pairs, excluding expired and non-ACCEPTED batches.
   * Mirrors the exact eligibility rules of reserveStockInTx / fulfillReservedStockInTx
   * without acquiring locks or mutating inventory.
   */
  static async getEligibleAvailableByWarehouseAndItem(
    pairs: Array<{ warehouseId: string; inventoryItemId: string }>,
    refDate = new Date(),
  ): Promise<Map<string, Prisma.Decimal>> {
    const summary = await this.getEligibleStockSummaryByWarehouseAndItem(pairs, refDate);
    const result = new Map<string, Prisma.Decimal>();
    for (const [key, val] of summary.entries()) {
      if (val.available.gt(ZERO)) {
        result.set(key, val.available);
      }
    }
    return result;
  }

  /**
   * Read-only batch lookup of eligible on-hand, reserved, and available stock across
   * (warehouseId, inventoryItemId) pairs, excluding expired and non-ACCEPTED batches.
   * Mirrors the exact eligibility rules of reserveStockInTx / fulfillReservedStockInTx
   * without acquiring locks or mutating inventory.
   */
  static async getEligibleStockSummaryByWarehouseAndItem(
    pairs: Array<{ warehouseId: string; inventoryItemId: string }>,
    refDate = new Date(),
  ): Promise<Map<string, WarehouseItemStockSummary>> {
    const result = new Map<string, WarehouseItemStockSummary>();
    if (pairs.length === 0) return result;

    const warehouseIds = [...new Set(pairs.map(p => p.warehouseId))];
    const itemIds = [...new Set(pairs.map(p => p.inventoryItemId))];

    const rows = await prisma.$queryRaw<
      Array<{
        warehouse_id: string;
        inventory_item_id: string;
        quantity_on_hand: string;
        quantity_reserved: string;
        expiry_date: Date | null;
      }>
    >`
      SELECT b.warehouse_id, b.inventory_item_id,
             b.quantity_on_hand::text, b.quantity_reserved::text,
             ib.expiry_date
      FROM inventory_balances b
      LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
      WHERE b.warehouse_id = ANY(${warehouseIds}::text[])
        AND b.inventory_item_id = ANY(${itemIds}::text[])
        AND b.quantity_on_hand > 0
        AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
    `;

    for (const row of rows) {
      if (isBatchExpired(row.expiry_date, refDate)) continue;
      const onHand = Prisma.Decimal.max(ZERO, new Prisma.Decimal(row.quantity_on_hand));
      const reserved = Prisma.Decimal.max(ZERO, new Prisma.Decimal(row.quantity_reserved));
      const avail = Prisma.Decimal.max(ZERO, onHand.sub(reserved));
      const key = `${row.warehouse_id}:${row.inventory_item_id}`;
      const prev = result.get(key) ?? { onHand: ZERO, reserved: ZERO, available: ZERO };
      result.set(key, {
        onHand: prev.onHand.add(onHand),
        reserved: prev.reserved.add(reserved),
        available: prev.available.add(avail),
      });
    }

    return result;
  }

  /**
   * Atomically reserve non-expired available stock in a warehouse inside an active DB transaction.
   * Uses SELECT ... FOR UPDATE to prevent concurrent overselling and reports all insufficient lines.
   */
  static async reserveStockInTx(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    items: ReservationItemRequest[],
  ): Promise<void> {
    if (items.length === 0) return;

    const itemIds = items.map(i => i.inventoryItemId);
    const [lockedItems, uomSymbols] = await Promise.all([
      lockInventoryItems(tx, itemIds),
      getUomSymbolsByItem(tx, itemIds),
    ]);

    const refDate = new Date();
    const shortageErrors: string[] = [];

    for (const req of items) {
      const item = lockedItems.get(req.inventoryItemId);
      if (!item) throw new AppError('Inventory item not found.', 404);

      const candidates = await tx.$queryRaw<LockedCandidateBalance[]>`
        SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
               ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
        FROM inventory_balances b
        LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
        WHERE b.warehouse_id = ${warehouseId}
          AND b.inventory_item_id = ${item.id}
          AND (b.quantity_on_hand - b.quantity_reserved) > 0
          AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
        FOR UPDATE OF b
      `;

      const valid = sortFefo(candidates.filter(c => !isBatchExpired(c.expiry_date, refDate)));
      const totalAvailable = valid.reduce(
        (acc, c) =>
          acc.add(
            Prisma.Decimal.max(
              ZERO,
              new Prisma.Decimal(c.quantity_on_hand).sub(new Prisma.Decimal(c.quantity_reserved)),
            ),
          ),
        ZERO,
      );

      if (totalAvailable.lt(req.baseQuantity)) {
        shortageErrors.push(
          formatShortageMessage(
            item.name,
            req.baseQuantity,
            totalAvailable,
            uomSymbols.get(item.id) || '',
          ),
        );
        continue;
      }

      let remaining = req.baseQuantity;
      for (const cand of valid) {
        if (remaining.lte(ZERO)) break;
        const onHand = new Prisma.Decimal(cand.quantity_on_hand);
        const reserved = new Prisma.Decimal(cand.quantity_reserved);
        const available = onHand.sub(reserved);
        if (available.lte(ZERO)) continue;

        const take = available.gte(remaining) ? remaining : available;
        await tx.inventoryBalance.update({
          where: { id: cand.id },
          data: { quantityReserved: reserved.add(take) },
        });
        remaining = remaining.sub(take);
      }
    }

    if (shortageErrors.length > 0) {
      throw new AppError(shortageErrors.join(' '), 400);
    }
  }

  /**
   * Release previously reserved stock in a warehouse inside an active DB transaction.
   * Releases in FEFO order (non-expired ACCEPTED batches first) to match reserveStockInTx.
   */
  static async releaseReservedStockInTx(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    items: ReservationItemRequest[],
  ): Promise<void> {
    if (items.length === 0) return;

    await lockInventoryItems(
      tx,
      items.map(i => i.inventoryItemId),
    );

    const refDate = new Date();

    for (const req of items) {
      if (req.baseQuantity.lte(ZERO)) continue;

      const reservedRows = await tx.$queryRaw<LockedCandidateBalance[]>`
        SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
               ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
        FROM inventory_balances b
        LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
        WHERE b.warehouse_id = ${warehouseId}
          AND b.inventory_item_id = ${req.inventoryItemId}
          AND b.quantity_reserved > 0
        FOR UPDATE OF b
      `;

      const nonExpired = sortFefo(reservedRows.filter(r => !isBatchExpired(r.expiry_date, refDate)));
      const expiredOrOther = sortFefo(reservedRows.filter(r => isBatchExpired(r.expiry_date, refDate)));
      const ordered = [...nonExpired, ...expiredOrOther];

      let remaining = req.baseQuantity;
      for (const row of ordered) {
        if (remaining.lte(ZERO)) break;
        const reserved = new Prisma.Decimal(row.quantity_reserved);
        const releaseQty = reserved.gte(remaining) ? remaining : reserved;

        await tx.inventoryBalance.update({
          where: { id: row.id },
          data: { quantityReserved: reserved.sub(releaseQty) },
        });

        remaining = remaining.sub(releaseQty);
      }
    }
  }

  /**
   * Fulfill reserved stock for a Sales Order by atomically releasing reservation and
   * posting an InventoryIssue + InventoryTransaction (ISSUE) using FEFO batch picking.
   */
  static async fulfillReservedStockInTx(
    tx: Prisma.TransactionClient,
    params: {
      warehouseId: string;
      orderNumber: string;
      orderId: string;
      idempotencyKey: string;
      userId: string;
      notes?: string | null;
      lines: FulfillmentLineRequest[];
    },
  ) {
    const itemIds = params.lines.map(l => l.inventoryItemId);
    const [lockedItems, uomSymbols] = await Promise.all([
      lockInventoryItems(tx, itemIds),
      getUomSymbolsByItem(tx, itemIds),
    ]);

    // 1. Release only this order's reserved quantities for the fulfilled items in FEFO order
    // so we never release another order's active reservation if this line had 0 or partial reservation.
    const toRelease = params.lines
      .map(l => ({
        inventoryItemId: l.inventoryItemId,
        baseQuantity:
          l.reservedBaseQuantity !== undefined
            ? Prisma.Decimal.min(l.baseQuantity, Prisma.Decimal.max(ZERO, l.reservedBaseQuantity))
            : l.baseQuantity,
      }))
      .filter(l => l.baseQuantity.gt(ZERO));

    await this.releaseReservedStockInTx(tx, params.warehouseId, toRelease);

    // 2. Create posted InventoryIssue document for full traceability
    const issue = await tx.inventoryIssue.create({
      data: {
        issueNumber: generateDocNumber('ISS'),
        warehouseId: params.warehouseId,
        status: InventoryDocumentStatus.POSTED,
        pickingStrategy: PickingStrategy.FEFO,
        issueDate: new Date(),
        departmentRef: 'SALES_DISPATCH',
        purpose: `Sales Order Fulfillment: ${params.orderNumber}`,
        notes: params.notes || `Fulfilled Sales Order ${params.orderNumber}`,
        idempotencyKey: params.idempotencyKey,
        createdById: params.userId,
        approvedById: params.userId,
        approvedAt: new Date(),
        postedById: params.userId,
        postedAt: new Date(),
      },
    });

    // 3. Append immutable InventoryTransaction ledger entry
    const invTx = await tx.inventoryTransaction.create({
      data: {
        transactionNumber: generateDocNumber('TXN'),
        transactionType: InventoryTransactionType.ISSUE,
        referenceType: 'SALES_ORDER_FULFILLMENT',
        referenceId: params.orderId,
        referenceNumber: params.orderNumber,
        idempotencyKey: `${params.idempotencyKey}-TX`,
        warehouseId: params.warehouseId,
        transactionDate: new Date(),
        postedById: params.userId,
        remarks: `Sales Order ${params.orderNumber} fulfillment (${issue.issueNumber})`,
      },
    });

    const refDate = new Date();
    let txLineCounter = 0;
    const shortageErrors: string[] = [];

    for (let i = 0; i < params.lines.length; i++) {
      const line = params.lines[i];
      const item = lockedItems.get(line.inventoryItemId);
      if (!item) throw new AppError('Inventory item not found.', 404);

      const candidates = await tx.$queryRaw<LockedCandidateBalance[]>`
        SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
               ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
        FROM inventory_balances b
        LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
        WHERE b.warehouse_id = ${params.warehouseId}
          AND b.inventory_item_id = ${item.id}
          AND (b.quantity_on_hand - b.quantity_reserved) > 0
          AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
        FOR UPDATE OF b
      `;

      const valid = sortFefo(candidates.filter(c => !isBatchExpired(c.expiry_date, refDate)));
      const totalAvailable = valid.reduce(
        (acc, c) =>
          acc.add(
            Prisma.Decimal.max(
              ZERO,
              new Prisma.Decimal(c.quantity_on_hand).sub(new Prisma.Decimal(c.quantity_reserved)),
            ),
          ),
        ZERO,
      );

      if (totalAvailable.lt(line.baseQuantity)) {
        shortageErrors.push(
          formatShortageMessage(
            item.name,
            line.baseQuantity,
            totalAvailable,
            uomSymbols.get(item.id) || '',
          ),
        );
        continue;
      }

      let remaining = line.baseQuantity;
      let lineTotalCost = ZERO;

      for (const cand of valid) {
        if (remaining.lte(ZERO)) break;
        const onHand = new Prisma.Decimal(cand.quantity_on_hand);
        const reserved = new Prisma.Decimal(cand.quantity_reserved);
        const available = onHand.sub(reserved);
        if (available.lte(ZERO)) continue;

        const pickQty = available.gte(remaining) ? remaining : available;
        const newOnHand = onHand.sub(pickQty);

        const outwardUnitCost =
          item.valuation_method === 'MWAC'
            ? new Prisma.Decimal(item.moving_average_cost)
            : new Prisma.Decimal(cand.unit_cost || cand.batch_unit_cost || '0');

        const pickCost = pickQty.mul(outwardUnitCost).toDecimalPlaces(4);
        lineTotalCost = lineTotalCost.add(pickCost);
        const newTotalVal = newOnHand.mul(outwardUnitCost).toDecimalPlaces(4);

        await tx.inventoryBalance.update({
          where: { id: cand.id },
          data: {
            quantityOnHand: newOnHand,
            totalValue: newTotalVal,
            lastTransactionAt: new Date(),
          },
        });

        txLineCounter += 1;
        await tx.inventoryTransactionLine.create({
          data: {
            transactionId: invTx.id,
            lineNumber: txLineCounter,
            inventoryItemId: item.id,
            batchId: cand.batch_id,
            uomId: item.uom_id,
            quantity: pickQty.neg(),
            baseUomId: item.uom_id,
            baseQuantity: pickQty.neg(),
            unitCost: outwardUnitCost,
            totalCost: pickCost.neg(),
            balanceAfter: newOnHand,
            mwacAfter:
              item.valuation_method === 'MWAC'
                ? new Prisma.Decimal(item.moving_average_cost)
                : null,
          },
        });

        remaining = remaining.sub(pickQty);
      }

      const avgUnitCost = line.baseQuantity.gt(ZERO)
        ? lineTotalCost.div(line.baseQuantity).toDecimalPlaces(4)
        : ZERO;

      await tx.inventoryIssueLine.create({
        data: {
          issueId: issue.id,
          lineNumber: i + 1,
          inventoryItemId: item.id,
          uomId: line.uomId,
          requestedQuantity: line.requestedQuantity,
          baseQuantity: line.baseQuantity,
          unitCost: avgUnitCost,
          totalCost: lineTotalCost,
        },
      });
    }

    if (shortageErrors.length > 0) {
      throw new AppError(shortageErrors.join(' '), 400);
    }

    return { inventoryIssue: issue, inventoryTransaction: invTx };
  }
}
