import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const LocationStockPage: React.FC = () => {
  const [warehouseId, setWarehouseId] = useState('');

  const { data: stockRes, isLoading } = useQuery({
    queryKey: ['warehouse', 'location-stock', warehouseId],
    queryFn: () => warehouseService.listLocationStock({ warehouseId }),
    enabled: Boolean(warehouseId),
  });

  const { data: movRes } = useQuery({
    queryKey: ['warehouse', 'movements', warehouseId],
    queryFn: () => warehouseService.listMovements(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const allocations = stockRes?.data ?? [];
  const movements = movRes?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Location Stock & Movements</h1>
          <p className="text-xs text-[#66756A]">
            Bin-level stock, batch allocations, and physical location movement history.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm overflow-x-auto">
        <div className="border-b border-[#E1E7DD] px-4 py-2.5 text-xs font-bold text-[#17452C]">
          Current Bin Stock Allocations
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
            <tr>
              <th className="px-3 py-2">Bin</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">QC Status</th>
              <th className="px-3 py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4ED]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#66756A]">
                  Loading location stock...
                </td>
              </tr>
            ) : allocations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#66756A]">
                  No bin allocations recorded in this warehouse.
                </td>
              </tr>
            ) : (
              allocations.map(a => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono font-semibold text-[#17452C]">{a.bin.code}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono">{a.inventoryItem.code}</span> — {a.inventoryItem.name}
                  </td>
                  <td className="px-3 py-2 font-mono">{a.batch?.batchNumber ?? '—'}</td>
                  <td className="px-3 py-2">{a.batch?.qualityStatus ?? 'N/A'}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {a.quantity} {a.inventoryItem.uom?.symbol ?? ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm overflow-x-auto">
        <div className="border-b border-[#E1E7DD] px-4 py-2.5 text-xs font-bold text-[#17452C]">
          Location Movement History
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
            <tr>
              <th className="px-3 py-2">Movement #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">From → To</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4ED]">
            {movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#66756A]">
                  No bin movements yet.
                </td>
              </tr>
            ) : (
              movements.map(m => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-mono">{m.movementNumber}</td>
                  <td className="px-3 py-2">{m.movementType}</td>
                  <td className="px-3 py-2">{m.inventoryItem.code}</td>
                  <td className="px-3 py-2 font-mono">
                    {m.fromBin?.code ?? 'WH'} → {m.toBin?.code ?? 'ISSUE'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{m.quantity}</td>
                  <td className="px-3 py-2">{m.performedBy.username}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
