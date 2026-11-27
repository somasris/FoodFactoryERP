import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Download, Edit, Eye, XCircle } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { paymentsService } from '../../services/payments.service';
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMode, setPayMode] = useState<
    'BANK_TRANSFER' | 'UPI' | 'NEFT_RTGS' | 'CHEQUE' | 'CASH' | 'OTHER'
  >('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payIdempotencyKey, setPayIdempotencyKey] = useState('');
  const [reason, setReason] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'invoice', id],
    queryFn: () => salesService.invoices.getById(id!),
    enabled: Boolean(id),
  });

  const paymentHistoryQuery = useQuery({
    queryKey: ['sales', 'invoice-payments', id],
    queryFn: () => paymentsService.getInvoicePaymentHistory(id!),
    enabled: Boolean(id) && hasPermission('sales.payments.read'),
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

  const recordPaymentMut = useMutation({
    mutationFn: async () => {
      const invData = data?.data;
      if (!invData) throw new Error('Invoice not loaded');
      const outstanding = Number(
        paymentHistoryQuery.data?.data?.outstandingAmount ?? invData.grandTotal,
      );
      const entered = Number(payAmount);
      if (!Number.isFinite(entered) || entered <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }
      const canAllocate = hasPermission('sales.payments.allocate');
      const allocAmt = Math.min(entered, outstanding);
      const allocations =
        canAllocate && allocAmt > 0
          ? [{ salesInvoiceId: invData.id, allocatedAmount: allocAmt.toFixed(2) }]
          : undefined;

      return paymentsService.create({
        customerId: invData.customerId,
        paymentDate: payDate,
        amount: entered.toFixed(2),
        paymentMode: payMode,
        transactionReference: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        idempotencyKey: payIdempotencyKey || undefined,
        allocations,
      });
    },
    onSuccess: res => {
      invalidate();
      setPayOpen(false);
      setActionError(null);
      const payment = res.data;
      setActionSuccess(
        payment
          ? `Payment ${payment.paymentNumber} recorded (Allocated: ₹${payment.allocatedAmount}, Unallocated: ₹${payment.unallocatedAmount}).`
          : 'Payment recorded and allocated successfully.',
      );
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Failed to record payment');
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
  const paymentSummary = paymentHistoryQuery.data?.data;
  const currentOutstanding = Number(
    paymentSummary?.outstandingAmount ?? inv.grandTotal,
  );
  const canEdit = hasPermission('sales.invoices.update') && inv.status === 'DRAFT';
  const canIssue = hasPermission('sales.invoices.issue') && inv.status === 'DRAFT';
  const canCancel = hasPermission('sales.invoices.cancel') && inv.status === 'DRAFT';
  const canDownload = hasPermission('sales.invoices.download');
  const canRecordPayment =
    hasPermission('sales.payments.create') &&
    inv.status === 'ISSUED' &&
    currentOutstanding > 0;

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
          {canRecordPayment && (
            <Button
              size="sm"
              variant="teal"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setPayAmount(currentOutstanding.toFixed(2));
                setPayDate(new Date().toISOString().slice(0, 10));
                setPayRef('');
                setPayNotes('');
                setPayIdempotencyKey(`INV-PAY-${inv.id}-${Date.now()}`);
                setPayOpen(true);
              }}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Record Payment
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

      {actionSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {inv.status === 'ISSUED' && paymentHistoryQuery.data?.data && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm sm:grid-cols-5">
          <div>
            <span className="text-slate-500">Payment Status</span>
            <div className="mt-0.5 font-semibold text-slate-900">
              {paymentHistoryQuery.data.data.paymentStatus}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Invoice Total</span>
            <div className="mt-0.5 font-semibold">₹{paymentHistoryQuery.data.data.grandTotal}</div>
          </div>
          <div>
            <span className="text-slate-500">Paid</span>
            <div className="mt-0.5 font-semibold text-emerald-700">
              ₹{paymentHistoryQuery.data.data.netAllocatedPayments}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Credit Notes</span>
            <div className="mt-0.5 font-semibold text-indigo-700">
              ₹{paymentHistoryQuery.data.data.issuedCreditNotesTotal}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Outstanding</span>
            <div className="mt-0.5 font-semibold text-amber-700">
              ₹{paymentHistoryQuery.data.data.outstandingAmount}
            </div>
          </div>
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

      {/* Payment & Allocation History */}
      {inv.status === 'ISSUED' && paymentSummary && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-brand-navy">Payment &amp; Allocation History</h3>
            <Link
              to="/sales/payments"
              className="text-[11px] font-medium text-brand-blue hover:underline"
            >
              Manage All Payments →
            </Link>
          </div>
          {paymentSummary.allocations.length === 0 ? (
            <p className="text-xs text-slate-500">
              No payments allocated to this invoice yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2">Payment #</th>
                    <th className="px-2.5 py-2">Date</th>
                    <th className="px-2.5 py-2">Mode / Ref</th>
                    <th className="px-2.5 py-2 text-right">Allocated</th>
                    <th className="px-2.5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentSummary.allocations.map(a => (
                    <tr key={a.id} className={a.isReversed ? 'opacity-60' : ''}>
                      <td className="px-2.5 py-2 font-mono font-medium">
                        {a.payment.paymentNumber}
                      </td>
                      <td className="px-2.5 py-2 text-slate-600">
                        {new Date(a.payment.paymentDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-2.5 py-2 text-slate-600">{a.payment.paymentMode}</td>
                      <td className="px-2.5 py-2 text-right font-semibold text-emerald-700">
                        ₹{Number(a.allocatedAmount).toFixed(2)}
                      </td>
                      <td className="px-2.5 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            a.isReversed || a.payment.status === 'REVERSED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {a.isReversed ? 'REVERSED' : a.payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      <Modal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Record Payment – ${inv.invoiceNumber}`}
      >
        <div className="space-y-3 text-xs">
          <div className="rounded-md bg-slate-50 p-2.5 text-slate-700">
            <div>
              <strong>Customer:</strong> {inv.customerLegalName}
            </div>
            <div>
              <strong>Outstanding Balance:</strong> ₹{currentOutstanding.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Payment Date</label>
              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Payment Mode</label>
              <select
                value={payMode}
                onChange={e =>
                  setPayMode(
                    e.target.value as
                      | 'BANK_TRANSFER'
                      | 'UPI'
                      | 'NEFT_RTGS'
                      | 'CHEQUE'
                      | 'CASH'
                      | 'OTHER',
                  )
                }
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="NEFT_RTGS">NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Reference #</label>
              <input
                type="text"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="UTR / Cheque / Ref"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700">Notes</label>
            <input
              type="text"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
              placeholder="Optional payment remarks"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </div>

          {Number(payAmount) > currentOutstanding && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              Entered amount exceeds invoice outstanding (₹{currentOutstanding.toFixed(2)}). ₹
              {currentOutstanding.toFixed(2)} will be allocated to this invoice and ₹
              {(Number(payAmount) - currentOutstanding).toFixed(2)} will remain as unallocated customer advance.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="teal"
              disabled={!payAmount || Number(payAmount) <= 0 || recordPaymentMut.isPending}
              onClick={() => recordPaymentMut.mutate()}
            >
              {recordPaymentMut.isPending ? 'Recording...' : 'Record & Allocate Payment'}
            </Button>
          </div>
        </div>
      </Modal>

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
