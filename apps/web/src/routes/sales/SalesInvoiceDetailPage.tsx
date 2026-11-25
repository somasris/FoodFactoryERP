import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Edit, Eye, XCircle } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { useAuth } from '../../hooks/useAuth';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

export const SalesInvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'invoice', id],
    queryFn: () => salesService.invoices.getById(id!),
    enabled: Boolean(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sales'] });

  const issueMut = useMutation({
    mutationFn: () => salesService.invoices.issue(id!),
    onSuccess: () => {
      invalidate();
      setIssueOpen(false);
      setActionError(null);
    },
    onError: err => {
      setIssueOpen(false);
      setActionError(err instanceof Error ? err.message : 'Failed to issue invoice');
    },
  });

  const cancelMut = useMutation({
    mutationFn: (r: string) => salesService.invoices.cancel(id!, r),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      setReason('');
      setActionError(null);
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel invoice');
    },
  });

  const handlePdfAction = async (mode: 'download' | 'preview') => {
    if (!id || !data?.data) return;
    setPdfLoading(true);
    setActionError(null);
    try {
      const blob = await salesService.invoices.fetchPdfBlob(id);
      const url = URL.createObjectURL(blob);
      if (mode === 'preview') {
        setPdfPreviewUrl(url);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'PDF download failed');
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading sales invoice...
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Sales invoice not found'}
      </div>
    );
  }

  const inv = data.data;
  const canEdit = hasPermission('sales.invoices.update') && inv.status === 'DRAFT';
  const canIssue = hasPermission('sales.invoices.issue') && inv.status === 'DRAFT';
  const canCancel =
    hasPermission('sales.invoices.cancel') &&
    (inv.status === 'DRAFT' || inv.status === 'ISSUED');
  const canDownload = hasPermission('sales.invoices.download');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/sales/invoices"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold text-brand-navy">{inv.invoiceNumber}</h2>
              <SalesStatusBadge status={inv.status} />
            </div>
            <p className="text-xs text-slate-500">
              Order:{' '}
              <Link to={`/sales/orders/${inv.salesOrderId}`} className="text-brand-blue hover:underline">
                {inv.salesOrder.orderNumber}
              </Link>{' '}
              · FY {inv.financialYear} · Date {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/sales/invoices/${inv.id}/edit`)}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit Draft
            </Button>
          )}
          {canIssue && (
            <Button size="sm" variant="teal" onClick={() => setIssueOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Issue Invoice
            </Button>
          )}
          {canDownload && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pdfLoading}
                onClick={() => handlePdfAction('preview')}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pdfLoading}
                onClick={() => handlePdfAction('download')}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel Invoice
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {inv.cancellationReason && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>Cancellation Reason:</strong> {inv.cancellationReason}
        </div>
      )}

      {/* Seller & Buyer Snapshots */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm space-y-1">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Supplier (Seller)</div>
          <div className="text-sm font-bold text-slate-900">{inv.companyLegalName}</div>
          <div className="text-slate-600">{inv.companyAddress}</div>
          <div className="font-mono text-slate-700">
            GSTIN: {inv.companyGstin} · State Code: {inv.companyStateCode}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm space-y-1">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Bill To (Customer)</div>
          <div className="text-sm font-bold text-slate-900">{inv.customerLegalName}</div>
          <div className="text-slate-600">{inv.customerBillingAddress}</div>
          <div className="font-mono text-slate-700">
            GSTIN: {inv.customerGstin || 'Unregistered'} · Place of Supply: {inv.placeOfSupply}
          </div>
          <div className="text-slate-500">
            Supply Type: {inv.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">HSN</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5 text-right">Disc</th>
                <th className="px-3 py-2.5 text-right">Taxable</th>
                <th className="px-3 py-2.5 text-right">CGST</th>
                <th className="px-3 py-2.5 text-right">SGST</th>
                <th className="px-3 py-2.5 text-right">IGST</th>
                <th className="px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(inv.lines || []).map(l => (
                <tr key={l.id}>
                  <td className="px-3 py-2 text-slate-500">{l.lineNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{l.itemName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{l.itemCode}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600">{l.hsnCode}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(l.quantity)} {l.uomSymbol}
                  </td>
                  <td className="px-3 py-2 text-right">₹{Number(l.unitPrice).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">₹{Number(l.discountAmount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">₹{Number(l.taxableAmount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">₹{Number(l.cgstAmount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">₹{Number(l.sgstAmount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">₹{Number(l.igstAmount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                    ₹{Number(l.lineTotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GST & Grand Total Summary */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="ml-auto max-w-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{Number(inv.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>-₹{Number(inv.discountAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-700 font-medium">
              <span>Taxable Value</span>
              <span>₹{Number(inv.taxableAmount).toFixed(2)}</span>
            </div>
            {inv.isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>
                <span>₹{Number(inv.igstAmount).toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>
                  <span>₹{Number(inv.cgstAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST</span>
                  <span>₹{Number(inv.sgstAmount).toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Round Off</span>
              <span>₹{Number(inv.roundOffAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-bold text-brand-navy">
              <span>Grand Total</span>
              <span>₹{Number(inv.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status History */}
      {inv.statusHistory && inv.statusHistory.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-brand-navy mb-2">Invoice Status History</h3>
          <div className="space-y-1.5 text-xs">
            {inv.statusHistory.map(h => (
              <div key={h.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                <div>
                  <span className="font-semibold text-slate-800">
                    {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                  </span>
                  {h.reason && <span className="ml-2 text-slate-500">({h.reason})</span>}
                </div>
                <div className="text-[11px] text-slate-400">
                  {h.changedBy?.fullName || 'System'} · {new Date(h.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pdfPreviewUrl && (
        <Modal
          isOpen={Boolean(pdfPreviewUrl)}
          onClose={() => {
            URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }}
          title={`PDF Preview – ${inv.invoiceNumber}`}
        >
          <iframe
            src={pdfPreviewUrl}
            title="Invoice PDF Preview"
            className="h-[70vh] w-full rounded border border-slate-200"
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={issueOpen}
        onClose={() => setIssueOpen(false)}
        onConfirm={() => issueMut.mutate()}
        title="Issue GST Sales Invoice"
        message={`Issue invoice ${inv.invoiceNumber}? Once issued, financial lines and GST amounts are locked and cannot be edited.`}
        confirmLabel="Issue Invoice"
        isLoading={issueMut.isPending}
      />

      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Sales Invoice"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Provide a cancellation reason. This preserves the invoice record for audit and releases
            the invoiced quantity back to the sales order without altering inventory.
          </p>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for cancellation (minimum 3 characters)..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              disabled={reason.trim().length < 3 || cancelMut.isPending}
              onClick={() => cancelMut.mutate(reason.trim())}
            >
              {cancelMut.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
