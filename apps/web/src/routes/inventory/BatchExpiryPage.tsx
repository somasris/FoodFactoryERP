import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { manufacturingIntelligenceService } from '../../services/manufacturing-intelligence.service';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { Button } from '../../components/common/Button';

export const BatchExpiryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expiryStatus, setExpiryStatus] = useState('');
  const [radarRiskWindow, setRadarRiskWindow] = useState('ALL');
  const [radarItemType, setRadarItemType] = useState('');

  const { data: radarData } = useQuery({
    queryKey: ['mi', 'shelf-life-radar', radarRiskWindow, radarItemType, search],
    queryFn: () =>
      manufacturingIntelligenceService.getShelfLifeRadar({
        riskWindow: radarRiskWindow,
        itemType: radarItemType || undefined,
        search: search || undefined,
        page: 1,
        limit: 25,
      }),
    retry: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'batches', page, search, expiryStatus],
    queryFn: () =>
      inventoryService.batches({
        page,
        limit: 20,
        search: search || undefined,
        expiryStatus: expiryStatus || undefined,
      }),
  });

  const items = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Batch &amp; Expiry Tracking</h2>
          <p className="text-xs text-slate-500">
            Track manufacturing dates, expiry dates, and batch-level quantities for FIFO/FEFO picking.
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
              placeholder="Search batch # or item..."
              className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={expiryStatus}
            onChange={e => {
              setExpiryStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Expiry States</option>
            <option value="EXPIRED">Expired</option>
            <option value="EXPIRING_SOON">Expiring Within 30d</option>
            <option value="VALID">Valid</option>
          </select>
          <select
            aria-label="Filter Shelf-Life Radar by item type"
            value={radarItemType}
            onChange={e => setRadarItemType(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Item Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="PACKAGING">Packaging</option>
            <option value="FINISHED_GOODS">Finished Goods</option>
          </select>
        </div>
      </div>

      {radarData && (
        <div className="space-y-2 rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17452C]">
            <AlertTriangle className="h-3.5 w-3.5 text-[#C58A25]" />
            <span>Shelf-Life Risk Radar (Available / Reserved / Quarantined / Rejected)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {radarData.summary.map(bucket => (
              <button
                key={bucket.riskWindow}
                type="button"
                onClick={() =>
                  setRadarRiskWindow(prev =>
                    prev === bucket.riskWindow ? 'ALL' : bucket.riskWindow,
                  )
                }
                className={`rounded-md border p-2 text-left text-xs transition-colors ${
                  radarRiskWindow === bucket.riskWindow
                    ? 'border-[#245C3A] bg-[#EAF1E8]'
                    : 'border-[#E1E7DD] bg-white hover:bg-[#EAF1E8]/50'
                }`}
              >
                <div className="text-[10px] font-bold text-[#66756A]">{bucket.riskWindow}</div>
                <div className="mt-0.5 text-sm font-bold text-[#17452C]">
                  {bucket.batchRowCount} batches
                </div>
                <div className="text-[10px] text-[#66756A]">
                  Avail: {Number(bucket.availableQty).toFixed(1)} | Res:{' '}
                  {Number(bucket.reservedQty).toFixed(1)}
                </div>
                {(Number(bucket.quarantinedQty) > 0 || Number(bucket.rejectedQty) > 0) && (
                  <div className="text-[10px] font-semibold text-red-700">
                    Q: {Number(bucket.quarantinedQty).toFixed(1)} | Rej:{' '}
                    {Number(bucket.rejectedQty).toFixed(1)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading batches...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load batches'}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No batches found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Batch #</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Mfg Date</th>
                <th className="px-3 py-2">Expiry Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total On Hand</th>
                <th className="px-3 py-2">Warehouses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold text-brand-navy">{b.batchNumber}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono">{b.inventoryItem?.code}</span>
                    <div className="text-[11px] text-slate-500">{b.inventoryItem?.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    {b.manufacturingDate ? new Date(b.manufacturingDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <InventoryStatusBadge status={b.expiryState || 'NO_EXPIRY'} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {Number(b.totalOnHand || 0).toFixed(3)} {b.inventoryItem?.uom?.symbol}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600">
                    {b.balances
                      ?.filter(bal => Number(bal.quantityOnHand) > 0)
                      .map(bal => `${bal.warehouse.code}: ${Number(bal.quantityOnHand).toFixed(2)}`)
                      .join(', ') || 'Zero stock'}
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
    </div>
  );
};
