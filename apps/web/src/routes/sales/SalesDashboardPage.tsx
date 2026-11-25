import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingCart, Clock, CheckCircle2, IndianRupee, XCircle, ArrowRight } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';

export const SalesDashboardPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'dashboard', fromDate, toDate],
    queryFn: () =>
      salesService.dashboard({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  const summary = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold text-brand-navy">Period Filter</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs"
          />
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-xs text-brand-blue hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading sales dashboard...
        </div>
      ) : error || !summary ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load sales dashboard'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Confirmed Sales Value
                </CardTitle>
                <IndianRupee className="h-4 w-4 text-brand-navy" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-brand-navy">
                  ₹
                  {Number(summary.confirmedSalesValue).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Confirmed, partial &amp; fulfilled orders
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-teal-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{summary.totalOrders}</div>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.draftOrders} draft · {summary.confirmedOrders} confirmed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Pending Approvals
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700">{summary.pendingApprovals}</div>
                <Link
                  to="/sales/approvals"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
                >
                  Review queue <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Fulfilled / Cancelled
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-emerald-700">
                    {summary.fulfilledOrders}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <XCircle className="h-3.5 w-3.5 text-slate-400" /> {summary.cancelledOrders} cancelled
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.partiallyFulfilledOrders} partially fulfilled
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-brand-navy">Recent Sales Orders</CardTitle>
              <Link to="/sales/orders" className="text-xs text-brand-blue hover:underline">
                View all orders
              </Link>
            </CardHeader>
            <CardContent>
              {summary.recentOrders.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No sales orders created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Order #</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Warehouse</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Total</th>
                        <th className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.recentOrders.map(order => (
                        <tr key={order.id}>
                          <td className="py-2 pr-3 font-mono font-medium">
                            <Link
                              to={`/sales/orders/${order.id}`}
                              className="text-brand-blue hover:underline"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">{order.customer.legalName}</td>
                          <td className="py-2 pr-3">{order.warehouse.code}</td>
                          <td className="py-2 pr-3">
                            <SalesStatusBadge status={order.status} />
                          </td>
                          <td className="py-2 pr-3 text-right font-mono font-medium">
                            ₹{Number(order.totalAmount).toFixed(2)}
                          </td>
                          <td className="py-2 text-slate-500">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
