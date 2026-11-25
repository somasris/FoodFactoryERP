import crypto from 'crypto';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { hashPassword, validatePasswordPolicy, verifyPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  TokenPayload,
} from '../../utils/token';
import { AuditService } from '../../services/audit.service';
import { AuthResult, AuthUserData, LoginInput, RegisterInput } from './auth.types';

// Dummy hash for timing attack mitigation when user is not found
let dummyHash = '';
hashPassword('dummy_timing_mitigation_password').then(h => (dummyHash = h));

// Concurrency grace window (5000 ms) to tolerate concurrent duplicate refresh requests
// from the same client without falsely triggering malicious reuse detection.
const REFRESH_CONCURRENCY_GRACE_WINDOW_MS = 5000;

export class AuthService {
  /**
   * Resolve active roles and deduplicated permissions from database userRoles.
   * Rejects accounts with no active role assignments.
   */
  private static resolveActiveRolesAndPermissions(
    userRoles: Array<{
      role: {
        code: string;
        isActive: boolean;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>,
  ): { roles: string[]; permissions: string[] } {
    const activeUserRoles = userRoles.filter(ur => ur.role.isActive);
    const roles = activeUserRoles.map(ur => ur.role.code);

    if (roles.length === 0) {
      throw new AppError(
        'Your account does not have an active role assigned. Please contact an administrator.',
        403,
      );
    }

    const permissions = Array.from(
      new Set(activeUserRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code))),
    );

    return { roles, permissions };
  }

  /**
   * Public user registration.
   * Creates an inactive account in PENDING_APPROVAL state with zero roles or permissions.
   * An authorized OWNER or ADMIN must approve and assign a role before the user can sign in.
   */
  static async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const policyCheck = validatePasswordPolicy(input.password);
    if (!policyCheck.isValid) {
      throw new AppError(policyCheck.reason || 'Password does not meet security policy', 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new AppError('An account with this email address already exists', 409);
    }

    const emailPrefix =
      normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'user';
    let username = `${emailPrefix}_${crypto.randomBytes(3).toString('hex')}`;
    while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      username = `${emailPrefix}_${crypto.randomBytes(4).toString('hex')}`;
    }

    const passwordHash = await hashPassword(input.password);

    const createdUser = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          username,
          fullName: input.name.trim(),
          phone: input.phoneNumber?.trim() || null,
          passwordHash,
          isActive: false,
          registrationStatus: 'PENDING_APPROVAL',
          requestedRole: input.requestedRole,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          registrationStatus: true,
          requestedRole: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'UserRegistration',
          entityId: user.id,
          newState: {
            email: user.email,
            fullName: user.fullName,
            isActive: user.isActive,
            registrationStatus: user.registrationStatus,
            requestedRole: user.requestedRole,
          },
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          remarks: `Public user registration submitted requesting role '${input.requestedRole}' (pending administrator approval)`,
        },
      });

      return user;
    });

    return createdUser;
  }

  /**
   * Authenticate user with username or email and password.
   */
  static async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const identifier = input.usernameOrEmail.trim().toLowerCase();

    // Find user by either email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        warehouseAccess: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!user) {
      // Execute timing-equalizing verify to prevent user enumeration via response latency
      if (dummyHash) await verifyPassword(input.password, dummyHash);
      await AuditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: 'unknown',
        remarks: `Failed login attempt for nonexistent user/email: ${identifier}`,
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid email/username or password', 401);
    }

    // Verify Argon2id password hash
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        remarks: 'Invalid password provided during login',
        ipAddress,
        userAgent,
      });
      throw new AppError('Invalid email/username or password', 401);
    }

    // Check registration approval & account active status
    if (user.registrationStatus === 'PENDING_APPROVAL') {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        remarks: 'Login blocked: registration pending administrator approval',
        ipAddress,
        userAgent,
      });
      throw new AppError('Your registration is pending administrator approval.', 403);
    }

    if (user.registrationStatus === 'REJECTED') {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        remarks: 'Login blocked: registration rejected',
        ipAddress,
        userAgent,
      });
      throw new AppError(
        'Your registration request was rejected. Please contact an administrator.',
        403,
      );
    }

    if (!user.isActive) {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        remarks: 'Login blocked for disabled account',
        ipAddress,
        userAgent,
      });
      throw new AppError('Your account has been deactivated. Please contact an administrator.', 403);
    }

    // Collect active roles and deduplicated permissions
    const { roles, permissions } = AuthService.resolveActiveRolesAndPermissions(user.userRoles);

    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const family = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

    // Save refresh token securely hashed within an atomic transaction
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          family,
          expiresAt,
          ipAddress,
          userAgent,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
          remarks: 'User logged in successfully',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    });

    const authUser: AuthUserData = {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      companyId: user.companyId,
      roles,
      permissions,
      warehouseAccess: user.warehouseAccess.map(wa => ({
        warehouseId: wa.warehouseId,
        warehouseCode: wa.warehouse.code,
        warehouseName: wa.warehouse.name,
        accessLevel: wa.accessLevel,
      })),
    };

    return {
      user: authUser,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Rotate a refresh token with atomic row-level locking and automatic reuse detection.
   */
  static async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    return await prisma.$transaction(async tx => {
      // 1. Acquire exclusive lock on the refresh token row (FOR UPDATE)
      // Extract age in milliseconds using UTC timezone to match Prisma's timestamp without time zone storage
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          token_hash: string;
          user_id: string;
          family: string;
          is_revoked: boolean;
          expires_at: Date;
          created_at: Date;
          updated_at: Date;
          elapsed_ms: number;
        }>
      >`
        SELECT id, token_hash, user_id, family, is_revoked, expires_at, created_at, updated_at,
               ROUND(EXTRACT(EPOCH FROM ((clock_timestamp() AT TIME ZONE 'UTC') - updated_at)) * 1000)::bigint AS elapsed_ms
        FROM refresh_tokens
        WHERE token_hash = ${tokenHash}
        FOR UPDATE
      `;

      if (!rows || rows.length === 0) {
        throw new AppError('Invalid or unrecognized refresh token', 401);
      }

      const storedToken = rows[0];

      // 2. REUSE AND CONCURRENCY DETECTION
      if (storedToken.is_revoked) {
        const rawElapsed = (storedToken as Record<string, unknown>)['elapsed_ms'] ?? (storedToken as Record<string, unknown>)['elapsedms'];
        const elapsedMs = rawElapsed !== undefined && rawElapsed !== null
          ? Number(rawElapsed)
          : Math.max(0, Date.now() - new Date(storedToken.updated_at).getTime());

        // Check if there is still an active token in this family (normal rotation in progress)
        const activeTokensInFamily = await tx.refreshToken.count({
          where: { family: storedToken.family, isRevoked: false },
        });

        // Legitimate frontend concurrency grace window:
        // Only applies if the family still has active tokens and within the grace window
        if (activeTokensInFamily > 0 && elapsedMs <= REFRESH_CONCURRENCY_GRACE_WINDOW_MS) {
          throw new AppError(
            'Concurrent token refresh detected. Please use the newly issued session token.',
            401,
          );
        }

        // CONFIRMED REUSE of an already-rotated or compromised token!
        // Invalidate the entire token family immediately on prisma client (committed outside the rolled back tx)
        await prisma.refreshToken.updateMany({
          where: { family: storedToken.family },
          data: { isRevoked: true },
        });

        const tokenUserId = (storedToken as Record<string, unknown>)['user_id'] ?? (storedToken as Record<string, unknown>)['userId'];
        await prisma.auditLog.create({
          data: {
            userId: (tokenUserId as string) || null,
            action: 'SECURITY_ALERT',
            entityType: 'RefreshTokenFamily',
            entityId: storedToken.family,
            remarks: `Confirmed refresh token reuse detected (${elapsedMs}ms after rotation). Revoked entire family.`,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });

        throw new AppError(
          'Security alert: Token reuse detected. All sessions in this chain have been revoked.',
          401,
        );
      }

      // 3. Expiration verification
      if (new Date(storedToken.expires_at) < new Date()) {
        throw new AppError('Refresh token expired. Please log in again.', 401);
      }

      // 4. Retrieve user and active status
      const user = await tx.user.findUnique({
        where: { id: storedToken.user_id },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          warehouseAccess: {
            include: {
              warehouse: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User profile not found', 404);
      }

      if (user.registrationStatus !== 'APPROVED') {
        throw new AppError('Your registration is pending approval or was rejected.', 403);
      }

      if (!user.isActive) {
        throw new AppError('Your account has been deactivated.', 403);
      }

      // Resolve active roles and permissions before rotating token
      const { roles, permissions } = AuthService.resolveActiveRolesAndPermissions(user.userRoles);

      // 5. Atomic rotation: Mark current token as revoked
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      // 6. Generate new rotated refresh token with the SAME family
      const newRawRefreshToken = generateRefreshToken();
      const newTokenHash = hashRefreshToken(newRawRefreshToken);

      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          family: storedToken.family,
          expiresAt: newExpiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // 7. Generate fresh access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        roles,
        permissions,
      };

      const accessToken = generateAccessToken(tokenPayload);

      const authUser: AuthUserData = {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        companyId: user.companyId,
        roles,
        permissions,
        warehouseAccess: user.warehouseAccess.map(wa => ({
          warehouseId: wa.warehouseId,
          warehouseCode: wa.warehouse.code,
          warehouseName: wa.warehouse.name,
          accessLevel: wa.accessLevel,
        })),
      };

      return {
        user: authUser,
        accessToken,
        refreshToken: newRawRefreshToken,
      };
    });
  }

  /**
   * Log out active session by revoking the refresh token.
   */
  static async logout(
    rawRefreshToken?: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    if (userId) {
      await AuditService.log({
        userId,
        action: 'LOGOUT',
        entityType: 'UserSession',
        entityId: userId,
        remarks: 'User logged out',
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Log out from all devices by atomically revoking all refresh tokens for this user.
   */
  static async logoutAll(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await prisma.$transaction(async tx => {
      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          entityType: 'UserSession',
          entityId: userId,
          remarks: 'Revoked all active sessions across all devices',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    });
  }

  /**
   * Fetch current user profile with roles, permissions, and warehouse scoping.
   */
  static async getCurrentUser(userId: string): Promise<AuthUserData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        warehouseAccess: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    if (user.registrationStatus !== 'APPROVED') {
      throw new AppError('Your registration is pending approval or was rejected.', 403);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated.', 403);
    }

    const { roles, permissions } = AuthService.resolveActiveRolesAndPermissions(user.userRoles);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      companyId: user.companyId,
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
}
