import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { PlanVsActualRow, ProductionReportQuery } from '../../types/production';

export const ProductionPlanVsActualPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<PlanVsActualRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.planVsActual(query);
      setRows(res.data?.items ?? []);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan vs actual report');
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
        <h2 className="text-lg font-semibold text-brand-navy">Production Plan vs Actual Report</h2>
      </div>

      <ReportFilterBar
        query={query}
        onChange={setQuery}
        reportType="plan-vs-actual"
        statusOptions={['DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED', 'COMPLETED', 'CANCELLED']}
      />

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading plan vs actual report...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No production plan records match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Plan #</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Planned</th>
                  <th className="px-2 py-1.5 text-right">WO Qty</th>
                  <th className="px-2 py-1.5 text-right">Produced</th>
                  <th className="px-2 py-1.5 text-right">Accepted</th>
                  <th className="px-2 py-1.5 text-right">Remaining</th>
                  <th className="px-2 py-1.5 text-right">Completion %</th>
                  <th className="px-2 py-1.5">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={`${r.planId}-${idx}`}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">{r.planNumber}</td>
                    <td className="px-2 py-1.5">
                      {r.productName} ({r.variantName})
                    </td>
                    <td className="px-2 py-1.5"><Badge variant="default">{r.planStatus}</Badge></td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.plannedQuantity} {r.uomSymbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.workOrderedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.actualProducedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.acceptedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.remainingQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.completionPercent}%</td>
                    <td className="px-2 py-1.5">
                      <Badge variant={r.varianceClassification === 'ON_TARGET' ? 'success' : 'warning'}>
                        {r.varianceClassification}
                      </Badge>
                    </td>
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
