import React from 'react';
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
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

const inventoryTabs = [
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
    <ModuleLayoutHeader
      title="Inventory Management"
      description="Warehouse-wise stock balances, receipts, FEFO/FIFO issues, transfers, adjustments, batch expiry, and MWAC valuation."
      tabs={visibleTabs}
      ariaLabel="Inventory navigation"
    />
  );
};
