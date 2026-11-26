import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Settings,
  ShoppingCart,
  Boxes,
  Cpu,
  ShieldAlert,
  IndianRupee,
  Users,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  canNavigateToActionUrl,
  useNotificationActions,
  useNotificationsList,
  useNotificationStream,
  useUnreadNotificationCount,
} from '../../hooks/useNotifications';
import {
  NotificationCategory,
  NotificationItem,
  NotificationPriority,
  NotificationType,
} from '../../types/notifications';

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'SALES':
      return ShoppingCart;
    case 'INVENTORY':
      return Boxes;
    case 'PRODUCTION':
      return Cpu;
    case 'QUALITY':
      return ShieldAlert;
    case 'FINANCE':
      return IndianRupee;
    case 'ADMINISTRATION':
      return Users;
    default:
      return Info;
  }
}

export function getTypeBadgeClasses(type: NotificationType): string {
  switch (type) {
    case 'SUCCESS':
      return 'bg-[#EAF1E8] text-[#17452C]';
    case 'WARNING':
      return 'bg-amber-50 text-amber-700';
    case 'ERROR':
      return 'bg-red-50 text-[#C74440]';
    case 'ACTION_REQUIRED':
      return 'bg-emerald-50 text-[#245C3A]';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getTypeIndicator(type: NotificationType) {
  switch (type) {
    case 'SUCCESS':
      return CheckCircle2;
    case 'WARNING':
      return AlertTriangle;
    case 'ERROR':
      return AlertCircle;
    case 'ACTION_REQUIRED':
      return Clock;
    default:
      return Info;
  }
}

export function PriorityBadge({ priority }: { priority: NotificationPriority }) {
  if (priority === 'LOW' || priority === 'NORMAL') return null;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        priority === 'CRITICAL'
          ? 'bg-red-100 text-[#C74440] border border-red-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200'
      }`}
    >
      {priority}
    </span>
  );
}

export const NotificationBell: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useNotificationStream();

  const { data: unreadData } = useUnreadNotificationCount(Boolean(user));
  const {
    data: listData,
    isLoading,
    isError,
    refetch,
  } = useNotificationsList({ page: 1, limit: 8, isArchived: false }, Boolean(user) && open);

  const { markAsRead, markAllAsRead } = useNotificationActions();

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!user) return null;

  const unreadCount = unreadData?.data?.unreadCount ?? 0;
  const items = listData?.data?.items ?? [];

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsRead.mutate(item.id);
    }
    setOpen(false);
    if (item.actionUrl && canNavigateToActionUrl(item.actionUrl, hasPermission)) {
      navigate(item.actionUrl);
    } else {
      navigate(`/notifications?selected=${item.id}`);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        data-tour="notifications"
        onClick={() => setOpen(prev => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[#E1E7DD] bg-white text-[#245C3A] hover:bg-[#EAF1E8]/70 focus:outline-none focus:ring-2 focus:ring-[#245C3A]/30 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-[#C74440] px-1 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 rounded-lg border border-[#E1E7DD] bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[#E1E7DD] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#17452C]">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#EAF1E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#245C3A]">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#245C3A] hover:bg-[#EAF1E8] disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <Link
                to="/notifications/preferences"
                onClick={() => setOpen(false)}
                aria-label="Notification preferences"
                className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8] hover:text-[#17452C]"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#F0F4ED]">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-[#66756A]">Loading notifications...</div>
            ) : isError ? (
              <div className="p-5 text-center text-xs text-[#C74440]">
                <p>Failed to load notifications.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-2 rounded border border-[#E1E7DD] px-2.5 py-1 text-[11px] font-medium text-[#17452C] hover:bg-[#EAF1E8]"
                >
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-[#8A958C]" />
                <p className="mt-2 text-xs font-medium text-[#24352A]">No notifications</p>
                <p className="mt-0.5 text-[11px] text-[#66756A]">You are all caught up.</p>
              </div>
            ) : (
              items.map(item => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#FAFBF8] ${
                      !item.isRead ? 'bg-[#EAF1E8]/35' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${getTypeBadgeClasses(item.type)}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#24352A]">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <PriorityBadge priority={item.priority} />
                          {!item.isRead && (
                            <span
                              className="h-2 w-2 rounded-full bg-[#27834A]"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[#66756A]">
                        {item.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#8A958C]">
                        <span>{item.category}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[#E1E7DD] bg-[#FAFBF8] px-3.5 py-2 text-center rounded-b-lg">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#245C3A] hover:text-[#17452C] hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
