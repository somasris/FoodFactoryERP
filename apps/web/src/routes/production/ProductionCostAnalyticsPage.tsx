import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { ProductionCostAnalyticsRow, ProductionReportQuery } from '../../types/production';

export const ProductionCostAnalyticsPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<ProductionCostAnalyticsRow[]>([]);
  const [summary, setSummary] = useState<{
    finalizedStandardCost: string;
    finalizedActualCost: string;
    finalizedVarianceAmount: string;
    provisionalNonFinalizedCost: string;
  } | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.costing(query);
      setRows(res.data?.items ?? []);
      setSummary(res.data?.summary ?? null);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load production cost analytics');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/production/reports" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Analytics
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Production Cost &amp; Variance Analytics</h2>
      </div>

      <ReportFilterBar
        query={query}
        onChange={setQuery}
        reportType="costing"
        statusOptions={['DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED']}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3"><div className="text-xs text-slate-500">Finalized Std Cost</div><div className="text-base font-bold">₹{summary.finalizedStandardCost}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Finalized Actual Cost</div><div className="text-base font-bold">₹{summary.finalizedActualCost}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Finalized Variance</div><div className="text-base font-bold">₹{summary.finalizedVarianceAmount}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Provisional (Unfinalized)</div><div className="text-base font-bold text-amber-700">₹{summary.provisionalNonFinalizedCost}</div></Card>
        </div>
      )}

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading cost analytics...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No batch costing records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Batch #</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Material</th>
                  <th className="px-2 py-1.5 text-right">Labour</th>
                  <th className="px-2 py-1.5 text-right">Machine</th>
                  <th className="px-2 py-1.5 text-right">Overhead</th>
                  <th className="px-2 py-1.5 text-right">Total Actual</th>
                  <th className="px-2 py-1.5 text-right">Unit Cost</th>
                  <th className="px-2 py-1.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">
                      <Link to={`/production/costing/batches/${r.productionBatchId}`}>{r.batchNumber}</Link>
                    </td>
                    <td className="px-2 py-1.5">{r.productName}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant={r.isFinalized ? 'success' : 'warning'}>{r.status}</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.actualMaterialCost}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.labourCost}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.machineCost}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.overheadCost}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">₹{r.totalActualCost}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.costPerAcceptedUnit}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.costVariance} ({r.costVariancePercent}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={(query.page || 1) <= 1} onClick={() => setQuery({ ...query, page: (query.page || 1) - 1 })}>Prev</Button>
          <span>Page {query.page || 1} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={(query.page || 1) >= totalPages} onClick={() => setQuery({ ...query, page: (query.page || 1) + 1 })}>Next</Button>
        </div>
      </Card>
    </div>
  );
};
