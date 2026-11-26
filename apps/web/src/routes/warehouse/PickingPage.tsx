import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const PickingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestMut = useMutation({
    mutationFn: () =>
      warehouseService.suggestPicking({ warehouseId, inventoryItemId, quantity }),
    onError: e => setError(e instanceof Error ? e.message : 'Failed to generate pick suggestions'),
  });

  const pickMut = useMutation({
    mutationFn: (s: { binId: string; batchId: string | null; qty: string }) =>
      warehouseService.pickFromBin({
        warehouseId,
        fromBinId: s.binId,
        inventoryItemId,
        batchId: s.batchId,
        quantity: s.qty,
      }),
    onSuccess: res => {
      setError(null);
      setMessage(`Picked from bin: ${res.data?.movementNumber}`);
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      suggestMut.mutate();
    },
    onError: e => {
      setMessage(null);
      setError(e instanceof Error ? e.message : 'Pick failed');
    },
  });

  const plan = suggestMut.data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Picking Operations (FEFO / FIFO)</h1>
          <p className="text-xs text-[#66756A]">
            Advisory picking plan filtering strictly to ACCEPTED, non-expired batches.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={inventoryItemId}
            onChange={e => setInventoryItemId(e.target.value)}
            placeholder="Inventory Item UUID"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 font-mono text-xs"
          />
          <input
            type="number"
            min="0.0001"
            step="0.0001"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Requested Quantity"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={!warehouseId || !inventoryItemId || suggestMut.isPending}
            onClick={() => suggestMut.mutate()}
            className="rounded bg-[#245C3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            Generate FEFO / FIFO Pick Plan
          </button>
        </div>

        {message && <p className="text-xs font-medium text-[#17452C]">{message}</p>}
        {error && <p className="text-xs text-[#C74440]">{error}</p>}

        {plan && (
          <div className="space-y-2 pt-2">
            {Number(plan.shortfallQuantity) > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Shortfall: {plan.shortfallQuantity} units unavailable in accepted bins.
              </div>
            )}
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
                <tr>
                  <th className="px-3 py-2">Bin</th>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Strategy</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2 text-right">Pick Qty</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4ED]">
                {plan.suggestions.map((s, idx) => (
                  <tr key={`${s.binId}-${s.batchId ?? idx}`}>
                    <td className="px-3 py-2 font-mono font-semibold text-[#17452C]">{s.binCode}</td>
                    <td className="px-3 py-2 font-mono">{s.batchNumber ?? 'N/A'}</td>
                    <td className="px-3 py-2">{s.strategy}</td>
                    <td className="px-3 py-2">
                      {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{s.suggestedPickQuantity}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pickMut.isPending}
                        onClick={() =>
                          pickMut.mutate({
                            binId: s.binId,
                            batchId: s.batchId,
                            qty: s.suggestedPickQuantity,
                          })
                        }
                        className="rounded bg-[#245C3A] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#17452C]"
                      >
                        Confirm Pick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
