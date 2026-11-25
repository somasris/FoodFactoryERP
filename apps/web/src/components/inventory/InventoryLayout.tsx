import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  CalendarClock,
  IndianRupee,
  History,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface NavTab {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

const inventoryTabs: NavTab[] = [
  { label: 'Dashboard', to: '/inventory/dashboard', icon: LayoutDashboard, permission: 'inventory.read' },
  { label: 'Stock Balances', to: '/inventory/balances', icon: Boxes, permission: 'inventory.read' },
  { label: 'Receipts', to: '/inventory/receipts', icon: ArrowDownToLine, permission: 'inventory.read' },
  { label: 'Issues', to: '/inventory/issues', icon: ArrowUpFromLine, permission: 'inventory.read' },
  { label: 'Transfers', to: '/inventory/transfers', icon: ArrowLeftRight, permission: 'inventory.read' },
  { label: 'Adjustments', to: '/inventory/adjustments', icon: SlidersHorizontal, permission: 'inventory.read' },
  { label: 'Batches & Expiry', to: '/inventory/batches', icon: CalendarClock, permission: 'inventory.read' },
  { label: 'Valuation', to: '/inventory/valuation', icon: IndianRupee, permission: 'inventory.valuation.read' },
  { label: 'Transaction History', to: '/inventory/transactions', icon: History, permission: 'inventory.read' },
];

export const InventoryLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = inventoryTabs.filter(tab => hasPermission(tab.permission));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-4 pb-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">Inventory Management</h1>
          <p className="text-xs text-slate-500">
            Warehouse-wise stock balances, receipts, FEFO/FIFO issues, transfers, adjustments, batch expiry &amp; MWAC valuation.
          </p>
        </div>
        <nav
          aria-label="Inventory navigation"
          className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
        >
          {visibleTabs.map(tab => {
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
