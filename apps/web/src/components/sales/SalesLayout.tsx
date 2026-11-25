import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  CheckSquare,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface NavTab {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

const salesTabs: NavTab[] = [
  { label: 'Dashboard', to: '/sales/dashboard', icon: LayoutDashboard, permission: 'sales.dashboard.read' },
  { label: 'Sales Orders', to: '/sales/orders', icon: ShoppingCart, permission: 'sales.orders.read' },
  { label: 'New Order', to: '/sales/orders/new', icon: PlusCircle, permission: 'sales.orders.create' },
  { label: 'Pending Approvals', to: '/sales/approvals', icon: CheckSquare, permission: 'sales.orders.approve' },
  { label: 'Fulfillment', to: '/sales/fulfillment', icon: PackageCheck, permission: 'sales.orders.fulfill' },
];

export const SalesLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = salesTabs.filter(tab => hasPermission(tab.permission));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-4 pb-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">Sales &amp; Orders</h1>
          <p className="text-xs text-slate-500">
            Customer order intake, approval workflow, stock reservation, and warehouse fulfillment.
          </p>
        </div>
        <nav
          aria-label="Sales navigation"
          className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
        >
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/sales/orders'}
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
