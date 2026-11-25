import crypto from 'crypto';
import { AuditAction, Prisma, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AuditService } from '../../services/audit.service';
import { AppError } from '../../middleware/error.middleware';
import {
  AuditMeta,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  getAuthorizedWarehouseIds,
  isBatchExpired,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import { getIndianFinancialYear } from '../sales/sales-invoice.service';
import { buildDateRangeFilter } from '../sales/sales.utils';
import { CreateWorkOrderInput, UpdateWorkOrderInput } from './work-order.types';

const HUNDRED = new Prisma.Decimal(100);

const WO_INCLUDE = {
  productionPlan: { select: { id: true, planNumber: true, name: true, status: true } },
  productionPlanItem: {
    select: {
      id: true,
      lineNumber: true,
      plannedQuantity: true,
      workOrderedQuantity: true,
    },
  },
  productVariant: {
    select: {
      id: true,
      sku: true,
      name: true,
      product: { select: { id: true, code: true, name: true } },
    },
  },
  bom: { select: { id: true, code: true, name: true } },
  bomVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      expectedGoodOutput: true,
      yieldPercentage: true,
      expectedWastagePercent: true,
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  uom: { select: { id: true, code: true, symbol: true } },
  assignedTo: { select: { id: true, fullName: true, username: true } },
};

async function generateWorkOrderNumberInTx(
  tx: Prisma.TransactionClient,
  refDate: Date,
): Promise<{ workOrderNumber: string; financialYear: string }> {
  const prefixCfg = await tx.systemConfig.findUnique({ where: { key: 'WORK_ORDER_NUMBER_PREFIX' } });
  const prefix = (prefixCfg?.value || 'WO').trim().toUpperCase().slice(0, 15) || 'WO';
  const financialYear = getIndianFinancialYear(refDate);
  const newId = crypto.randomUUID();

  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO work_order_number_sequences (id, prefix, financial_year, last_number, updated_at)
    VALUES (${newId}, ${prefix}, ${financialYear}, 1, NOW())
    ON CONFLICT (prefix, financial_year)
    DO UPDATE SET last_number = work_order_number_sequences.last_number + 1, updated_at = NOW()
    RETURNING last_number
  `;

  const seq = rows[0].last_number;
  return {
    workOrderNumber: `${prefix}/${financialYear}/${String(seq).padStart(5, '0')}`,
    financialYear,
  };
}

export class WorkOrderService {
  static async getDashboardSummary(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const where: Prisma.WorkOrderWhereInput = allowedWh
      ? { warehouseId: { in: allowedWh } }
      : {};

    const [
      totalWorkOrders,
      draftCount,
      submittedCount,
      approvedCount,
      releasedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      urgentCount,
      recentWorkOrders,
    ] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.workOrder.count({ where: { ...where, status: 'SUBMITTED' } }),
      prisma.workOrder.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.workOrder.count({ where: { ...where, status: 'RELEASED' } }),
      prisma.workOrder.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.workOrder.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.workOrder.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.workOrder.count({
        where: { ...where, priority: 'URGENT', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
      prisma.workOrder.findMany({
        where,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          productVariant: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          uom: { select: { id: true, code: true, symbol: true } },
        },
      }),
    ]);

    return {
      totalWorkOrders,
      draftCount,
      submittedCount,
      approvedCount,
      releasedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      urgentCount,
      recentWorkOrders,
    };
  }

  static async listWorkOrders(
    params: PaginationParams,
    user: UserContext,
    filters: {
      status?: string;
      priority?: string;
      warehouseId?: string;
      productionPlanId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    if (filters.warehouseId) {
      await assertWarehouseAccess(user, filters.warehouseId, 'READ');
    }

    const where: Prisma.WorkOrderWhereInput = {};
    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    } else if (allowedWh) {
      where.warehouseId = { in: allowedWh };
    }
    if (filters.status) where.status = filters.status as WorkOrderStatus;
    if (filters.priority) where.priority = filters.priority as WorkOrderPriority;
    if (filters.productionPlanId) where.productionPlanId = filters.productionPlanId;

    const dateFilter = buildDateRangeFilter(filters.fromDate, filters.toDate);
    if (dateFilter) where.plannedStartDate = dateFilter;

    if (params.search) {
      where.OR = [
        { workOrderNumber: { contains: params.search, mode: 'insensitive' } },
        { productionLine: { contains: params.search, mode: 'insensitive' } },
        { productVariant: { sku: { contains: params.search, mode: 'insensitive' } } },
        { productionPlan: { planNumber: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: WO_INCLUDE,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async findScheduleConflicts(
    wo: {
      id: string;
      plannedStartDate: Date | null;
      plannedEndDate: Date | null;
      productionLine: string | null;
      assignedToId: string | null;
    },
  ) {
    if (!wo.plannedStartDate || (!wo.productionLine && !wo.assignedToId)) {
      return [];
    }
    const start = wo.plannedStartDate;
    const end = wo.plannedEndDate ?? wo.plannedStartDate;

    const orFilters: Prisma.WorkOrderWhereInput[] = [];
    if (wo.productionLine) orFilters.push({ productionLine: wo.productionLine });
    if (wo.assignedToId) orFilters.push({ assignedToId: wo.assignedToId });

    const conflicts = await prisma.workOrder.findMany({
      where: {
        id: { not: wo.id },
        status: { in: ['APPROVED', 'RELEASED', 'IN_PROGRESS'] },
        OR: orFilters,
        plannedStartDate: { lte: end },
        AND: [
          {
            OR: [{ plannedEndDate: null }, { plannedEndDate: { gte: start } }],
          },
        ],
      },
      select: {
        id: true,
        workOrderNumber: true,
        status: true,
        productionLine: true,
        assignedToId: true,
        plannedStartDate: true,
        plannedEndDate: true,
      },
    });

    return conflicts.map(c => ({
      workOrderId: c.id,
      workOrderNumber: c.workOrderNumber,
      status: c.status,
      reason:
        wo.productionLine && c.productionLine === wo.productionLine
          ? `Overlapping schedule on production line "${c.productionLine}"`
          : 'Overlapping schedule for assigned personnel',
    }));
  }

  static async getWorkOrderById(id: string, user: UserContext) {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        ...WO_INCLUDE,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!wo) throw new AppError('Work order not found.', 404);
    await assertWarehouseAccess(user, wo.warehouseId, 'READ');

    const [materialRequirements, scheduleConflicts] = await Promise.all([
      this.getMaterialRequirements(wo.id, user),
      this.findScheduleConflicts(wo),
    ]);

    return { ...wo, materialRequirements, scheduleConflicts };
  }

  /**
   * Read-only BOM-derived material requirements + live warehouse availability (zero inventory mutations).
   */
  static async getMaterialRequirements(id: string, user: UserContext) {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        bomVersion: {
          include: {
            items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
          },
        },
      },
    });
    if (!wo) throw new AppError('Work order not found.', 404);
    await assertWarehouseAccess(user, wo.warehouseId, 'READ');

    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    const refDate = new Date();
    const plannedQty = new Prisma.Decimal(wo.plannedQuantity);
    const expectedGoodOut = new Prisma.Decimal(wo.bomVersion.expectedGoodOutput);
    const yieldPct = new Prisma.Decimal(wo.bomVersion.yieldPercentage);
    const scaleFactor = plannedQty.div(expectedGoodOut).mul(HUNDRED.div(yieldPct));

    const results = [];
    for (const item of wo.bomVersion.items) {
      const scaledRecipeQty = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor);
      const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
      const effectiveRecipeQty = scaledRecipeQty
        .mul(HUNDRED.add(scrapPct))
        .div(HUNDRED)
        .toDecimalPlaces(4);

      const { converted: requiredBase } = await convertQuantityDecimal(
        prisma,
        effectiveRecipeQty,
        item.uomId,
        item.inventoryItem.uomId,
      );

      const balances = await prisma.inventoryBalance.findMany({
        where: {
          inventoryItemId: item.inventoryItemId,
          ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          batch: { select: { expiryDate: true } },
        },
      });

      let onHand = ZERO;
      let reserved = ZERO;
      const warehouses: string[] = [];
      for (const b of balances) {
        if (b.batch && isBatchExpired(b.batch.expiryDate, refDate)) continue;
        onHand = onHand.add(b.quantityOnHand);
        reserved = reserved.add(b.quantityReserved);
        if (new Prisma.Decimal(b.quantityOnHand).gt(ZERO) && !warehouses.includes(b.warehouse.code)) {
          warehouses.push(b.warehouse.code);
        }
      }

      const netAvailable = Prisma.Decimal.max(ZERO, onHand.sub(reserved));
      const shortage = Prisma.Decimal.max(ZERO, requiredBase.sub(netAvailable));

      results.push({
        inventoryItemId: item.inventoryItemId,
        itemCode: item.inventoryItem.code,
        itemName: item.inventoryItem.name,
        itemType: item.itemType,
        uomCode: item.inventoryItem.uom.code,
        uomSymbol: item.inventoryItem.uom.symbol,
        requiredQuantity: requiredBase.toFixed(4),
        availableQuantity: onHand.toFixed(4),
        reservedQuantity: reserved.toFixed(4),
        netAvailableQuantity: netAvailable.toFixed(4),
        shortageQuantity: shortage.toFixed(4),
        warehouses,
      });
    }

    return results;
  }

  static async createWorkOrder(
    input: CreateWorkOrderInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.workOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: WO_INCLUDE,
      });
      if (existing) {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return existing;
      }
    }

    if (input.plannedStartDate && input.plannedEndDate) {
      if (new Date(input.plannedEndDate) < new Date(input.plannedStartDate)) {
        throw new AppError('Planned end date must be on or after planned start date.', 400);
      }
    }

    if (input.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId } });
      if (!assignee || !assignee.isActive) {
        throw new AppError('Assigned production user not found or inactive.', 400);
      }
    }

    const created = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM production_plans WHERE id = ${input.productionPlanId} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Production plan not found.', 404);

      const plan = await tx.productionPlan.findUniqueOrThrow({
        where: { id: input.productionPlanId },
      });
      await assertWarehouseAccess(user, plan.warehouseId, 'READ_WRITE');

      if (plan.status !== 'APPROVED' && plan.status !== 'RELEASED') {
        throw new AppError(
          `Work orders can only be generated from APPROVED or RELEASED plans (current status: ${plan.status}).`,
          400,
        );
      }

      const planItem = await tx.productionPlanItem.findFirst({
        where: { id: input.productionPlanItemId, productionPlanId: plan.id },
      });
      if (!planItem) {
        throw new AppError('Production plan item not found on the selected plan.', 404);
      }

      const remaining = new Prisma.Decimal(planItem.plannedQuantity).sub(
        planItem.workOrderedQuantity,
      );
      if (remaining.lte(ZERO)) {
        throw new AppError(
          'No remaining unallocated quantity on this production plan item.',
          400,
        );
      }

      const reqQty = input.plannedQuantity
        ? new Prisma.Decimal(input.plannedQuantity)
        : remaining;
      if (reqQty.gt(remaining)) {
        throw new AppError(
          `Requested work order quantity (${reqQty.toString()}) exceeds remaining plan item quantity (${remaining.toString()}).`,
          400,
        );
      }

      await tx.productionPlanItem.update({
        where: { id: planItem.id },
        data: {
          workOrderedQuantity: new Prisma.Decimal(planItem.workOrderedQuantity).add(reqQty),
        },
      });

      const now = new Date();
      const { workOrderNumber, financialYear } = await generateWorkOrderNumberInTx(tx, now);

      return tx.workOrder.create({
        data: {
          workOrderNumber,
          financialYear,
          productionPlanId: plan.id,
          productionPlanItemId: planItem.id,
          productVariantId: planItem.productVariantId,
          inventoryItemId: planItem.inventoryItemId,
          bomId: planItem.bomId,
          bomVersionId: planItem.bomVersionId,
          warehouseId: plan.warehouseId,
          uomId: planItem.uomId,
          plannedQuantity: reqQty.toDecimalPlaces(4),
          priority: (input.priority || 'NORMAL') as WorkOrderPriority,
          status: WorkOrderStatus.DRAFT,
          plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
          plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : null,
          productionLine: input.productionLine ?? null,
          assignedToId: input.assignedToId ?? null,
          notes: input.notes ?? null,
          instructions: input.instructions ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: user.userId,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: WorkOrderStatus.DRAFT,
              changedById: user.userId,
              reason: `Work order generated from ${plan.planNumber}`,
            },
          },
        },
        include: WO_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.CREATE,
      entityType: 'WorkOrder',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async updateDraftWorkOrder(
    id: string,
    input: UpdateWorkOrderInput,
    user: UserContext,
    meta: AuditMeta,
  ) {
    const existing = await prisma.workOrder.findUnique({ where: { id } });
    if (!existing) throw new AppError('Work order not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError(
        `Only DRAFT or REJECTED work orders can be edited (current status: ${existing.status}).`,
        400,
      );
    }

    const nextStart =
      input.plannedStartDate !== undefined
        ? input.plannedStartDate
          ? new Date(input.plannedStartDate)
          : null
        : existing.plannedStartDate;
    const nextEnd =
      input.plannedEndDate !== undefined
        ? input.plannedEndDate
          ? new Date(input.plannedEndDate)
          : null
        : existing.plannedEndDate;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      throw new AppError('Planned end date must be on or after planned start date.', 400);
    }

    const updated = await prisma.$transaction(async tx => {
      if (input.plannedQuantity !== undefined) {
        await tx.$queryRaw`
          SELECT id FROM production_plans WHERE id = ${existing.productionPlanId} FOR UPDATE
        `;
        const planItem = await tx.productionPlanItem.findUniqueOrThrow({
          where: { id: existing.productionPlanItemId },
        });
        const oldQty = new Prisma.Decimal(existing.plannedQuantity);
        const newQty = new Prisma.Decimal(input.plannedQuantity);
        const delta = newQty.sub(oldQty);
        const remaining = new Prisma.Decimal(planItem.plannedQuantity).sub(
          planItem.workOrderedQuantity,
        );
        if (delta.gt(remaining)) {
          throw new AppError(
            `Updated work order quantity exceeds remaining plan item quantity (${remaining.add(oldQty).toString()}).`,
            400,
          );
        }
        await tx.productionPlanItem.update({
          where: { id: planItem.id },
          data: {
            workOrderedQuantity: new Prisma.Decimal(planItem.workOrderedQuantity).add(delta),
          },
        });
      }

      return tx.workOrder.update({
        where: { id },
        data: {
          ...(input.plannedQuantity !== undefined
            ? { plannedQuantity: new Prisma.Decimal(input.plannedQuantity).toDecimalPlaces(4) }
            : {}),
          ...(input.priority !== undefined ? { priority: input.priority as WorkOrderPriority } : {}),
          ...(input.plannedStartDate !== undefined ? { plannedStartDate: nextStart } : {}),
          ...(input.plannedEndDate !== undefined ? { plannedEndDate: nextEnd } : {}),
          ...(input.productionLine !== undefined ? { productionLine: input.productionLine } : {}),
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        },
        include: WO_INCLUDE,
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: AuditAction.UPDATE,
      entityType: 'WorkOrder',
      entityId: id,
      previousState: { plannedQuantity: existing.plannedQuantity, priority: existing.priority },
      newState: { plannedQuantity: updated.plannedQuantity, priority: updated.priority },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  private static async transitionWorkOrder(
    id: string,
    allowedFrom: WorkOrderStatus[],
    toStatus: WorkOrderStatus,
    auditAction: AuditAction,
    user: UserContext,
    meta: AuditMeta,
    extraData: Prisma.WorkOrderUpdateInput,
    reason: string,
    onCancelRelease?: boolean,
  ) {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.workOrder.findUnique({ where: { id } });
      if (!existing) throw new AppError('Work order not found.', 404);
      await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

      if (!allowedFrom.includes(existing.status)) {
        throw new AppError(
          `Cannot transition work order from ${existing.status} to ${toStatus}.`,
          400,
        );
      }

      if (onCancelRelease) {
        await tx.$queryRaw`
          SELECT id FROM production_plans WHERE id = ${existing.productionPlanId} FOR UPDATE
        `;
        const planItem = await tx.productionPlanItem.findUniqueOrThrow({
          where: { id: existing.productionPlanItemId },
        });
        await tx.productionPlanItem.update({
          where: { id: planItem.id },
          data: {
            workOrderedQuantity: Prisma.Decimal.max(
              ZERO,
              new Prisma.Decimal(planItem.workOrderedQuantity).sub(existing.plannedQuantity),
            ),
          },
        });
      }

      const wo = await tx.workOrder.update({
        where: { id },
        data: { status: toStatus, ...extraData },
        include: WO_INCLUDE,
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: id,
          fromStatus: existing.status,
          toStatus,
          changedById: user.userId,
          reason,
        },
      });

      return { wo, previousStatus: existing.status };
    });

    await AuditService.log({
      userId: meta.userId,
      action: auditAction,
      entityType: 'WorkOrder',
      entityId: id,
      previousState: { status: result.previousStatus },
      newState: { status: result.wo.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: reason,
    });

    return result.wo;
  }

  static submitWorkOrder(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionWorkOrder(
      id,
      ['DRAFT', 'REJECTED'],
      WorkOrderStatus.SUBMITTED,
      AuditAction.SUBMIT,
      user,
      meta,
      { submittedById: user.userId, submittedAt: new Date() },
      'Work order submitted for approval',
    );
  }

  static approveWorkOrder(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionWorkOrder(
      id,
      ['SUBMITTED'],
      WorkOrderStatus.APPROVED,
      AuditAction.APPROVE,
      user,
      meta,
      { approvedById: user.userId, approvedAt: new Date() },
      'Work order approved',
    );
  }

  static rejectWorkOrder(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    return this.transitionWorkOrder(
      id,
      ['SUBMITTED'],
      WorkOrderStatus.REJECTED,
      AuditAction.REJECT,
      user,
      meta,
      { rejectedById: user.userId, rejectedAt: new Date(), rejectionReason: reason },
      reason,
    );
  }

  static releaseWorkOrder(id: string, user: UserContext, meta: AuditMeta) {
    return this.transitionWorkOrder(
      id,
      ['APPROVED'],
      WorkOrderStatus.RELEASED,
      AuditAction.RELEASE,
      user,
      meta,
      { releasedById: user.userId, releasedAt: new Date() },
      'Work order released to shop floor',
    );
  }

  static cancelWorkOrder(id: string, reason: string, user: UserContext, meta: AuditMeta) {
    return this.transitionWorkOrder(
      id,
      ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED'],
      WorkOrderStatus.CANCELLED,
      AuditAction.CANCEL,
      user,
      meta,
      { cancelledById: user.userId, cancelledAt: new Date(), cancellationReason: reason },
      reason,
      true,
    );
  }
}
