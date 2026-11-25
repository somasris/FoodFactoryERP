import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

interface TransferLineForm {
  inventoryItemId: string;
  uomId: string;
  quantity: string;
}

export const WarehouseTransfersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'dispatch' | 'receive' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLineForm[]>([{ inventoryItemId: '', uomId: '', quantity: '' }]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'transfers', page, statusFilter],
    queryFn: () => inventoryService.transfers.list({ page, limit: 20, status: statusFilter || undefined }),
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
    mutationFn: (payload: Record<string, unknown>) => inventoryService.transfers.create(payload),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Failed to create transfer'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'dispatch' | 'receive' | 'cancel' }) =>
      inventoryService.transfers[action](id),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
      setFormError(null);
    },
    onError: err => {
      setConfirmAction(null);
      setFormError(err instanceof Error ? err.message : 'Action failed');
    },
  });

  const transfers = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('inventory.transfer.create');
  const canApprove = hasPermission('inventory.transfer.approve');
  const canDispatch = hasPermission('inventory.transfer.dispatch');
  const canReceive = hasPermission('inventory.transfer.receive');

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Warehouse Transfers</h2>
          <p className="text-xs text-slate-500">
            Inter-warehouse stock movement: DRAFT → APPROVED → IN_TRANSIT (dispatch) → RECEIVED.
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
            <option value="APPROVED">Approved</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="RECEIVED">Received</option>
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
              <Plus className="h-3.5 w-3.5" /> New Transfer
            </Button>
          )}
        </div>
      </div>

      {formError && !isModalOpen && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{formError}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading transfers...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load transfers'}
        </div>
      ) : transfers.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No warehouse transfers found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Transfer #</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.map(trf => (
                <tr key={trf.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">
                    {trf.transferNumber}
                  </td>
                  <td className="px-3 py-2">{trf.sourceWarehouse.code}</td>
                  <td className="px-3 py-2">{trf.destinationWarehouse.code}</td>
                  <td className="px-3 py-2">
                    {trf.lines.map(l => (
                      <div key={l.id} className="text-[11px]">
                        {l.inventoryItem?.code}: {Number(l.quantity).toFixed(2)} {l.uom?.symbol}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={trf.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {trf.status === 'DRAFT' && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: trf.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                      )}
                      {trf.status === 'APPROVED' && canDispatch && (
                        <Button
                          size="sm"
                          onClick={() => setConfirmAction({ id: trf.id, action: 'dispatch' })}
                        >
                          Dispatch
                        </Button>
                      )}
                      {trf.status === 'IN_TRANSIT' && canReceive && (
                        <Button
                          size="sm"
                          onClick={() => setConfirmAction({ id: trf.id, action: 'receive' })}
                        >
                          Receive
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
        title="Create Warehouse Transfer"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            setFormError(null);
            if (sourceWarehouseId === destinationWarehouseId) {
              return setFormError('Source and destination warehouses must be different.');
            }
            createMutation.mutate({
              sourceWarehouseId,
              destinationWarehouseId,
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              lines,
            });
          }}
          className="space-y-4"
        >
          {formError && <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Source Warehouse *</label>
              <select
                required
                value={sourceWarehouseId}
                onChange={e => setSourceWarehouseId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="">Select source...</option>
                {warehousesData?.data?.items.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Destination Warehouse *
              </label>
              <select
                required
                value={destinationWarehouseId}
                onChange={e => setDestinationWarehouseId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="">Select destination...</option>
                {warehousesData?.data?.items.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Transfer Lines</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLines(prev => [...prev, { inventoryItemId: '', uomId: '', quantity: '' }])}
              >
                + Add Line
              </Button>
            </div>
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-4"
              >
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
            ))}
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
              {createMutation.isPending ? 'Saving...' : 'Create Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actionMutation.mutate(confirmAction)}
        title={confirmAction?.action === 'dispatch' ? 'Dispatch Warehouse Transfer' : 'Receive Warehouse Transfer'}
        message={
          confirmAction?.action === 'dispatch'
            ? 'Dispatching will deduct stock from the source warehouse and mark the transfer IN_TRANSIT. Continue?'
            : 'Receiving will credit stock to the destination warehouse and complete the transfer. Continue?'
        }
        confirmLabel={confirmAction?.action === 'dispatch' ? 'Confirm Dispatch' : 'Confirm Receipt'}
        isLoading={actionMutation.isPending}
      />
    </div>
  );
};
