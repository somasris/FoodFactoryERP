import React, { useMemo, useState } from 'react';
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
import { DashboardCustomizer } from '../../components/ux/DashboardCustomizer';
import { useDashboardPreferences } from '../../hooks/useDashboardPreferences';

const formatInr = (val: string | number) => `₹${val}`;

const EXECUTIVE_WIDGET_DEFS = [
  { id: 'issuedInvoiceValue', label: 'Issued Invoice Value' },
  { id: 'salesOrders', label: 'Sales Orders' },
  { id: 'inventoryValuation', label: 'Inventory Valuation' },
  { id: 'finalizedProdCost', label: 'Finalized Prod Cost' },
  { id: 'pendingApprovals', label: 'Pending Approvals' },
  { id: 'activeWorkOrders', label: 'Active Work Orders' },
  { id: 'activeBatches', label: 'Active Batches' },
  { id: 'pendingInspections', label: 'Pending Inspections' },
  { id: 'lowStockItems', label: 'Low Stock Items' },
  { id: 'expiringBatches', label: 'Expiring (30d)' },
  { id: 'delayedPlans', label: 'Delayed Plans' },
];

export const ExecutiveDashboardPage: React.FC = () => {
  const [financialYear, setFinancialYear] = useState('');
  const {
    orderedWidgets,
    isCustomized,
    isSaving,
    toggleWidget,
    moveWidget,
    resetToDefault,
  } = useDashboardPreferences('executive', EXECUTIVE_WIDGET_DEFS);

  const visibleIds = useMemo(
    () => new Set(orderedWidgets.filter(w => w.visible).map(w => w.id)),
    [orderedWidgets],
  );

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
        title="Executive Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <DashboardCustomizer
              widgets={orderedWidgets}
              isCustomized={isCustomized}
              isSaving={isSaving}
              onToggle={toggleWidget}
              onMove={moveWidget}
              onReset={resetToDefault}
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
          {orderedWidgets
            .filter(w =>
              [
                'issuedInvoiceValue',
                'salesOrders',
                'inventoryValuation',
                'finalizedProdCost',
                'pendingApprovals',
              ].includes(w.id) && visibleIds.has(w.id),
            )
            .map(w => {
              if (w.id === 'issuedInvoiceValue') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Issued Invoice Value"
                    value={formatInr(businessKpis.issuedInvoiceValue)}
                    sublabel={`${businessKpis.issuedInvoiceCount} issued invoices`}
                    icon={<IndianRupee className="h-4 w-4" />}
                    tone="info"
                  />
                );
              }
              if (w.id === 'salesOrders') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Sales Orders"
                    value={businessKpis.salesOrderCount}
                    sublabel="Active & fulfilled orders"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    tone="neutral"
                  />
                );
              }
              if (w.id === 'inventoryValuation') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Inventory Valuation"
                    value={formatInr(businessKpis.inventoryValue)}
                    sublabel="MWAC / Batch Actual"
                    icon={<Warehouse className="h-4 w-4" />}
                    tone="success"
                  />
                );
              }
              if (w.id === 'finalizedProdCost') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Finalized Prod Cost"
                    value={formatInr(businessKpis.finalizedProductionCost)}
                    sublabel={`Rejection rate: ${businessKpis.qualityRejectionRatePercent}%`}
                    icon={<Factory className="h-4 w-4" />}
                    tone="neutral"
                  />
                );
              }
              return (
                <KpiCard
                  key={w.id}
                  label="Pending Approvals"
                  value={businessKpis.pendingApprovalsCount}
                  sublabel="SO / Plan / WO / Audit"
                  icon={<Clock className="h-4 w-4" />}
                  tone={Number(businessKpis.pendingApprovalsCount) > 0 ? 'warning' : 'neutral'}
                />
              );
            })}
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
          {orderedWidgets
            .filter(w =>
              [
                'activeWorkOrders',
                'activeBatches',
                'pendingInspections',
                'lowStockItems',
                'expiringBatches',
                'delayedPlans',
              ].includes(w.id) && visibleIds.has(w.id),
            )
            .map(w => {
              if (w.id === 'activeWorkOrders') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Active Work Orders"
                    value={operationalKpis.activeWorkOrders}
                    icon={<Factory className="h-4 w-4" />}
                    tone="info"
                  />
                );
              }
              if (w.id === 'activeBatches') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Active Batches"
                    value={operationalKpis.activeProductionBatches}
                    icon={<Activity className="h-4 w-4" />}
                    tone="info"
                  />
                );
              }
              if (w.id === 'pendingInspections') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Pending Inspections"
                    value={operationalKpis.pendingInspections}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    tone={Number(operationalKpis.pendingInspections) > 0 ? 'warning' : 'neutral'}
                  />
                );
              }
              if (w.id === 'lowStockItems') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Low Stock Items"
                    value={operationalKpis.lowStockItemsCount}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    tone={Number(operationalKpis.lowStockItemsCount) > 0 ? 'warning' : 'success'}
                  />
                );
              }
              if (w.id === 'expiringBatches') {
                return (
                  <KpiCard
                    key={w.id}
                    label="Expiring (30d)"
                    value={operationalKpis.expiringBatchesCount}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    tone={Number(operationalKpis.expiringBatchesCount) > 0 ? 'danger' : 'success'}
                  />
                );
              }
              return (
                <KpiCard
                  key={w.id}
                  label="Delayed Plans"
                  value={operationalKpis.delayedProductionPlans}
                  icon={<PackageCheck className="h-4 w-4" />}
                  tone={Number(operationalKpis.delayedProductionPlans) > 0 ? 'danger' : 'neutral'}
                />
              );
            })}
        </div>
      </section>
    </div>
  );
};
