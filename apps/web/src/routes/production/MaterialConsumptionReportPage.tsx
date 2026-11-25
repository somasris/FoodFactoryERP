import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ReportFilterBar } from '../../components/production/ReportFilterBar';
import { productionService } from '../../services/production.service';
import { MaterialConsumptionReportRow, ProductionReportQuery } from '../../types/production';

export const MaterialConsumptionReportPage: React.FC = () => {
  const [query, setQuery] = useState<ProductionReportQuery>({ period: 'month', page: 1, limit: 20 });
  const [rows, setRows] = useState<MaterialConsumptionReportRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.reports.materialConsumption(query);
      setRows(res.data?.items ?? []);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load material consumption report');
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
        <h2 className="text-lg font-semibold text-brand-navy">Material Consumption &amp; Wastage Report</h2>
      </div>

      <ReportFilterBar query={query} onChange={setQuery} reportType="material-consumption" />

      {error && <div className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading material consumption...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No material consumption records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Batch #</th>
                  <th className="px-2 py-1.5">Material</th>
                  <th className="px-2 py-1.5">Source Lots</th>
                  <th className="px-2 py-1.5 text-right">BOM Planned</th>
                  <th className="px-2 py-1.5 text-right">Consumed</th>
                  <th className="px-2 py-1.5 text-right">Returned</th>
                  <th className="px-2 py-1.5 text-right">Net Usage</th>
                  <th className="px-2 py-1.5 text-right">Wastage %</th>
                  <th className="px-2 py-1.5 text-right">Net Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={`${r.productionBatchId}-${r.inventoryItemId}`}>
                    <td className="px-2 py-1.5 font-medium text-brand-navy">{r.batchNumber}</td>
                    <td className="px-2 py-1.5">{r.itemCode} – {r.itemName}</td>
                    <td className="px-2 py-1.5">{r.sourceBatchNumbers}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.bomPlannedQuantity} {r.uomSymbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.actualConsumedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.returnedQuantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.netConsumption}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.wastagePercent}%</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{r.materialCost}</td>
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
