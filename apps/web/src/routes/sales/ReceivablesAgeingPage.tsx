import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { Button } from '../../components/common/Button';

export const ReceivablesAgeingPage: React.FC = () => {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<'receivables' | 'ageing'>('receivables');

  const recQuery = useQuery({
    queryKey: ['sales', 'receivables'],
    queryFn: () => paymentsService.getReceivables(),
  });

  const ageingQuery = useQuery({
    queryKey: ['sales', 'ageing', asOfDate],
    queryFn: () => paymentsService.getAgeing({ asOfDate }),
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const blob = await paymentsService.downloadAgeingExport(format, { asOfDate });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receivables-ageing.${format === 'excel' ? 'xls' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rec = recQuery.data?.data;
  const ageing = ageingQuery.data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">As Of:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
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

      {rec && (
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
      ) : ageingQuery.isLoading ? (
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
      )}
    </div>
  );
};
