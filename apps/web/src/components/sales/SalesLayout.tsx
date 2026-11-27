import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  CheckSquare,
  PackageCheck,
  FileText,
  IndianRupee,
  Clock,
  FileMinus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

const salesTabs = [
  { label: 'Dashboard', to: '/sales/dashboard', icon: LayoutDashboard, permission: 'sales.dashboard.read' },
  { label: 'Sales Orders', to: '/sales/orders', icon: ShoppingCart, permission: 'sales.orders.read', end: true },
  { label: 'New Order', to: '/sales/orders/new', icon: PlusCircle, permission: 'sales.orders.create' },
  { label: 'Pending Approvals', to: '/sales/approvals', icon: CheckSquare, permission: 'sales.orders.approve' },
  { label: 'Fulfillment', to: '/sales/fulfillment', icon: PackageCheck, permission: 'sales.orders.fulfill' },
  { label: 'Invoices', to: '/sales/invoices', icon: FileText, permission: 'sales.invoices.read' },
  { label: 'Payments', to: '/sales/payments', icon: IndianRupee, permission: 'sales.payments.read' },
  { label: 'Receivables & Ageing', to: '/sales/receivables', icon: Clock, permission: 'sales.payments.read' },
  { label: 'Credit Notes', to: '/sales/credit-notes', icon: FileMinus, permission: 'sales.credit_notes.read' },
];

export const SalesLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = salesTabs.filter(tab => hasPermission(tab.permission));

  return (
    <ModuleLayoutHeader
      title="Sales & Orders"
      tabs={visibleTabs}
      ariaLabel="Sales navigation"
    />
  );
};
