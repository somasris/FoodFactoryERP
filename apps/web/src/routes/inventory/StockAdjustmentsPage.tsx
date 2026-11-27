import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';
import { AdjustmentReason } from '../../types/inventory';

interface AdjLineForm {
  inventoryItemId: string;
  uomId: string;
  quantityDelta: string;
  unitCost: string;
}

export const StockAdjustmentsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postTargetId, setPostTargetId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('PHYSICAL_COUNT');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AdjLineForm[]>([
    { inventoryItemId: '', uomId: '', quantityDelta: '', unitCost: '' },
  ]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'adjustments', page, statusFilter],
    queryFn: () => inventoryService.adjustments.list({ page, limit: 20, status: statusFilter || undefined }),
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => inventoryService.adjustments.create(payload),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Failed to create adjustment'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'approve' | 'post' | 'cancel' }) =>
      inventoryService.adjustments[action](id),
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

  const adjustments = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('inventory.adjustment.create');
  const canApprove = hasPermission('inventory.adjustment.approve');
  const canPost = hasPermission('inventory.adjustment.post');

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Stock Adjustments</h2>
          <p className="text-xs text-slate-500">
            Record physical count variances, damage, or spoilage with full approval and audit trail.
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
              <Plus className="h-3.5 w-3.5" /> New Adjustment
            </Button>
          )}
        </div>
      </div>

      {formError && !isModalOpen && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{formError}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading adjustments...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load adjustments'}
        </div>
      ) : adjustments.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No stock adjustments found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Adjustment #</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Lines (Delta)</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.map(adj => (
                <tr key={adj.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">
                    {adj.adjustmentNumber}
                  </td>
                  <td className="px-3 py-2">{adj.warehouse.code}</td>
                  <td className="px-3 py-2 font-mono">{adj.reason}</td>
                  <td className="px-3 py-2">
                    {adj.lines.map(l => (
                      <div key={l.id} className="text-[11px]">
                        {l.inventoryItem?.code}:{' '}
                        <span className={Number(l.quantityDelta) >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {Number(l.quantityDelta) >= 0 ? '+' : ''}
                          {Number(l.quantityDelta).toFixed(3)} {l.uom?.symbol}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={adj.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {adj.status === 'DRAFT' && canCreate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: adj.id, action: 'submit' })}
                        >
                          Submit
                        </Button>
                      )}
                      {(adj.status === 'DRAFT' || adj.status === 'SUBMITTED') && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: adj.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                      )}
                      {adj.status === 'APPROVED' && canPost && (
                        <Button size="sm" onClick={() => setPostTargetId(adj.id)}>
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
        title="Create Stock Adjustment"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            setFormError(null);
            createMutation.mutate({
              warehouseId,
              reason,
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              lines: lines.map(l => ({
                inventoryItemId: l.inventoryItemId,
                uomId: l.uomId,
                quantityDelta: l.quantityDelta,
                ...(l.unitCost ? { unitCost: l.unitCost } : {}),
              })),
            });
          }}
          className="space-y-4"
        >
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
              <label className="mb-1 block text-xs font-medium text-slate-700">Reason *</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as AdjustmentReason)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="PHYSICAL_COUNT">Physical Count</option>
                <option value="DAMAGE">Damage</option>
                <option value="SPOILAGE">Spoilage</option>
                <option value="EXPIRY">Expiry</option>
                <option value="SHRINKAGE">Shrinkage</option>
                <option value="OPENING_STOCK">Opening Stock</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Adjustment Lines</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLines(prev => [...prev, { inventoryItemId: '', uomId: '', quantityDelta: '', unitCost: '' }])
                }
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
                    placeholder="Delta (+/-)"
                    value={line.quantityDelta}
                    onChange={e =>
                      setLines(prev =>
                        prev.map((l, i) => (i === idx ? { ...l, quantityDelta: e.target.value } : l)),
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
              {createMutation.isPending ? 'Saving...' : 'Create Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(postTargetId)}
        onClose={() => setPostTargetId(null)}
        onConfirm={() => postTargetId && actionMutation.mutate({ id: postTargetId, action: 'post' })}
        title="Post Stock Adjustment"
        message="Posting this adjustment will update stock balances and append an immutable adjustment transaction to the ledger. Continue?"
        confirmLabel="Post Adjustment"
        isLoading={actionMutation.isPending}
      />
    </div>
  );
};
