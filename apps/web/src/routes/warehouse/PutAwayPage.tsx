import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const PutAwayPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [toBinId, setToBinId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: binsRes } = useQuery({
    queryKey: ['warehouse', 'bins', warehouseId],
    queryFn: () => warehouseService.listBins(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const suggestMut = useMutation({
    mutationFn: () =>
      warehouseService.suggestPutAway({
        warehouseId,
        inventoryItemId,
        batchId: batchId || undefined,
        quantity,
      }),
    onError: e => setError(e instanceof Error ? e.message : 'Failed to fetch suggestions'),
  });

  const putAwayMut = useMutation({
    mutationFn: () =>
      warehouseService.putAway({
        warehouseId,
        toBinId,
        inventoryItemId,
        batchId: batchId || null,
        quantity,
      }),
    onSuccess: res => {
      setError(null);
      setMessage(`Put-away recorded: ${res.data?.movementNumber}`);
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: e => {
      setMessage(null);
      setError(e instanceof Error ? e.message : 'Put-away failed');
    },
  });

  const bins = binsRes?.data ?? [];
  const suggestions = suggestMut.data?.data?.suggestions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Put-Away Operations</h1>
          <p className="text-xs text-[#66756A]">
            Get capacity & storage-condition put-away suggestions, then confirm bin placement.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={inventoryItemId}
            onChange={e => setInventoryItemId(e.target.value)}
            placeholder="Inventory Item UUID"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 font-mono text-xs"
          />
          <input
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            placeholder="Batch UUID (optional)"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 font-mono text-xs"
          />
          <input
            type="number"
            min="0.0001"
            step="0.0001"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Quantity"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={!warehouseId || !inventoryItemId || suggestMut.isPending}
            onClick={() => suggestMut.mutate()}
            className="rounded border border-[#245C3A] bg-[#EAF1E8] px-3 py-1.5 text-xs font-semibold text-[#17452C] hover:bg-[#dce8d9] disabled:opacity-50"
          >
            Suggest Put-Away Bins
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[#17452C]">Recommended Bins (click to select):</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s.binId}
                  type="button"
                  onClick={() => setToBinId(s.binId)}
                  className={`rounded border px-2.5 py-1.5 text-left text-[11px] ${
                    toBinId === s.binId
                      ? 'border-[#245C3A] bg-[#EAF1E8]'
                      : 'border-[#E1E7DD] bg-[#FAFBF8]'
                  }`}
                >
                  <div className="font-mono font-bold text-[#17452C]">{s.binCode}</div>
                  <div className="text-[#66756A]">
                    Avail: {s.availableCapacity} · {s.storageCondition}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F0F4ED]">
          <select
            value={toBinId}
            onChange={e => setToBinId(e.target.value)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Select destination bin...</option>
            {bins.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name} ({b.storageCondition})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!warehouseId || !toBinId || !inventoryItemId || putAwayMut.isPending}
            onClick={() => putAwayMut.mutate()}
            className="rounded bg-[#245C3A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            Confirm Put-Away
          </button>
        </div>

        {message && <p className="text-xs font-medium text-[#17452C]">{message}</p>}
        {error && <p className="text-xs text-[#C74440]">{error}</p>}
      </div>
    </div>
  );
};
