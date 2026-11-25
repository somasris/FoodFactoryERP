import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { productionService } from '../../services/production.service';
import { CostVarianceReportResponse } from '../../types/production';

export const CostVarianceReportPage: React.FC = () => {
  const [report, setReport] = useState<CostVarianceReportResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.costing.varianceReport(
        statusFilter ? { status: statusFilter } : {},
      );
      setReport(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load variance report');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to="/production/costing"
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Costing
          </Link>
          <h2 className="text-lg font-semibold text-brand-navy">Production Cost Variance Report</h2>
        </div>

        <select
          aria-label="Filter variance report status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
        >
          <option value="">All Calculated / Reviewed / Finalized</option>
          <option value="CALCULATED">CALCULATED</option>
          <option value="REVIEWED">REVIEWED</option>
          <option value="FINALIZED">FINALIZED</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <div className="text-[11px] text-slate-500">Standard Total</div>
              <div className="text-base font-bold">₹{report.summary.standardTotalCost}</div>
            </Card>
            <Card className="p-3">
              <div className="text-[11px] text-slate-500">Actual Total</div>
              <div className="text-base font-bold">₹{report.summary.actualTotalCost}</div>
            </Card>
            <Card className="p-3">
              <div className="text-[11px] text-slate-500">Material / Labour Var.</div>
              <div className="text-sm font-semibold">
                ₹{report.summary.materialVarianceAmount} / ₹{report.summary.labourVarianceAmount}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-[11px] text-slate-500">Total Variance</div>
              <div className="text-base font-bold">
                ₹{report.summary.totalVarianceAmount} ({report.summary.totalVariancePercent}%)
              </div>
            </Card>
          </div>

          <Card className="p-4">
            {loading ? (
              <p className="text-xs text-slate-500">Loading variance rows...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">Batch #</th>
                      <th className="px-2 py-1.5">Product</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5 text-right">Standard</th>
                      <th className="px-2 py-1.5 text-right">Actual</th>
                      <th className="px-2 py-1.5 text-right">Mat. Var</th>
                      <th className="px-2 py-1.5 text-right">Lab. Var</th>
                      <th className="px-2 py-1.5 text-right">OH Var</th>
                      <th className="px-2 py-1.5 text-right">Total Var (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rows.map(r => (
                      <tr key={r.id}>
                        <td className="px-2 py-1.5 font-medium text-brand-navy">
                          <Link to={`/production/costing/batches/${r.productionBatchId}`}>
                            {r.productionBatch?.batchNumber}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">{r.productionBatch?.productVariant?.name}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant={r.status === 'FINALIZED' ? 'success' : 'teal'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ₹{Number(r.standardTotalCost).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ₹{Number(r.totalActualCost).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ₹{Number(r.materialVarianceAmount).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ₹{Number(r.labourVarianceAmount).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ₹{Number(r.overheadVarianceAmount).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">
                          ₹{Number(r.totalVarianceAmount).toFixed(2)} ({r.totalVariancePercent}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
