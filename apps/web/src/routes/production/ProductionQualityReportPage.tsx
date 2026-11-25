import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { ProductionQualityReportRow, ProductionReportQuery } from '../../types/production';

export const ProductionQualityReportPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<ProductionQualityReportRow[]>([]);
  const [summary, setSummary] = useState<{
    totalInspectedQuantity: string;
    acceptedQuantity: string;
    rejectedQuantity: string;
    quarantinedQuantity: string;
    pendingInspectionQuantity: string;
    acceptanceRatePercent: string;
    rejectionRatePercent: string;
  } | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.quality(query);
      setRows(res.data?.items ?? []);
      setSummary(res.data?.summary ?? null);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quality report');
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
        <h2 className="text-lg font-semibold text-brand-navy">Finished Goods &amp; Quality Analytics</h2>
      </div>

      <ReportFilterBar
        query={query}
        onChange={setQuery}
        reportType="quality"
        statusOptions={['PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'QUARANTINED', 'REJECTED']}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3"><div className="text-xs text-slate-500">Acceptance Rate</div><div className="text-lg font-bold text-emerald-700">{summary.acceptanceRatePercent}%</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Rejection Rate</div><div className="text-lg font-bold text-red-600">{summary.rejectionRatePercent}%</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Quarantined Qty</div><div className="text-lg font-bold text-amber-600">{summary.quarantinedQuantity}</div></Card>
          <Card className="p-3"><div className="text-xs text-slate-500">Pending Inspection</div><div className="text-lg font-bold">{summary.pendingInspectionQuantity}</div></Card>
        </div>
      )}

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading quality analytics...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No quality inspection records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Inspection #</th>
                  <th className="px-2 py-1.5">FG Batch #</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Decision</th>
                  <th className="px-2 py-1.5 text-right">Inspected</th>
                  <th className="px-2 py-1.5 text-right">Accepted</th>
                  <th className="px-2 py-1.5 text-right">Rejected</th>
                  <th className="px-2 py-1.5 text-right">Quarantined</th>
                  <th className="px-2 py-1.5">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">{r.inspectionNumber}</td>
                    <td className="px-2 py-1.5">{r.inventoryBatchNumber}</td>
                    <td className="px-2 py-1.5">{r.productName}</td>
                    <td className="px-2 py-1.5"><Badge variant={r.decision === 'ACCEPTED' ? 'success' : 'warning'}>{r.decision}</Badge></td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.inspectedQuantity} {r.uomSymbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.acceptedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.rejectedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.quarantinedQuantity}</td>
                    <td className="px-2 py-1.5">{r.expiryDate ? r.expiryDate.slice(0, 10) : '-'}</td>
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
