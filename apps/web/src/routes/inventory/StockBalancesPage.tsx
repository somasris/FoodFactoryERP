import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { masterDataService } from '../../services/master-data.service';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';

export const StockBalancesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [itemType, setItemType] = useState('');

  const { data: warehousesData } = useQuery({
    queryKey: ['master-data', 'warehouses', 'all'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100, isActive: true }),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'balances', page, search, warehouseId, itemType],
    queryFn: () =>
      inventoryService.balances({
        page,
        limit: 20,
        search: search || undefined,
        warehouseId: warehouseId || undefined,
        itemType: itemType || undefined,
      }),
  });

  const items = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Stock Balances</h2>
          <p className="text-xs text-slate-500">
            Warehouse-wise and batch-wise physical, reserved, and available quantities.
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
              placeholder="Search item, batch, warehouse..."
              className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-brand-navy focus:outline-none"
            />
          </div>
          <select
            value={warehouseId}
            onChange={e => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Warehouses</option>
            {warehousesData?.data?.items.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <select
            value={itemType}
            onChange={e => {
              setItemType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Item Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="PACKAGING">Packaging</option>
            <option value="FINISHED_GOODS">Finished Goods</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading stock balances...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load balances'}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No stock balances found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2 text-right">On Hand</th>
                <th className="px-3 py-2 text-right">Reserved</th>
                <th className="px-3 py-2 text-right">Available</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-brand-navy">
                    {row.warehouse.code}
                    <div className="text-[11px] font-normal text-slate-500">{row.warehouse.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono font-medium">{row.inventoryItem.code}</span>
                    <div className="text-[11px] text-slate-500">{row.inventoryItem.name}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">{row.batch?.batchNumber || '—'}</td>
                  <td className="px-3 py-2">
                    {row.batch?.expiryDate ? (
                      <div className="flex items-center gap-1.5">
                        <span>{new Date(row.batch.expiryDate).toLocaleDateString()}</span>
                        {row.isExpired && <InventoryStatusBadge status="EXPIRED" />}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(row.quantityOnHand).toFixed(3)} {row.inventoryItem.uom?.symbol}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {Number(row.quantityReserved).toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-teal-700">
                    {Number(row.availableQuantity).toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">₹{Number(row.unitCost).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    ₹{Number(row.totalValue).toFixed(2)}
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} rows)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
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
    </div>
  );
};
