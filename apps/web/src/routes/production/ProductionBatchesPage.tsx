import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const BATCH_STATUSES = ['', 'CREATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  CREATED: 'outline',
  IN_PROGRESS: 'warning',
  PAUSED: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export const ProductionBatchesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'batches', 'list', page, search, status],
    queryFn: () =>
      productionService.batches.list({
        page,
        limit: 15,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const rows = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search batch #, WO #, SKU..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by batch status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            {BATCH_STATUSES.map(s => (
              <option key={s || 'ALL'} value={s}>
                {s || 'All Statuses'}
              </option>
            ))}
          </select>
        </div>

        <Link to="/production/execution" className="text-xs font-medium text-brand-teal hover:underline">
          Execution Dashboard →
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading production batches...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load production batches'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No production batches found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Batch #</th>
                  <th className="px-3 py-2.5 font-medium">Work Order #</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">BOM Version</th>
                  <th className="px-3 py-2.5 font-medium text-right">Planned</th>
                  <th className="px-3 py-2.5 font-medium text-right">Good / Wastage</th>
                  <th className="px-3 py-2.5 font-medium text-right">Yield %</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-brand-navy">{b.batchNumber}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/production/work-orders/${b.workOrderId}`} className="text-brand-teal hover:underline">
                        {b.workOrder?.workOrderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{b.productVariant?.sku}</div>
                      <div className="text-[11px] text-slate-500">{b.productVariant?.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {b.bom?.code} v{b.bomVersion?.versionNumber}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {Number(b.plannedQuantity).toFixed(2)} {b.uom?.symbol}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {Number(b.actualGoodQuantity).toFixed(2)} /{' '}
                      {(Number(b.rejectedQuantity) + Number(b.wastageQuantity)).toFixed(2)} {b.uom?.symbol}
                    </td>
                    <td className="px-3 py-2.5 text-right">{Number(b.actualYieldPercent).toFixed(1)}%</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_BADGE[b.status] || 'outline'}>{b.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to={`/production/batches/${b.id}`}
                        className="inline-flex items-center gap-1 font-medium text-brand-teal hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" /> Execute
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
