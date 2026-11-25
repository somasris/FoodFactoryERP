import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { hashPassword, validatePasswordPolicy } from '../../utils/password';
import {
  AdminListUsersQuery,
  ResetUserPasswordInput,
  ReviewRegistrationInput,
} from './admin.types';
import { AdminActorMeta } from './organization.service';

export class AdminUserService {
  /**
   * Paginated, searchable, filterable user directory for administration.
   * Never exposes passwordHash or secrets.
   */
  static async listUsersPaginated(query: AdminListUsersQuery) {
    const { page, limit, search, role, isActive, registrationStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (registrationStatus) where.registrationStatus = registrationStatus;
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
          registrationStatus: true,
          requestedRole: true,
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
        registrationStatus: u.registrationStatus,
        requestedRole: u.requestedRole,
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
   * Review a pending public user registration (approve with role assignment or reject).
   */
  static async reviewRegistration(
    targetUserId: string,
    input: ReviewRegistrationInput,
    actor: AdminActorMeta,
  ) {
    if (targetUserId === actor.userId) {
      throw new AppError('You cannot review your own registration.', 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isActive: true,
        registrationStatus: true,
      },
    });
    if (!target) {
      throw new AppError('User not found.', 404);
    }

    if (target.registrationStatus !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending registrations can be reviewed.', 400);
    }

    if (input.decision === 'APPROVED') {
      const requestedRoleCodes = Array.from(new Set(input.roleCodes));
      if (requestedRoleCodes.length === 0) {
        throw new AppError('At least one role must be assigned when approving a registration.', 400);
      }

      const isActorOwner = actor.roles.includes('OWNER');
      if (requestedRoleCodes.includes('OWNER') && !isActorOwner) {
        throw new AppError('Forbidden: ADMIN cannot assign the OWNER role.', 403);
      }

      const roles = await prisma.role.findMany({
        where: { code: { in: requestedRoleCodes }, isActive: true },
        select: { id: true, code: true },
      });

      if (roles.length !== requestedRoleCodes.length) {
        throw new AppError('One or more selected roles are invalid or inactive.', 400);
      }

      await prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            isActive: true,
            registrationStatus: 'APPROVED',
          },
        });

        await tx.userRole.createMany({
          data: roles.map(r => ({ userId: targetUserId, roleId: r.id })),
          skipDuplicates: true,
        });

        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'APPROVE',
            entityType: 'UserRegistration',
            entityId: targetUserId,
            previousState: {
              isActive: target.isActive,
              registrationStatus: target.registrationStatus,
            },
            newState: {
              isActive: true,
              registrationStatus: 'APPROVED',
              roles: roles.map(r => r.code),
            },
            remarks: `Registration approved for '${target.email}' with roles [${roles.map(r => r.code).join(', ')}] by ${actor.username}${input.reason ? ` (${input.reason})` : ''}`,
            ipAddress: actor.ipAddress || null,
            userAgent: actor.userAgent || null,
          },
        });
      });

      await NotificationEventsService.onUserAccountChanged(
        targetUserId,
        target.username,
        `Your registration was approved with role(s): ${roles.map(r => r.code).join(', ')}.`,
        'registration_approved',
      );

      return {
        userId: targetUserId,
        registrationStatus: 'APPROVED' as const,
        isActive: true,
        roles: roles.map(r => r.code),
      };
    }

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          isActive: false,
          registrationStatus: 'REJECTED',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'REJECT',
          entityType: 'UserRegistration',
          entityId: targetUserId,
          previousState: {
            isActive: target.isActive,
            registrationStatus: target.registrationStatus,
          },
          newState: {
            isActive: false,
            registrationStatus: 'REJECTED',
          },
          remarks: `Registration rejected for '${target.email}' by ${actor.username}${input.reason ? ` (${input.reason})` : ''}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    return {
      userId: targetUserId,
      registrationStatus: 'REJECTED' as const,
      isActive: false,
      roles: [] as string[],
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
