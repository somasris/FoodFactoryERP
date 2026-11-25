import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { hashPassword, validatePasswordPolicy } from '../../utils/password';
import {
  AssignRolesInput,
  CreateUserInput,
  UpdateStatusInput,
  UpdateUserInput,
} from './users.types';

export interface ActorContext {
  userId: string;
  username: string;
  roles: string[];
}

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
   * SECURITY RULE: Only an authenticated OWNER can create a user with the OWNER role.
   * ADMIN cannot create a user with the OWNER role.
   */
  static async createUser(
    input: CreateUserInput,
    actor?: ActorContext,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Password policy verification
    const policyResult = validatePasswordPolicy(input.password);
    if (!policyResult.isValid) {
      throw new AppError(`Password policy violation: ${policyResult.reason}`, 400);
    }

    // 2. OWNER privilege escalation guard
    const isAssigningOwner = input.roleCodes.includes('OWNER');
    const isActorOwner = actor?.roles?.includes('OWNER') ?? false;

    if (isAssigningOwner && !isActorOwner) {
      throw new AppError(
        'Forbidden: Only an authenticated OWNER can create an account with the OWNER role.',
        403,
      );
    }

    // 3. Uniqueness verification
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

    // 4. Resolve role entities
    const roles = await prisma.role.findMany({
      where: { code: { in: input.roleCodes } },
    });

    if (roles.length !== input.roleCodes.length) {
      const foundCodes = new Set(roles.map(r => r.code));
      const missing = input.roleCodes.filter(c => !foundCodes.has(c));
      throw new AppError(`Invalid role code(s): [${missing.join(', ')}]`, 400);
    }

    // 5. Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // 6. Execute atomic user creation and mandatory audit log in transaction
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

      // Write mandatory audit log inside transaction
      await tx.auditLog.create({
        data: {
          userId: actor?.userId || null,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id,
          newState: {
            id: user.id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            roles: input.roleCodes,
          },
          remarks: `User provisioned with roles: [${input.roleCodes.join(', ')}] by actor: ${actor?.username || 'system'}`,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return user;
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
   * SECURITY RULE: ADMIN cannot modify an OWNER's account details.
   */
  static async updateUser(
    userId: string,
    input: UpdateUserInput,
    actor?: ActorContext,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const isTargetOwner = existing.userRoles.some(ur => ur.role.code === 'OWNER');
    const isActorOwner = actor?.roles?.includes('OWNER') ?? false;

    // ADMIN cannot modify an OWNER's account unless actor is modifying their own profile
    if (isTargetOwner && !isActorOwner && actor?.userId !== userId) {
      throw new AppError("Forbidden: ADMIN cannot modify an OWNER's account details.", 403);
    }

    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (emailConflict) {
        throw new AppError('Email address is already in use by another user.', 409);
      }
    }

    const updated = await prisma.$transaction(async tx => {
      const res = await tx.user.update({
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

      await tx.auditLog.create({
        data: {
          userId: actor?.userId || null,
          action: 'UPDATE',
          entityType: 'User',
          entityId: userId,
          previousState: {
            email: existing.email,
            fullName: existing.fullName,
            phone: existing.phone,
          },
          newState: res,
          remarks: 'Updated basic user information',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * Assign roles to a user.
   * SECURITY RULES:
   * 1. Only an authenticated OWNER can assign the OWNER role.
   * 2. Only an authenticated OWNER can remove the OWNER role from another user.
   * 3. ADMIN cannot modify the role assignments of an OWNER.
   * 4. Prevent self-escalation (non-owners cannot give themselves OWNER).
   * 5. Preserve last-active-OWNER protection.
   */
  static async assignRoles(
    userId: string,
    input: AssignRolesInput,
    actor?: ActorContext,
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
    const isTargetOwner = currentRoles.includes('OWNER');
    const willBeOwner = input.roleCodes.includes('OWNER');
    const isActorOwner = actor?.roles?.includes('OWNER') ?? false;

    // RULE: ADMIN cannot modify the role assignments of an OWNER
    if (isTargetOwner && !isActorOwner) {
      throw new AppError("Forbidden: ADMIN cannot modify an OWNER's role assignments.", 403);
    }

    // RULE: Only an authenticated OWNER can assign the OWNER role
    if (!isTargetOwner && willBeOwner && !isActorOwner) {
      throw new AppError('Forbidden: Only an authenticated OWNER can assign the OWNER role.', 403);
    }

    // RULE: Only an authenticated OWNER can remove the OWNER role from another user
    if (isTargetOwner && !willBeOwner && !isActorOwner) {
      throw new AppError('Forbidden: Only an authenticated OWNER can remove the OWNER role.', 403);
    }

    // RULE: Prevent self-escalation
    if (userId === actor?.userId && !isActorOwner && willBeOwner) {
      throw new AppError('Forbidden: You cannot escalate your own account to the OWNER role.', 403);
    }

    // RULE: LAST ACTIVE OWNER PROTECTION
    if (isTargetOwner && !willBeOwner) {
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

      // Write mandatory audit log
      await tx.auditLog.create({
        data: {
          userId: actor?.userId || null,
          action: 'UPDATE',
          entityType: 'UserRole',
          entityId: userId,
          previousState: { roles: currentRoles },
          newState: { roles: input.roleCodes },
          remarks: `Role assignment modified from [${currentRoles.join(', ')}] to [${input.roleCodes.join(', ')}] by actor: ${actor?.username || 'system'}`,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    });

    return {
      userId,
      roles: input.roleCodes,
    };
  }

  /**
   * Enable or disable a user account.
   * SECURITY RULES:
   * 1. ADMIN cannot deactivate an OWNER.
   * 2. Cannot deactivate the last active OWNER account.
   */
  static async setUserStatus(
    userId: string,
    input: UpdateStatusInput,
    actor?: ActorContext,
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

    const isTargetOwner = user.userRoles.some(ur => ur.role.code === 'OWNER');
    const isActorOwner = actor?.roles?.includes('OWNER') ?? false;

    // RULE: ADMIN cannot deactivate an OWNER
    if (isTargetOwner && !isActorOwner && !input.isActive) {
      throw new AppError('Forbidden: ADMIN cannot deactivate an OWNER.', 403);
    }

    // RULE: LAST ACTIVE OWNER PROTECTION
    if (isTargetOwner && !input.isActive) {
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

    // RULE: Prevent accidental self-lockout
    if (actor?.userId === userId && !input.isActive) {
      throw new AppError('Security constraint violation: You cannot deactivate your own account.', 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const res = await tx.user.update({
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
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor?.userId || null,
          action: 'UPDATE',
          entityType: 'User',
          entityId: userId,
          previousState: { isActive: user.isActive },
          newState: { isActive: input.isActive },
          remarks: input.isActive
            ? `Account enabled by ${actor?.username || 'system'}`
            : `Account deactivated & sessions terminated by ${actor?.username || 'system'}`,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * Revoke all active sessions for a user.
   * SECURITY RULE: ADMIN cannot revoke sessions for an OWNER account.
   */
  static async revokeUserSessions(
    userId: string,
    actor?: ActorContext,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    const isTargetOwner = targetUser.userRoles.some(ur => ur.role.code === 'OWNER');
    const isActorOwner = actor?.roles?.includes('OWNER') ?? false;

    // RULE: ADMIN cannot revoke sessions for an OWNER account (unless revoking self)
    if (isTargetOwner && !isActorOwner && actor?.userId !== userId) {
      throw new AppError("Forbidden: ADMIN cannot revoke sessions for an OWNER account.", 403);
    }

    const result = await prisma.$transaction(async tx => {
      const revoked = await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });

      await tx.auditLog.create({
        data: {
          userId: actor?.userId || null,
          action: 'CANCEL',
          entityType: 'UserSession',
          entityId: userId,
          remarks: `Administrator (${actor?.username || 'system'}) revoked all active sessions (${revoked.count} revoked)`,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return revoked;
    });

    return {
      userId,
      revokedCount: result.count,
    };
  }
}
