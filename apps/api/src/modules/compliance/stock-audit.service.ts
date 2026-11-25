import { AdjustmentReason, AuditAction, InventoryDocumentStatus, Prisma, StockAuditStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import { InventoryAdjustmentService } from '../inventory/inventory-adjustment.service';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  generateDocNumber,
  getAuthorizedWarehouseIds,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import {
  CreateStockAuditInput,
  ReviewStockAuditInput,
} from './compliance.types';

export class StockAuditService {
  /**
   * 4.2.3 Inventory Valuation & Movement Reconciliation Report.
   * Respects MWAC & BATCH_ACTUAL valuation methods using Prisma.Decimal.
   */
  static async getInventoryValuationReport(
    user: UserContext,
    filters: { warehouseId?: string },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.InventoryBalanceWhereInput = {
      quantityOnHand: { gt: 0 },
    };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
        inventoryItem: {
          select: {
            id: true,
            code: true,
            name: true,
            itemType: true,
            valuationMethod: true,
            movingAverageCost: true,
            uom: { select: { id: true, code: true, symbol: true } },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            unitCost: true,
            qualityStatus: true,
            expiryDate: true,
          },
        },
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { inventoryItem: { code: 'asc' } }],
    });

    let totalValue = ZERO;
    let rawMaterialValue = ZERO;
    let packagingValue = ZERO;
    let finishedGoodsValue = ZERO;

    const warehouseMap = new Map<
      string,
      { warehouseId: string; warehouseCode: string; warehouseName: string; totalValue: Prisma.Decimal; itemCount: number }
    >();

    const rows = balances.map(b => {
      const unitCost =
        b.inventoryItem.valuationMethod === 'BATCH_ACTUAL' && b.batch
          ? b.batch.unitCost
          : b.inventoryItem.movingAverageCost;
      const lineValue = b.quantityOnHand.mul(unitCost).toDecimalPlaces(2);
      totalValue = totalValue.add(lineValue);

      if (b.inventoryItem.itemType === 'RAW_MATERIAL') {
        rawMaterialValue = rawMaterialValue.add(lineValue);
      } else if (b.inventoryItem.itemType === 'PACKAGING') {
        packagingValue = packagingValue.add(lineValue);
      } else if (b.inventoryItem.itemType === 'FINISHED_GOODS') {
        finishedGoodsValue = finishedGoodsValue.add(lineValue);
      }

      const wEntry = warehouseMap.get(b.warehouseId) || {
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        totalValue: ZERO,
        itemCount: 0,
      };
      wEntry.totalValue = wEntry.totalValue.add(lineValue);
      wEntry.itemCount += 1;
      warehouseMap.set(b.warehouseId, wEntry);

      return {
        balanceId: b.id,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        itemId: b.inventoryItemId,
        itemCode: b.inventoryItem.code,
        itemName: b.inventoryItem.name,
        itemType: b.inventoryItem.itemType,
        uomSymbol: b.inventoryItem.uom.symbol,
        valuationMethod: b.inventoryItem.valuationMethod,
        batchNumber: b.batch?.batchNumber || null,
        qualityStatus: b.batch?.qualityStatus || 'ACCEPTED',
        quantityOnHand: b.quantityOnHand.toFixed(4),
        quantityReserved: b.quantityReserved.toFixed(4),
        unitCost: unitCost.toFixed(4),
        totalValue: lineValue.toFixed(2),
      };
    });

    // Movement reconciliation summary from immutable InventoryTransactionLine
    const txSummary = await prisma.inventoryTransaction.groupBy({
      by: ['transactionType'],
      _count: { id: true },
    });

    return {
      summary: {
        totalValuation: totalValue.toFixed(2),
        rawMaterialValuation: rawMaterialValue.toFixed(2),
        packagingValuation: packagingValue.toFixed(2),
        finishedGoodsValuation: finishedGoodsValue.toFixed(2),
        activeStockLines: rows.length,
      },
      warehouseSummary: Array.from(warehouseMap.values()).map(w => ({
        ...w,
        totalValue: w.totalValue.toFixed(2),
      })),
      movementSummary: txSummary.map(t => ({
        transactionType: t.transactionType,
        transactionCount: t._count.id,
      })),
      items: rows,
    };
  }

  static async listStockAudits(
    user: UserContext,
    params: { warehouseId?: string; status?: string; page?: number; limit?: number },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (params.warehouseId) {
      await assertWarehouseAccess(user, params.warehouseId, 'READ');
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAuditWhereInput = {};
    if (params.warehouseId) where.warehouseId = params.warehouseId;
    else if (allowedWh) where.warehouseId = { in: allowedWh };
    if (params.status) where.status = params.status as StockAuditStatus;

    const [items, total] = await Promise.all([
      prisma.stockAudit.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stockAudit.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getStockAuditById(id: string, user: UserContext) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!audit) throw new AppError('Stock audit session not found.', 404);
    await assertWarehouseAccess(user, audit.warehouseId, 'READ');
    return audit;
  }

  /**
   * Create a physical stock count session. Does NOT mutate inventory balances.
   */
  static async createStockAudit(
    input: CreateStockAuditInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || !warehouse.isActive) {
      throw new AppError('Active warehouse not found.', 404);
    }

    const created = await prisma.$transaction(async tx => {
      const preparedLines: Prisma.StockAuditLineCreateWithoutStockAuditInput[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
        if (!item || !item.isActive) {
          throw new AppError(`Active inventory item not found for line ${i + 1}.`, 404);
        }

        let unitCost = item.movingAverageCost;
        let expectedBaseQty = ZERO;

        if (line.batchId) {
          const batch = await tx.inventoryBatch.findUnique({ where: { id: line.batchId } });
          if (!batch || batch.inventoryItemId !== item.id) {
            throw new AppError(`Line ${i + 1}: Invalid batch for inventory item.`, 400);
          }
          if (item.valuationMethod === 'BATCH_ACTUAL') {
            unitCost = batch.unitCost;
          }
          const bal = await tx.inventoryBalance.findUnique({
            where: {
              warehouseId_inventoryItemId_batchId: {
                warehouseId: input.warehouseId,
                inventoryItemId: item.id,
                batchId: line.batchId,
              },
            },
          });
          expectedBaseQty = bal ? bal.quantityOnHand : ZERO;
        } else {
          const agg = await tx.inventoryBalance.aggregate({
            where: {
              warehouseId: input.warehouseId,
              inventoryItemId: item.id,
            },
            _sum: { quantityOnHand: true },
          });
          expectedBaseQty = agg._sum.quantityOnHand || ZERO;
        }

        const { converted: countedBaseQty } = await convertQuantityDecimal(
          tx,
          new Prisma.Decimal(line.countedQuantity),
          line.uomId,
          item.uomId,
        );

        const varianceBaseQty = countedBaseQty.sub(expectedBaseQty).toDecimalPlaces(4);
        const varianceValue = varianceBaseQty.mul(unitCost).toDecimalPlaces(2);

        preparedLines.push({
          lineNumber: i + 1,
          inventoryItemId: item.id,
          batchId: line.batchId || null,
          uomId: item.uomId,
          expectedBaseQuantity: expectedBaseQty,
          countedBaseQuantity: countedBaseQty,
          varianceBaseQuantity: varianceBaseQty,
          unitCost,
          varianceValue,
          varianceReason: line.varianceReason || AdjustmentReason.PHYSICAL_COUNT,
          remarks: line.remarks || null,
        });
      }

      const audit = await tx.stockAudit.create({
        data: {
          auditNumber: generateDocNumber('SA'),
          warehouseId: input.warehouseId,
          status: StockAuditStatus.DRAFT,
          auditDate: input.auditDate ? new Date(input.auditDate) : new Date(),
          notes: input.notes || null,
          createdById: user.userId,
          lines: { create: preparedLines },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNumber: 'asc' } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: meta.userId,
          action: AuditAction.CREATE,
          entityType: 'StockAudit',
          entityId: audit.id,
          newState: { auditNumber: audit.auditNumber, warehouseId: audit.warehouseId, lineCount: audit.lines.length },
          ipAddress: meta.ipAddress || null,
          userAgent: meta.userAgent || null,
        },
      });

      return audit;
    });

    return created;
  }

  static async submitStockAudit(id: string, user: UserContext, meta: AuditMeta) {
    const existing = await prisma.stockAudit.findUnique({ where: { id } });
    if (!existing) throw new AppError('Stock audit session not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'IN_PROGRESS') {
      throw new AppError(`Cannot submit stock audit in status ${existing.status}.`, 400);
    }

    const updated = await prisma.stockAudit.update({
      where: { id },
      data: {
        status: StockAuditStatus.SUBMITTED,
        submittedById: user.userId,
        submittedAt: new Date(),
      },
      include: { lines: true, warehouse: { select: { id: true, code: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: meta.userId,
        action: AuditAction.SUBMIT,
        entityType: 'StockAudit',
        entityId: id,
        previousState: { status: existing.status },
        newState: { status: updated.status },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return updated;
  }

  static async reviewStockAudit(
    id: string,
    input: ReviewStockAuditInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.stockAudit.findUnique({ where: { id } });
    if (!existing) throw new AppError('Stock audit session not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED') {
      throw new AppError(`Stock audit must be SUBMITTED before review (current: ${existing.status}).`, 400);
    }

    if (input.decision === 'REJECTED' && (!input.reason || input.reason.trim().length < 3)) {
      throw new AppError('A rejection reason is required.', 400);
    }

    const updated = await prisma.stockAudit.update({
      where: { id },
      data: {
        status: input.decision === 'APPROVED' ? StockAuditStatus.APPROVED : StockAuditStatus.REJECTED,
        reviewedById: user.userId,
        reviewedAt: new Date(),
        reviewReason: input.reason || null,
      },
      include: { lines: true, warehouse: { select: { id: true, code: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: meta.userId,
        action: input.decision === 'APPROVED' ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: 'StockAudit',
        entityId: id,
        previousState: { status: existing.status },
        newState: { status: updated.status, reason: input.reason || null },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return updated;
  }

  /**
   * Post an APPROVED stock audit by creating & posting an official InventoryAdjustment
   * via InventoryAdjustmentService (idempotent, ledger-backed, never directly edits balances).
   */
  static async postStockAuditAdjustment(
    id: string,
    idempotencyKey: string | undefined,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const effectiveKey = idempotencyKey || `POST-SA-${id}`;

    const existingByKey = await prisma.stockAudit.findUnique({
      where: { idempotencyKey: effectiveKey },
      include: { lines: true, warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (existingByKey && existingByKey.status === 'POSTED') {
      await assertWarehouseAccess(user, existingByKey.warehouseId, 'READ_WRITE');
      return existingByKey;
    }

    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!audit) throw new AppError('Stock audit session not found.', 404);
    await assertWarehouseAccess(user, audit.warehouseId, 'READ_WRITE');

    if (audit.status === 'POSTED') {
      if (audit.idempotencyKey === effectiveKey) return audit;
      throw new AppError('Stock audit has already been posted.', 409);
    }
    if (audit.status !== 'APPROVED') {
      throw new AppError(`Stock audit must be APPROVED before posting (current: ${audit.status}).`, 400);
    }

    const varianceLines = audit.lines.filter(l => !l.varianceBaseQuantity.isZero());

    let adjustmentId: string | null = null;
    if (varianceLines.length > 0) {
      // Create, approve, and post via authorized InventoryAdjustmentService
      const adj = await InventoryAdjustmentService.create(
        {
          warehouseId: audit.warehouseId,
          reason: AdjustmentReason.PHYSICAL_COUNT,
          notes: `Posted from Stock Audit ${audit.auditNumber}`,
          lines: varianceLines.map(l => ({
            inventoryItemId: l.inventoryItemId,
            batchId: l.batchId || undefined,
            uomId: l.uomId,
            quantityDelta: l.varianceBaseQuantity.toString(),
            unitCost: l.unitCost.toString(),
            reasonNote: l.remarks || `Stock audit ${audit.auditNumber}`,
          })),
        },
        user,
        meta,
      );

      // Move adjustment DRAFT -> APPROVED -> POSTED using InventoryAdjustmentService.post
      await prisma.inventoryAdjustment.update({
        where: { id: adj.id },
        data: {
          status: InventoryDocumentStatus.APPROVED,
          approvedById: user.userId,
          approvedAt: new Date(),
        },
      });

      await InventoryAdjustmentService.post(adj.id, `ADJ-FROM-${effectiveKey}`, user, meta);
      adjustmentId = adj.id;
    }

    const posted = await prisma.stockAudit.update({
      where: { id },
      data: {
        status: StockAuditStatus.POSTED,
        idempotencyKey: effectiveKey,
        inventoryAdjustmentId: adjustmentId,
        postedById: user.userId,
        postedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: meta.userId,
        action: AuditAction.POST,
        entityType: 'StockAudit',
        entityId: id,
        previousState: { status: audit.status },
        newState: { status: posted.status, inventoryAdjustmentId: adjustmentId },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return posted;
  }
}
