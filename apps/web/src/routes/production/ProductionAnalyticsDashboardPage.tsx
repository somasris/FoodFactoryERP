import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Factory,
  Layers,
  PackageCheck,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../hooks/useAuth';
import { productionService } from '../../services/production.service';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { ProductionTrendChart } from '../../components/production/ProductionTrendChart';
import {
  ProductionAnalyticsDashboard,
  ProductionReportQuery,
  ProductionTrendsResponse,
  TrendGranularity,
} from '../../types/production';

export const ProductionAnalyticsDashboardPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState<ProductionReportQuery>({
    period: 'month',
    granularity: 'daily',
  });
  const [dashboard, setDashboard] = useState<ProductionAnalyticsDashboard | null>(null);
  const [trends, setTrends] = useState<ProductionTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCosting = hasPermission('production.reports.costing.read');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, trendRes] = await Promise.all([
        productionService.reports.dashboard(query),
        productionService.reports.trends(query),
      ]);
      setDashboard(dashRes.data ?? null);
      setTrends(trendRes.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load production analytics');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const k = dashboard?.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">
            Production Analytics &amp; Reports
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative operational, yield, wastage, quality, and costing KPIs
            {dashboard?.dateRange ? ` · FY ${dashboard.dateRange.financialYear}` : ''}.
          </p>
        </div>

        <select
          aria-label="Trend granularity"
          value={query.granularity || 'daily'}
          onChange={e =>
            setQuery({ ...query, granularity: e.target.value as TrendGranularity })
          }
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
        >
          <option value="daily">Daily Trends</option>
          <option value="weekly">Weekly Trends</option>
          <option value="monthly">Monthly Trends</option>
        </select>
      </div>

      <ReportFilterBar query={query} onChange={setQuery} showSearch={false} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading && !k ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-slate-100 p-4" />
          ))}
        </div>
      ) : (
        k && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Plans (Pending / Total)</span>
                <ClipboardList className="h-4 w-4 text-brand-navy" />
              </div>
              <div className="mt-1 text-xl font-bold">
                {k.pendingProductionPlans} / {k.totalProductionPlans}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                WO: {k.activeWorkOrders} active / {k.completedWorkOrders} done ({k.totalWorkOrders}{' '}
                total)
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Batches (In Progress / Done)</span>
                <Layers className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-1 text-xl font-bold">
                {k.batchesInProgress} / {k.completedBatches}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Total Batches: {k.totalProductionBatches}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Output (Actual / Planned)</span>
                <PackageCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-1 text-lg font-bold">
                {Number(k.actualProducedQuantity).toFixed(2)} /{' '}
                {Number(k.plannedProductionQuantity).toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Accepted: {Number(k.acceptedFinishedGoodsQuantity).toFixed(2)} · Rejected:{' '}
                {Number(k.rejectedQuantity).toFixed(2)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Yield % &amp; Wastage %</span>
                <Activity className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-700">
                {k.overallYieldPercentage}% Yield
              </div>
              <div className="mt-1 text-xs text-red-600">
                Material Wastage: {k.materialWastagePercentage}%
              </div>
            </Card>

            {canCosting && k.costAccess && (
              <>
                <Card className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Total Actual Cost</span>
                    <BarChart3 className="h-4 w-4 text-brand-navy" />
                  </div>
                  <div className="mt-1 text-xl font-bold">
                    ₹{Number(k.totalActualProductionCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Variance: ₹{Number(k.productionCostVariance || 0).toFixed(2)}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Avg Cost / Accepted Unit</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="mt-1 text-xl font-bold">
                    ₹{Number(k.averageCostPerAcceptedUnit || 0).toFixed(4)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Based on finalized costings</div>
                </Card>
              </>
            )}
          </div>
        )
      )}

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductionTrendChart
          title="Planned vs Actual Production Trend"
          series={trends?.series || []}
          mode="quantity"
        />
        <ProductionTrendChart
          title="Production Yield vs Wastage Trend (%)"
          series={trends?.series || []}
          mode="yield"
        />
        {canCosting && (
          <div className="lg:col-span-2">
            <ProductionTrendChart
              title="Production Cost Trend (₹)"
              series={trends?.series || []}
              mode="cost"
            />
          </div>
        )}
      </div>

      {/* Report Navigation Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/production/reports/plan-vs-actual">
          <Card className="p-4 transition-colors hover:border-brand-navy">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <ClipboardList className="h-4 w-4" /> Plan vs Actual Report
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Compare planned, work-ordered, produced, accepted, and remaining quantities.
            </p>
          </Card>
        </Link>
        <Link to="/production/reports/work-order-performance">
          <Card className="p-4 transition-colors hover:border-brand-navy">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Factory className="h-4 w-4" /> Work Order Performance
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Execution duration, overdue alerts, delays, and batch completion counts.
            </p>
          </Card>
        </Link>
        <Link to="/production/reports/batch-yield">
          <Card className="p-4 transition-colors hover:border-brand-navy">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Layers className="h-4 w-4" /> Batch Yield &amp; Scrap Report
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Actual vs locked BOM expected yield, scrap, and low-yield batch alerts.
            </p>
          </Card>
        </Link>
        <Link to="/production/reports/material-consumption">
          <Card className="p-4 transition-colors hover:border-brand-navy">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Scale className="h-4 w-4" /> Material Consumption &amp; Wastage
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Net RM/PM usage after returns, expected vs actual wastage, and cost impact.
            </p>
          </Card>
        </Link>
        <Link to="/production/reports/quality">
          <Card className="p-4 transition-colors hover:border-brand-navy">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <ShieldCheck className="h-4 w-4" /> Finished Goods &amp; Quality
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Acceptance rate, rejections, quarantined/pending FG stock, and expiry tracking.
            </p>
          </Card>
        </Link>
        {canCosting && (
          <Link to="/production/reports/costing">
            <Card className="p-4 transition-colors hover:border-brand-navy">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                <BarChart3 className="h-4 w-4" /> Production Cost &amp; Variance
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Finalized vs provisional costing, standard vs actual variance, and unit cost.
              </p>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
};
