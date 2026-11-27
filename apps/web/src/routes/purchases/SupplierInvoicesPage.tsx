import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2, Plus, Search, XCircle } from 'lucide-react';
import { purchasesService, SupplierInvoice } from '../../services/purchases.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/master-data/Modal';

export const SupplierInvoicesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canCreate = hasPermission('purchases.invoices.create');
  const canPost = hasPermission('purchases.invoices.post');
  const canCancel = hasPermission('purchases.invoices.cancel');
  const canMatch = hasPermission('purchases.invoices.match');
  const canUpdate = hasPermission('purchases.invoices.update');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<SupplierInvoice | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [cancelTarget, setCancelTarget] = useState<SupplierInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create form
  const [supplierId, setSupplierId] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [uomId, setUomId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxRatePercent, setTaxRatePercent] = useState('5');

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchases', 'invoices', page, search, status],
    queryFn: () =>
      purchasesService.list({
        page,
        limit: 15,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const suppliersQuery = useQuery({
    queryKey: ['master-data', 'suppliers', 'all'],
    queryFn: () => masterDataService.suppliers.list({ limit: 100 }),
    enabled: createOpen,
  });

  const factoriesQuery = useQuery({
    queryKey: ['master-data', 'factories'],
    queryFn: () => masterDataService.factories.list(),
    enabled: createOpen,
  });

  const itemsQuery = useQuery({
    queryKey: ['master-data', 'inventory-items'],
    queryFn: () => masterDataService.inventoryItems.list(),
    enabled: createOpen,
  });

  const uomsQuery = useQuery({
    queryKey: ['master-data', 'uoms', 'all'],
    queryFn: () => masterDataService.uoms.list({ limit: 100 }),
    enabled: createOpen,
  });

  const unmatchedQuery = useQuery({
    queryKey: ['purchases', 'unmatched-receipts'],
    queryFn: () => purchasesService.getUnmatchedReceipts(),
    enabled: Boolean(matchTarget),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['purchases'] });

  const createMut = useMutation({
    mutationFn: () =>
      purchasesService.createDraft({
        supplierId,
        factoryId,
        supplierInvoiceNumber,
        invoiceDate,
        lines: [
          {
            inventoryItemId,
            uomId,
            quantity,
            unitPrice,
            taxRatePercent,
          },
        ],
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setSupplierInvoiceNumber('');
      setQuantity('');
      setUnitPrice('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to create supplier invoice'),
  });

  const postMut = useMutation({
    mutationFn: (id: string) => purchasesService.post(id),
    onSuccess: () => {
      invalidate();
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to post invoice'),
  });

  const cancelMut = useMutation({
    mutationFn: () => purchasesService.cancel(cancelTarget!.id, cancelReason),
    onSuccess: () => {
      invalidate();
      setCancelTarget(null);
      setCancelReason('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel invoice'),
  });

  const matchMut = useMutation({
    mutationFn: () => purchasesService.matchReceipts(matchTarget!.id, [selectedReceiptId]),
    onSuccess: () => {
      invalidate();
      setMatchTarget(null);
      setSelectedReceiptId('');
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to match receipt'),
  });

  const itcMut = useMutation({
    mutationFn: ({ id, itcStatus }: { id: string; itcStatus: string }) =>
      purchasesService.updateItc(id, itcStatus),
    onSuccess: () => {
      invalidate();
      setErrorMsg(null);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to update ITC status'),
  });

  const rows = data?.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier inv # or supplier..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="POSTED">POSTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Supplier Invoice
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
          Loading supplier invoices...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load supplier invoices'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No supplier purchase invoices recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Internal #</th>
                <th className="px-3 py-2.5">Supplier Inv #</th>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5 text-right">Taxable</th>
                <th className="px-3 py-2.5 text-right">GST</th>
                <th className="px-3 py-2.5 text-right">Grand Total</th>
                <th className="px-3 py-2.5">Match</th>
                <th className="px-3 py-2.5">ITC Status</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{inv.internalInvoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-700">{inv.supplierInvoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-700">{inv.supplierLegalName}</td>
                  <td className="px-3 py-2 text-right">₹{inv.taxableValue}</td>
                  <td className="px-3 py-2 text-right">₹{inv.taxAmount}</td>
                  <td className="px-3 py-2 text-right font-semibold">₹{inv.grandTotal}</td>
                  <td className="px-3 py-2">{inv.matchingStatus}</td>
                  <td className="px-3 py-2">
                    {canUpdate && inv.status !== 'CANCELLED' ? (
                      <select
                        aria-label={`ITC status for ${inv.internalInvoiceNumber}`}
                        value={inv.itcStatus}
                        onChange={e => itcMut.mutate({ id: inv.id, itcStatus: e.target.value })}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                        <option value="ELIGIBLE">ELIGIBLE</option>
                        <option value="INELIGIBLE">INELIGIBLE</option>
                      </select>
                    ) : (
                      inv.itcStatus
                    )}
                  </td>
                  <td className="px-3 py-2">{inv.status}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {canPost && inv.status === 'DRAFT' && (
                        <Button size="sm" onClick={() => postMut.mutate(inv.id)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Post
                        </Button>
                      )}
                      {canMatch && inv.status !== 'CANCELLED' && (
                        <Button size="sm" variant="outline" onClick={() => setMatchTarget(inv)}>
                          <Link2 className="mr-1 h-3 w-3" /> Match
                        </Button>
                      )}
                      {canCancel && inv.status !== 'CANCELLED' && (
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(inv)}>
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

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Supplier Purchase Invoice">
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Supplier</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                <option value="">Select supplier...</option>
                {(suppliersQuery.data?.data?.items || []).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Factory</label>
              <select
                value={factoryId}
                onChange={e => setFactoryId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                <option value="">Select factory...</option>
                {(factoriesQuery.data?.data || []).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Supplier Invoice #</label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={e => setSupplierInvoiceNumber(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Inventory Item</label>
              <select
                value={inventoryItemId}
                onChange={e => setInventoryItemId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                <option value="">Select item...</option>
                {(itemsQuery.data?.data?.items || []).map(it => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">UOM</label>
              <select
                value={uomId}
                onChange={e => setUomId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                <option value="">Select UOM...</option>
                {(uomsQuery.data?.data?.items || []).map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Unit Price</label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">GST %</label>
              <input
                type="number"
                step="0.01"
                value={taxRatePercent}
                onChange={e => setTaxRatePercent(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !supplierId ||
                !factoryId ||
                !supplierInvoiceNumber ||
                !inventoryItemId ||
                !uomId ||
                !quantity ||
                !unitPrice ||
                createMut.isPending
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Saving...' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(matchTarget)}
        onClose={() => setMatchTarget(null)}
        title={`Match Receipt to ${matchTarget?.internalInvoiceNumber ?? ''}`}
      >
        <div className="space-y-3 text-xs">
          <select
            value={selectedReceiptId}
            onChange={e => setSelectedReceiptId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
          >
            <option value="">Select posted inventory receipt...</option>
            {(unmatchedQuery.data?.data || []).map(r => (
              <option key={r.id} value={r.id}>
                {r.receiptNumber} — {r.warehouse.name} ({new Date(r.receiptDate).toLocaleDateString('en-IN')})
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setMatchTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedReceiptId || matchMut.isPending}
              onClick={() => matchMut.mutate()}
            >
              {matchMut.isPending ? 'Matching...' : 'Match Receipt'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel ${cancelTarget?.internalInvoiceNumber ?? ''}`}
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
