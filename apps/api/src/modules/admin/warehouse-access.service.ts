import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AssignUserWarehouseAccessInput } from './admin.types';
import { AdminActorMeta } from './organization.service';

export class WarehouseAccessService {
  static async listWarehouseAccess(params: { userId?: string; warehouseId?: string }) {
    const where: Prisma.UserWarehouseAccessWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (params.warehouseId) where.warehouseId = params.warehouseId;

    const items = await prisma.userWarehouseAccess.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            isActive: true,
            userRoles: { select: { role: { select: { code: true } } } },
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            warehouseType: true,
            isActive: true,
            factory: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ assignedAt: 'desc' }],
    });

    return items.map(item => ({
      id: item.id,
      userId: item.userId,
      username: item.user.username,
      fullName: item.user.fullName,
      userIsActive: item.user.isActive,
      userRoles: item.user.userRoles.map(ur => ur.role.code),
      warehouseId: item.warehouseId,
      warehouseCode: item.warehouse.code,
      warehouseName: item.warehouse.name,
      warehouseType: item.warehouse.warehouseType,
      factory: item.warehouse.factory,
      accessLevel: item.accessLevel,
      assignedAt: item.assignedAt,
    }));
  }

  static async assignUserWarehouseAccess(
    userId: string,
    input: AssignUserWarehouseAccessInput,
    actor: AdminActorMeta,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        warehouseAccess: {
          include: { warehouse: { select: { code: true } } },
        },
      },
    });
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const warehouseIds = Array.from(new Set(input.assignments.map(a => a.warehouseId)));
    const warehouses = warehouseIds.length
      ? await prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } },
        })
      : [];

    if (warehouses.length !== warehouseIds.length) {
      throw new AppError('One or more referenced warehouses do not exist.', 400);
    }

    const previousState = user.warehouseAccess.map(wa => ({
      warehouseId: wa.warehouseId,
      warehouseCode: wa.warehouse.code,
      accessLevel: wa.accessLevel,
    }));

    const dedupedAssignments = warehouseIds.map(wId => {
      const match = input.assignments.find(a => a.warehouseId === wId)!;
      return { warehouseId: wId, accessLevel: match.accessLevel };
    });

    await prisma.$transaction(async tx => {
      await tx.userWarehouseAccess.deleteMany({ where: { userId } });
      if (dedupedAssignments.length > 0) {
        await tx.userWarehouseAccess.createMany({
          data: dedupedAssignments.map(a => ({
            userId,
            warehouseId: a.warehouseId,
            accessLevel: a.accessLevel,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'UserWarehouseAccess',
          entityId: userId,
          previousState: { assignments: previousState },
          newState: { assignments: dedupedAssignments },
          remarks: `Warehouse access updated for user '${user.username}' by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    return this.listWarehouseAccess({ userId });
  }

  static async revokeWarehouseAccess(
    userId: string,
    warehouseId: string,
    actor: AdminActorMeta,
  ) {
    const existing = await prisma.userWarehouseAccess.findUnique({
      where: {
        userId_warehouseId: { userId, warehouseId },
      },
      include: {
        user: { select: { username: true } },
        warehouse: { select: { code: true } },
      },
    });

    if (!existing) {
      throw new AppError('Warehouse access assignment not found.', 404);
    }

    await prisma.$transaction(async tx => {
      await tx.userWarehouseAccess.delete({
        where: { id: existing.id },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'DELETE',
          entityType: 'UserWarehouseAccess',
          entityId: userId,
          previousState: {
            warehouseId,
            warehouseCode: existing.warehouse.code,
            accessLevel: existing.accessLevel,
          },
          newState: Prisma.JsonNull,
          remarks: `Revoked warehouse '${existing.warehouse.code}' access for '${existing.user.username}' by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    return { revoked: true, userId, warehouseId };
  }

  static async getAccessHistory(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      entityType: 'UserWarehouseAccess',
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
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
}
