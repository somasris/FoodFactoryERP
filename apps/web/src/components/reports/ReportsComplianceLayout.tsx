import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, ClipboardCheck, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

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
    <div className="space-y-4">
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-4 pb-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">Compliance, BI &amp; Reports</h1>
          <p className="text-xs text-slate-500">
            GST compliance summaries, inventory valuation, physical stock audits, traceability, and executive analytics.
          </p>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Reports and compliance sections">
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
