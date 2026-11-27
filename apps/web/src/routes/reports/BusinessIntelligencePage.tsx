import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Factory, Layers, ShoppingCart, TrendingUp } from 'lucide-react';
import { reportsService } from '../../services/reports.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { ExportButtons } from '../../components/common/ExportButtons';
import { ErrorState, LoadingState } from '../../components/common/StateViews';

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
    queryKey: ['bi', 'production', financialYear],
    queryFn: () => reportsService.getProductionAnalytics({ financialYear: financialYear || undefined }),
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
            <ExportButtons
              onExport={fmt =>
                reportsService.downloadExport(
                  tab === 'factory' ? 'factory-performance' : tab,
                  fmt,
                  { financialYear: financialYear || undefined },
                )
              }
            />
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

      {tab === 'production' && prodQuery.isLoading && (
        <LoadingState label="Loading production analytics..." />
      )}
      {tab === 'production' && prodQuery.error && (
        <ErrorState
          title="Failed to load production analytics"
          message={(prodQuery.error as Error)?.message || 'Unknown error'}
          onRetry={() => prodQuery.refetch()}
        />
      )}
      {tab === 'production' &&
        prodQuery.data &&
        (() => {
          const dashboard = (prodQuery.data.dashboard ?? {}) as {
            kpis?: Record<string, string | number | boolean | null>;
          };
          const kpis = dashboard.kpis ?? {};
          const planVsActual = (prodQuery.data.planVsActual ?? []) as Array<Record<string, unknown>>;
          return (
            <div className="space-y-4 rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Integrated Production Analytics
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Live production output, yield, wastage, and Plan vs Actual execution.
                  </p>
                </div>
                <Link
                  to="/production/analytics"
                  className="text-xs font-medium text-brand-blue hover:underline"
                >
                  Open Full Production Analytics →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded border p-3">
                  <div className="text-xs text-slate-500">Actual / Planned Output</div>
                  <div className="mt-1 text-lg font-bold text-brand-navy">
                    {Number(kpis.actualProducedQuantity ?? 0).toFixed(0)} /{' '}
                    {Number(kpis.plannedProductionQuantity ?? 0).toFixed(0)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Plans: {String(kpis.totalProductionPlans ?? 0)} ({String(kpis.pendingProductionPlans ?? 0)} pending)
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-slate-500">Accepted FG Qty</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    {Number(kpis.acceptedFinishedGoodsQuantity ?? 0).toFixed(0)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Rejected: {Number(kpis.rejectedQuantity ?? 0).toFixed(0)}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-slate-500">Overall Yield %</div>
                  <div className="mt-1 text-lg font-bold text-brand-navy">
                    {String(kpis.overallYieldPercentage ?? '0.00')}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Material Wastage: {String(kpis.materialWastagePercentage ?? '0.00')}%
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-slate-500">Work Orders &amp; Batches</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {String(kpis.completedWorkOrders ?? 0)} / {String(kpis.totalWorkOrders ?? 0)} WOs
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Batches: {String(kpis.completedBatches ?? 0)} completed · {String(kpis.batchesInProgress ?? 0)} in progress
                  </div>
                </div>
              </div>

              {planVsActual.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                  No production plan vs actual records found for the selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Plan #</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Warehouse</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Planned</th>
                        <th className="px-3 py-2 text-right">Actual</th>
                        <th className="px-3 py-2 text-right">Accepted</th>
                        <th className="px-3 py-2 text-right">Completion %</th>
                        <th className="px-3 py-2">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planVsActual.map((row, idx) => (
                        <tr key={`${String(row.planId)}-${String(row.productVariantId ?? idx)}`}>
                          <td className="px-3 py-2">
                            <div className="font-mono font-medium text-brand-navy">
                              {String(row.planNumber)}
                            </div>
                            {Boolean(row.planName) && (
                              <div className="text-[10px] text-slate-500">{String(row.planName)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-800">{String(row.productName)}</div>
                            <div className="font-mono text-[10px] text-slate-400">{String(row.sku)}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{String(row.warehouseName)}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{String(row.planStatus)}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {Number(row.plannedQuantity ?? 0).toFixed(2)} {String(row.uomSymbol ?? '')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {Number(row.actualProducedQuantity ?? 0).toFixed(2)} {String(row.uomSymbol ?? '')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-700">
                            {Number(row.acceptedQuantity ?? 0).toFixed(2)} {String(row.uomSymbol ?? '')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {String(row.completionPercent ?? '0.00')}%
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{String(row.varianceClassification ?? '-')}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

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

