import React from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
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

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    visibleItems: group.items.filter(item => canAccessNavItem(user, item)),
  })).filter(group => group.visibleItems.length > 0);

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
          collapsed ? 'md:w-16' : 'md:w-60',
          'w-64',
          isOpen ? 'translate-x-0 shadow-xl md:shadow-none' : '-translate-x-full',
        )}
      >
        {/* Mobile Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 md:hidden">
          <span className="text-sm font-semibold text-[#F4F0E4]">Navigation</span>
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
              'hidden md:flex items-center border-b border-white/10 px-3 py-2',
              collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!collapsed && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E8D7AA]/85">
                Modules
              </span>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded p-1 text-white/70 hover:bg-[#3D7651]/50 hover:text-white"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {/* Permission-Driven Navigation List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {visibleGroups.map(group => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id}>
                {!collapsed ? (
                  <div className="mb-1 flex items-center gap-2 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#E8D7AA]/85">
                    <GroupIcon className="h-3.5 w-3.5 text-[#C39A45] shrink-0" />
                    <span className="truncate">{t(`navigation.${group.label}`, group.label)}</span>
                  </div>
                ) : (
                  <div
                    className="mb-1 flex justify-center py-1 text-[#C39A45]"
                    title={group.label}
                  >
                    <GroupIcon className="h-4 w-4" />
                  </div>
                )}
                <nav className="space-y-0.5" aria-label={group.label}>
                  {group.visibleItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={collapsed ? `${group.label}: ${item.label}` : undefined}
                      onClick={() => {
                        if (window.innerWidth < 768) onClose();
                      }}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                          collapsed && 'justify-center px-1.5',
                          isActive
                            ? 'border-l-2 border-[#C39A45] bg-[#245C3A] text-white font-semibold'
                            : 'text-[#F4F0E4]/85 hover:bg-[#3D7651]/45 hover:text-white',
                        )
                      }
                    >
                      {collapsed ? (
                        <span className="text-[11px] font-semibold">
                          {item.label
                            .split(' ')
                            .slice(0, 2)
                            .map(w => w[0])
                            .join('')}
                        </span>
                      ) : (
                        <span className="truncate">{t(`navigation.${item.label}`, item.label)}</span>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>
            );
          })}
        </div>

        {/* Authenticated Role Footer */}
        {user && !collapsed && (
          <div className="border-t border-white/10 bg-[#103B28]/80 px-3.5 py-2.5 text-xs">
            <div className="font-medium text-white truncate">{user.fullName}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.roles.map(role => (
                <span
                  key={role}
                  className="inline-flex items-center rounded border border-[#C39A45]/45 bg-[#245C3A] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#E8D7AA]"
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
