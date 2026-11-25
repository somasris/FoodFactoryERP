import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CalendarRange, TrendingUp, Factory, BarChart3, PlayCircle, Layers } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

export const ProductionLayout: React.FC = () => {
  const { hasPermission } = useAuth();

  const tabs = [
    {
      label: 'Planning Dashboard',
      to: '/production/planning',
      icon: LayoutDashboard,
      permission: 'production.plans.read',
    },
    {
      label: 'Demand & MRP',
      to: '/production/demand',
      icon: TrendingUp,
      permission: 'production.demand.read',
    },
    {
      label: 'Production Plans',
      to: '/production/plans',
      icon: CalendarRange,
      permission: 'production.plans.read',
    },
    {
      label: 'Work Orders',
      to: '/production/work-orders',
      icon: Factory,
      permission: 'production.work_orders.read',
    },
    {
      label: 'WO Dashboard',
      to: '/production/work-orders/dashboard',
      icon: BarChart3,
      permission: 'production.work_orders.read',
    },
    {
      label: 'Execution',
      to: '/production/execution',
      icon: PlayCircle,
      permission: 'production.batches.read',
    },
    {
      label: 'Batches',
      to: '/production/batches',
      icon: Layers,
      permission: 'production.batches.read',
    },
    {
      label: 'BOM & Recipes',
      to: '/production/boms',
      icon: ClipboardList,
      permission: 'bom.read',
    },
  ].filter(t => hasPermission(t.permission));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-4 pb-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">BOM &amp; Production</h1>
          <p className="text-xs text-slate-500">
            Recipe formulations, demand-driven production planning, material availability, and version governance.
          </p>
        </div>
        <nav
          aria-label="Production navigation"
          className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-brand-navy text-white shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-brand-navy',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
};
