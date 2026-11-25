import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Search,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  canNavigateToActionUrl,
  useNotificationActions,
  useNotificationsList,
} from '../../hooks/useNotifications';
import {
  NotificationCategory,
  NotificationItem,
  NotificationPriority,
} from '../../types/notifications';
import {
  getCategoryIcon,
  getTypeBadgeClasses,
  PriorityBadge,
} from '../../components/layout/NotificationBell';

const CATEGORIES: Array<{ value: '' | NotificationCategory; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'SALES', label: 'Sales' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMINISTRATION', label: 'Administration' },
  { value: 'SYSTEM', label: 'System' },
];

const PRIORITIES: Array<{ value: '' | NotificationPriority; label: string }> = [
  { value: '', label: 'All Priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

type TabMode = 'all' | 'unread' | 'read' | 'archived';

export const NotificationsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSelected = searchParams.get('selected');

  const [tab, setTab] = useState<TabMode>('all');
  const [category, setCategory] = useState<'' | NotificationCategory>('');
  const [priority, setPriority] = useState<'' | NotificationPriority>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 15,
      category: category || undefined,
      priority: priority || undefined,
      isRead: tab === 'unread' ? false : tab === 'read' ? true : undefined,
      isArchived: tab === 'archived',
      search: search.trim() || undefined,
    }),
    [page, category, priority, tab, search],
  );

  const { data, isLoading, isError, refetch } = useNotificationsList(queryParams);
  const { markAsRead, markAllAsRead, archive, archiveAll } = useNotificationActions();

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;
  const unreadCount = data?.data?.unreadCount ?? 0;

  const selectedItem: NotificationItem | undefined =
    items.find(i => i.id === selectedId) ?? items[0];

  const handleSelect = (item: NotificationItem) => {
    setSelectedId(item.id);
    if (!item.isRead) {
      markAsRead.mutate(item.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Notification Center</h1>
          <p className="text-xs text-[#66756A]">
            {unreadCount} unread · {total} total in view
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending || unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E1E7DD] bg-white px-3 py-1.5 text-xs font-medium text-[#245C3A] hover:bg-[#EAF1E8] disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </button>
          <button
            type="button"
            onClick={() => archiveAll.mutate()}
            disabled={archiveAll.isPending || tab === 'archived' || total === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E1E7DD] bg-white px-3 py-1.5 text-xs font-medium text-[#66756A] hover:bg-[#FAFBF8] disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive all</span>
          </button>
          <Link
            to="/notifications/preferences"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C]"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Preferences</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Notification status filter">
          {(['all', 'unread', 'read', 'archived'] as TabMode[]).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-[#245C3A] text-white'
                  : 'border border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A] hover:bg-[#EAF1E8]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8A958C]" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notifications..."
              aria-label="Search notifications"
              className="w-full rounded-md border border-[#E1E7DD] bg-white py-1.5 pl-8 pr-3 text-xs text-[#24352A] focus:border-[#245C3A] focus:outline-none sm:w-52"
            />
          </div>

          <select
            value={category}
            onChange={e => {
              setCategory(e.target.value as '' | NotificationCategory);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-xs text-[#24352A] focus:border-[#245C3A] focus:outline-none"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={e => {
              setPriority(e.target.value as '' | NotificationPriority);
              setPage(1);
            }}
            aria-label="Filter by priority"
            className="rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-xs text-[#24352A] focus:border-[#245C3A] focus:outline-none"
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master-detail grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm lg:col-span-2 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#66756A]">Loading notifications...</div>
          ) : isError ? (
            <div className="p-8 text-center text-xs text-[#C74440]">
              <p>Unable to load notifications.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 rounded border border-[#E1E7DD] px-3 py-1 text-xs text-[#17452C]"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-[#8A958C]" />
              <p className="mt-2 text-xs font-semibold text-[#24352A]">No notifications found</p>
              <p className="mt-0.5 text-[11px] text-[#66756A]">
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F4ED]">
              {items.map(item => {
                const Icon = getCategoryIcon(item.category);
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 transition-colors ${
                      isSelected
                        ? 'bg-[#EAF1E8]/60'
                        : !item.isRead
                          ? 'bg-[#FAFBF8]'
                          : 'bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${getTypeBadgeClasses(item.type)}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#24352A]">
                            {item.title}
                          </span>
                          <PriorityBadge priority={item.priority} />
                          {!item.isRead && (
                            <span className="rounded bg-[#27834A]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#17452C]">
                              Unread
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-[#66756A]">{item.message}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8A958C]">
                          <span>{item.category}</span>
                          <span>·</span>
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead.mutate(item.id)}
                          title="Mark as read"
                          aria-label="Mark as read"
                          className="rounded p-1.5 text-[#245C3A] hover:bg-[#EAF1E8]"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!item.isArchived && (
                        <button
                          type="button"
                          onClick={() => archive.mutate(item.id)}
                          title="Archive"
                          aria-label="Archive notification"
                          className="rounded p-1.5 text-[#66756A] hover:bg-[#F0F4ED]"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E1E7DD] bg-[#FAFBF8] px-4 py-2.5 text-xs text-[#66756A]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="rounded border border-[#E1E7DD] bg-white px-2.5 py-1 text-xs hover:bg-[#EAF1E8] disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="rounded border border-[#E1E7DD] bg-white px-2.5 py-1 text-xs hover:bg-[#EAF1E8] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail pane */}
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#66756A]">
            Notification Details
          </h2>
          {!selectedItem ? (
            <p className="mt-4 text-xs text-[#8A958C]">Select a notification to view details.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#EAF1E8] px-2 py-0.5 text-[10px] font-semibold text-[#17452C]">
                  {selectedItem.category}
                </span>
                <PriorityBadge priority={selectedItem.priority} />
                <span className="text-[11px] text-[#8A958C]">
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </span>
              </div>

              <h3 className="text-sm font-bold text-[#24352A]">{selectedItem.title}</h3>
              <p className="text-xs leading-relaxed text-[#4A5A4F]">{selectedItem.message}</p>

              {selectedItem.entityType && (
                <div className="rounded-md border border-[#E1E7DD] bg-[#FAFBF8] p-2.5 text-[11px] text-[#66756A]">
                  <div>
                    <span className="font-semibold text-[#24352A]">Entity:</span>{' '}
                    {selectedItem.entityType}
                  </div>
                  {selectedItem.entityId && (
                    <div className="mt-0.5 truncate font-mono text-[10px]">
                      ID: {selectedItem.entityId}
                    </div>
                  )}
                </div>
              )}

              {selectedItem.actionUrl && (
                <div>
                  {canNavigateToActionUrl(selectedItem.actionUrl, hasPermission) ? (
                    <button
                      type="button"
                      onClick={() => navigate(selectedItem.actionUrl!)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C]"
                    >
                      <span>Open Related Record</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <p className="text-[11px] text-[#8A958C]">
                      You do not have permission to open the linked record.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
