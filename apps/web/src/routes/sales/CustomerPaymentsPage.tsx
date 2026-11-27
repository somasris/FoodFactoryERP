import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, CheckCircle2, Search } from 'lucide-react';
import { paymentsService, CustomerPayment } from '../../services/payments.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/master-data/Modal';

export const CustomerPaymentsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canCreate = hasPermission('sales.payments.create');
  const canAllocate = hasPermission('sales.payments.allocate');
  const canReverse = hasPermission('sales.payments.reverse');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [allocPayment, setAllocPayment] = useState<CustomerPayment | null>(null);
  const [reverseTarget, setReverseTarget] = useState<CustomerPayment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create form state
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [txRef, setTxRef] = useState('');
  const [notes, setNotes] = useState('');

  // Allocation form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'payments', page, search, status],
    queryFn: () =>
      paymentsService.list({
        page,
        limit: 15,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const customersQuery = useQuery({
    queryKey: ['master-data', 'customers', 'all'],
    queryFn: () => masterDataService.customers.list({ limit: 100 }),
    enabled: createOpen,
  });

  const receivablesQuery = useQuery({
    queryKey: ['sales', 'receivables', allocPayment?.customerId],
    queryFn: () => paymentsService.getReceivables({ customerId: allocPayment?.customerId }),
    enabled: Boolean(allocPayment?.customerId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sales'] });

  const createMut = useMutation({
    mutationFn: () =>
      paymentsService.create({
        customerId,
        amount,
        paymentMode,
        transactionReference: txRef || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setCustomerId('');
      setAmount('');
      setTxRef('');
      setNotes('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to record payment'),
  });

  const allocateMut = useMutation({
    mutationFn: () =>
      paymentsService.allocate(allocPayment!.id, [
        { salesInvoiceId: selectedInvoiceId, allocatedAmount: allocAmount },
      ]),
    onSuccess: () => {
      invalidate();
      setAllocPayment(null);
      setSelectedInvoiceId('');
      setAllocAmount('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to allocate payment'),
  });

  const reverseMut = useMutation({
    mutationFn: () => paymentsService.reverse(reverseTarget!.id, reverseReason),
    onSuccess: () => {
      invalidate();
      setReverseTarget(null);
      setReverseReason('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to reverse payment'),
  });

  const rows = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const openInvoices = (receivablesQuery.data?.data?.invoices || []).filter(
    i => Number(i.outstandingAmount) > 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search payment # or customer..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-brand-blue focus:outline-none"
            />
          </div>
          <select
            aria-label="Filter by payment status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-blue focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="RECORDED">RECORDED</option>
            <option value="REVERSED">REVERSED</option>
          </select>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record Payment
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
          Loading customer payments...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load payments'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No customer payments recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Payment #</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Mode / Ref</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Allocated</th>
                <th className="px-3 py-2.5 text-right">Unallocated</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{p.paymentNumber}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{p.customer.legalName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.paymentMode}
                    {p.transactionReference ? ` (${p.transactionReference})` : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    ₹{Number(p.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    ₹{Number(p.allocatedAmount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-700">
                    ₹{Number(p.unallocatedAmount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.status === 'RECORDED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {canAllocate && p.status === 'RECORDED' && Number(p.unallocatedAmount) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAllocPayment(p);
                            setAllocAmount(p.unallocatedAmount);
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Allocate
                        </Button>
                      )}
                      {canReverse && p.status === 'RECORDED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReverseTarget(p)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Reverse
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Prev
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

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Record Customer Payment">
        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-slate-700">Customer</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            >
              <option value="">Select customer...</option>
              {(customersQuery.data?.data?.items || []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.legalName} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
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
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Transaction Reference</label>
            <input
              type="text"
              value={txRef}
              onChange={e => setTxRef(e.target.value)}
              placeholder="UTR / Cheque # / Ref"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
              disabled={!customerId || !amount || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Saving...' : 'Save Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(allocPayment)}
        onClose={() => setAllocPayment(null)}
        title={`Allocate ${allocPayment?.paymentNumber ?? ''}`}
      >
        <div className="space-y-3 text-xs">
          <div className="rounded-md bg-slate-50 p-2.5 text-slate-700">
            Unallocated Balance: <strong>₹{allocPayment?.unallocatedAmount}</strong>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Issued Invoice</label>
            <select
              value={selectedInvoiceId}
              onChange={e => {
                setSelectedInvoiceId(e.target.value);
                const inv = openInvoices.find(i => i.invoiceId === e.target.value);
                if (inv && allocPayment) {
                  const max = Math.min(
                    Number(inv.outstandingAmount),
                    Number(allocPayment.unallocatedAmount),
                  );
                  setAllocAmount(max.toFixed(2));
                }
              }}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            >
              <option value="">Select invoice...</option>
              {openInvoices.map(inv => (
                <option key={inv.invoiceId} value={inv.invoiceId}>
                  {inv.invoiceNumber} — Outstanding: ₹{inv.outstandingAmount}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Allocate Amount (INR)</label>
            <input
              type="number"
              step="0.01"
              value={allocAmount}
              onChange={e => setAllocAmount(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAllocPayment(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedInvoiceId || !allocAmount || allocateMut.isPending}
              onClick={() => allocateMut.mutate()}
            >
              {allocateMut.isPending ? 'Allocating...' : 'Confirm Allocation'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(reverseTarget)}
        onClose={() => setReverseTarget(null)}
        title={`Reverse Payment ${reverseTarget?.paymentNumber ?? ''}`}
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Reversing this payment will mark all its invoice allocations as reversed and recalculate
            invoice outstanding balances while preserving full audit history.
          </p>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Reason (required)</label>
            <textarea
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setReverseTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reverseReason.trim().length < 3 || reverseMut.isPending}
              onClick={() => reverseMut.mutate()}
            >
              {reverseMut.isPending ? 'Reversing...' : 'Reverse Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
