import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { purchasesService } from '../../services/purchases.service';
import { Button } from '../../components/common/Button';

export const PurchaseRegisterPage: React.FC = () => {
  const [itcStatus, setItcStatus] = useState('');
  const [matchingStatus, setMatchingStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const regQuery = useQuery({
    queryKey: ['purchases', 'register', itcStatus, matchingStatus, fromDate, toDate],
    queryFn: () =>
      purchasesService.getRegister({
        itcStatus: itcStatus || undefined,
        matchingStatus: matchingStatus || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const blob = await purchasesService.downloadRegisterExport(format, {
      itcStatus: itcStatus || undefined,
      matchingStatus: matchingStatus || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-register.${format === 'excel' ? 'xls' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reg = regQuery.data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Filter by ITC status"
            value={itcStatus}
            onChange={e => setItcStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5"
          >
            <option value="">All ITC Statuses</option>
            <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            <option value="ELIGIBLE">ELIGIBLE</option>
            <option value="INELIGIBLE">INELIGIBLE</option>
          </select>
          <select
            aria-label="Filter by matching status"
            value={matchingStatus}
            onChange={e => setMatchingStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5"
          >
            <option value="">All Match Statuses</option>
            <option value="UNMATCHED">UNMATCHED</option>
            <option value="MATCHED">MATCHED</option>
            <option value="MISMATCH">MISMATCH</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-1.5">
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

      {reg && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Posted Invoices</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{reg.invoiceCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Taxable Purchase Value</div>
            <div className="mt-1 text-base font-semibold text-slate-900">₹{reg.totals.taxableValue}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Total Input GST</div>
            <div className="mt-1 text-base font-semibold text-emerald-700">₹{reg.totals.taxAmount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">Grand Total</div>
            <div className="mt-1 text-base font-semibold text-slate-900">₹{reg.totals.grandTotal}</div>
          </div>
        </div>
      )}

      {regQuery.isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading purchase register...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5">Supplier Inv #</th>
                <th className="px-3 py-2.5">Internal #</th>
                <th className="px-3 py-2.5">HSN</th>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Taxable</th>
                <th className="px-3 py-2.5 text-right">CGST</th>
                <th className="px-3 py-2.5 text-right">SGST</th>
                <th className="px-3 py-2.5 text-right">IGST</th>
                <th className="px-3 py-2.5">Match</th>
                <th className="px-3 py-2.5">ITC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reg?.rows || []).map((r, idx) => (
                <tr key={`${r.supplierInvoiceId}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{r.supplierName}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.supplierInvoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{r.internalInvoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{r.hsnCode}</td>
                  <td className="px-3 py-2 text-slate-700">{r.itemDescription}</td>
                  <td className="px-3 py-2 text-right">
                    {r.quantity} {r.uomSymbol}
                  </td>
                  <td className="px-3 py-2 text-right">₹{r.taxableValue}</td>
                  <td className="px-3 py-2 text-right">₹{r.cgstAmount}</td>
                  <td className="px-3 py-2 text-right">₹{r.sgstAmount}</td>
                  <td className="px-3 py-2 text-right">₹{r.igstAmount}</td>
                  <td className="px-3 py-2">{r.matchingStatus}</td>
                  <td className="px-3 py-2">{r.itcStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
