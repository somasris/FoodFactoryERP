export type NotificationType =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'ACTION_REQUIRED';

export type NotificationCategory =
  | 'SALES'
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'QUALITY'
  | 'FINANCE'
  | 'ADMINISTRATION'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface NotificationItem {
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
  readAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationPreferenceItem {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string | null;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  category?: NotificationCategory | '';
  priority?: NotificationPriority | '';
  isRead?: boolean;
  isArchived?: boolean;
  search?: string;
}
