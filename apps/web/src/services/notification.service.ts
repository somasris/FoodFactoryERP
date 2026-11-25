import { apiClient } from './api-client';
import {
  ListNotificationsParams,
  NotificationItem,
  NotificationListResponse,
  NotificationPreferenceItem,
} from '../types/notifications';

export const notificationService = {
  list: (params: ListNotificationsParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.category) qs.set('category', params.category);
    if (params.priority) qs.set('priority', params.priority);
    if (params.isRead !== undefined) qs.set('isRead', String(params.isRead));
    if (params.isArchived !== undefined) qs.set('isArchived', String(params.isArchived));
    if (params.search?.trim()) qs.set('search', params.search.trim());
    const query = qs.toString();
    return apiClient<NotificationListResponse>(`/notifications${query ? `?${query}` : ''}`);
  },

  getUnreadCount: () => apiClient<{ unreadCount: number }>('/notifications/unread-count'),

  getById: (id: string) => apiClient<NotificationItem>(`/notifications/${id}`),

  markAsRead: (id: string) =>
    apiClient<{ id: string; isRead: boolean; readAt: string | null; unreadCount: number }>(
      `/notifications/${id}/read`,
      { method: 'PATCH', body: '{}' },
    ),

  markAllAsRead: () =>
    apiClient<{ updatedCount: number; unreadCount: number }>('/notifications/read-all', {
      method: 'PATCH',
      body: '{}',
    }),

  archive: (id: string) =>
    apiClient<{ id: string; isArchived: boolean; archivedAt: string | null; unreadCount: number }>(
      `/notifications/${id}/archive`,
      { method: 'PATCH', body: '{}' },
    ),

  archiveAll: () =>
    apiClient<{ archivedCount: number; unreadCount: number }>('/notifications/archive-all', {
      method: 'PATCH',
      body: '{}',
    }),

  getPreferences: () => apiClient<NotificationPreferenceItem[]>('/notifications/preferences'),

  updatePreferences: (
    preferences: Array<{ category: NotificationPreferenceItem['category']; inAppEnabled: boolean }>,
  ) =>
    apiClient<NotificationPreferenceItem[]>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences }),
    }),
};
