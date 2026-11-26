import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { useAuth } from '../../hooks/useAuth';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { Button } from '../../components/common/Button';
import { SavedViewsBar } from '../../components/ux/SavedViewsBar';
import { FilterValue } from '../../services/ux.service';

export const SalesOrdersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'orders', page, search, status],
    queryFn: () =>
      salesService.orders.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const orders = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('sales.orders.create');

  const handleApplyView = useCallback((filters: Record<string, FilterValue>) => {
    setSearch(typeof filters.search === 'string' ? filters.search : '');
    setStatus(typeof filters.status === 'string' ? filters.status : '');
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setPage(1);
  }, []);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SavedViewsBar
        module="sales_orders"
        currentFilters={{ search, status }}
        onApplyView={handleApplyView}
        onResetFilters={handleResetFilters}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Sales Orders</h2>
          <p className="text-xs text-slate-500">
            Search, filter, and manage customer sales orders across all lifecycle stages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search order # or customer..."
              className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/sales/orders/new')} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Order
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading sales orders...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load sales orders'}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No sales orders found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Order Date</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">
                    <Link to={`/sales/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{order.customer.legalName}</div>
                    <div className="text-[11px] text-slate-500">{order.customer.code}</div>
                  </td>
                  <td className="px-3 py-2">{order.warehouse.code}</td>
                  <td className="px-3 py-2">{order._count?.lines ?? order.lines?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <SalesStatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    ₹{Number(order.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(order.orderDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/sales/orders/${order.id}`}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      <Eye className="h-3 w-3" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
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
  );
};
