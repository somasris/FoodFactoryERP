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
  Grid,
  MapPin,
  QrCode,
  ScanLine,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

const inventoryTabs = [
  { label: 'Dashboard', to: '/inventory/dashboard', icon: LayoutDashboard, permission: 'inventory.read' },
  { label: 'Stock Balances', to: '/inventory/balances', icon: Boxes, permission: 'inventory.read' },
  { label: 'Warehouse Layout', to: '/inventory/warehouse-layout', icon: Grid, permission: 'inventory.read' },
  { label: 'Zones & Bins', to: '/inventory/zones-bins', icon: MapPin, permission: 'inventory.read' },
  { label: 'Location Stock', to: '/inventory/location-stock', icon: Boxes, permission: 'inventory.read' },
  { label: 'Barcodes', to: '/inventory/barcodes', icon: QrCode, permission: 'inventory.read' },
  { label: 'Scan Ops', to: '/inventory/scan', icon: ScanLine, permission: 'inventory.read' },
  { label: 'Put-Away', to: '/inventory/put-away', icon: ArrowDownToLine, permission: 'inventory.transfer.create' },
  { label: 'Picking', to: '/inventory/picking', icon: ArrowUpFromLine, permission: 'inventory.issue.create' },
  { label: 'Bin Transfers', to: '/inventory/bin-transfers', icon: ArrowLeftRight, permission: 'inventory.transfer.create' },
  { label: 'Cycle Counts', to: '/inventory/cycle-counts', icon: SlidersHorizontal, permission: 'compliance.stock_audit.read' },
  { label: 'Analytics', to: '/inventory/analytics', icon: BarChart3, permission: 'inventory.read' },
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
      title="Inventory"
      tabs={visibleTabs}
      ariaLabel="Inventory navigation"
    />
  );
};
