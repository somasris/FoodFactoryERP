import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, BarChart3, IndianRupee, PackageCheck } from 'lucide-react';
import { reportsService } from '../../services/reports.service';

export const ExecutiveDashboardPage: React.FC = () => {
  const [financialYear, setFinancialYear] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'executive-dashboard', financialYear],
    queryFn: () =>
      reportsService.getExecutiveDashboard({
        financialYear: financialYear || undefined,
      }),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-slate-500">
        Loading executive dashboard KPIs...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load executive dashboard: {(error as Error)?.message || 'Unknown error'}
      </div>
    );
  }

  const { businessKpis, operationalKpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-navy" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Executive Management Dashboard</h2>
            <p className="text-xs text-slate-500">
              Live cross-module KPIs aggregated from PostgreSQL transactional records.
            </p>
          </div>
        </div>
        <input
          type="text"
          placeholder="Filter FY (e.g. 2026-27)"
          value={financialYear}
          onChange={e => setFinancialYear(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
        />
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <IndianRupee className="h-3.5 w-3.5" />
          Business KPIs
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Issued Invoice Value</div>
            <div className="mt-1 text-lg font-bold text-brand-navy">
              ₹{businessKpis.issuedInvoiceValue}
            </div>
            <div className="text-[11px] text-slate-400">
              {businessKpis.issuedInvoiceCount} issued invoices
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Sales Orders</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {businessKpis.salesOrderCount}
            </div>
            <div className="text-[11px] text-slate-400">Active &amp; fulfilled orders</div>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Inventory Valuation</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              ₹{businessKpis.inventoryValue}
            </div>
            <div className="text-[11px] text-slate-400">MWAC / Batch Actual</div>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Finalized Prod Cost</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              ₹{businessKpis.finalizedProductionCost}
            </div>
            <div className="text-[11px] text-slate-400">
              Rejection rate: {businessKpis.qualityRejectionRatePercent}%
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Pending Approvals</div>
            <div className="mt-1 text-lg font-bold text-amber-700">
              {businessKpis.pendingApprovalsCount}
            </div>
            <div className="text-[11px] text-slate-400">SO / Plan / WO / Audit</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          Operational KPIs
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500">Active Work Orders</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {operationalKpis.activeWorkOrders}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500">Active Batches</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {operationalKpis.activeProductionBatches}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500">Pending Inspections</div>
            <div className="mt-1 text-lg font-bold text-amber-700">
              {operationalKpis.pendingInspections}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Low Stock Items
            </div>
            <div className="mt-1 text-lg font-bold text-amber-700">
              {operationalKpis.lowStockItemsCount}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500">Expiring (30d)</div>
            <div className="mt-1 text-lg font-bold text-red-700">
              {operationalKpis.expiringBatchesCount}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <PackageCheck className="h-3 w-3 text-slate-500" />
              Delayed Plans
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {operationalKpis.delayedProductionPlans}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

