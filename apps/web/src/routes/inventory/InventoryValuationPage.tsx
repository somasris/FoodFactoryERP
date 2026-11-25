import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, History } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/master-data/Modal';

export const InventoryValuationPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'valuation', page, search, itemType],
    queryFn: () =>
      inventoryService.valuation({
        page,
        limit: 20,
        search: search || undefined,
        itemType: itemType || undefined,
      }),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['inventory', 'valuation-history', selectedItemId],
    queryFn: () => inventoryService.valuationHistory(selectedItemId!, { limit: 25 }),
    enabled: Boolean(selectedItemId),
  });

  const items = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Inventory Valuation</h2>
          <p className="text-xs text-slate-500">
            MWAC valuation for raw/packaging materials and Batch Actual costing for finished goods.
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
              placeholder="Search item code or name..."
              className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={itemType}
            onChange={e => {
              setItemType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Item Types</option>
            <option value="RAW_MATERIAL">Raw Material (MWAC)</option>
            <option value="PACKAGING">Packaging (MWAC)</option>
            <option value="FINISHED_GOODS">Finished Goods (Batch Actual)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading valuation...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load valuation'}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No inventory items found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Item Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2 text-right">MWAC / Unit Cost</th>
                <th className="px-3 py-2 text-right">Total On Hand</th>
                <th className="px-3 py-2 text-right">Total Value</th>
                <th className="px-3 py-2 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-medium text-brand-navy">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{item.itemType}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={item.valuationMethod === 'MWAC' ? 'teal' : 'secondary'}>
                      {item.valuationMethod}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ₹{Number(item.movingAverageCost).toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(item.totalQuantityOnHand).toFixed(3)} {item.uom.symbol}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-brand-navy">
                    ₹{Number(item.totalStockValue).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedItemId(item.id)}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <History className="h-3 w-3" /> History
                    </Button>
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
        isOpen={Boolean(selectedItemId)}
        onClose={() => setSelectedItemId(null)}
        title={`Valuation History: ${historyData?.data?.item?.code || ''}`}
        maxWidth="max-w-3xl"
      >
        {historyLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading valuation history...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Txn #</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Base Qty</th>
                  <th className="py-2 pr-3 text-right">Unit Cost</th>
                  <th className="py-2 text-right">MWAC After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData?.data?.history?.items?.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 pr-3">{new Date(h.transaction.transactionDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 font-mono">{h.transaction.transactionNumber}</td>
                    <td className="py-2 pr-3">{h.transaction.transactionType}</td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(h.baseQuantity).toFixed(3)}</td>
                    <td className="py-2 pr-3 text-right font-mono">₹{Number(h.unitCost).toFixed(4)}</td>
                    <td className="py-2 text-right font-mono font-semibold">
                      {h.mwacAfter ? `₹${Number(h.mwacAfter).toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};
