import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

interface ReceiptLineForm {
  inventoryItemId: string;
  uomId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
}

export const InventoryReceiptsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postTargetId, setPostTargetId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceiptLineForm[]>([
    { inventoryItemId: '', uomId: '', quantity: '', unitCost: '', batchNumber: '', manufacturingDate: '', expiryDate: '' },
  ]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'receipts', page, statusFilter],
    queryFn: () => inventoryService.receipts.list({ page, limit: 20, status: statusFilter || undefined }),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['master-data', 'warehouses', 'active'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100, isActive: true }),
  });

  const { data: itemsData } = useQuery({
    queryKey: ['master-data', 'inventory-items', 'active'],
    queryFn: () => masterDataService.inventoryItems.list({ limit: 200, isActive: true }),
  });

  const { data: uomsData } = useQuery({
    queryKey: ['master-data', 'uoms', 'active'],
    queryFn: () => masterDataService.uoms.list({ limit: 100, isActive: true }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => inventoryService.receipts.create(payload),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Failed to create receipt'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'approve' | 'post' | 'cancel' }) =>
      inventoryService.receipts[action](id),
    onSuccess: () => {
      invalidate();
      setPostTargetId(null);
      setFormError(null);
    },
    onError: err => {
      setPostTargetId(null);
      setFormError(err instanceof Error ? err.message : 'Action failed');
    },
  });

  const receipts = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('inventory.receipt.create');
  const canApprove = hasPermission('inventory.receipt.approve');
  const canPost = hasPermission('inventory.receipt.post');

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!warehouseId) return setFormError('Please select a warehouse.');
    const preparedLines = lines.map(l => ({
      inventoryItemId: l.inventoryItemId,
      uomId: l.uomId,
      quantity: l.quantity,
      unitCost: l.unitCost || '0',
      ...(l.batchNumber.trim() ? { batchNumber: l.batchNumber.trim() } : {}),
      ...(l.manufacturingDate ? { manufacturingDate: l.manufacturingDate } : {}),
      ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}),
    }));
    createMutation.mutate({
      warehouseId,
      ...(supplierRef.trim() ? { supplierRef: supplierRef.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lines: preparedLines,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Inventory Receipts</h2>
          <p className="text-xs text-slate-500">
            Record inward stock with batch details, unit conversions, and MWAC valuation updates upon posting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Receipt
            </Button>
          )}
        </div>
      </div>

      {formError && !isModalOpen && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{formError}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading receipts...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load receipts'}
        </div>
      ) : receipts.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No inventory receipts found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Receipt #</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Supplier Ref</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map(rcp => (
                <tr key={rcp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">
                    {rcp.receiptNumber}
                  </td>
                  <td className="px-3 py-2">{rcp.warehouse.code}</td>
                  <td className="px-3 py-2 text-slate-600">{rcp.supplierRef || '—'}</td>
                  <td className="px-3 py-2">
                    {rcp.lines.map(l => (
                      <div key={l.id} className="text-[11px]">
                        {l.inventoryItem?.code}: {Number(l.quantity).toFixed(2)} {l.uom?.symbol} @ ₹
                        {Number(l.unitCost).toFixed(2)}
                        {l.batchNumber ? ` [${l.batchNumber}]` : ''}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={rcp.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(rcp.receiptDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {rcp.status === 'DRAFT' && canCreate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: rcp.id, action: 'submit' })}
                        >
                          Submit
                        </Button>
                      )}
                      {(rcp.status === 'DRAFT' || rcp.status === 'SUBMITTED') && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: rcp.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                      )}
                      {rcp.status === 'APPROVED' && canPost && (
                        <Button size="sm" onClick={() => setPostTargetId(rcp.id)}>
                          Post
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Inventory Receipt"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Warehouse *</label>
              <select
                required
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="">Select warehouse...</option>
                {warehousesData?.data?.items.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Supplier Reference</label>
              <input
                type="text"
                value={supplierRef}
                onChange={e => setSupplierRef(e.target.value)}
                placeholder="e.g. CHALLAN-1042"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Receipt Lines</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLines(prev => [
                    ...prev,
                    {
                      inventoryItemId: '',
                      uomId: '',
                      quantity: '',
                      unitCost: '',
                      batchNumber: '',
                      manufacturingDate: '',
                      expiryDate: '',
                    },
                  ])
                }
              >
                + Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <select
                      required
                      value={line.inventoryItemId}
                      onChange={e => {
                        const val = e.target.value;
                        const found = itemsData?.data?.items.find(it => it.id === val);
                        setLines(prev =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, inventoryItemId: val, uomId: found?.uomId || l.uomId } : l,
                          ),
                        );
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                    >
                      <option value="">Select Item...</option>
                      {itemsData?.data?.items.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.code} — {it.name}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      value={line.uomId}
                      onChange={e =>
                        setLines(prev => prev.map((l, i) => (i === idx ? { ...l, uomId: e.target.value } : l)))
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="">UOM...</option>
                      {uomsData?.data?.items.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.code} ({u.symbol})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <input
                        required
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={e =>
                          setLines(prev =>
                            prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)),
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input
                      required
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="Unit Cost (₹)"
                      value={line.unitCost}
                      onChange={e =>
                        setLines(prev => prev.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)))
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Batch # (optional)"
                      value={line.batchNumber}
                      onChange={e =>
                        setLines(prev =>
                          prev.map((l, i) => (i === idx ? { ...l, batchNumber: e.target.value } : l)),
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    <input
                      type="date"
                      title="Manufacturing Date"
                      value={line.manufacturingDate}
                      onChange={e =>
                        setLines(prev =>
                          prev.map((l, i) => (i === idx ? { ...l, manufacturingDate: e.target.value } : l)),
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    <input
                      type="date"
                      title="Expiry Date"
                      value={line.expiryDate}
                      onChange={e =>
                        setLines(prev =>
                          prev.map((l, i) => (i === idx ? { ...l, expiryDate: e.target.value } : l)),
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create Draft Receipt'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(postTargetId)}
        onClose={() => setPostTargetId(null)}
        onConfirm={() => postTargetId && actionMutation.mutate({ id: postTargetId, action: 'post' })}
        title="Post Inventory Receipt"
        message="Posting this receipt will update warehouse stock balances, create batches, recalculate MWAC, and write an immutable ledger entry. Continue?"
        confirmLabel="Post Receipt"
        isLoading={actionMutation.isPending}
      />
    </div>
  );
};
