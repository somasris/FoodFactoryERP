import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { READ_ONLY_PERMISSIONS } from '../../middleware/auth.middleware';
import { NotificationEventsService } from '../notifications/notification-events.service';
import {
  CreateRoleInput,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
} from './admin.types';
import { AdminActorMeta } from './organization.service';

export class RolePermissionService {
  static async listRoles() {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            userRoles: true,
            permissions: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });

    return roles.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      userCount: r._count.userRoles,
      permissionCount: r._count.permissions,
      permissions: r.permissions.map(rp => rp.permission.code),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  static async getRoleById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { userRoles: true } },
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!role) {
      throw new AppError('Role not found.', 404);
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      userCount: role._count.userRoles,
      permissions: role.permissions.map(rp => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  static async listPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }

    return {
      items: permissions,
      grouped,
    };
  }

  static async createRole(input: CreateRoleInput, actor: AdminActorMeta) {
    const existing = await prisma.role.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new AppError(`Role with code '${input.code}' already exists.`, 409);
    }

    const perms = input.permissionCodes.length
      ? await prisma.permission.findMany({
          where: { code: { in: input.permissionCodes } },
        })
      : [];

    if (perms.length !== input.permissionCodes.length) {
      const found = new Set(perms.map(p => p.code));
      const missing = input.permissionCodes.filter(c => !found.has(c));
      throw new AppError(`Invalid permission code(s): [${missing.join(', ')}]`, 400);
    }

    // Prevent non-OWNER from creating a role with administration.roles.manage or administration.users.manage
    const isActorOwner = actor.roles.includes('OWNER');
    if (
      !isActorOwner &&
      input.permissionCodes.some(c =>
        ['administration.roles.manage', 'users.roles.assign'].includes(c),
      )
    ) {
      throw new AppError(
        'Forbidden: Only OWNER can create roles with role/privilege management permissions.',
        403,
      );
    }

    const created = await prisma.$transaction(async tx => {
      const role = await tx.role.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          isSystem: false,
          isActive: true,
          permissions: perms.length
            ? {
                create: perms.map(p => ({ permissionId: p.id })),
              }
            : undefined,
        },
        include: {
          permissions: { include: { permission: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'CREATE',
          entityType: 'Role',
          entityId: role.id,
          newState: {
            code: role.code,
            name: role.name,
            permissions: input.permissionCodes,
          },
          remarks: `Custom role '${role.code}' created by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return role;
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      isSystem: created.isSystem,
      isActive: created.isActive,
      permissions: created.permissions.map(rp => rp.permission.code),
    };
  }

  static async updateRole(id: string, input: UpdateRoleInput, actor: AdminActorMeta) {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Role not found.', 404);
    }

    if (existing.code === 'OWNER' && input.isActive === false) {
      throw new AppError('Security constraint: Cannot deactivate the system OWNER role.', 400);
    }

    if (existing.isSystem && input.isActive === false) {
      throw new AppError(`Security constraint: Cannot deactivate system role '${existing.code}'.`, 400);
    }

    const isActorOwner = actor.roles.includes('OWNER');
    if (existing.code === 'OWNER' && !isActorOwner) {
      throw new AppError('Forbidden: Only OWNER can modify the OWNER role.', 403);
    }

    const updated = await prisma.$transaction(async tx => {
      const role = await tx.role.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'Role',
          entityId: role.id,
          previousState: {
            name: existing.name,
            description: existing.description,
            isActive: existing.isActive,
          },
          newState: {
            name: role.name,
            description: role.description,
            isActive: role.isActive,
          },
          remarks: `Role '${role.code}' updated by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return role;
    });

    return updated;
  }

  static async updateRolePermissions(
    id: string,
    input: UpdateRolePermissionsInput,
    actor: AdminActorMeta,
  ) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!role) {
      throw new AppError('Role not found.', 404);
    }

    const isActorOwner = actor.roles.includes('OWNER');
    if (role.code === 'OWNER') {
      throw new AppError(
        'Security constraint: OWNER role permissions are protected and cannot be stripped.',
        400,
      );
    }

    if (role.code === 'ADMIN' && !isActorOwner) {
      throw new AppError('Forbidden: Only OWNER can modify ADMIN role permissions.', 403);
    }

    // AUDITOR must remain strictly read-only
    if (role.code === 'AUDITOR') {
      const nonReadOnly = input.permissionCodes.filter(c => !READ_ONLY_PERMISSIONS.has(c));
      if (nonReadOnly.length > 0) {
        throw new AppError(
          `Security constraint: AUDITOR role is strictly read-only. Cannot assign write permission(s): [${nonReadOnly.join(', ')}]`,
          400,
        );
      }
    }

    const uniqueCodes = Array.from(new Set(input.permissionCodes));
    const perms = uniqueCodes.length
      ? await prisma.permission.findMany({
          where: { code: { in: uniqueCodes } },
        })
      : [];

    if (perms.length !== uniqueCodes.length) {
      const found = new Set(perms.map(p => p.code));
      const missing = uniqueCodes.filter(c => !found.has(c));
      throw new AppError(`Invalid permission code(s): [${missing.join(', ')}]`, 400);
    }

    const previousCodes = role.permissions.map(rp => rp.permission.code).sort();

    await prisma.$transaction(async tx => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (perms.length > 0) {
        await tx.rolePermission.createMany({
          data: perms.map(p => ({ roleId: id, permissionId: p.id })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'RolePermission',
          entityId: id,
          previousState: { roleCode: role.code, permissions: previousCodes },
          newState: { roleCode: role.code, permissions: uniqueCodes.slice().sort() },
          remarks: `Permissions updated for role '${role.code}' by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    await NotificationEventsService.onRolePermissionsChanged({
      id: role.id,
      code: role.code,
      name: role.name,
    });

    return {
      roleId: id,
      roleCode: role.code,
      permissions: uniqueCodes.slice().sort(),
    };
  }

  static async getRoleHistory(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      entityType: { in: ['Role', 'RolePermission', 'UserRole'] },
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
