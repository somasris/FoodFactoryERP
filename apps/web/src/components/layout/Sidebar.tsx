import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { canAccessNavItem, NAV_GROUPS } from '../../config/navigation';

interface SidebarProps {
  isOpen: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  collapsed = false,
  onToggleCollapse,
  onClose,
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map(group => ({
        ...group,
        visibleItems: group.items.filter(item => canAccessNavItem(user, item)),
      })).filter(group => group.visibleItems.length > 0),
    [user],
  );

  const activeGroupId = useMemo(() => {
    const pathname = location.pathname;
    for (const group of visibleGroups) {
      if (
        group.visibleItems.some(
          item => pathname === item.path || pathname.startsWith(`${item.path}/`),
        ) ||
        pathname === group.basePath ||
        pathname.startsWith(`${group.basePath}/`)
      ) {
        return group.id;
      }
    }
    return visibleGroups[0]?.id ?? null;
  }, [location.pathname, visibleGroups]);

  const storageKey = `ff_nav_groups_${user?.id ?? 'guest'}`;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw) as Record<string, boolean>;
      }
    } catch {
      // Ignore storage read errors
    }
    return activeGroupId ? { [activeGroupId]: true } : {};
  });

  // Automatically expand the group containing the active route
  useEffect(() => {
    if (!activeGroupId) return;
    setExpandedGroups(prev => {
      if (prev[activeGroupId]) return prev;
      const next = { ...prev, [activeGroupId]: true };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, [activeGroupId, storageKey]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#103B28]/50 backdrop-blur-[1px] md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Deep Forest Green Sidebar Panel */}
      <aside
        data-tour="sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#103B28] bg-[#173F2B] text-white transition-all duration-200 ease-in-out md:static md:z-0 md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-64',
          'w-64',
          isOpen ? 'translate-x-0 shadow-xl md:shadow-none' : '-translate-x-full',
        )}
      >
        {/* Mobile Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 md:hidden">
          <span className="text-sm font-semibold text-[#F4F0E4]">
            {t('common.navigation', 'Navigation')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-white/75 hover:bg-[#3D7651]/45 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop Collapse Toggle */}
        {onToggleCollapse && (
          <div
            className={cn(
              'hidden md:flex items-center px-3 pt-3 pb-1',
              collapsed ? 'justify-center' : 'justify-end',
            )}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-md p-1.5 text-white/70 hover:bg-[#3D7651]/45 hover:text-white transition-colors"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {/* Permission-Driven Collapsible Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {visibleGroups.map(group => {
            const GroupIcon = group.icon;
            const isExpanded = Boolean(expandedGroups[group.id]);
            const isGroupActive = activeGroupId === group.id;

            if (collapsed) {
              const firstItem = group.visibleItems[0];
              return (
                <NavLink
                  key={group.id}
                  to={firstItem.path}
                  title={t(`navigation.${group.label}`, group.label)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 transition-colors',
                    isGroupActive
                      ? 'bg-[#245C3A] text-[#E8D7AA]'
                      : 'text-white/75 hover:bg-[#3D7651]/40 hover:text-white',
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                </NavLink>
              );
            }

            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                    isGroupActive
                      ? 'text-[#E8D7AA] bg-white/[0.06]'
                      : 'text-[#F4F0E4]/85 hover:bg-[#3D7651]/35 hover:text-white',
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <GroupIcon className="h-4 w-4 shrink-0 text-[#C39A45]" />
                    <span className="truncate">{t(`navigation.${group.label}`, group.label)}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/60" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
                  )}
                </button>

                {isExpanded && (
                  <nav className="ml-3 border-l border-white/15 pl-2.5 py-0.5 space-y-0.5" aria-label={group.label}>
                    {group.visibleItems.map(item => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          if (window.innerWidth < 768) onClose();
                        }}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                            isActive
                              ? 'bg-[#245C3A] text-white font-semibold'
                              : 'text-[#F4F0E4]/80 hover:bg-[#3D7651]/40 hover:text-white',
                          )
                        }
                      >
                        <span className="truncate">{t(`navigation.${item.label}`, item.label)}</span>
                      </NavLink>
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>

        {/* Authenticated Role Footer */}
        {user && !collapsed && (
          <div className="border-t border-white/10 bg-[#103B28]/70 px-4 py-3 text-xs">
            <div className="font-medium text-white truncate">{user.fullName}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.roles.map(role => (
                <span
                  key={role}
                  className="inline-flex items-center rounded bg-[#245C3A] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#E8D7AA]"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
