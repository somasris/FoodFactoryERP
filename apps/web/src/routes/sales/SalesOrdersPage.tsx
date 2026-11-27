import React, { useCallback, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Eye, Plus, Search } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { useAuth } from '../../hooks/useAuth';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { StockAvailabilityBadge } from '../../components/sales/StockAvailabilityBadge';
import { StockShortageTable } from '../../components/sales/StockShortageTable';
import { Button } from '../../components/common/Button';
import { SavedViewsBar } from '../../components/ux/SavedViewsBar';
import { FilterValue } from '../../services/ux.service';
import { SalesOrder } from '../../types/sales';

export const SalesOrdersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const captionId = useId();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [stockAvailability, setStockAvailability] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['sales', 'orders', page, search, status, stockAvailability, sortBy, sortOrder],
    queryFn: () =>
      salesService.orders.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        stockAvailability: stockAvailability || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const orders = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('sales.orders.create');

  const handleApplyView = useCallback((filters: Record<string, FilterValue>) => {
    setSearch(typeof filters.search === 'string' ? filters.search : '');
    setStatus(typeof filters.status === 'string' ? filters.status : '');
    setStockAvailability(
      typeof filters.stockAvailability === 'string' ? filters.stockAvailability : '',
    );
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setStockAvailability('');
    setSortBy('');
    setSortOrder('asc');
    setPage(1);
  }, []);

  const handleToggleStockSort = () => {
    if (sortBy !== 'stockAvailability') {
      setSortBy('stockAvailability');
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortBy('');
      setSortOrder('asc');
    }
    setPage(1);
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const renderStockSummaryCell = (order: SalesOrder) => {
    const stock = order.stockAvailability;
    const isChecking = isFetching && !stock;

    if (isChecking) {
      return <StockAvailabilityBadge isLoading />;
    }

    if (!stock) {
      return <StockAvailabilityBadge status={null} />;
    }

    const hasShortage = stock.status === 'INSUFFICIENT' || stock.status === 'PARTIAL';
    const isExpanded = Boolean(expandedOrderIds[order.id]);

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <StockAvailabilityBadge status={stock.status} />
        </div>
        {hasShortage && stock.lines.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => toggleExpanded(order.id)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C74440] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              <span>
                {stock.insufficientLines} of {stock.totalLines} item
                {stock.totalLines === 1 ? '' : 's'} short
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SavedViewsBar
        module="sales_orders"
        currentFilters={{ search, status, stockAvailability }}
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
            aria-label="Filter by order status"
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
          <select
            aria-label="Filter by stock availability"
            value={stockAvailability}
            onChange={e => {
              setStockAvailability(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Orders (Stock)</option>
            <option value="SUFFICIENT">Sufficient Stock</option>
            <option value="INSUFFICIENT">Insufficient Stock</option>
            <option value="PARTIAL">Partial Stock</option>
          </select>
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/sales/orders/new')} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Order
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Loading sales orders and checking stock availability...
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load sales orders'}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No sales orders found.</div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[780px] text-left text-xs">
            <caption id={captionId} className="sr-only">
              Sales Orders with live stock availability
            </caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2">Order #</th>
                <th scope="col" className="px-3 py-2">Customer</th>
                <th scope="col" className="px-3 py-2">Warehouse</th>
                <th scope="col" className="px-3 py-2">Lines</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th
                  scope="col"
                  aria-sort={
                    sortBy === 'stockAvailability'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className="p-0"
                >
                  <button
                    type="button"
                    onClick={handleToggleStockSort}
                    className="inline-flex min-h-[24px] w-full items-center gap-1 px-3 py-2 text-left font-semibold text-slate-600 hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-navy"
                  >
                    <span>Stock Availability</span>
                    {sortBy === 'stockAvailability' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th scope="col" className="px-3 py-2 text-right">Total</th>
                <th scope="col" className="px-3 py-2">Order Date</th>
                <th scope="col" className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => {
                const stock = order.stockAvailability;
                const isExpanded = Boolean(expandedOrderIds[order.id]);
                const hasShortage =
                  stock && (stock.status === 'INSUFFICIENT' || stock.status === 'PARTIAL');

                return (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-slate-50">
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
                      <td className="px-3 py-2">{renderStockSummaryCell(order)}</td>
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
                    {hasShortage && isExpanded && stock && (
                      <tr className="bg-red-50/40">
                        <td colSpan={9} className="px-4 py-3">
                          <StockShortageTable stock={stock} orderNumber={order.orderNumber} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
