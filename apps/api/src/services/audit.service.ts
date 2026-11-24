import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from './prisma.service';
import { logger } from '../utils/logger';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  remarks?: string | null;
}

export class AuditService {
  /**
   * Record an immutable audit log entry.
   */
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          previousState: params.previousState
            ? (params.previousState as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newState: params.newState ? (params.newState as Prisma.InputJsonValue) : Prisma.JsonNull,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          remarks: params.remarks || null,
        },
      });
    } catch (error) {
      // Security rule: Audit log failures must be logged to stderr without crashing the host process
      logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
