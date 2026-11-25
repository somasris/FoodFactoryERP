import {
  InventoryDocumentStatus,
  InventoryTransactionType,
  PickingStrategy,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
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
}

export class InventoryReservationService {
  /**
   * Atomically reserve non-expired available stock in a warehouse inside an active DB transaction.
   * Uses SELECT ... FOR UPDATE to prevent concurrent overselling.
   */
  static async reserveStockInTx(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    items: ReservationItemRequest[],
  ): Promise<void> {
    if (items.length === 0) return;

    const lockedItems = await lockInventoryItems(
      tx,
      items.map(i => i.inventoryItemId),
    );

    const refDate = new Date();

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

      const valid = candidates.filter(c => !isBatchExpired(c.expiry_date, refDate));
      valid.sort((a, b) => {
        const expA = a.expiry_date ? a.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
        const expB = b.expiry_date ? b.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
        if (expA !== expB) return expA - expB;
        const recA = a.received_date ? a.received_date.getTime() : a.created_at.getTime();
        const recB = b.received_date ? b.received_date.getTime() : b.created_at.getTime();
        return recA - recB;
      });

      let remaining = req.baseQuantity;

      for (const cand of valid) {
        if (remaining.lte(ZERO)) break;
        const onHand = new Prisma.Decimal(cand.quantity_on_hand);
        const reserved = new Prisma.Decimal(cand.quantity_reserved);
        const available = onHand.sub(reserved);
        if (available.lte(ZERO)) continue;

        const take = available.gte(remaining) ? remaining : available;
        const newReserved = reserved.add(take);

        await tx.inventoryBalance.update({
          where: { id: cand.id },
          data: { quantityReserved: newReserved },
        });

        remaining = remaining.sub(take);
      }

      if (remaining.gt(ZERO)) {
        throw new AppError(
          `Insufficient available non-expired stock for item ${item.code} (${item.name}). Short by ${remaining.toString()}.`,
          400,
        );
      }
    }
  }

  /**
   * Release previously reserved stock in a warehouse inside an active DB transaction.
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
        ORDER BY b.created_at DESC
        FOR UPDATE OF b
      `;

      let remaining = req.baseQuantity;
      for (const row of reservedRows) {
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
    const lockedItems = await lockInventoryItems(
      tx,
      params.lines.map(l => l.inventoryItemId),
    );

    // 1. Release the reserved quantities for the fulfilled items
    await this.releaseReservedStockInTx(
      tx,
      params.warehouseId,
      params.lines.map(l => ({
        inventoryItemId: l.inventoryItemId,
        baseQuantity: l.baseQuantity,
      })),
    );

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

      const valid = candidates.filter(c => !isBatchExpired(c.expiry_date, refDate));
      valid.sort((a, b) => {
        const expA = a.expiry_date ? a.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
        const expB = b.expiry_date ? b.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
        if (expA !== expB) return expA - expB;
        const recA = a.received_date ? a.received_date.getTime() : a.created_at.getTime();
        const recB = b.received_date ? b.received_date.getTime() : b.created_at.getTime();
        return recA - recB;
      });

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

      if (remaining.gt(ZERO)) {
        throw new AppError(
          `Insufficient available non-expired stock for item ${item.code} during fulfillment. Short by ${remaining.toString()}.`,
          400,
        );
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

    return { inventoryIssue: issue, inventoryTransaction: invTx };
  }
}
