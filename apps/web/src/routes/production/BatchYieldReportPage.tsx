import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { BatchYieldReportRow, ProductionReportQuery } from '../../types/production';

export const BatchYieldReportPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<BatchYieldReportRow[]>([]);
  const [lowYieldCount, setLowYieldCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.batchYield(query);
      setRows(res.data?.items ?? []);
      setLowYieldCount(res.data?.lowYieldBatchesCount ?? 0);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch yield report');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/production/reports" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy">
            <ArrowLeft className="h-3.5 w-3.5" /> Analytics
          </Link>
          <h2 className="text-lg font-semibold text-brand-navy">Batch Production &amp; Yield Report</h2>
        </div>
        <Badge variant={lowYieldCount > 0 ? 'warning' : 'success'}>
          Low-Yield Batches: {lowYieldCount}
        </Badge>
      </div>

      <ReportFilterBar
        query={query}
        onChange={setQuery}
        reportType="batch-yield"
        statusOptions={['CREATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']}
      />

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading batch yield report...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No batches found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Batch #</th>
                  <th className="px-2 py-1.5">WO #</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Planned</th>
                  <th className="px-2 py-1.5 text-right">Output</th>
                  <th className="px-2 py-1.5 text-right">Accepted</th>
                  <th className="px-2 py-1.5 text-right">Scrap</th>
                  <th className="px-2 py-1.5 text-right">Actual Yield</th>
                  <th className="px-2 py-1.5 text-right">BOM Expected</th>
                  <th className="px-2 py-1.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">{r.batchNumber}</td>
                    <td className="px-2 py-1.5">{r.workOrderNumber}</td>
                    <td className="px-2 py-1.5">{r.productName}</td>
                    <td className="px-2 py-1.5"><Badge variant={r.isLowYield ? 'warning' : 'default'}>{r.status}</Badge></td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.plannedQuantity} {r.uomSymbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.actualOutputQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.acceptedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.scrapQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.actualYieldPercent}%</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.expectedYieldPercent}%</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.yieldVariancePercent}%</td>
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
