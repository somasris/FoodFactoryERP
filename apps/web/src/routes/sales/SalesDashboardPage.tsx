import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingCart, Clock, CheckCircle2, IndianRupee, FileText } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateViews';

export const SalesDashboardPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales', 'dashboard', fromDate, toDate],
    queryFn: () =>
      salesService.dashboard({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  const summary = data?.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Overview"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="text-xs font-medium text-brand-blue hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading sales dashboard..." />
      ) : error || !summary ? (
        <ErrorState
          title="Failed to load sales dashboard"
          message={error instanceof Error ? error.message : 'Unable to retrieve sales summary'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Confirmed Sales Value"
              value={`₹${Number(summary.confirmedSalesValue).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}`}
              sublabel="Confirmed, partial & fulfilled orders"
              icon={<IndianRupee className="h-4 w-4" />}
              tone="info"
            />
            <KpiCard
              label="Total Orders"
              value={summary.totalOrders}
              sublabel={`${summary.draftOrders} draft · ${summary.confirmedOrders} confirmed`}
              icon={<ShoppingCart className="h-4 w-4" />}
              tone="neutral"
            />
            <KpiCard
              label="Pending Approvals"
              value={summary.pendingApprovals}
              sublabel="Awaiting authorization"
              icon={<Clock className="h-4 w-4" />}
              tone={summary.pendingApprovals > 0 ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="Fulfilled Orders"
              value={summary.fulfilledOrders}
              sublabel={`${summary.partiallyFulfilledOrders} partial · ${summary.cancelledOrders} cancelled`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
            />
          </div>

          {summary.invoiceMetrics && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Total Invoiced Value (Issued)"
                value={`₹${Number(summary.invoiceMetrics.totalInvoicedValue).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}`}
                sublabel={`${summary.invoiceMetrics.issuedInvoices} issued GST invoices`}
                icon={<FileText className="h-4 w-4" />}
                tone="info"
              />
              <KpiCard
                label="Sales Invoices"
                value={summary.invoiceMetrics.totalInvoices}
                sublabel={`${summary.invoiceMetrics.draftInvoices} draft · ${summary.invoiceMetrics.cancelledInvoices} cancelled`}
                icon={<FileText className="h-4 w-4" />}
                tone="neutral"
              />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Invoice Trends
                  </CardTitle>
                  <Link to="/sales/invoices" className="text-xs font-medium text-brand-blue hover:underline">
                    View invoices
                  </Link>
                </CardHeader>
                <CardContent>
                  {summary.invoiceMetrics.invoiceTrends.length === 0 ? (
                    <p className="text-xs text-slate-500">No issued invoices in selected period.</p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {summary.invoiceMetrics.invoiceTrends.slice(-3).map(t => (
                        <div key={t.period} className="flex justify-between">
                          <span className="font-mono text-slate-600">{t.period}</span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {t.count} · ₹{Number(t.totalValue).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Recent Sales Orders
              </CardTitle>
              <Link to="/sales/orders" className="text-xs font-medium text-brand-blue hover:underline">
                View all orders
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {summary.recentOrders.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No sales orders created yet"
                    description="Create a sales order to begin tracking customer demand and fulfillment."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Order #</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Warehouse</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.recentOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono font-medium">
                            <Link
                              to={`/sales/orders/${order.id}`}
                              className="text-brand-blue hover:underline"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-slate-800">{order.customer.legalName}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">{order.warehouse.code}</td>
                          <td className="px-4 py-2.5">
                            <SalesStatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                            ₹{Number(order.totalAmount).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">
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
