import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SavedViewsBar } from '../../components/ux/SavedViewsBar';
import { FilterValue } from '../../services/ux.service';

const WO_STATUSES = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const WO_PRIORITIES = ['', 'LOW', 'NORMAL', 'HIGH', 'URGENT'];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  APPROVED: 'teal',
  REJECTED: 'default',
  RELEASED: 'success',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

const PRIORITY_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  LOW: 'outline',
  NORMAL: 'secondary',
  HIGH: 'warning',
  URGENT: 'default',
};

export const WorkOrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'work-orders', 'list', page, search, status, priority],
    queryFn: () =>
      productionService.workOrders.list({
        page,
        limit: 15,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
      }),
  });

  const rows = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  const handleApplyView = useCallback((filters: Record<string, FilterValue>) => {
    setSearch(typeof filters.search === 'string' ? filters.search : '');
    setStatus(typeof filters.status === 'string' ? filters.status : '');
    setPriority(typeof filters.priority === 'string' ? filters.priority : '');
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setPriority('');
    setPage(1);
  }, []);

  return (
    <div className="space-y-4">
      <SavedViewsBar
        module="work_orders"
        currentFilters={{ search, status, priority }}
        onApplyView={handleApplyView}
        onResetFilters={handleResetFilters}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search WO #, SKU, line, plan #..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by work order status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            {WO_STATUSES.map(s => (
              <option key={s || 'ALL'} value={s}>
                {s || 'All Statuses'}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by work order priority"
            value={priority}
            onChange={e => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            {WO_PRIORITIES.map(p => (
              <option key={p || 'ALL'} value={p}>
                {p || 'All Priorities'}
              </option>
            ))}
          </select>
        </div>

        <Link to="/production/plans" className="text-xs font-medium text-brand-teal hover:underline">
          Generate from Production Plan →
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading work orders...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load work orders'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No work orders found matching your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Work Order #</th>
                  <th className="px-3 py-2.5 font-medium">Plan #</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">BOM Version</th>
                  <th className="px-3 py-2.5 font-medium">Warehouse</th>
                  <th className="px-3 py-2.5 font-medium text-right">Planned Qty</th>
                  <th className="px-3 py-2.5 font-medium">Schedule</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(wo => (
                  <tr key={wo.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-brand-navy">{wo.workOrderNumber}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/production/plans/${wo.productionPlanId}`} className="text-brand-teal hover:underline">
                        {wo.productionPlan?.planNumber || 'Plan'}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{wo.productVariant?.sku}</div>
                      <div className="text-[11px] text-slate-500">{wo.productVariant?.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {wo.bom?.code} v{wo.bomVersion?.versionNumber}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{wo.warehouse?.code}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                      {Number(wo.plannedQuantity).toFixed(2)} {wo.uom?.symbol}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>
                        {wo.plannedStartDate ? new Date(wo.plannedStartDate).toLocaleDateString() : 'Unscheduled'}
                      </div>
                      {wo.productionLine && (
                        <div className="text-[11px] text-slate-400">{wo.productionLine}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={PRIORITY_BADGE[wo.priority] || 'outline'}>{wo.priority}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_BADGE[wo.status] || 'outline'}>{wo.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to={`/production/work-orders/${wo.id}`}
                        className="inline-flex items-center gap-1 font-medium text-brand-teal hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
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
