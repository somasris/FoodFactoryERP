import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { ProductionReportQuery, WorkOrderPerformanceRow } from '../../types/production';

export const WorkOrderPerformanceReportPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<WorkOrderPerformanceRow[]>([]);
  const [summary, setSummary] = useState<{ totalWorkOrders: number; overdueWorkOrders: number; delayedWorkOrders: number } | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.workOrderPerformance(query);
      setRows(res.data?.items ?? []);
      setSummary(res.data?.summary ?? null);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work order performance report');
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
        <h2 className="text-lg font-semibold text-brand-navy">Work Order Performance Report</h2>
      </div>

      <ReportFilterBar
        query={query}
        onChange={setQuery}
        reportType="work-order-performance"
        statusOptions={['DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']}
      />

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3"><div className="text-xs text-slate-500">Total Work Orders</div><div className="text-lg font-bold">{summary.totalWorkOrders}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Overdue (Active)</div><div className="text-lg font-bold text-red-600">{summary.overdueWorkOrders}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Delayed</div><div className="text-lg font-bold text-amber-600">{summary.delayedWorkOrders}</div></Card>
        </div>
      )}

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading work order performance...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No work orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">WO #</th>
                  <th className="px-2 py-1.5">Plan #</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Priority</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Planned</th>
                  <th className="px-2 py-1.5 text-right">Actual Good</th>
                  <th className="px-2 py-1.5 text-right">Scrap</th>
                  <th className="px-2 py-1.5 text-right">Batches</th>
                  <th className="px-2 py-1.5 text-right">Delay (d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">{r.workOrderNumber}</td>
                    <td className="px-2 py-1.5">{r.productionPlanNumber}</td>
                    <td className="px-2 py-1.5">{r.productName}</td>
                    <td className="px-2 py-1.5"><Badge variant="outline">{r.priority}</Badge></td>
                    <td className="px-2 py-1.5"><Badge variant={r.isOverdue ? 'warning' : 'default'}>{r.status}</Badge></td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.plannedQuantity} {r.uomSymbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.actualGoodQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.scrapQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.batchCount}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.delayDays}</td>
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
