import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const BinTransfersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [fromBinId, setFromBinId] = useState('');
  const [toBinId, setToBinId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: binsRes } = useQuery({
    queryKey: ['warehouse', 'bins', warehouseId],
    queryFn: () => warehouseService.listBins(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const transferMut = useMutation({
    mutationFn: () =>
      warehouseService.binTransfer({
        warehouseId,
        fromBinId,
        toBinId,
        inventoryItemId,
        batchId: batchId || null,
        quantity,
        notes: notes || undefined,
      }),
    onSuccess: res => {
      setError(null);
      setMessage(`Balanced bin transfer completed: ${res.data?.movementNumber}`);
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: e => {
      setMessage(null);
      setError(e instanceof Error ? e.message : 'Bin transfer failed');
    },
  });

  const bins = binsRes?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Bin-to-Bin Transfers</h1>
          <p className="text-xs text-[#66756A]">
            Move partial or full stock quantities between bins while preserving total warehouse balance.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          transferMut.mutate();
        }}
        className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            required
            value={fromBinId}
            onChange={e => setFromBinId(e.target.value)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Source Bin...</option>
            {bins.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
          <select
            required
            value={toBinId}
            onChange={e => setToBinId(e.target.value)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Destination Bin...</option>
            {bins.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
          <input
            required
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
            required
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Quantity"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={!warehouseId || transferMut.isPending}
          className="rounded bg-[#245C3A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
        >
          Execute Bin Transfer
        </button>

        {message && <p className="text-xs font-medium text-[#17452C]">{message}</p>}
        {error && <p className="text-xs text-[#C74440]">{error}</p>}
      </form>
    </div>
  );
};
