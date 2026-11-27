import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

interface IssueLineForm {
  inventoryItemId: string;
  uomId: string;
  requestedQuantity: string;
}

export const InventoryIssuesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postTargetId, setPostTargetId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [pickingStrategy, setPickingStrategy] = useState<'FEFO' | 'FIFO'>('FEFO');
  const [purpose, setPurpose] = useState('');
  const [lines, setLines] = useState<IssueLineForm[]>([
    { inventoryItemId: '', uomId: '', requestedQuantity: '' },
  ]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'issues', page, statusFilter],
    queryFn: () => inventoryService.issues.list({ page, limit: 20, status: statusFilter || undefined }),
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
    mutationFn: (payload: Record<string, unknown>) => inventoryService.issues.create(payload),
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Failed to create issue'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'approve' | 'post' | 'cancel' }) =>
      inventoryService.issues[action](id),
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

  const issues = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canCreate = hasPermission('inventory.issue.create');
  const canApprove = hasPermission('inventory.issue.approve');
  const canPost = hasPermission('inventory.issue.post');

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Inventory Issues</h2>
          <p className="text-xs text-slate-500">
            Outward stock issuance with FEFO/FIFO batch picking, expiry validation, and negative stock prevention.
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
              <Plus className="h-3.5 w-3.5" /> New Issue
            </Button>
          )}
        </div>
      </div>

      {formError && !isModalOpen && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{formError}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading issues...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load issues'}
        </div>
      ) : issues.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No inventory issues found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Issue #</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Strategy</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map(iss => (
                <tr key={iss.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">{iss.issueNumber}</td>
                  <td className="px-3 py-2">{iss.warehouse.code}</td>
                  <td className="px-3 py-2 font-mono">{iss.pickingStrategy}</td>
                  <td className="px-3 py-2 text-slate-600">{iss.purpose || '—'}</td>
                  <td className="px-3 py-2">
                    {iss.lines.map(l => (
                      <div key={l.id} className="text-[11px]">
                        {l.inventoryItem?.code}: {Number(l.requestedQuantity).toFixed(2)} {l.uom?.symbol}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={iss.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {iss.status === 'DRAFT' && canCreate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: iss.id, action: 'submit' })}
                        >
                          Submit
                        </Button>
                      )}
                      {(iss.status === 'DRAFT' || iss.status === 'SUBMITTED') && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: iss.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                      )}
                      {iss.status === 'APPROVED' && canPost && (
                        <Button size="sm" onClick={() => setPostTargetId(iss.id)}>
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
        title="Create Inventory Issue"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            setFormError(null);
            createMutation.mutate({
              warehouseId,
              pickingStrategy,
              ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
              lines,
            });
          }}
          className="space-y-4"
        >
          {formError && <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <label className="mb-1 block text-xs font-medium text-slate-700">Picking Strategy *</label>
              <select
                value={pickingStrategy}
                onChange={e => setPickingStrategy(e.target.value as 'FEFO' | 'FIFO')}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="FEFO">FEFO (Earliest Expiry First)</option>
                <option value="FIFO">FIFO (Oldest Receipt First)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="e.g. Line 1 Production"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Issue Lines</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLines(prev => [...prev, { inventoryItemId: '', uomId: '', requestedQuantity: '' }])}
              >
                + Add Line
              </Button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-4">
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
                    value={line.requestedQuantity}
                    onChange={e =>
                      setLines(prev =>
                        prev.map((l, i) => (i === idx ? { ...l, requestedQuantity: e.target.value } : l)),
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create Draft Issue'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(postTargetId)}
        onClose={() => setPostTargetId(null)}
        onConfirm={() => postTargetId && actionMutation.mutate({ id: postTargetId, action: 'post' })}
        title="Post Inventory Issue"
        message="Posting this issue will allocate non-expired batches using the selected picking strategy, deduct stock, and record an immutable ledger entry. Continue?"
        confirmLabel="Post Issue"
        isLoading={actionMutation.isPending}
      />
    </div>
  );
};
