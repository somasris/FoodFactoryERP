import crypto from 'crypto';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  TokenPayload,
} from '../../utils/token';
import { AuditService } from '../../services/audit.service';
import { AuthResult, AuthUserData, LoginInput } from './auth.types';

// Dummy hash for timing attack mitigation when user is not found
let dummyHash = '';
hashPassword('dummy_timing_mitigation_password').then(h => (dummyHash = h));

export class AuthService {
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

    // Check account active status
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
      throw new AppError(
        'Your account has been deactivated. Please contact an administrator.',
        403,
      );
    }

    // Collect roles and deduplicated permissions
    const roles = user.userRoles.map(ur => ur.role.code);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code))),
    );

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

    // Save refresh token securely hashed
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      remarks: 'User logged in successfully',
      ipAddress,
      userAgent,
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
   * Rotate a refresh token with automatic reuse detection.
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

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
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
        },
      },
    });

    if (!storedToken) {
      throw new AppError('Invalid or unrecognized refresh token', 401);
    }

    // AUTOMATIC REUSE DETECTION
    // If an already revoked token is presented, an adversary or leaked token is being reused!
    if (storedToken.isRevoked) {
      // Invalidate the entire token family immediately
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { isRevoked: true },
      });

      await AuditService.log({
        userId: storedToken.userId,
        action: 'SECURITY_ALERT',
        entityType: 'RefreshTokenFamily',
        entityId: storedToken.family,
        remarks: 'Refresh token reuse detected! Revoked entire token family for security.',
        ipAddress,
        userAgent,
      });

      throw new AppError(
        'Security alert: Token reuse detected. All sessions in this chain have been revoked.',
        401,
      );
    }

    // Check token expiration
    if (storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token expired. Please log in again.', 401);
    }

    // Check user active status
    if (!storedToken.user.isActive) {
      throw new AppError('Your account has been deactivated.', 403);
    }

    // Mark current token as revoked
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate new rotated refresh token with the SAME family
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newTokenHash,
        family: storedToken.family,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Generate new access token
    const roles = storedToken.user.userRoles.map(ur => ur.role.code);
    const permissions = Array.from(
      new Set(
        storedToken.user.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code)),
      ),
    );

    const tokenPayload: TokenPayload = {
      userId: storedToken.user.id,
      username: storedToken.user.username,
      email: storedToken.user.email,
      roles,
      permissions,
    };

    const accessToken = generateAccessToken(tokenPayload);

    const authUser: AuthUserData = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
      fullName: storedToken.user.fullName,
      phone: storedToken.user.phone,
      isActive: storedToken.user.isActive,
      companyId: storedToken.user.companyId,
      roles,
      permissions,
      warehouseAccess: storedToken.user.warehouseAccess.map(wa => ({
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
   * Log out from all devices by revoking all refresh tokens for this user.
   */
  static async logoutAll(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await AuditService.log({
      userId,
      action: 'LOGOUT',
      entityType: 'UserSession',
      entityId: userId,
      remarks: 'Revoked all active sessions across all devices',
      ipAddress,
      userAgent,
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

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated.', 403);
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
