import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, FileBarChart2, Search } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { productionService } from '../../services/production.service';
import {
  CostingDashboardSummary,
  ProductionBatch,
  ProductionBatchCosting,
} from '../../types/production';

const STATUS_BADGE: Record<string, 'default' | 'teal' | 'warning' | 'success' | 'outline'> = {
  DRAFT: 'default',
  CALCULATED: 'teal',
  REVIEWED: 'warning',
  FINALIZED: 'success',
};

export const ProductionCostingDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<CostingDashboardSummary | null>(null);
  const [batches, setBatches] = useState<
    Array<ProductionBatch & { costing?: ProductionBatchCosting | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, listRes] = await Promise.all([
        productionService.costing.dashboard(),
        productionService.costing.listBatches({
          page: 1,
          limit: 30,
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);
      setSummary(dash.data ?? null);
      setBatches(listRes.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load production costing data');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Production Costing</h2>
          <p className="text-xs text-slate-500">
            Batch-level material, labour, machine, overhead, variance, and finished-goods valuation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/production/costing/variance-report">
            <Button variant="secondary" size="sm">
              <FileBarChart2 className="mr-1.5 h-3.5 w-3.5" />
              Cost Variance Report
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Actual Cost</span>
              <Calculator className="h-4 w-4 text-brand-navy" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              ₹{Number(summary.totalActualCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Std: ₹{Number(summary.totalStandardCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Net Cost Variance</span>
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <div
              className={`mt-1 text-xl font-bold ${
                Number(summary.totalVarianceAmount) > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {Number(summary.totalVarianceAmount) > 0 ? '+' : ''}₹
              {Number(summary.totalVarianceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-500">{summary.totalVariancePercent}% vs standard</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Wastage &amp; Rejection Cost</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              ₹{Number(summary.totalWastageCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-500">Separated from good output cost</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Finalized / Pending</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {summary.statusCounts.FINALIZED || 0} / {summary.costedBatchesCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.pendingCostEntryApprovals} pending entry approval(s)
            </div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Batch Costing List</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search batch, SKU, WO..."
                className="rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-brand-navy focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter by costing status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:border-brand-navy focus:outline-none"
            >
              <option value="">All Costing Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CALCULATED">CALCULATED</option>
              <option value="REVIEWED">REVIEWED</option>
              <option value="FINALIZED">FINALIZED</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading batch costings...</p>
        ) : batches.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            No production batches found matching the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-medium text-slate-600">
                <tr>
                  <th className="px-3 py-2">Batch #</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Batch Status</th>
                  <th className="px-3 py-2">Costing Status</th>
                  <th className="px-3 py-2 text-right">Net Material</th>
                  <th className="px-3 py-2 text-right">Conversion &amp; OH</th>
                  <th className="px-3 py-2 text-right">Total Actual</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(b => {
                  const c = b.costing;
                  const convOh = c
                    ? Number(c.actualLabourCost) +
                      Number(c.actualMachineCost) +
                      Number(c.otherDirectCost) +
                      Number(c.actualOverheadCost)
                    : 0;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-brand-navy">{b.batchNumber}</td>
                      <td className="px-3 py-2">
                        <div>{b.productVariant?.name ?? '-'}</div>
                        <div className="text-[11px] text-slate-400">{b.productVariant?.sku}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="default">{b.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {c ? (
                          <Badge variant={STATUS_BADGE[c.status] || 'default'}>{c.status}</Badge>
                        ) : (
                          <span className="text-slate-400">Not Calculated</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {c ? `₹${Number(c.netMaterialCost).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {c ? `₹${convOh.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">
                        {c ? `₹${Number(c.totalActualCost).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {c ? `₹${Number(c.costPerAcceptedUnit).toFixed(4)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {c ? (
                          <span
                            className={
                              Number(c.totalVarianceAmount) > 0
                                ? 'text-red-600'
                                : 'text-emerald-700'
                            }
                          >
                            {Number(c.totalVarianceAmount) > 0 ? '+' : ''}
                            {Number(c.totalVariancePercent).toFixed(2)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/production/costing/batches/${b.id}`}
                          className="font-medium text-brand-navy hover:underline"
                        >
                          Open Costing
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
