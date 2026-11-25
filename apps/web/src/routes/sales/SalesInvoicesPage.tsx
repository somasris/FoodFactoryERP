import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { Button } from '../../components/common/Button';

const INVOICE_STATUSES = ['', 'DRAFT', 'ISSUED', 'CANCELLED'];

export const SalesInvoicesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'invoices', page, search, status],
    queryFn: () =>
      salesService.invoices.list({
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
              placeholder="Search invoice # or customer..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-brand-blue focus:outline-none"
            />
          </div>
          <select
            aria-label="Filter by invoice status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-blue focus:outline-none"
          >
            {INVOICE_STATUSES.map(s => (
              <option key={s} value={s}>
                {s ? s : 'All Statuses'}
              </option>
            ))}
          </select>
        </div>

        <Link
          to="/sales/orders"
          className="text-xs font-medium text-brand-blue hover:underline"
        >
          Create from Fulfilled Order →
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading sales invoices...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load sales invoices'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No sales invoices found. Generate an invoice from a fulfilled or partially fulfilled sales order.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Order Ref</th>
                  <th className="px-4 py-2.5">Taxable</th>
                  <th className="px-4 py-2.5">GST</th>
                  <th className="px-4 py-2.5">Grand Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-brand-navy">
                      <Link to={`/sales/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{inv.customerLegalName}</div>
                      <div className="text-[11px] text-slate-500">{inv.placeOfSupply}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      <Link
                        to={`/sales/orders/${inv.salesOrderId}`}
                        className="text-brand-blue hover:underline"
                      >
                        {inv.salesOrder.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      ₹{Number(inv.taxableAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      ₹{Number(inv.taxAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      ₹{Number(inv.grandTotal).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SalesStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/sales/invoices/${inv.id}`}
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
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
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
