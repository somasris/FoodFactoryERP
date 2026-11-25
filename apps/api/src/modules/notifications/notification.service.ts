import crypto from 'crypto';
import {
  NotificationCategory,
  NotificationOutboxStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { isGlobalWarehouseRole } from '../inventory/inventory.utils';
import {
  CreateNotificationInput,
  ListNotificationsQuery,
  RecipientTarget,
  SseNotificationPayload,
  UpdatePreferencesInput,
} from './notification.types';
import { NotificationSseService } from './notification-sse.service';

type DbClient = Prisma.TransactionClient | typeof prisma;

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|hash|authorization|cookie|privatekey|apikey|credential/i;

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

const ALL_CATEGORIES = Object.values(NotificationCategory);

/**
 * Recursively redact sensitive fields before persisting notification metadata.
 */
export function sanitizeMetadata(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;

  const sanitizeValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) return val.map(sanitizeValue);
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          obj[k] = '[REDACTED]';
        } else {
          obj[k] = sanitizeValue(v);
        }
      }
      return obj;
    }
    return val;
  };

  return sanitizeValue(input) as Record<string, unknown>;
}

export class NotificationService {
  /**
   * Resolve distinct, active, authorized recipient user IDs from database roles,
   * permissions, warehouse access scopes, and user notification preferences.
   */
  static async resolveRecipients(
    db: DbClient,
    category: NotificationCategory,
    target: RecipientTarget,
  ): Promise<string[]> {
    const hasUserIds = Boolean(target.userIds && target.userIds.length > 0);
    const hasRoles = Boolean(target.roles && target.roles.length > 0);
    const hasPerms = Boolean(target.permissions && target.permissions.length > 0);

    if (!hasUserIds && !hasRoles && !hasPerms) {
      return [];
    }

    const candidates = await db.user.findMany({
      where: {
        isActive: true,
        registrationStatus: 'APPROVED',
        userRoles: {
          some: {
            role: { isActive: true },
          },
        },
      },
      select: {
        id: true,
        userRoles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: {
                    permission: {
                      select: { code: true },
                    },
                  },
                },
              },
            },
          },
        },
        warehouseAccess: target.warehouseId
          ? {
              where: { warehouseId: target.warehouseId },
              select: { warehouseId: true },
            }
          : false,
        notificationPreferences: {
          where: { category },
          select: { inAppEnabled: true },
        },
      },
    });

    const excluded = new Set(target.excludeUserIds ?? []);
    const explicitUserIds = new Set(target.userIds ?? []);
    const targetRoles = new Set(target.roles ?? []);
    const targetPerms = new Set(target.permissions ?? []);

    const matchedUserIds: string[] = [];

    for (const user of candidates) {
      if (excluded.has(user.id)) continue;

      // Respect user category preference (defaults to enabled when no row exists)
      const pref = user.notificationPreferences[0];
      if (pref && !pref.inAppEnabled) continue;

      const roleCodes = user.userRoles.map(ur => ur.role.code);
      const isOwner = roleCodes.includes('OWNER');
      const permCodes = new Set(
        user.userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code)),
      );

      let matchesTarget = false;
      if (explicitUserIds.has(user.id)) {
        matchesTarget = true;
      } else if (hasRoles && roleCodes.some(r => targetRoles.has(r))) {
        matchesTarget = true;
      } else if (hasPerms && (isOwner || Array.from(targetPerms).some(p => permCodes.has(p)))) {
        matchesTarget = true;
      }

      if (!matchesTarget) continue;

      // Enforce warehouse scope for non-global roles
      if (target.warehouseId && !isGlobalWarehouseRole(roleCodes)) {
        const whAccess = Array.isArray(user.warehouseAccess) ? user.warehouseAccess : [];
        if (whAccess.length === 0) continue;
      }

      matchedUserIds.push(user.id);
    }

    return matchedUserIds;
  }

  /**
   * Create a persistent notification, per-user delivery records, and outbox entries
   * inside a database transaction, then publish to active SSE subscribers.
   */
  static async notify(
    input: CreateNotificationInput,
    outerTx?: Prisma.TransactionClient,
  ): Promise<{ notificationId: string; recipientCount: number } | null> {
    const sanitizedMeta = sanitizeMetadata(input.metadata);
    const type = input.type ?? NotificationType.INFO;
    const priority = input.priority ?? NotificationPriority.NORMAL;

    const runInTx = async (tx: Prisma.TransactionClient) => {
      const recipientIds = await this.resolveRecipients(tx, input.category, input.target);
      if (recipientIds.length === 0) {
        return null;
      }

      // Filter out recipients who already received this exact eventKey
      const existingDeliveries = await tx.userNotification.findMany({
        where: {
          userId: { in: recipientIds },
          eventKey: input.eventKey,
        },
        select: { userId: true },
      });
      const alreadyDelivered = new Set(existingDeliveries.map(d => d.userId));
      const newRecipientIds = recipientIds.filter(uid => !alreadyDelivered.has(uid));

      if (newRecipientIds.length === 0) {
        return null;
      }

      const notification = await tx.notification.create({
        data: {
          title: input.title.slice(0, 200),
          message: input.message,
          type,
          category: input.category,
          priority,
          eventKey: input.eventKey.slice(0, 180),
          entityType: input.entityType?.slice(0, 80) ?? null,
          entityId: input.entityId?.slice(0, 80) ?? null,
          actionUrl: input.actionUrl?.slice(0, 255) ?? null,
          metadata: sanitizedMeta ? (sanitizedMeta as Prisma.InputJsonValue) : Prisma.JsonNull,
          expiresAt: input.expiresAt ?? null,
        },
      });

      const userNotificationsData = newRecipientIds.map(userId => ({
        id: crypto.randomUUID(),
        notificationId: notification.id,
        userId,
        eventKey: input.eventKey.slice(0, 180),
      }));

      await tx.userNotification.createMany({
        data: userNotificationsData,
        skipDuplicates: true,
      });

      const outboxEntries = userNotificationsData.map(un => {
        const payload: SseNotificationPayload = {
          id: un.id,
          notificationId: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category: notification.category,
          priority: notification.priority,
          entityType: notification.entityType,
          entityId: notification.entityId,
          actionUrl: notification.actionUrl,
          metadata: sanitizedMeta,
          isRead: false,
          createdAt: notification.createdAt.toISOString(),
        };
        return {
          id: crypto.randomUUID(),
          notificationId: notification.id,
          userId: un.userId,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: NotificationOutboxStatus.PENDING,
        };
      });

      await tx.notificationOutbox.createMany({
        data: outboxEntries,
      });

      return {
        notificationId: notification.id,
        recipientCount: userNotificationsData.length,
        outboxEntries,
      };
    };

    const result = outerTx
      ? await runInTx(outerTx)
      : await prisma.$transaction(tx => runInTx(tx));

    if (!result) {
      return null;
    }

    // Dispatch real-time SSE events outside the critical write path
    await this.flushOutboxEntries(result.outboxEntries.map(e => ({ id: e.id, userId: e.userId, payload: e.payload })));

    return {
      notificationId: result.notificationId,
      recipientCount: result.recipientCount,
    };
  }

  /**
   * Non-throwing wrapper for business event notifications so notification failures
   * never roll back completed ERP transactions.
   */
  static async notifySafe(input: CreateNotificationInput): Promise<void> {
    try {
      await this.notify(input);
    } catch (error) {
      logger.error(
        `Notification dispatch failed for eventKey=${input.eventKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Deliver pending outbox entries to active SSE clients and update outbox status.
   */
  private static async flushOutboxEntries(
    entries: Array<{ id: string; userId: string; payload: Prisma.InputJsonValue }>,
  ): Promise<void> {
    for (const entry of entries) {
      try {
        const delivered = NotificationSseService.publishToUser(
          entry.userId,
          'notification',
          entry.payload,
        );
        if (delivered) {
          const unreadCount = await this.getUnreadCount(entry.userId);
          NotificationSseService.publishToUser(entry.userId, 'unread_count', { unreadCount });
          await prisma.notificationOutbox.update({
            where: { id: entry.id },
            data: {
              status: NotificationOutboxStatus.DELIVERED,
              attempts: { increment: 1 },
              processedAt: new Date(),
            },
          });
        }
      } catch (err) {
        logger.debug(
          `Outbox SSE flush error for ${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Flush any pending outbox entries for a user when they establish an SSE connection.
   */
  static async deliverPendingOutboxForUser(userId: string): Promise<void> {
    try {
      const pending = await prisma.notificationOutbox.findMany({
        where: { userId, status: NotificationOutboxStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      if (pending.length > 0) {
        await this.flushOutboxEntries(
          pending.map(p => ({
            id: p.id,
            userId: p.userId,
            payload: p.payload as Prisma.InputJsonValue,
          })),
        );
      }
    } catch (err) {
      logger.debug(`Failed to flush pending outbox for user ${userId}: ${String(err)}`);
    }
  }

  /**
   * Trigger a state-based alert (e.g. LOW_STOCK, ZERO_STOCK, BATCH_EXPIRING).
   * Prevents duplicate notifications while the condition remains active; re-notifies
   * only after the condition has been resolved and becomes active again.
   */
  static async triggerStateAlert(
    alertKey: string,
    input: Omit<CreateNotificationInput, 'eventKey'>,
  ): Promise<boolean> {
    try {
      const state = await prisma.$transaction(async tx => {
        const existing = await tx.notificationAlertState.findUnique({
          where: { alertKey },
        });

        if (existing && existing.isActive) {
          return null; // Already active; do not spam
        }

        if (existing) {
          return tx.notificationAlertState.update({
            where: { alertKey },
            data: {
              isActive: true,
              epoch: { increment: 1 },
              lastTriggeredAt: new Date(),
              resolvedAt: null,
            },
          });
        }

        return tx.notificationAlertState.create({
          data: {
            alertKey,
            isActive: true,
            epoch: 1,
          },
        });
      });

      if (!state) return false;

      await this.notifySafe({
        ...input,
        eventKey: `${alertKey}:v${state.epoch}`,
      });
      return true;
    } catch (err) {
      logger.error(`triggerStateAlert failed for ${alertKey}: ${String(err)}`);
      return false;
    }
  }

  /**
   * Mark a previously active state alert as resolved so future recurrences can notify again.
   */
  static async resolveStateAlert(alertKey: string): Promise<void> {
    try {
      await prisma.notificationAlertState.updateMany({
        where: { alertKey, isActive: true },
        data: { isActive: false, resolvedAt: new Date() },
      });
    } catch (err) {
      logger.debug(`resolveStateAlert failed for ${alertKey}: ${String(err)}`);
    }
  }

  /**
   * List paginated notifications strictly owned by the authenticated user.
   */
  static async listForUser(userId: string, query: ListNotificationsQuery) {
    const now = new Date();
    const where: Prisma.UserNotificationWhereInput = {
      userId,
      isArchived: query.isArchived ?? false,
      notification: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const notifFilter: Prisma.NotificationWhereInput = {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (query.category) {
      notifFilter.category = query.category;
    }
    if (query.priority) {
      notifFilter.priority = query.priority;
    }
    if (query.search) {
      notifFilter.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { message: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    where.notification = notifFilter;

    if (query.fromDate || query.toDate) {
      where.createdAt = {
        ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
        ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        include: { notification: true },
        orderBy:
          query.sortBy === 'priority'
            ? [{ notification: { priority: query.sortOrder } }, { createdAt: 'desc' }]
            : { createdAt: query.sortOrder },
        skip,
        take: query.limit,
      }),
      prisma.userNotification.count({ where }),
      this.getUnreadCount(userId),
    ]);

    const mapped = items.map(item => ({
      id: item.id,
      notificationId: item.notificationId,
      title: item.notification.title,
      message: item.notification.message,
      type: item.notification.type,
      category: item.notification.category,
      priority: item.notification.priority,
      entityType: item.notification.entityType,
      entityId: item.notification.entityId,
      actionUrl: item.notification.actionUrl,
      metadata: item.notification.metadata,
      isRead: item.isRead,
      readAt: item.readAt,
      isArchived: item.isArchived,
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
    }));

    if (query.sortBy === 'priority') {
      mapped.sort((a, b) => {
        const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        return query.sortOrder === 'asc' ? diff : -diff;
      });
    }

    return {
      items: mapped,
      total,
      unreadCount,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /**
   * Return unread, non-archived, non-expired notification count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const now = new Date();
    return prisma.userNotification.count({
      where: {
        userId,
        isRead: false,
        isArchived: false,
        notification: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    });
  }

  /**
   * Fetch a single notification record strictly owned by the authenticated user.
   */
  static async getById(userId: string, id: string) {
    const item = await prisma.userNotification.findFirst({
      where: { id, userId },
      include: { notification: true },
    });

    if (!item) {
      throw new AppError('Notification not found.', 404);
    }

    return {
      id: item.id,
      notificationId: item.notificationId,
      title: item.notification.title,
      message: item.notification.message,
      type: item.notification.type,
      category: item.notification.category,
      priority: item.notification.priority,
      entityType: item.notification.entityType,
      entityId: item.notification.entityId,
      actionUrl: item.notification.actionUrl,
      metadata: item.notification.metadata,
      isRead: item.isRead,
      readAt: item.readAt,
      isArchived: item.isArchived,
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
    };
  }

  /**
   * Mark a single user notification as read (ownership enforced).
   */
  static async markAsRead(userId: string, id: string) {
    const existing = await prisma.userNotification.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('Notification not found.', 404);
    }

    const updated = existing.isRead
      ? existing
      : await prisma.userNotification.update({
          where: { id: existing.id },
          data: { isRead: true, readAt: new Date() },
        });

    const unreadCount = await this.getUnreadCount(userId);
    NotificationSseService.publishToUser(userId, 'unread_count', { unreadCount });

    return { id: updated.id, isRead: updated.isRead, readAt: updated.readAt, unreadCount };
  }

  /**
   * Mark all unread notifications for the authenticated user as read.
   */
  static async markAllAsRead(userId: string) {
    const result = await prisma.userNotification.updateMany({
      where: { userId, isRead: false, isArchived: false },
      data: { isRead: true, readAt: new Date() },
    });

    const unreadCount = await this.getUnreadCount(userId);
    NotificationSseService.publishToUser(userId, 'unread_count', { unreadCount });

    return { updatedCount: result.count, unreadCount };
  }

  /**
   * Archive a single user notification (ownership enforced).
   */
  static async archive(userId: string, id: string) {
    const existing = await prisma.userNotification.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('Notification not found.', 404);
    }

    const updated = await prisma.userNotification.update({
      where: { id: existing.id },
      data: {
        isArchived: true,
        archivedAt: existing.archivedAt ?? new Date(),
        isRead: true,
        readAt: existing.readAt ?? new Date(),
      },
    });

    const unreadCount = await this.getUnreadCount(userId);
    NotificationSseService.publishToUser(userId, 'unread_count', { unreadCount });

    return {
      id: updated.id,
      isArchived: updated.isArchived,
      archivedAt: updated.archivedAt,
      unreadCount,
    };
  }

  /**
   * Archive all non-archived notifications for the authenticated user.
   */
  static async archiveAll(userId: string) {
    const now = new Date();
    const result = await prisma.userNotification.updateMany({
      where: { userId, isArchived: false },
      data: { isArchived: true, archivedAt: now, isRead: true, readAt: now },
    });

    const unreadCount = await this.getUnreadCount(userId);
    NotificationSseService.publishToUser(userId, 'unread_count', { unreadCount });

    return { archivedCount: result.count, unreadCount };
  }

  /**
   * Retrieve notification preferences for all categories for the authenticated user.
   */
  static async getPreferences(userId: string) {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byCategory = new Map(rows.map(r => [r.category, r]));

    return ALL_CATEGORIES.map(category => {
      const existing = byCategory.get(category);
      return {
        category,
        inAppEnabled: existing ? existing.inAppEnabled : true,
        emailEnabled: false, // Email delivery not yet implemented
        updatedAt: existing?.updatedAt ?? null,
      };
    });
  }

  /**
   * Update notification category preferences for the authenticated user.
   */
  static async updatePreferences(userId: string, input: UpdatePreferencesInput) {
    await prisma.$transaction(
      input.preferences.map(pref =>
        prisma.notificationPreference.upsert({
          where: { userId_category: { userId, category: pref.category } },
          create: {
            userId,
            category: pref.category,
            inAppEnabled: pref.inAppEnabled,
            emailEnabled: false,
          },
          update: {
            inAppEnabled: pref.inAppEnabled,
          },
        }),
      ),
    );

    return this.getPreferences(userId);
  }

  /**
   * Expire and clean up old notifications according to retention rules.
   */
  static async cleanupExpired(retentionDays = 90): Promise<{ deletedNotifications: number }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await prisma.notification.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: cutoff } }],
      },
    });

    return { deletedNotifications: deleted.count };
  }
}
