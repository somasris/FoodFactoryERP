import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const PLAN_STATUSES = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED', 'CANCELLED'];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  APPROVED: 'teal',
  REJECTED: 'default',
  RELEASED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export const ProductionPlansPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'plans', page, search, status],
    queryFn: () =>
      productionService.plans.list({
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
              placeholder="Search plan # or name..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by plan status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            {PLAN_STATUSES.map(s => (
              <option key={s} value={s}>
                {s ? s : 'All Statuses'}
              </option>
            ))}
          </select>
        </div>

        <Link to="/production/demand" className="text-xs font-medium text-brand-blue hover:underline">
          Generate from Sales Demand →
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading production plans...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load production plans'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No production plans found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Plan #</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Warehouse</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Plan Date</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(plan => (
                  <tr key={plan.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-brand-navy">
                      <Link to={`/production/plans/${plan.id}`} className="hover:underline">
                        {plan.planNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{plan.name || '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{plan.warehouse.code}</td>
                    <td className="px-4 py-2.5">{plan._count?.items ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_BADGE[plan.status] || 'outline'}>{plan.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(plan.planDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/production/plans/${plan.id}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3 w-3" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs">
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.totalPages}
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
