import { z } from 'zod';
import {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.nativeEnum(NotificationCategory).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  isRead: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const updatePreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        category: z.nativeEnum(NotificationCategory),
        inAppEnabled: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export interface RecipientTarget {
  userIds?: string[];
  roles?: string[];
  permissions?: string[];
  warehouseId?: string;
  excludeUserIds?: string[];
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  eventKey: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  target: RecipientTarget;
}

export interface SseNotificationPayload {
  id: string;
  notificationId: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}
