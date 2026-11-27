import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RotateCcw } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { useAuth } from '../../hooks/useAuth';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/master-data/Modal';

export const InventoryTransactionsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'transactions', page, search, transactionType],
    queryFn: () =>
      inventoryService.transactions({
        page,
        limit: 20,
        search: search || undefined,
        transactionType: transactionType || undefined,
      }),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryService.reverseTransaction(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setReverseTargetId(null);
      setReverseReason('');
      setActionError(null);
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Failed to reverse transaction');
    },
  });

  const items = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canReverse = hasPermission('inventory.adjustment.post');

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Inventory Transaction History</h2>
          <p className="text-xs text-slate-500">
            Immutable append-only stock ledger. Corrections are recorded via compensating reversals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search txn # or ref #..."
              className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={transactionType}
            onChange={e => {
              setTransactionType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Types</option>
            <option value="RECEIPT">Receipt</option>
            <option value="ISSUE">Issue</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="ADJUSTMENT_IN">Adjustment In</option>
            <option value="ADJUSTMENT_OUT">Adjustment Out</option>
            <option value="REVERSAL">Reversal</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading transaction ledger...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load transactions'}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No inventory transactions found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Txn #</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Items / Qty</th>
                <th className="px-3 py-2">Posted By</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">
                    {tx.transactionNumber}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={tx.transactionType} />
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600">{tx.referenceNumber}</td>
                  <td className="px-3 py-2">{tx.warehouse.code}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      {tx.lines?.map(l => (
                        <div key={l.id} className="text-[11px]">
                          <span className="font-mono font-medium">{l.inventoryItem?.code}</span>:{' '}
                          <span
                            className={
                              Number(l.baseQuantity) >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }
                          >
                            {Number(l.baseQuantity) >= 0 ? '+' : ''}
                            {Number(l.baseQuantity).toFixed(3)} {l.baseUom?.symbol}
                          </span>
                          {l.batch && <span className="text-slate-400"> ({l.batch.batchNumber})</span>}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{tx.postedBy?.fullName || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(tx.transactionDate).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {tx.reversalOf ? (
                      <span className="text-[11px] text-slate-400">
                        Reversed by {tx.reversalOf.transactionNumber}
                      </span>
                    ) : (
                      canReverse &&
                      tx.transactionType !== 'REVERSAL' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReverseTargetId(tx.id);
                            setActionError(null);
                          }}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <RotateCcw className="h-3 w-3" /> Reverse
                        </Button>
                      )
                    )}
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
        isOpen={Boolean(reverseTargetId)}
        onClose={() => setReverseTargetId(null)}
        title="Reverse Posted Transaction"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (reverseTargetId && reverseReason.trim().length >= 3) {
              reverseMutation.mutate({ id: reverseTargetId, reason: reverseReason.trim() });
            }
          }}
          className="space-y-4"
        >
          <p className="text-xs text-slate-600">
            This will create a compensating REVERSAL ledger entry without modifying the original posted transaction.
          </p>
          {actionError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{actionError}</div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Reversal Reason *</label>
            <textarea
              required
              minLength={3}
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
              rows={3}
              placeholder="Explain why this transaction is being reversed..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReverseTargetId(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reverseMutation.isPending || reverseReason.trim().length < 3}>
              {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
