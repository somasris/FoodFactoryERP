import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from '../../services/audit.service';
import { generateAccessToken, TokenPayload } from '../../utils/token';

export interface SessionPolicy {
  timeoutMinutes: number;
  warningMinutes: number;
  absoluteMaxHours: number;
}

const DEFAULT_TIMEOUT_MINUTES = 15;
const DEFAULT_WARNING_MINUTES = 2;
const DEFAULT_ABSOLUTE_MAX_HOURS = 12;

type DbClient = PrismaClient | Prisma.TransactionClient;

export class SessionService {
  static async getPolicy(db: DbClient = prisma): Promise<SessionPolicy> {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: [
            'SESSION_INACTIVITY_TIMEOUT_MINUTES',
            'SESSION_WARNING_MINUTES',
            'SESSION_ABSOLUTE_MAX_HOURS',
          ],
        },
      },
      select: { key: true, value: true },
    });

    const map = new Map(configs.map(c => [c.key, c.value]));
    const rawTimeout = Number(map.get('SESSION_INACTIVITY_TIMEOUT_MINUTES'));
    const rawWarning = Number(map.get('SESSION_WARNING_MINUTES'));
    const rawMaxHours = Number(map.get('SESSION_ABSOLUTE_MAX_HOURS'));

    const timeoutMinutes =
      Number.isFinite(rawTimeout) && rawTimeout >= 5 && rawTimeout <= 120
        ? Math.floor(rawTimeout)
        : DEFAULT_TIMEOUT_MINUTES;

    const maxWarning = Math.max(1, Math.min(10, timeoutMinutes - 1));
    const warningMinutes =
      Number.isFinite(rawWarning) && rawWarning >= 1 && rawWarning <= maxWarning
        ? Math.floor(rawWarning)
        : Math.min(DEFAULT_WARNING_MINUTES, maxWarning);

    const absoluteMaxHours =
      Number.isFinite(rawMaxHours) && rawMaxHours >= 1 && rawMaxHours <= 72
        ? Math.floor(rawMaxHours)
        : DEFAULT_ABSOLUTE_MAX_HOURS;

    return { timeoutMinutes, warningMinutes, absoluteMaxHours };
  }

  static async createSessionInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      family: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const policy = await this.getPolicy(tx);
    const now = new Date();
    const inactivityExpiresAt = new Date(now.getTime() + policy.timeoutMinutes * 60_000);
    const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteMaxHours * 3_600_000);

    return tx.userSession.create({
      data: {
        userId: params.userId,
        family: params.family,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        lastActivityAt: now,
        inactivityExpiresAt,
        absoluteExpiresAt,
      },
    });
  }

  static async validateSession(sessionId: string) {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AppError('Session not found or expired. Please sign in again.', 401, {
        code: 'SESSION_EXPIRED',
      });
    }

    if (session.isRevoked) {
      throw new AppError('Your session has been terminated. Please sign in again.', 401, {
        code: 'SESSION_REVOKED',
      });
    }

    const now = new Date();
    const expiredByInactivity = session.inactivityExpiresAt <= now;
    const expiredByAbsolute = session.absoluteExpiresAt <= now;

    if (expiredByInactivity || expiredByAbsolute) {
      const reason = expiredByAbsolute ? 'ABSOLUTE_LIFETIME_EXPIRED' : 'INACTIVITY_TIMEOUT';
      const updated = await prisma.userSession.updateMany({
        where: { id: session.id, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: now,
          revocationReason: reason,
        },
      });

      await prisma.refreshToken.updateMany({
        where: { family: session.family, isRevoked: false },
        data: { isRevoked: true },
      });

      if (updated.count > 0) {
        await AuditService.log({
          userId: session.userId,
          action: 'UPDATE',
          entityType: 'UserSession',
          entityId: session.id,
          remarks: `SESSION_EXPIRED: ${reason}`,
        });
      }

      throw new AppError(
        'Your session expired due to inactivity. Please sign in again.',
        401,
        { code: 'SESSION_EXPIRED' },
      );
    }

    return session;
  }

  static async getSessionStatus(sessionId: string) {
    const session = await this.validateSession(sessionId);
    const policy = await this.getPolicy();
    return {
      sessionId: session.id,
      lastActivityAt: session.lastActivityAt.toISOString(),
      inactivityExpiresAt: session.inactivityExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      timeoutMinutes: policy.timeoutMinutes,
      warningMinutes: policy.warningMinutes,
      serverTime: new Date().toISOString(),
    };
  }

  static async extendSession(
    sessionId: string,
    payload: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const session = await this.validateSession(sessionId);
    const policy = await this.getPolicy();
    const now = new Date();

    const candidateExpiry = new Date(now.getTime() + policy.timeoutMinutes * 60_000);
    const nextInactivityExpiresAt =
      candidateExpiry > session.absoluteExpiresAt ? session.absoluteExpiresAt : candidateExpiry;

    if (nextInactivityExpiresAt <= now) {
      throw new AppError('Session has reached maximum lifetime. Please sign in again.', 401, {
        code: 'SESSION_EXPIRED',
      });
    }

    const updated = await prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        inactivityExpiresAt: nextInactivityExpiresAt,
      },
    });

    const freshAccessToken = generateAccessToken({
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      sessionId: session.id,
    });

    await AuditService.log({
      userId: payload.userId,
      action: 'UPDATE',
      entityType: 'UserSession',
      entityId: session.id,
      remarks: 'SESSION_EXTENDED: User confirmed session extension',
      ipAddress,
      userAgent,
    });

    return {
      sessionId: updated.id,
      lastActivityAt: updated.lastActivityAt.toISOString(),
      inactivityExpiresAt: updated.inactivityExpiresAt.toISOString(),
      absoluteExpiresAt: updated.absoluteExpiresAt.toISOString(),
      timeoutMinutes: policy.timeoutMinutes,
      warningMinutes: policy.warningMinutes,
      serverTime: now.toISOString(),
      accessToken: freshAccessToken,
    };
  }

  static async listUserSessions(userId: string) {
    return prisma.userSession.findMany({
      where: { userId },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        inactivityExpiresAt: true,
        absoluteExpiresAt: true,
        isRevoked: true,
        revokedAt: true,
        revocationReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  static async revokeSession(
    sessionId: string,
    actorId: string,
    options: { isAdmin?: boolean; reason?: string; ipAddress?: string; userAgent?: string } = {},
  ) {
    const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new AppError('Session not found.', 404);
    }
    if (!options.isAdmin && session.userId !== actorId) {
      throw new AppError('Forbidden: You can only revoke your own sessions.', 403);
    }

    const now = new Date();
    const reason =
      options.reason ||
      (options.isAdmin ? 'ADMIN_SESSION_REVOCATION' : 'USER_SESSION_REVOCATION');

    await prisma.$transaction(async tx => {
      await tx.userSession.updateMany({
        where: { id: sessionId, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: now,
          revokedById: actorId,
          revocationReason: reason,
        },
      });

      await tx.refreshToken.updateMany({
        where: { family: session.family, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'UPDATE',
      entityType: 'UserSession',
      entityId: sessionId,
      remarks: `${options.isAdmin ? 'ADMIN_SESSION_REVOCATION' : 'SESSION_REVOKED'}: ${reason}`,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return { sessionId, revoked: true };
  }
}
