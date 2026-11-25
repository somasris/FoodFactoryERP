import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { config } from '../config/env';
import { getAccessToken } from '../services/api-client';
import { notificationService } from '../services/notification.service';
import { useAuth } from './useAuth';
import { ListNotificationsParams } from '../types/notifications';

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; anyPermission: string[] }> = [
  { prefix: '/sales/invoices', anyPermission: ['sales.invoices.read'] },
  { prefix: '/sales/orders', anyPermission: ['sales.orders.read'] },
  { prefix: '/sales', anyPermission: ['sales.dashboard.read', 'sales.orders.read'] },
  { prefix: '/inventory', anyPermission: ['inventory.read'] },
  { prefix: '/production/demand', anyPermission: ['production.demand.read'] },
  { prefix: '/production/planning', anyPermission: ['production.plans.read'] },
  { prefix: '/production/work-orders', anyPermission: ['production.work_orders.read'] },
  { prefix: '/production/execution', anyPermission: ['production.batches.read'] },
  { prefix: '/production/quality', anyPermission: ['production.quality.read'] },
  { prefix: '/production/costing', anyPermission: ['production.costing.read'] },
  { prefix: '/admin/users', anyPermission: ['administration.users.read'] },
  { prefix: '/admin/roles', anyPermission: ['administration.roles.read'] },
  { prefix: '/admin/warehouse-access', anyPermission: ['administration.warehouse_access.read'] },
  { prefix: '/admin/settings', anyPermission: ['administration.settings.read'] },
  { prefix: '/admin/backups', anyPermission: ['operations.backup.read'] },
  { prefix: '/admin/maintenance', anyPermission: ['operations.monitoring.read', 'administration.settings.read'] },
];

export function canNavigateToActionUrl(
  actionUrl: string | null | undefined,
  hasPermission: (perm: string) => boolean,
): boolean {
  if (!actionUrl || !actionUrl.startsWith('/')) return false;
  const match = ROUTE_PERMISSION_MAP.find(r => actionUrl.startsWith(r.prefix));
  if (!match) return true;
  return match.anyPermission.some(p => hasPermission(p));
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.getUnreadCount(),
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useNotificationsList(params: ListNotificationsParams, enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => notificationService.list(params),
    enabled,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: data => {
      queryClient.setQueryData(['notifications', 'unread-count'], {
        success: true,
        message: 'ok',
        data: { unreadCount: data.data?.unreadCount ?? 0 },
        timestamp: new Date().toISOString(),
      });
      invalidate();
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => invalidate(),
  });

  const archive = useMutation({
    mutationFn: (id: string) => notificationService.archive(id),
    onSuccess: () => invalidate(),
  });

  const archiveAll = useMutation({
    mutationFn: () => notificationService.archiveAll(),
    onSuccess: () => invalidate(),
  });

  return { markAsRead, markAllAsRead, archive, archiveAll };
}

/**
 * Establishes an authenticated SSE connection using fetch streaming (so the
 * Authorization Bearer header is sent without leaking tokens in URLs).
 */
export function useNotificationStream() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const retryDelayRef = useRef(2000);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;
    let abortController: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (cancelled) return;
      const token = getAccessToken();
      if (!token) return;

      abortController = new AbortController();
      const url = `${config.apiBaseUrl}/notifications/stream`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE stream failed with status ${res.status}`);
        }

        // Reset backoff on successful connection
        retryDelayRef.current = 2000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            if (!frame.trim() || frame.startsWith(':')) continue;
            let eventName = 'message';
            let dataLine = '';

            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLine += line.slice(5).trim();
              }
            }

            if (eventName === 'notification' && dataLine) {
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            } else if (eventName === 'unread_count' && dataLine) {
              try {
                const parsed = JSON.parse(dataLine) as { unreadCount: number };
                queryClient.setQueryData(['notifications', 'unread-count'], {
                  success: true,
                  message: 'ok',
                  data: { unreadCount: parsed.unreadCount },
                  timestamp: new Date().toISOString(),
                });
              } catch {
                queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
              }
            }
          }
        }
      } catch {
        // Ignore abort errors on unmount/logout
      }

      if (!cancelled) {
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30_000);
        retryTimer = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (abortController) abortController.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, user, queryClient]);
}
