import React from 'react';
import { FileSpreadsheet, Receipt } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

const purchaseTabs = [
  {
    label: 'Supplier Invoices',
    to: '/purchases/invoices',
    icon: Receipt,
    permission: 'purchases.invoices.read',
  },
  {
    label: 'Purchase Register & GST',
    to: '/purchases/register',
    icon: FileSpreadsheet,
    permission: 'purchases.invoices.read',
  },
];

export const PurchasesLayout: React.FC = () => {
  const { hasPermission } = useAuth();
  const visibleTabs = purchaseTabs.filter(t => hasPermission(t.permission));

  return (
    <ModuleLayoutHeader
      title="Purchases & Supplier GST"
      tabs={visibleTabs}
      ariaLabel="Purchases navigation"
    />
  );
};
