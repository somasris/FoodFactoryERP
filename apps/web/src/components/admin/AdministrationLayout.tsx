import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Building2,
  Factory,
  Users,
  ShieldCheck,
  Warehouse,
  Sliders,
  FileSearch,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

export const AdministrationLayout: React.FC = () => {
  const { hasPermission } = useAuth();

  const tabs = [
    {
      label: 'Organization',
      to: '/admin/organization',
      icon: Building2,
      permission: 'administration.organization.read',
    },
    {
      label: 'Factories',
      to: '/admin/factories',
      icon: Factory,
      permission: 'administration.factories.read',
    },
    {
      label: 'Users',
      to: '/admin/users',
      icon: Users,
      permission: 'administration.users.read',
    },
    {
      label: 'Roles & Permissions',
      to: '/admin/roles',
      icon: ShieldCheck,
      permission: 'administration.roles.read',
    },
    {
      label: 'Warehouse Access',
      to: '/admin/warehouse-access',
      icon: Warehouse,
      permission: 'administration.warehouse_access.read',
    },
    {
      label: 'System Settings',
      to: '/admin/settings',
      icon: Sliders,
      permission: 'administration.settings.read',
    },
    {
      label: 'Audit & Governance',
      to: '/admin/governance',
      icon: FileSearch,
      permission: 'governance.audit.read',
    },
  ].filter(t => hasPermission(t.permission));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-4 pb-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">System Administration</h1>
          <p className="text-xs text-slate-500">
            Centralized organization profile, factory locations, user security, RBAC governance, and system settings.
          </p>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Administration sections">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-brand-navy text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
};
