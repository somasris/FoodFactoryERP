import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { hashPassword, validatePasswordPolicy } from '../../utils/password';
import { AdminListUsersQuery, ResetUserPasswordInput } from './admin.types';
import { AdminActorMeta } from './organization.service';

export class AdminUserService {
  /**
   * Paginated, searchable, filterable user directory for administration.
   * Never exposes passwordHash or secrets.
   */
  static async listUsersPaginated(query: AdminListUsersQuery) {
    const { page, limit, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (role) {
      where.userRoles = {
        some: {
          role: { code: role },
        },
      };
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            select: {
              role: { select: { id: true, code: true, name: true } },
            },
          },
          warehouseAccess: {
            select: {
              warehouseId: true,
              accessLevel: true,
              warehouse: { select: { code: true, name: true } },
            },
          },
          _count: {
            select: {
              refreshTokens: {
                where: { isRevoked: false, expiresAt: { gt: new Date() } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        phone: u.phone,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        activeSessions: u._count.refreshTokens,
        companyId: u.companyId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        roles: u.userRoles.map(ur => ur.role.code),
        warehouseAccess: u.warehouseAccess.map(wa => ({
          warehouseId: wa.warehouseId,
          warehouseCode: wa.warehouse.code,
          warehouseName: wa.warehouse.name,
          accessLevel: wa.accessLevel,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Authorized administrative password reset.
   * Enforces password policy, OWNER protection, revokes all active sessions, and logs AuditLog.
   */
  static async resetPassword(
    targetUserId: string,
    input: ResetUserPasswordInput,
    actor: AdminActorMeta,
  ) {
    const policy = validatePasswordPolicy(input.newPassword);
    if (!policy.isValid) {
      throw new AppError(`Password policy violation: ${policy.reason}`, 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    if (!target) {
      throw new AppError('User not found.', 404);
    }

    const isTargetOwner = target.userRoles.some(ur => ur.role.code === 'OWNER');
    const isActorOwner = actor.roles.includes('OWNER');

    if (isTargetOwner && !isActorOwner) {
      throw new AppError('Forbidden: ADMIN cannot reset the password of an OWNER account.', 403);
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { passwordHash: newHash },
      });

      // Revoke all active refresh tokens to force re-login
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'UserSecurity',
          entityId: targetUserId,
          remarks: `Administrative password reset for '${target.username}' by ${actor.username}${input.reason ? ` (${input.reason})` : ''}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    return {
      userId: targetUserId,
      username: target.username,
      sessionsRevoked: true,
    };
  }

  /**
   * Retrieve user security & activity history (AuditLog + active session summary).
   */
  static async getUserActivity(userId: string, page = 1, limit = 20) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      OR: [{ userId }, { entityId: userId, entityType: { in: ['User', 'UserRole', 'UserSecurity', 'UserWarehouseAccess'] } }],
    };

    const [logs, total, activeSessions] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.refreshToken.count({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      user: {
        ...user,
        activeSessions,
      },
      items: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
