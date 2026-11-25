import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { AuditAction, BackupStatus, BackupVerificationStatus, RestoreRequestStatus } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { invalidateMaintenanceCache } from '../../middleware/maintenance.middleware';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { TelemetryStore } from '../../utils/telemetry';

const execFileAsync = promisify(execFile);

export class OperationsService {
  /**
   * 4.5.1 Authenticated Detailed System Health Diagnostics (no secrets or connection strings).
   */
  static async getDetailedHealth() {
    const start = Date.now();
    let dbStatus = 'connected';
    let dbError: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = 'disconnected';
      dbError = err instanceof Error ? err.message : 'Database connection error';
    }
    const dbLatencyMs = Date.now() - start;

    const [activeSessions, maintenanceCfg, latestMigration] = await Promise.all([
      prisma.refreshToken.count({ where: { isRevoked: false, expiresAt: { gt: new Date() } } }),
      prisma.systemConfig.findUnique({ where: { key: 'OPERATIONS_MAINTENANCE_MODE' } }),
      prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 1
      `.catch(() => []),
    ]);

    const mem = process.memoryUsage();

    return {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      api: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        memoryMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
        latestMigration: latestMigration[0]?.migration_name || null,
      },
      activeSessions,
      maintenanceMode: maintenanceCfg?.value === 'true',
    };
  }

  /**
   * 4.5.2 & 4.5.3 Application Error & Performance Monitoring.
   * Stack traces restricted to ADMIN / OWNER.
   */
  static async getMonitoring(roles: string[]) {
    const canViewStack = roles.includes('OWNER') || roles.includes('ADMIN');
    return {
      performance: TelemetryStore.getPerformanceSummary(500),
      recentErrors: TelemetryStore.getRecentErrors(canViewStack),
    };
  }

  /**
   * 4.5.6 Safe Database Maintenance Visibility (read-only; never runs VACUUM FULL / DROP / TRUNCATE).
   */
  static async getDatabaseMaintenanceInfo() {
    const [migrations, dbSizeRows, tableSizes] = await Promise.all([
      prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; applied_steps_count: number }>>`
        SELECT migration_name, finished_at, applied_steps_count
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 25
      `.catch(() => []),
      prisma.$queryRaw<Array<{ size_bytes: bigint }>>`
        SELECT pg_database_size(current_database()) AS size_bytes
      `.catch(() => []),
      prisma.$queryRaw<Array<{ table_name: string; total_bytes: bigint }>>`
        SELECT relname AS table_name, pg_total_relation_size(relid) AS total_bytes
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 15
      `.catch(() => []),
    ]);

    return {
      databaseSizeMb: dbSizeRows[0]
        ? Number((Number(dbSizeRows[0].size_bytes) / (1024 * 1024)).toFixed(2))
        : null,
      migrationsCount: migrations.length,
      migrations,
      largestTables: tableSizes.map(t => ({
        tableName: t.table_name,
        sizeMb: Number((Number(t.total_bytes) / (1024 * 1024)).toFixed(3)),
      })),
      recommendations: [
        'Schedule regular pg_dump backups to an off-host encrypted storage volume.',
        'Monitor audit_logs and inventory_transaction_lines growth quarterly.',
        'Run ANALYZE during off-peak hours; never run VACUUM FULL from web UI.',
      ],
    };
  }

  /**
   * 4.5.4 Safe Backup Management (honestly reports UNAVAILABLE if pg_dump or BACKUP_DIR is unconfigured).
   */
  static async listBackups() {
    const [backups, restoreRequests] = await Promise.all([
      prisma.backupRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.restoreRequest.findMany({
        include: {
          backupRecord: { select: { backupName: true, status: true, checksumSha256: true } },
        },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
    ]);

    return { backups, restoreRequests };
  }

  static async triggerBackup(actor: { userId: string; username: string; ipAddress?: string; userAgent?: string }) {
    const backupDir = process.env.BACKUP_DIR;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `foodfactory-backup-${timestamp}.sql`;

    if (!backupDir) {
      const record = await prisma.backupRecord.create({
        data: {
          backupName,
          backupType: 'MANUAL',
          status: BackupStatus.UNAVAILABLE,
          failureReason:
            'BACKUP_DIR environment variable is not configured in this deployment environment. Backup execution skipped safely.',
          triggeredById: actor.userId,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: actor.userId,
          action: AuditAction.CREATE,
          entityType: 'BackupRecord',
          entityId: record.id,
          newState: { status: record.status, reason: record.failureReason },
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
      return record;
    }

    // Check pg_dump availability
    try {
      await execFileAsync('pg_dump', ['--version']);
    } catch {
      const record = await prisma.backupRecord.create({
        data: {
          backupName,
          backupType: 'MANUAL',
          status: BackupStatus.UNAVAILABLE,
          failureReason: 'pg_dump binary is not installed or not in PATH.',
          triggeredById: actor.userId,
        },
      });
      return record;
    }

    const resolvedDir = path.resolve(backupDir);
    await fs.mkdir(resolvedDir, { recursive: true });
    const outPath = path.join(resolvedDir, backupName);

    try {
      await execFileAsync('pg_dump', [process.env.DATABASE_URL || '', '-f', outPath]);
      const stat = await fs.stat(outPath);
      const buf = await fs.readFile(outPath);
      const checksum = crypto.createHash('sha256').update(buf).digest('hex');

      const record = await prisma.backupRecord.create({
        data: {
          backupName,
          backupType: 'MANUAL',
          status: BackupStatus.COMPLETED,
          filePathReference: backupName, // never expose absolute server path or DB creds
          fileSizeBytes: stat.size,
          checksumSha256: checksum,
          verificationStatus: BackupVerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          triggeredById: actor.userId,
          completedAt: new Date(),
        },
      });
      await NotificationEventsService.onBackupEvent({
        id: record.id,
        backupName: record.backupName,
        failed: false,
      });
      return record;
    } catch (err) {
      const record = await prisma.backupRecord.create({
        data: {
          backupName,
          backupType: 'MANUAL',
          status: BackupStatus.FAILED,
          failureReason: err instanceof Error ? err.message : 'pg_dump execution failed',
          triggeredById: actor.userId,
        },
      });
      await NotificationEventsService.onBackupEvent({
        id: record.id,
        backupName: record.backupName,
        failed: true,
        failureReason: record.failureReason,
      });
      return record;
    }
  }

  static async verifyBackup(id: string) {
    const record = await prisma.backupRecord.findUnique({ where: { id } });
    if (!record) throw new AppError('Backup record not found.', 404);

    if (record.status !== 'COMPLETED' || !record.filePathReference || !process.env.BACKUP_DIR) {
      return prisma.backupRecord.update({
        where: { id },
        data: {
          verificationStatus: BackupVerificationStatus.FAILED,
          verifiedAt: new Date(),
        },
      });
    }

    const fullPath = path.join(path.resolve(process.env.BACKUP_DIR), record.filePathReference);
    try {
      const buf = await fs.readFile(fullPath);
      const checksum = crypto.createHash('sha256').update(buf).digest('hex');
      const matches = checksum === record.checksumSha256;
      return prisma.backupRecord.update({
        where: { id },
        data: {
          verificationStatus: matches
            ? BackupVerificationStatus.VERIFIED
            : BackupVerificationStatus.FAILED,
          verifiedAt: new Date(),
        },
      });
    } catch {
      return prisma.backupRecord.update({
        where: { id },
        data: {
          verificationStatus: BackupVerificationStatus.FAILED,
          verifiedAt: new Date(),
        },
      });
    }
  }

  /**
   * 4.5.5 Controlled Restore Workflow (never auto-executes destructive DB restore).
   */
  static async requestRestore(
    backupRecordId: string,
    notes: string | undefined,
    actor: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const backup = await prisma.backupRecord.findUnique({ where: { id: backupRecordId } });
    if (!backup) throw new AppError('Backup record not found.', 404);

    const reqRecord = await prisma.restoreRequest.create({
      data: {
        backupRecordId,
        status: RestoreRequestStatus.REQUESTED,
        requestedById: actor.userId,
        recoveryNotes: notes || 'Controlled restore requested for isolated recovery environment.',
        environmentLabel: 'ISOLATED_STAGING',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'RestoreRequest',
        entityId: reqRecord.id,
        newState: { backupRecordId, status: reqRecord.status },
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
      },
    });

    await NotificationEventsService.onRestoreRequestEvent(
      { id: reqRecord.id, requestedById: reqRecord.requestedById, status: reqRecord.status },
      'SUBMITTED',
    );

    return reqRecord;
  }

  static async reviewRestoreRequest(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string | undefined,
    actor: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await prisma.restoreRequest.findUnique({ where: { id } });
    if (!existing) throw new AppError('Restore request not found.', 404);
    if (existing.status !== 'REQUESTED') {
      throw new AppError(`Restore request already reviewed (${existing.status}).`, 400);
    }

    const updated = await prisma.restoreRequest.update({
      where: { id },
      data: {
        status:
          decision === 'APPROVED' ? RestoreRequestStatus.APPROVED : RestoreRequestStatus.REJECTED,
        approvedById: actor.userId,
        approvedAt: new Date(),
        rejectionReason: decision === 'REJECTED' ? reason || 'Rejected by administrator' : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: decision === 'APPROVED' ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: 'RestoreRequest',
        entityId: id,
        previousState: { status: existing.status },
        newState: { status: updated.status },
        remarks: 'Manual external recovery runbook required; active DB is never overwritten automatically.',
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
      },
    });

    await NotificationEventsService.onRestoreRequestEvent(
      { id: updated.id, requestedById: updated.requestedById, status: updated.status },
      decision,
    );

    return updated;
  }

  /**
   * 4.5.7 Maintenance Mode Control (OWNER/ADMIN bypass guaranteed).
   */
  static async getMaintenanceMode() {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['OPERATIONS_MAINTENANCE_MODE', 'OPERATIONS_MAINTENANCE_MESSAGE'] },
      },
    });
    const map = new Map(configs.map(c => [c.key, c.value]));
    return {
      enabled: map.get('OPERATIONS_MAINTENANCE_MODE') === 'true',
      message:
        map.get('OPERATIONS_MAINTENANCE_MESSAGE') ||
        'System is undergoing scheduled maintenance. Please try again shortly.',
    };
  }

  static async setMaintenanceMode(
    enabled: boolean,
    message: string | undefined,
    actor: { userId: string; username: string; ipAddress?: string; userAgent?: string },
  ) {
    const prev = await this.getMaintenanceMode();

    await prisma.$transaction(async tx => {
      await tx.systemConfig.upsert({
        where: { key: 'OPERATIONS_MAINTENANCE_MODE' },
        update: { value: String(enabled), updatedById: actor.userId },
        create: {
          key: 'OPERATIONS_MAINTENANCE_MODE',
          value: String(enabled),
          category: 'SECURITY',
          valueType: 'BOOLEAN',
          description: 'Application maintenance mode toggle',
          updatedById: actor.userId,
        },
      });

      if (message !== undefined) {
        await tx.systemConfig.upsert({
          where: { key: 'OPERATIONS_MAINTENANCE_MESSAGE' },
          update: { value: message, updatedById: actor.userId },
          create: {
            key: 'OPERATIONS_MAINTENANCE_MESSAGE',
            value: message,
            category: 'SECURITY',
            valueType: 'STRING',
            description: 'Maintenance mode banner message',
            updatedById: actor.userId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: AuditAction.UPDATE,
          entityType: 'MaintenanceMode',
          entityId: 'OPERATIONS_MAINTENANCE_MODE',
          previousState: prev,
          newState: { enabled, message: message ?? prev.message },
          remarks: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });
    });

    invalidateMaintenanceCache();
    await NotificationEventsService.onSystemSettingsChanged(['MAINTENANCE_MODE']);
    return this.getMaintenanceMode();
  }
}
