import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Plus, Search, XCircle } from 'lucide-react';
import { creditNotesService, CreditNote } from '../../services/credit-notes.service';
import { salesService } from '../../services/sales.service';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/master-data/Modal';

export const CreditNotesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canCreate = hasPermission('sales.credit_notes.create');
  const canIssue = hasPermission('sales.credit_notes.issue');
  const canCancel = hasPermission('sales.credit_notes.cancel');
  const canDownload = hasPermission('sales.credit_notes.download');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CreditNote | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [lineQtys, setLineQtys] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'credit-notes', page, search, status],
    queryFn: () =>
      creditNotesService.list({
        page,
        limit: 15,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const issuedInvoicesQuery = useQuery({
    queryKey: ['sales', 'invoices', 'ISSUED'],
    queryFn: () => salesService.invoices.list({ status: 'ISSUED', limit: 100 }),
    enabled: createOpen,
  });

  const selectedInvoiceDetail = useQuery({
    queryKey: ['sales', 'invoice', selectedInvoiceId],
    queryFn: () => salesService.invoices.getById(selectedInvoiceId),
    enabled: Boolean(selectedInvoiceId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sales'] });

  const createMut = useMutation({
    mutationFn: () => {
      const lines = Object.entries(lineQtys)
        .filter(([, q]) => Number(q) > 0)
        .map(([originalInvoiceLineId, quantity]) => ({ originalInvoiceLineId, quantity }));
      return creditNotesService.createDraft({
        salesInvoiceId: selectedInvoiceId,
        reason,
        lines,
      });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setSelectedInvoiceId('');
      setReason('');
      setLineQtys({});
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to create credit note'),
  });

  const issueMut = useMutation({
    mutationFn: (id: string) => creditNotesService.issue(id),
    onSuccess: () => {
      invalidate();
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to issue credit note'),
  });

  const cancelMut = useMutation({
    mutationFn: () => creditNotesService.cancel(cancelTarget!.id, cancelReason),
    onSuccess: () => {
      invalidate();
      setCancelTarget(null);
      setCancelReason('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel credit note'),
  });

  const handleDownloadPdf = async (cn: CreditNote) => {
    const blob = await creditNotesService.fetchPdfBlob(cn.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cn.creditNoteNumber.replace(/[/\\]/g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rows = data?.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search credit note # or invoice..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by credit note status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ISSUED">ISSUED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Credit Note
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading credit notes...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load credit notes'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No GST credit notes found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Credit Note #</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Invoice #</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 text-right">Taxable</th>
                <th className="px-3 py-2.5 text-right">GST</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(cn => (
                <tr key={cn.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{cn.creditNoteNumber}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(cn.creditNoteDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{cn.salesInvoice.invoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-700">{cn.customerLegalName}</td>
                  <td className="px-3 py-2 text-right">₹{cn.taxableValue}</td>
                  <td className="px-3 py-2 text-right">₹{cn.taxAmount}</td>
                  <td className="px-3 py-2 text-right font-semibold">₹{cn.grandTotal}</td>
                  <td className="px-3 py-2">{cn.status}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {canIssue && cn.status === 'DRAFT' && (
                        <Button size="sm" onClick={() => issueMut.mutate(cn.id)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Issue
                        </Button>
                      )}
                      {canDownload && (
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(cn)}>
                          <Download className="mr-1 h-3 w-3" /> PDF
                        </Button>
                      )}
                      {canCancel && cn.status !== 'CANCELLED' && (
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(cn)}>
                          <XCircle className="mr-1 h-3 w-3" /> Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create GST Credit Note Draft">
        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-slate-700">Issued Sales Invoice</label>
            <select
              value={selectedInvoiceId}
              onChange={e => {
                setSelectedInvoiceId(e.target.value);
                setLineQtys({});
              }}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            >
              <option value="">Select issued invoice...</option>
              {(issuedInvoicesQuery.data?.data?.items || []).map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.customer?.legalName} (₹{inv.grandTotal})
                </option>
              ))}
            </select>
          </div>
          {selectedInvoiceDetail.data?.data && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <div className="font-medium text-slate-700">Select Credit Quantities</div>
              {(selectedInvoiceDetail.data.data.lines || []).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">
                    {l.itemName} (Invoiced: {l.quantity})
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={l.quantity}
                    step="0.01"
                    placeholder="0"
                    value={lineQtys[l.id] || ''}
                    onChange={e => setLineQtys(prev => ({ ...prev, [l.id]: e.target.value }))}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                  />
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="mb-1 block font-medium text-slate-700">Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedInvoiceId || reason.trim().length < 3 || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel ${cancelTarget?.creditNoteNumber ?? ''}`}
      >
        <div className="space-y-3 text-xs">
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Mandatory cancellation reason..."
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={cancelReason.trim().length < 3 || cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Confirm Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
