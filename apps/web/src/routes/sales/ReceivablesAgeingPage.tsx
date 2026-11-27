import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { masterDataService } from '../../services/master-data.service';
import { Button } from '../../components/common/Button';

export const ReceivablesAgeingPage: React.FC = () => {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<'receivables' | 'ageing' | 'collections'>('receivables');

  // Collection report filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [groupBy, setGroupBy] = useState<'daily' | 'monthly'>('monthly');

  const recQuery = useQuery({
    queryKey: ['sales', 'receivables'],
    queryFn: () => paymentsService.getReceivables(),
  });

  const ageingQuery = useQuery({
    queryKey: ['sales', 'ageing', asOfDate],
    queryFn: () => paymentsService.getAgeing({ asOfDate }),
    enabled: view === 'ageing',
  });

  const customersQuery = useQuery({
    queryKey: ['master-data', 'customers', 'all'],
    queryFn: () => masterDataService.customers.list({ limit: 100 }),
    enabled: view === 'collections',
  });

  const collectionsQuery = useQuery({
    queryKey: ['sales', 'collections', fromDate, toDate, paymentMode, customerId, groupBy],
    queryFn: () =>
      paymentsService.getCollections({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentMode: paymentMode || undefined,
        customerId: customerId || undefined,
        groupBy,
      }),
    enabled: view === 'collections',
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const blob =
      view === 'collections'
        ? await paymentsService.downloadCollectionsExport(format, {
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            paymentMode: paymentMode || undefined,
            customerId: customerId || undefined,
            groupBy,
          })
        : await paymentsService.downloadAgeingExport(format, { asOfDate });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = view === 'collections' ? 'collection-summary' : 'receivables-ageing';
    a.download = `${prefix}.${format === 'excel' ? 'xls' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rec = recQuery.data?.data;
  const ageing = ageingQuery.data?.data;
  const col = collectionsQuery.data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView('receivables')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === 'receivables' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Customer &amp; Invoice Outstanding
          </button>
          <button
            onClick={() => setView('ageing')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === 'ageing' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ageing Buckets
          </button>
          <button
            onClick={() => setView('collections')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === 'collections' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Collection Summary
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view !== 'collections' && (
            <>
              <label className="text-xs text-slate-600">As Of:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('excel')}>
            <Download className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {view !== 'collections' && rec && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Total Invoiced</div>
            <div className="mt-1 text-base font-semibold text-slate-900">₹{rec.totals.totalInvoiced}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Net Payments Received</div>
            <div className="mt-1 text-base font-semibold text-emerald-700">₹{rec.totals.totalPaid}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Issued Credit Notes</div>
            <div className="mt-1 text-base font-semibold text-indigo-700">₹{rec.totals.totalCreditNotes}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Total Outstanding</div>
            <div className="mt-1 text-base font-semibold text-amber-700">₹{rec.totals.totalOutstanding}</div>
          </div>
        </div>
      )}

      {view === 'receivables' ? (
        recQuery.isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Loading receivables...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Invoice Total</th>
                  <th className="px-3 py-2.5 text-right">Paid</th>
                  <th className="px-3 py-2.5 text-right">Credit Notes</th>
                  <th className="px-3 py-2.5 text-right">Outstanding</th>
                  <th className="px-3 py-2.5 text-right">Excess Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rec?.invoices || []).map(inv => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2 text-slate-700">{inv.customerLegalName}</td>
                    <td className="px-3 py-2 text-slate-600">{inv.paymentStatus}</td>
                    <td className="px-3 py-2 text-right">₹{inv.grandTotal}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">₹{inv.paidAmount}</td>
                    <td className="px-3 py-2 text-right text-indigo-700">₹{inv.creditNoteAmount}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">
                      ₹{inv.outstandingAmount}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">₹{inv.excessCreditBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : view === 'ageing' ? (
        ageingQuery.isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Loading ageing report...
          </div>
        ) : (
          <div className="space-y-3">
            {ageing && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                {ageing.fallbackRule}
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5 text-right">Not Due</th>
                    <th className="px-3 py-2.5 text-right">1–30 Days</th>
                    <th className="px-3 py-2.5 text-right">31–60 Days</th>
                    <th className="px-3 py-2.5 text-right">61–90 Days</th>
                    <th className="px-3 py-2.5 text-right">Above 90 Days</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(ageing?.customers || []).map(c => (
                    <tr key={c.customerId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{c.customerLegalName}</td>
                      <td className="px-3 py-2 text-right">₹{c.notDue}</td>
                      <td className="px-3 py-2 text-right">₹{c.days1to30}</td>
                      <td className="px-3 py-2 text-right">₹{c.days31to60}</td>
                      <td className="px-3 py-2 text-right">₹{c.days61to90}</td>
                      <td className="px-3 py-2 text-right text-red-700">₹{c.above90}</td>
                      <td className="px-3 py-2 text-right font-semibold">₹{c.totalOutstanding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
            <input
              type="date"
              aria-label="Collection from date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
            <input
              type="date"
              aria-label="Collection to date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
            <select
              aria-label="Filter by payment mode"
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            >
              <option value="">All Modes</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="NEFT_RTGS">NEFT / RTGS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              aria-label="Filter by customer"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            >
              <option value="">All Customers</option>
              {(customersQuery.data?.data?.items || []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
            <select
              aria-label="Grouping interval"
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as 'daily' | 'monthly')}
              className="rounded-md border border-slate-300 px-2 py-1"
            >
              <option value="monthly">Monthly Grouping</option>
              <option value="daily">Daily Grouping</option>
            </select>
          </div>

          {collectionsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              Loading collection summary...
            </div>
          ) : collectionsQuery.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {collectionsQuery.error instanceof Error
                ? collectionsQuery.error.message
                : 'Failed to load collection summary'}
            </div>
          ) : !col || col.summary.transactionCount === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              No payment collections found for the selected filters.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-[11px] text-slate-500">Net Collections ({col.summary.recordedCount})</div>
                  <div className="mt-1 text-base font-semibold text-emerald-700">
                    ₹{col.summary.netCollections}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-[11px] text-slate-500">Gross Payments ({col.summary.transactionCount})</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    ₹{col.summary.totalGrossPaymentsReceived}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-[11px] text-slate-500">Reversed ({col.summary.reversedCount})</div>
                  <div className="mt-1 text-base font-semibold text-red-700">
                    ₹{col.summary.totalReversedPayments}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-[11px] text-slate-500">Unallocated Advances</div>
                  <div className="mt-1 text-base font-semibold text-amber-700">
                    ₹{col.summary.totalUnallocatedAdvances}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                  Collections by Period ({col.groupBy})
                </div>
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2 text-right">Txns</th>
                      <th className="px-3 py-2 text-right">Gross</th>
                      <th className="px-3 py-2 text-right">Reversed</th>
                      <th className="px-3 py-2 text-right">Net Collected</th>
                      <th className="px-3 py-2 text-right">Unallocated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {col.byPeriod.map(r => (
                      <tr key={r.period}>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.period}</td>
                        <td className="px-3 py-2 text-right">{r.transactionCount}</td>
                        <td className="px-3 py-2 text-right">₹{r.grossReceived}</td>
                        <td className="px-3 py-2 text-right text-red-700">₹{r.reversedAmount}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">₹{r.netCollected}</td>
                        <td className="px-3 py-2 text-right text-amber-700">₹{r.unallocatedAdvances}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    By Payment Mode
                  </div>
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Mode</th>
                        <th className="px-3 py-2 text-right">Txns</th>
                        <th className="px-3 py-2 text-right">Net Collected</th>
                        <th className="px-3 py-2 text-right">Unallocated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {col.byPaymentMode.map(m => (
                        <tr key={m.paymentMode}>
                          <td className="px-3 py-2 font-medium">{m.paymentMode}</td>
                          <td className="px-3 py-2 text-right">{m.transactionCount}</td>
                          <td className="px-3 py-2 text-right font-semibold">₹{m.netCollected}</td>
                          <td className="px-3 py-2 text-right text-amber-700">₹{m.unallocatedAdvances}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    By Customer
                  </div>
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2 text-right">Txns</th>
                        <th className="px-3 py-2 text-right">Net Collected</th>
                        <th className="px-3 py-2 text-right">Unallocated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {col.byCustomer.map(c => (
                        <tr key={c.customerId}>
                          <td className="px-3 py-2 font-medium">{c.customerLegalName}</td>
                          <td className="px-3 py-2 text-right">{c.transactionCount}</td>
                          <td className="px-3 py-2 text-right font-semibold">₹{c.netCollected}</td>
                          <td className="px-3 py-2 text-right text-amber-700">₹{c.unallocatedAdvances}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
