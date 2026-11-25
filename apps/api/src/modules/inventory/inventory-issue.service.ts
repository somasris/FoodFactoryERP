import { AuditAction, InventoryDocumentStatus, InventoryTransactionType, PickingStrategy, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta, paginatedResult, PaginationParams, toPlainJson } from '../master-data/master-data.utils';
import { CreateIssueInput } from './inventory.types';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  isBatchExpired,
  lockInventoryItems,
  UserContext,
  ZERO,
} from './inventory.utils';

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

export class InventoryIssueService {
  static async list(
    params: PaginationParams,
    user: UserContext,
    filters: { warehouseId?: string; status?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryIssueWhereInput = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (filters.status) where.status = filters.status as InventoryDocumentStatus;
    if (params.search) {
      where.OR = [
        { issueNumber: { contains: params.search, mode: 'insensitive' } },
        { departmentRef: { contains: params.search, mode: 'insensitive' } },
        { purpose: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryIssue.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              inventoryItem: { select: { id: true, code: true, name: true, itemType: true } },
              uom: { select: { id: true, code: true, symbol: true } },
              batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            },
          },
        },
      }),
      prisma.inventoryIssue.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getById(id: string, user: UserContext) {
    const issue = await prisma.inventoryIssue.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, itemType: true, valuationMethod: true } },
            uom: { select: { id: true, code: true, symbol: true } },
            batch: true,
          },
        },
      },
    });
    if (!issue) throw new AppError('Inventory issue not found.', 404);
    await assertWarehouseAccess(user, issue.warehouseId, 'READ');
    return issue;
  }

  static async create(input: CreateIssueInput, user: UserContext, meta: AuditMeta) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || !warehouse.isActive) {
      throw new AppError('Active warehouse not found.', 404);
    }

    const created = await prisma.$transaction(async tx => {
      const preparedLines: Prisma.InventoryIssueLineCreateWithoutIssueInput[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
        if (!item || !item.isActive) {
          throw new AppError(`Active inventory item not found for line ${i + 1}.`, 404);
        }

        if (line.batchId) {
          const batch = await tx.inventoryBatch.findUnique({ where: { id: line.batchId } });
          if (!batch || batch.inventoryItemId !== item.id) {
            throw new AppError(`Line ${i + 1}: Invalid batch for inventory item.`, 400);
          }
          if (isBatchExpired(batch.expiryDate)) {
            throw new AppError(`Line ${i + 1}: Batch ${batch.batchNumber} is expired and cannot be issued.`, 400);
          }
          if (batch.qualityStatus !== 'ACCEPTED') {
            throw new AppError(
              `Line ${i + 1}: Batch ${batch.batchNumber} is ${batch.qualityStatus} and cannot be issued.`,
              400,
            );
          }
        }

        const reqQty = new Prisma.Decimal(line.requestedQuantity);
        const { converted: baseQty } = await convertQuantityDecimal(tx, reqQty, line.uomId, item.uomId);

        preparedLines.push({
          lineNumber: i + 1,
          inventoryItem: { connect: { id: item.id } },
          uom: { connect: { id: line.uomId } },
          requestedQuantity: reqQty,
          baseQuantity: baseQty,
          ...(line.batchId ? { batch: { connect: { id: line.batchId } } } : {}),
          notes: line.notes ?? null,
        });
      }

      return tx.inventoryIssue.create({
        data: {
          issueNumber: generateDocNumber('ISS'),
          warehouseId: input.warehouseId,
          status: InventoryDocumentStatus.DRAFT,
          pickingStrategy: input.pickingStrategy as PickingStrategy,
          issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
          departmentRef: input.departmentRef ?? null,
          purpose: input.purpose ?? null,
          notes: input.notes ?? null,
          createdById: user.userId,
          lines: { create: preparedLines },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'InventoryIssue',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async submit(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryIssue.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory issue not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status !== 'DRAFT') {
      throw new AppError(`Only DRAFT issues can be submitted (current status: ${existing.status}).`, 400);
    }

    const updated = await prisma.inventoryIssue.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.SUBMITTED,
        submittedById: user.userId,
        submittedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'InventoryIssue',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: 'Submitted inventory issue for approval',
    });

    return updated;
  }

  static async approve(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryIssue.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory issue not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status !== 'SUBMITTED' && existing.status !== 'DRAFT') {
      throw new AppError(`Issue cannot be approved from status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryIssue.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.APPROVED,
        approvedById: user.userId,
        approvedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.APPROVE,
      entityType: 'InventoryIssue',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async cancel(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.inventoryIssue.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory issue not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');
    if (existing.status === 'POSTED' || existing.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel issue in status ${existing.status}.`, 400);
    }

    const updated = await prisma.inventoryIssue.update({
      where: { id },
      data: {
        status: InventoryDocumentStatus.CANCELLED,
        cancelledById: user.userId,
        cancelledAt: new Date(),
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CANCEL,
      entityType: 'InventoryIssue',
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async post(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `POST-ISS-${id}`;

    const existingByKey = await prisma.inventoryIssue.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: { lines: true, warehouse: true },
    });
    if (existingByKey && existingByKey.status === 'POSTED') {
      await assertWarehouseAccess(user, existingByKey.warehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const posted = await prisma.$transaction(async tx => {
      const lockedDoc = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM inventory_issues WHERE id = ${id} FOR UPDATE
      `;
      if (lockedDoc.length === 0) {
        throw new AppError('Inventory issue not found.', 404);
      }

      const issue = await tx.inventoryIssue.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });

      await assertWarehouseAccess(user, issue.warehouseId, 'READ_WRITE');

      if (issue.status === 'POSTED') {
        if (issue.idempotencyKey === effectiveKey) return issue;
        throw new AppError('Inventory issue has already been posted.', 409);
      }
      if (issue.status !== 'APPROVED') {
        throw new AppError(`Issue must be APPROVED before posting (current status: ${issue.status}).`, 400);
      }

      const lockedItems = await lockInventoryItems(
        tx,
        issue.lines.map(l => l.inventoryItemId),
      );

      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionNumber: generateDocNumber('TXN'),
          transactionType: InventoryTransactionType.ISSUE,
          referenceType: 'ISSUE',
          referenceId: issue.id,
          referenceNumber: issue.issueNumber,
          idempotencyKey: effectiveKey,
          warehouseId: issue.warehouseId,
          transactionDate: issue.issueDate,
          postedById: user.userId,
          remarks: issue.purpose || issue.notes || `Posted issue ${issue.issueNumber}`,
        },
      });

      let txLineCounter = 0;

      for (const line of issue.lines) {
        const item = lockedItems.get(line.inventoryItemId);
        if (!item) throw new AppError('Inventory item not found.', 404);

        const neededBaseQty = new Prisma.Decimal(line.baseQuantity);

        // Lock all candidate balance rows for this warehouse + item (or specific batch)
        const candidates = line.batchId
          ? await tx.$queryRaw<LockedCandidateBalance[]>`
              SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
                     ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
              FROM inventory_balances b
              LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
              WHERE b.warehouse_id = ${issue.warehouseId}
                AND b.inventory_item_id = ${item.id}
                AND b.batch_id = ${line.batchId}
                AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
              FOR UPDATE OF b
            `
          : await tx.$queryRaw<LockedCandidateBalance[]>`
              SELECT b.id, b.batch_id, b.quantity_on_hand::text, b.quantity_reserved::text, b.unit_cost::text,
                     ib.expiry_date, ib.received_date, ib.unit_cost::text AS batch_unit_cost, b.created_at
              FROM inventory_balances b
              LEFT JOIN inventory_batches ib ON ib.id = b.batch_id
              WHERE b.warehouse_id = ${issue.warehouseId}
                AND b.inventory_item_id = ${item.id}
                AND (b.quantity_on_hand - b.quantity_reserved) > 0
                AND (ib.id IS NULL OR ib.quality_status = 'ACCEPTED')
              FOR UPDATE OF b
            `;

        // Filter out expired batches
        const validCandidates = candidates.filter(c => !isBatchExpired(c.expiry_date, issue.issueDate));

        if (line.batchId && candidates.length > 0 && validCandidates.length === 0) {
          throw new AppError(`Line ${line.lineNumber}: Selected batch is expired and cannot be issued.`, 400);
        }

        // Sort according to pickingStrategy: FEFO or FIFO
        validCandidates.sort((a, b) => {
          if (issue.pickingStrategy === 'FEFO') {
            const expA = a.expiry_date ? a.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
            const expB = b.expiry_date ? b.expiry_date.getTime() : Number.MAX_SAFE_INTEGER;
            if (expA !== expB) return expA - expB;
          }
          const recA = a.received_date ? a.received_date.getTime() : a.created_at.getTime();
          const recB = b.received_date ? b.received_date.getTime() : b.created_at.getTime();
          return recA - recB;
        });

        let remainingToPick = neededBaseQty;
        let lineTotalCost = ZERO;

        for (const cand of validCandidates) {
          if (remainingToPick.lte(ZERO)) break;

          const onHand = new Prisma.Decimal(cand.quantity_on_hand);
          const reserved = new Prisma.Decimal(cand.quantity_reserved);
          const available = onHand.sub(reserved);

          if (available.lte(ZERO)) continue;

          const pickQty = available.gte(remainingToPick) ? remainingToPick : available;
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

          remainingToPick = remainingToPick.sub(pickQty);
        }

        if (remainingToPick.gt(ZERO)) {
          throw new AppError(
            `Insufficient available non-expired stock for item ${item.code} (${item.name}). Short by ${remainingToPick.toString()}.`,
            400,
          );
        }

        const avgLineUnitCost = neededBaseQty.gt(ZERO)
          ? lineTotalCost.div(neededBaseQty).toDecimalPlaces(4)
          : ZERO;

        await tx.inventoryIssueLine.update({
          where: { id: line.id },
          data: {
            unitCost: avgLineUnitCost,
            totalCost: lineTotalCost,
          },
        });
      }

      return tx.inventoryIssue.update({
        where: { id: issue.id },
        data: {
          status: InventoryDocumentStatus.POSTED,
          postedById: user.userId,
          postedAt: new Date(),
          idempotencyKey: effectiveKey,
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.POST,
      entityType: 'InventoryIssue',
      entityId: posted.id,
      previousState: { status: 'APPROVED' },
      newState: { status: posted.status, issueNumber: posted.issueNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return posted;
  }
}
