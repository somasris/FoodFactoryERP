import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Factory, Layers, ShoppingCart, TrendingUp } from 'lucide-react';
import { reportsService } from '../../services/reports.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

type BiTab = 'sales' | 'inventory' | 'production' | 'profitability' | 'factory';

export const BusinessIntelligencePage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canSales = hasPermission('analytics.sales.read');
  const canInv = hasPermission('analytics.inventory.read');
  const canProd = hasPermission('analytics.production.read');
  const canProf = hasPermission('analytics.profitability.read');
  const canFactory = hasPermission('analytics.factory.read');
  const canExport = hasPermission('analytics.export');

  const [tab, setTab] = useState<BiTab>(
    canSales ? 'sales' : canInv ? 'inventory' : canProd ? 'production' : 'factory',
  );
  const [financialYear, setFinancialYear] = useState('');

  const salesQuery = useQuery({
    queryKey: ['bi', 'sales', financialYear],
    queryFn: () => reportsService.getSalesAnalytics({ financialYear: financialYear || undefined }),
    enabled: canSales && tab === 'sales',
  });

  const invQuery = useQuery({
    queryKey: ['bi', 'inventory'],
    queryFn: () => reportsService.getInventoryAnalytics(),
    enabled: canInv && tab === 'inventory',
  });

  const prodQuery = useQuery({
    queryKey: ['bi', 'production'],
    queryFn: () => reportsService.getProductionAnalytics(),
    enabled: canProd && tab === 'production',
  });

  const profQuery = useQuery({
    queryKey: ['bi', 'profitability', financialYear],
    queryFn: () => reportsService.getProfitability({ financialYear: financialYear || undefined }),
    enabled: canProf && tab === 'profitability',
  });

  const facQuery = useQuery({
    queryKey: ['bi', 'factory'],
    queryFn: () => reportsService.getFactoryPerformance(),
    enabled: canFactory && tab === 'factory',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {canSales && (
            <button
              onClick={() => setTab('sales')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'sales' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Sales Intelligence
            </button>
          )}
          {canInv && (
            <button
              onClick={() => setTab('inventory')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'inventory'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Inventory Analytics
            </button>
          )}
          {canProd && (
            <button
              onClick={() => setTab('production')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'production'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Production Analytics
            </button>
          )}
          {canProf && (
            <button
              onClick={() => setTab('profitability')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'profitability'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Gross Margin &amp; Profitability
            </button>
          )}
          {canFactory && (
            <button
              onClick={() => setTab('factory')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'factory'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Factory className="h-3.5 w-3.5" />
              Factory Performance
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FY (e.g. 2026-27)"
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value)}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
          />
          {canExport && tab !== 'production' && (
            <div className="flex gap-1">
              {(['csv', 'excel', 'pdf'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() =>
                    reportsService.downloadExport(
                      tab === 'factory' ? 'factory-performance' : tab,
                      fmt,
                      { financialYear: financialYear || undefined },
                    )
                  }
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3 w-3" />
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === 'sales' && salesQuery.data && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Total Taxable Revenue (Issued Invoices)</div>
              <div className="text-xl font-bold text-brand-navy">
                ₹{String(salesQuery.data.totalTaxableRevenue)}
              </div>
            </div>
            <p className="max-w-md text-right text-[11px] text-slate-500">
              {String(salesQuery.data.revenueSourceNote)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-700">Order Status Breakdown</h4>
              <div className="space-y-1.5 text-xs">
                {(salesQuery.data.orderStatusBreakdown as Array<Record<string, unknown>>).map(o => (
                  <div key={String(o.status)} className="flex justify-between border-b pb-1">
                    <Badge variant="outline">{String(o.status)}</Badge>
                    <span>
                      {String(o.orderCount)} orders (₹{String(o.orderValue)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-700">Top Customers</h4>
              <div className="space-y-1.5 text-xs">
                {(salesQuery.data.salesByCustomer as Array<Record<string, unknown>>)
                  .slice(0, 5)
                  .map(c => (
                    <div key={String(c.customerId)} className="flex justify-between border-b pb-1">
                      <span>{String(c.customerName)}</span>
                      <span className="font-semibold">₹{String(c.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'inventory' && invQuery.data && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">
            Total Inventory Value: ₹{String(invQuery.data.totalInventoryValue)}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(invQuery.data.qualityDistribution as Array<Record<string, unknown>>).map(q => (
              <div key={String(q.qualityStatus)} className="rounded border p-3 text-xs">
                <div className="font-semibold text-slate-700">{String(q.qualityStatus)}</div>
                <div className="mt-1 text-base font-bold text-brand-navy">₹{String(q.value)}</div>
                <div className="text-slate-500">
                  Qty: {String(q.quantity)} ({String(q.batchCount)} batches)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'production' && prodQuery.data && (
        <div className="rounded-lg border bg-white p-4 text-xs">
          <h4 className="mb-2 text-sm font-semibold text-slate-900">
            Integrated Production Analytics (Phase 3.7)
          </h4>
          <p className="text-slate-600">
            Plan vs Actual items tracked:{' '}
            {(prodQuery.data.planVsActual as Array<unknown>)?.length ?? 0}
          </p>
        </div>
      )}

      {tab === 'profitability' && profQuery.data && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {String(profQuery.data.disclaimer)}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Revenue</div>
              <div className="text-lg font-bold">
                ₹{String((profQuery.data.summary as Record<string, unknown>).revenue)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Finalized Production Cost</div>
              <div className="text-lg font-bold">
                ₹{String((profQuery.data.summary as Record<string, unknown>).productionCost)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Gross Margin</div>
              <div className="text-lg font-bold text-emerald-700">
                ₹{String((profQuery.data.summary as Record<string, unknown>).grossMargin)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Gross Margin %</div>
              <div className="text-lg font-bold text-brand-navy">
                {String((profQuery.data.summary as Record<string, unknown>).grossMarginPercent)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'factory' && facQuery.data && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Factory</th>
                <th className="px-4 py-3">Warehouses</th>
                <th className="px-4 py-3">Inventory Value</th>
                <th className="px-4 py-3">Completed WOs</th>
                <th className="px-4 py-3">Good Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(facQuery.data.items as Array<Record<string, unknown>>).map(f => (
                <tr key={String(f.factoryId)}>
                  <td className="px-4 py-3 font-medium">
                    {String(f.factoryCode)} — {String(f.factoryName)}
                  </td>
                  <td className="px-4 py-3">{String(f.warehouseCount)}</td>
                  <td className="px-4 py-3">₹{String(f.inventoryValue)}</td>
                  <td className="px-4 py-3">{String(f.completedWorkOrders)}</td>
                  <td className="px-4 py-3">{String(f.productionOutputQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

