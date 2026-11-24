import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { hashPassword, validatePasswordPolicy } from '../../utils/password';
import { AuditService } from '../../services/audit.service';
import {
  AssignRolesInput,
  CreateUserInput,
  UpdateStatusInput,
  UpdateUserInput,
} from './users.types';

export class UsersService {
  /**
   * List all users with their roles and status.
   */
  static async listUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        warehouseAccess: {
          select: {
            warehouseId: true,
            accessLevel: true,
            warehouse: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      phone: u.phone,
      isActive: u.isActive,
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
    }));
  }

  /**
   * Get single user details by ID.
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                        module: true,
                        action: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        warehouseAccess: {
          select: {
            warehouseId: true,
            accessLevel: true,
            warehouse: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const roles = user.userRoles.map(ur => ur.role.code);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code))),
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      companyId: user.companyId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
      permissions,
      warehouseAccess: user.warehouseAccess.map(wa => ({
        warehouseId: wa.warehouseId,
        warehouseCode: wa.warehouse.code,
        warehouseName: wa.warehouse.name,
        accessLevel: wa.accessLevel,
      })),
    };
  }

  /**
   * Create a new user (administrative provisioning).
   */
  static async createUser(
    input: CreateUserInput,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Password policy verification
    const policyResult = validatePasswordPolicy(input.password);
    if (!policyResult.isValid) {
      throw new AppError(`Password policy violation: ${policyResult.reason}`, 400);
    }

    // 2. Uniqueness verification
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: input.email, mode: 'insensitive' } },
          { username: { equals: input.username, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      if (existing.email.toLowerCase() === input.email.toLowerCase()) {
        throw new AppError('Email address is already registered to another user.', 409);
      }
      throw new AppError('Username is already taken.', 409);
    }

    // 3. Resolve role entities
    const roles = await prisma.role.findMany({
      where: { code: { in: input.roleCodes } },
    });

    if (roles.length !== input.roleCodes.length) {
      const foundCodes = new Set(roles.map(r => r.code));
      const missing = input.roleCodes.filter(c => !foundCodes.has(c));
      throw new AppError(`Invalid role code(s): [${missing.join(', ')}]`, 400);
    }

    // 4. Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // 5. Execute atomic user creation
    const createdUser = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          username: input.username.toLowerCase(),
          passwordHash,
          fullName: input.fullName,
          phone: input.phone || null,
          companyId: input.companyId || null,
          isActive: true,
          userRoles: {
            create: roles.map(role => ({
              roleId: role.id,
            })),
          },
          warehouseAccess: input.warehouseAccess?.length
            ? {
                create: input.warehouseAccess.map(wa => ({
                  warehouseId: wa.warehouseId,
                  accessLevel: wa.accessLevel,
                })),
              }
            : undefined,
        },
        include: {
          userRoles: { include: { role: true } },
        },
      });

      return user;
    });

    // 6. Record audit log
    await AuditService.log({
      userId: actorId,
      action: 'CREATE',
      entityType: 'User',
      entityId: createdUser.id,
      newState: {
        id: createdUser.id,
        email: createdUser.email,
        username: createdUser.username,
        fullName: createdUser.fullName,
        roles: input.roleCodes,
      },
      remarks: `User created and assigned roles: [${input.roleCodes.join(', ')}]`,
      ipAddress,
      userAgent,
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      username: createdUser.username,
      fullName: createdUser.fullName,
      phone: createdUser.phone,
      isActive: createdUser.isActive,
      roles: input.roleCodes,
      createdAt: createdUser.createdAt,
    };
  }

  /**
   * Update basic user information.
   */
  static async updateUser(
    userId: string,
    input: UpdateUserInput,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (emailConflict) {
        throw new AppError('Email address is already in use by another user.', 409);
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email ? input.email.toLowerCase() : undefined,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await AuditService.log({
      userId: actorId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      previousState: {
        email: existing.email,
        fullName: existing.fullName,
        phone: existing.phone,
      },
      newState: updated,
      remarks: 'Updated basic user information',
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Assign roles to a user.
   * STRICT SECURITY INVARIANT: Protects against removing the OWNER role from the last active owner!
   */
  static async assignRoles(
    userId: string,
    input: AssignRolesInput,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentRoles = user.userRoles.map(ur => ur.role.code);
    const isCurrentlyOwner = currentRoles.includes('OWNER');
    const willBeOwner = input.roleCodes.includes('OWNER');

    // LAST OWNER PROTECTION
    if (isCurrentlyOwner && !willBeOwner) {
      const activeOwnerCount = await prisma.userRole.count({
        where: {
          role: { code: 'OWNER' },
          user: { isActive: true },
        },
      });

      if (activeOwnerCount <= 1) {
        throw new AppError(
          'Security constraint violation: Cannot remove OWNER role from the last active Owner account.',
          400,
        );
      }
    }

    // Resolve target role records
    const newRoles = await prisma.role.findMany({
      where: { code: { in: input.roleCodes } },
    });

    if (newRoles.length !== input.roleCodes.length) {
      const foundCodes = new Set(newRoles.map(r => r.code));
      const missing = input.roleCodes.filter(c => !foundCodes.has(c));
      throw new AppError(`Invalid role code(s): [${missing.join(', ')}]`, 400);
    }

    await prisma.$transaction(async tx => {
      // Clear existing roles
      await tx.userRole.deleteMany({ where: { userId } });

      // Insert new roles
      await tx.userRole.createMany({
        data: newRoles.map(r => ({
          userId,
          roleId: r.id,
        })),
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'UPDATE',
      entityType: 'UserRole',
      entityId: userId,
      previousState: { roles: currentRoles },
      newState: { roles: input.roleCodes },
      remarks: `Updated roles from [${currentRoles.join(', ')}] to [${input.roleCodes.join(', ')}]`,
      ipAddress,
      userAgent,
    });

    return {
      userId,
      roles: input.roleCodes,
    };
  }

  /**
   * Enable or disable a user account.
   * STRICT SECURITY INVARIANT: Protects against disabling the last active OWNER account!
   */
  static async setUserStatus(
    userId: string,
    input: UpdateStatusInput,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // LAST OWNER PROTECTION
    if (!input.isActive) {
      const isOwner = user.userRoles.some(ur => ur.role.code === 'OWNER');
      if (isOwner) {
        const activeOwnerCount = await prisma.userRole.count({
          where: {
            role: { code: 'OWNER' },
            user: { isActive: true },
          },
        });

        if (activeOwnerCount <= 1) {
          throw new AppError(
            'Security constraint violation: Cannot deactivate the last active Owner account.',
            400,
          );
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: input.isActive },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isActive: true,
      },
    });

    // If disabled, revoke all active sessions immediately
    if (!input.isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await AuditService.log({
      userId: actorId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      previousState: { isActive: user.isActive },
      newState: { isActive: input.isActive },
      remarks: input.isActive ? 'Account enabled' : 'Account disabled & all sessions revoked',
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Revoke all active sessions for a user.
   */
  static async revokeUserSessions(
    userId: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await AuditService.log({
      userId: actorId,
      action: 'CANCEL',
      entityType: 'UserSession',
      entityId: userId,
      remarks: `Administrator revoked all sessions (${result.count} revoked)`,
      ipAddress,
      userAgent,
    });

    return {
      userId,
      revokedCount: result.count,
    };
  }
}
