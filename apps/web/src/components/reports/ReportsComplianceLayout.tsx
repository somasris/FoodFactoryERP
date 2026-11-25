import React from 'react';
import { BarChart3, ClipboardCheck, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ModuleLayoutHeader } from '../common/ModuleLayoutHeader';

export const ReportsComplianceLayout: React.FC = () => {
  const { hasPermission } = useAuth();

  const tabs = [
    {
      label: 'Executive Dashboard',
      to: '/reports/executive',
      icon: LayoutDashboard,
      show: hasPermission('analytics.dashboard.read'),
    },
    {
      label: 'Business Intelligence',
      to: '/reports/bi',
      icon: BarChart3,
      show:
        hasPermission('analytics.sales.read') ||
        hasPermission('analytics.inventory.read') ||
        hasPermission('analytics.production.read') ||
        hasPermission('analytics.profitability.read') ||
        hasPermission('analytics.factory.read'),
    },
    {
      label: 'Financial Compliance',
      to: '/reports/compliance',
      icon: FileSpreadsheet,
      show:
        hasPermission('compliance.tax.read') ||
        hasPermission('compliance.inventory.read') ||
        hasPermission('compliance.documents.read'),
    },
    {
      label: 'Stock Audit',
      to: '/reports/stock-audit',
      icon: ClipboardCheck,
      show: hasPermission('compliance.stock_audit.read'),
    },
  ].filter(t => t.show);

  return (
    <ModuleLayoutHeader
      title="Compliance, BI & Reports"
      description="GST compliance summaries, inventory valuation, physical stock audits, and executive analytics."
      tabs={tabs}
      ariaLabel="Reports and compliance sections"
    />
  );
};
