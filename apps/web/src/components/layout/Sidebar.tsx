import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  ShoppingCart,
  Boxes,
  Cpu,
  BarChart3,
  Users,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../common/Badge';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    name: 'Foundation Dashboard',
    path: '/',
    icon: LayoutDashboard,
    badge: 'Active',
    badgeVariant: 'teal' as const,
  },
  {
    name: 'Master Data',
    path: '/master-data',
    icon: Database,
    badge: 'Phase 1.4',
    badgeVariant: 'teal' as const,
  },
  {
    name: 'Sales & Orders',
    path: '/sales',
    icon: ShoppingCart,
    badge: 'Phase 2',
    badgeVariant: 'teal' as const,
  },
  {
    name: 'Inventory & Stock',
    path: '/inventory',
    icon: Boxes,
    badge: 'Phase 1.5',
    badgeVariant: 'teal' as const,
  },
  {
    name: 'BOM & Production',
    path: '/production',
    icon: Cpu,
    badge: 'Phase 3',
    badgeVariant: 'outline' as const,
  },
  {
    name: 'Compliance & BI',
    path: '/reports',
    icon: BarChart3,
    badge: 'Phase 4.3',
    badgeVariant: 'teal' as const,
  },
  {
    name: 'System Admin',
    path: '/admin',
    icon: Settings,
    badge: 'Phase 4.1',
    badgeVariant: 'teal' as const,
  },
];

const plannedRoles = ['SALESMAN', 'ADMIN', 'PRODUCTION', 'OWNER', 'AUDITOR'];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 ease-in-out md:static md:z-0 md:translate-x-0 md:shadow-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Mobile Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 md:hidden">
          <span className="font-bold text-brand-navy">Navigation Menu</span>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            ERP Modules
          </div>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-navy text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-brand-navy',
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  <Badge
                    variant={item.badgeVariant}
                    className="text-[10px] px-1.5 py-0 font-normal"
                  >
                    {item.badge}
                  </Badge>
                </NavLink>
              );
            })}
          </nav>

          {/* Planned Roles Section */}
          <div className="mt-8 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <span>Target Role Matrix</span>
            </div>
            <p className="mt-1 px-3 text-xs text-slate-500">
              Configured for 5 planned ERP operational roles:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1 px-3">
              {plannedRoles.map(role => (
                <span
                  key={role}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer info */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Phase 1.1 Foundation</p>
              <p className="text-[11px] text-amber-700">Authentication & business logic deferred</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
