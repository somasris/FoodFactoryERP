import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  Factory,
  IndianRupee,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { reportsService } from '../../services/reports.service';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ErrorState, LoadingState } from '../../components/common/StateViews';

const formatInr = (val: string | number) =>
  `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ExecutiveDashboardPage: React.FC = () => {
  const [financialYear, setFinancialYear] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'executive-dashboard', financialYear],
    queryFn: () =>
      reportsService.getExecutiveDashboard({
        financialYear: financialYear || undefined,
      }),
  });

  if (isLoading) {
    return <LoadingState label="Loading executive dashboard KPIs..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load executive dashboard"
        message={(error as Error)?.message || 'Unknown error'}
        onRetry={() => refetch()}
      />
    );
  }

  const { businessKpis, operationalKpis } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Management Dashboard"
        description="Live cross-module KPIs aggregated from PostgreSQL transactional records."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="exec-fy-filter" className="text-xs font-medium text-slate-600">
              Financial Year
            </label>
            <input
              id="exec-fy-filter"
              type="text"
              placeholder="e.g. 2026-27"
              value={financialYear}
              onChange={e => setFinancialYear(e.target.value)}
              className="h-8 w-36 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none"
            />
          </div>
        }
      />

      <section aria-labelledby="business-kpis-heading" className="space-y-3">
        <h2
          id="business-kpis-heading"
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          <IndianRupee className="h-3.5 w-3.5" />
          Financial &amp; Commercial KPIs
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Issued Invoice Value"
            value={formatInr(businessKpis.issuedInvoiceValue)}
            sublabel={`${businessKpis.issuedInvoiceCount} issued invoices`}
            icon={<IndianRupee className="h-4 w-4" />}
            tone="info"
          />
          <KpiCard
            label="Sales Orders"
            value={businessKpis.salesOrderCount}
            sublabel="Active & fulfilled orders"
            icon={<ShoppingCart className="h-4 w-4" />}
            tone="neutral"
          />
          <KpiCard
            label="Inventory Valuation"
            value={formatInr(businessKpis.inventoryValue)}
            sublabel="MWAC / Batch Actual"
            icon={<Warehouse className="h-4 w-4" />}
            tone="success"
          />
          <KpiCard
            label="Finalized Prod Cost"
            value={formatInr(businessKpis.finalizedProductionCost)}
            sublabel={`Rejection rate: ${businessKpis.qualityRejectionRatePercent}%`}
            icon={<Factory className="h-4 w-4" />}
            tone="neutral"
          />
          <KpiCard
            label="Pending Approvals"
            value={businessKpis.pendingApprovalsCount}
            sublabel="SO / Plan / WO / Audit"
            icon={<Clock className="h-4 w-4" />}
            tone={Number(businessKpis.pendingApprovalsCount) > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </section>

      <section aria-labelledby="operational-kpis-heading" className="space-y-3">
        <h2
          id="operational-kpis-heading"
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          <Activity className="h-3.5 w-3.5" />
          Plant &amp; Inventory Operations
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Active Work Orders"
            value={operationalKpis.activeWorkOrders}
            icon={<Factory className="h-4 w-4" />}
            tone="info"
          />
          <KpiCard
            label="Active Batches"
            value={operationalKpis.activeProductionBatches}
            icon={<Activity className="h-4 w-4" />}
            tone="info"
          />
          <KpiCard
            label="Pending Inspections"
            value={operationalKpis.pendingInspections}
            icon={<ShieldCheck className="h-4 w-4" />}
            tone={Number(operationalKpis.pendingInspections) > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="Low Stock Items"
            value={operationalKpis.lowStockItemsCount}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={Number(operationalKpis.lowStockItemsCount) > 0 ? 'warning' : 'success'}
          />
          <KpiCard
            label="Expiring (30d)"
            value={operationalKpis.expiringBatchesCount}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={Number(operationalKpis.expiringBatchesCount) > 0 ? 'danger' : 'success'}
          />
          <KpiCard
            label="Delayed Plans"
            value={operationalKpis.delayedProductionPlans}
            icon={<PackageCheck className="h-4 w-4" />}
            tone={Number(operationalKpis.delayedProductionPlans) > 0 ? 'danger' : 'neutral'}
          />
        </div>
      </section>
    </div>
  );
};
