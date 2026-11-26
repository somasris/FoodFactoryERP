import { NotificationCategory, NotificationPriority, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from '../../services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { AuditMeta, paginatedResult, toPlainJson } from '../master-data/master-data.utils';
import { getAuthorizedWarehouseIds, UserContext } from '../inventory/inventory.utils';
import { CreateHandoverInput, ListHandoverQuery, UpdateHandoverInput } from './collaboration.types';

async function getAuthorizedFactoryIds(user: UserContext, level: 'READ' | 'READ_WRITE'): Promise<string[] | null> {
  const whIds = await getAuthorizedWarehouseIds(user, level);
  if (whIds === null) return null; // OWNER / ADMIN unrestricted
  if (whIds.length === 0) return [];
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: whIds } },
    select: { factoryId: true },
  });
  return Array.from(new Set(warehouses.map(w => w.factoryId)));
}

async function assertFactoryAccess(user: UserContext, factoryId: string, level: 'READ' | 'READ_WRITE') {
  const allowedFactories = await getAuthorizedFactoryIds(user, level);
  if (allowedFactories !== null && !allowedFactories.includes(factoryId)) {
    throw new AppError('Access denied. You do not have permission for this factory.', 403);
  }
}

export class ShiftHandoverService {
  static async getDashboard(user: UserContext, factoryId?: string) {
    const allowedFactories = await getAuthorizedFactoryIds(user, 'READ');
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');

    if (factoryId && allowedFactories !== null && !allowedFactories.includes(factoryId)) {
      throw new AppError('Access denied. You do not have permission for this factory.', 403);
    }

    const handoverWhere: Prisma.ShiftHandoverWhereInput = {
      ...(factoryId ? { factoryId } : allowedFactories !== null ? { factoryId: { in: allowedFactories } } : {}),
    };

    const overdueCutoff = new Date(Date.now() - 12 * 3600_000);

    const [
      pendingAcknowledgement,
      unresolvedIssues,
      recentlyClosed,
      overdueCount,
      activeBatches,
      pendingQualityInspections,
    ] = await Promise.all([
      prisma.shiftHandover.findMany({
        where: { ...handoverWhere, status: 'SUBMITTED' },
        orderBy: [{ priority: 'desc' }, { submittedAt: 'asc' }],
        take: 10,
      }),
      prisma.shiftHandover.findMany({
        where: {
          ...handoverWhere,
          status: { in: ['SUBMITTED', 'RETURNED', 'ACKNOWLEDGED'] },
          OR: [
            { equipmentIssues: { not: null } },
            { productionDelays: { not: null } },
            { pendingQualityNotes: { not: null } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.shiftHandover.findMany({
        where: { ...handoverWhere, status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        take: 5,
      }),
      prisma.shiftHandover.count({
        where: { ...handoverWhere, status: 'SUBMITTED', submittedAt: { lt: overdueCutoff } },
      }),
      prisma.productionBatch.findMany({
        where: {
          status: { in: ['IN_PROGRESS', 'PAUSED'] },
          ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
          ...(factoryId ? { warehouse: { factoryId } } : {}),
        },
        select: {
          id: true,
          batchNumber: true,
          status: true,
          plannedQuantity: true,
          actualGoodQuantity: true,
          productVariant: { select: { sku: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.qualityInspection.findMany({
        where: {
          decision: 'PENDING',
          ...(allowedWh ? { warehouseId: { in: allowedWh } } : {}),
          ...(factoryId ? { warehouse: { factoryId } } : {}),
        },
        select: {
          id: true,
          inspectionNumber: true,
          inspectedQuantity: true,
          productionBatch: { select: { id: true, batchNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      pendingAcknowledgement,
      unresolvedIssues,
      recentlyClosed,
      overdueCount,
      activeBatches,
      pendingQualityInspections,
    };
  }

  static async list(user: UserContext, query: ListHandoverQuery) {
    const allowedFactories = await getAuthorizedFactoryIds(user, 'READ');
    if (query.factoryId && allowedFactories !== null && !allowedFactories.includes(query.factoryId)) {
      throw new AppError('Access denied. You do not have permission for this factory.', 403);
    }

    const where: Prisma.ShiftHandoverWhereInput = {
      ...(query.factoryId
        ? { factoryId: query.factoryId }
        : allowedFactories !== null
          ? { factoryId: { in: allowedFactories } }
          : {}),
      ...(query.shiftDate ? { shiftDate: new Date(`${query.shiftDate}T00:00:00.000Z`) } : {}),
      ...(query.shiftName ? { shiftName: { contains: query.shiftName, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { handoverNumber: { contains: query.search, mode: 'insensitive' } },
              { shiftName: { contains: query.search, mode: 'insensitive' } },
              { productionLine: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      prisma.shiftHandover.findMany({
        where,
        orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      prisma.shiftHandover.count({ where }),
    ]);

    return paginatedResult(items, total, query.page, query.limit);
  }

  static async getById(user: UserContext, id: string) {
    const handover = await prisma.shiftHandover.findUnique({
      where: { id },
      include: { histories: { orderBy: { createdAt: 'desc' } } },
    });
    if (!handover) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, handover.factoryId, 'READ');
    return handover;
  }

  static async create(user: UserContext, input: CreateHandoverInput, meta: AuditMeta) {
    await assertFactoryAccess(user, input.factoryId, 'READ_WRITE');
    const handoverNumber = `SH-${input.shiftDate.replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;

    const created = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.create({
        data: {
          handoverNumber,
          factoryId: input.factoryId,
          warehouseId: input.warehouseId ?? null,
          productionLine: input.productionLine ?? null,
          shiftName: input.shiftName,
          shiftDate: new Date(`${input.shiftDate}T00:00:00.000Z`),
          outgoingUserId: user.userId,
          incomingUserId: input.incomingUserId ?? null,
          status: 'DRAFT',
          priority: input.priority ?? 'NORMAL',
          activeBatchesSummary: input.activeBatchesSummary ?? Prisma.JsonNull,
          pendingWorkOrdersSummary: input.pendingWorkOrdersSummary ?? Prisma.JsonNull,
          materialShortagesSummary: input.materialShortagesSummary ?? Prisma.JsonNull,
          equipmentIssues: input.equipmentIssues ?? null,
          pendingQualityNotes: input.pendingQualityNotes ?? null,
          productionDelays: input.productionDelays ?? null,
          safetyObservations: input.safetyObservations ?? null,
          notes: input.notes ?? null,
        },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: 1,
          action: 'CREATED',
          fromStatus: null,
          toStatus: 'DRAFT',
          actorId: user.userId,
          remarks: 'Shift handover created in DRAFT',
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });

      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'CREATE',
      entityType: 'ShiftHandover',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }

  static async update(user: UserContext, id: string, input: UpdateHandoverInput, meta: AuditMeta) {
    const existing = await prisma.shiftHandover.findUnique({ where: { id } });
    if (!existing) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, existing.factoryId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
      throw new AppError(
        `Submitted or acknowledged handovers cannot be edited directly (status: ${existing.status}). Return for correction first.`,
        400,
      );
    }

    const nextRevision = existing.status === 'RETURNED' ? existing.revisionNumber + 1 : existing.revisionNumber;

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.update({
        where: { id },
        data: {
          ...(input.warehouseId !== undefined && { warehouseId: input.warehouseId }),
          ...(input.productionLine !== undefined && { productionLine: input.productionLine }),
          ...(input.shiftName !== undefined && { shiftName: input.shiftName }),
          ...(input.shiftDate !== undefined && { shiftDate: new Date(`${input.shiftDate}T00:00:00.000Z`) }),
          ...(input.incomingUserId !== undefined && { incomingUserId: input.incomingUserId }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.activeBatchesSummary !== undefined && {
            activeBatchesSummary: input.activeBatchesSummary ?? Prisma.JsonNull,
          }),
          ...(input.pendingWorkOrdersSummary !== undefined && {
            pendingWorkOrdersSummary: input.pendingWorkOrdersSummary ?? Prisma.JsonNull,
          }),
          ...(input.materialShortagesSummary !== undefined && {
            materialShortagesSummary: input.materialShortagesSummary ?? Prisma.JsonNull,
          }),
          ...(input.equipmentIssues !== undefined && { equipmentIssues: input.equipmentIssues }),
          ...(input.pendingQualityNotes !== undefined && { pendingQualityNotes: input.pendingQualityNotes }),
          ...(input.productionDelays !== undefined && { productionDelays: input.productionDelays }),
          ...(input.safetyObservations !== undefined && { safetyObservations: input.safetyObservations }),
          ...(input.notes !== undefined && { notes: input.notes }),
          revisionNumber: nextRevision,
        },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: nextRevision,
          action: 'UPDATED',
          fromStatus: existing.status,
          toStatus: h.status,
          actorId: user.userId,
          remarks: `Updated handover (rev ${nextRevision})`,
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });

      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'UPDATE',
      entityType: 'ShiftHandover',
      entityId: updated.id,
      previousState: toPlainJson(existing),
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async submit(user: UserContext, id: string, meta: AuditMeta) {
    const existing = await prisma.shiftHandover.findUnique({ where: { id } });
    if (!existing) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, existing.factoryId, 'READ_WRITE');

    if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
      throw new AppError(`Cannot submit handover in status ${existing.status}.`, 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: h.revisionNumber,
          action: 'SUBMITTED',
          fromStatus: existing.status,
          toStatus: 'SUBMITTED',
          actorId: user.userId,
          remarks: `Submitted shift handover (rev ${h.revisionNumber})`,
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });
      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'SUBMIT',
      entityType: 'ShiftHandover',
      entityId: updated.id,
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notifySafe({
      title: `Shift Handover Submitted: ${updated.handoverNumber}`,
      message: `${updated.shiftName} shift handover requires incoming acknowledgement.`,
      type: NotificationType.ACTION_REQUIRED,
      category: NotificationCategory.PRODUCTION,
      priority: updated.priority === 'URGENT' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
      eventKey: `handover.submitted:${updated.id}:rev${updated.revisionNumber}`,
      entityType: 'ShiftHandover',
      entityId: updated.id,
      actionUrl: '/production/handovers',
      target: {
        ...(updated.incomingUserId ? { userIds: [updated.incomingUserId] } : {}),
        permissions: ['production.batches.read'],
        ...(updated.warehouseId ? { warehouseId: updated.warehouseId } : {}),
      },
    });

    return updated;
  }

  static async acknowledge(user: UserContext, id: string, notes: string | null | undefined, meta: AuditMeta) {
    const existing = await prisma.shiftHandover.findUnique({ where: { id } });
    if (!existing) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, existing.factoryId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED') {
      throw new AppError(`Only SUBMITTED handovers can be acknowledged (current: ${existing.status}).`, 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.update({
        where: { id },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedById: user.userId,
          acknowledgedAt: new Date(),
          acknowledgementNotes: notes ?? null,
        },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: h.revisionNumber,
          action: 'ACKNOWLEDGED',
          fromStatus: 'SUBMITTED',
          toStatus: 'ACKNOWLEDGED',
          actorId: user.userId,
          remarks: notes || 'Shift handover acknowledged',
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });
      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'APPROVE',
      entityType: 'ShiftHandover',
      entityId: updated.id,
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notifySafe({
      title: `Shift Handover Acknowledged: ${updated.handoverNumber}`,
      message: `${updated.shiftName} shift handover was acknowledged.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.PRODUCTION,
      priority: NotificationPriority.NORMAL,
      eventKey: `handover.acknowledged:${updated.id}:rev${updated.revisionNumber}`,
      entityType: 'ShiftHandover',
      entityId: updated.id,
      actionUrl: '/production/handovers',
      target: { userIds: [updated.outgoingUserId] },
    });

    return updated;
  }

  static async returnForCorrection(user: UserContext, id: string, reason: string, meta: AuditMeta) {
    const existing = await prisma.shiftHandover.findUnique({ where: { id } });
    if (!existing) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, existing.factoryId, 'READ_WRITE');

    if (existing.status !== 'SUBMITTED' && existing.status !== 'ACKNOWLEDGED') {
      throw new AppError(`Cannot return handover in status ${existing.status}.`, 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.update({
        where: { id },
        data: {
          status: 'RETURNED',
          returnedById: user.userId,
          returnedAt: new Date(),
          returnReason: reason,
        },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: h.revisionNumber,
          action: 'RETURNED',
          fromStatus: existing.status,
          toStatus: 'RETURNED',
          actorId: user.userId,
          remarks: reason,
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });
      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'REJECT',
      entityType: 'ShiftHandover',
      entityId: updated.id,
      remarks: reason,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notifySafe({
      title: `Shift Handover Returned: ${updated.handoverNumber}`,
      message: `Returned for correction: ${reason}`,
      type: NotificationType.WARNING,
      category: NotificationCategory.PRODUCTION,
      priority: NotificationPriority.HIGH,
      eventKey: `handover.returned:${updated.id}:rev${updated.revisionNumber}`,
      entityType: 'ShiftHandover',
      entityId: updated.id,
      actionUrl: '/production/handovers',
      target: { userIds: [updated.outgoingUserId] },
    });

    return updated;
  }

  static async close(user: UserContext, id: string, meta: AuditMeta) {
    const existing = await prisma.shiftHandover.findUnique({ where: { id } });
    if (!existing) throw new AppError('Shift handover not found.', 404);
    await assertFactoryAccess(user, existing.factoryId, 'READ_WRITE');

    if (existing.status !== 'ACKNOWLEDGED') {
      throw new AppError(`Only ACKNOWLEDGED handovers can be closed (current: ${existing.status}).`, 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.shiftHandover.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedById: user.userId,
          closedAt: new Date(),
        },
      });

      await tx.shiftHandoverHistory.create({
        data: {
          handoverId: h.id,
          revisionNumber: h.revisionNumber,
          action: 'CLOSED',
          fromStatus: 'ACKNOWLEDGED',
          toStatus: 'CLOSED',
          actorId: user.userId,
          remarks: 'Shift handover closed',
          snapshot: toPlainJson(h) as Prisma.InputJsonValue,
        },
      });
      return h;
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'UPDATE',
      entityType: 'ShiftHandover',
      entityId: updated.id,
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
