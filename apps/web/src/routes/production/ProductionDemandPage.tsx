import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

export const ProductionDemandPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [planName, setPlanName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'demand'],
    queryFn: () => productionService.demand(),
  });

  const canCreate = hasPermission('production.plans.create');
  const productSummary = data?.data?.productSummary || [];
  const orderDemandLines = data?.data?.orderDemandLines || [];

  const createPlanMut = useMutation({
    mutationFn: async () => {
      const selected = productSummary.filter(p =>
        selectedKeys.has(`${p.productVariantId}::${p.warehouseId}`),
      );
      if (selected.length === 0) {
        throw new Error('Select at least one product requirement to generate a plan.');
      }
      const warehouseId = selected[0].warehouseId;
      if (selected.some(s => s.warehouseId !== warehouseId)) {
        throw new Error('All selected items in a single production plan must share the same warehouse.');
      }
      return productionService.plans.create({
        name: planName.trim() || `Demand Plan ${new Date().toISOString().slice(0, 10)}`,
        warehouseId,
        items: selected.map(s => ({
          productVariantId: s.productVariantId,
          demandSources: s.sources.map(src => ({
            salesOrderId: src.salesOrderId,
            salesOrderLineId: src.salesOrderLineId,
            allocatedQuantity: src.unplannedQuantity,
          })),
        })),
      });
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
      if (res.data?.id) navigate(`/production/plans/${res.data.id}`);
    },
    onError: err => setErrorMsg(err instanceof Error ? err.message : 'Failed to create plan'),
  });

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-brand-navy">
              Net Production Requirements (Confirmed Sales Demand)
            </h2>
            <p className="text-xs text-slate-500">
              Net Requirement = Unplanned Confirmed Sales Demand − Available Finished Goods Stock.
            </p>
          </div>
          {canCreate && productSummary.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Optional plan name..."
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <Button
                size="sm"
                variant="teal"
                disabled={selectedKeys.size === 0 || createPlanMut.isPending}
                onClick={() => {
                  setErrorMsg(null);
                  createPlanMut.mutate();
                }}
              >
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                {createPlanMut.isPending ? 'Creating...' : 'Create Production Plan'}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading demand summary...</div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
            {error instanceof Error ? error.message : 'Failed to load demand'}
          </div>
        ) : productSummary.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No unplanned confirmed sales demand found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  {canCreate && <th className="px-3 py-2">Select</th>}
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2 text-right">Gross Demand</th>
                  <th className="px-3 py-2 text-right">Avail. FG Stock</th>
                  <th className="px-3 py-2 text-right">Net Requirement</th>
                  <th className="px-3 py-2">Active BOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productSummary.map(row => {
                  const key = `${row.productVariantId}::${row.warehouseId}`;
                  const canPlanRow = Number(row.netRequirementQuantity) > 0 && Boolean(row.activeBom);
                  return (
                    <tr key={key} className="hover:bg-slate-50">
                      {canCreate && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={!canPlanRow}
                            checked={selectedKeys.has(key)}
                            onChange={() => toggleKey(key)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{row.productName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{row.sku}</div>
                      </td>
                      <td className="px-3 py-2 font-mono">{row.warehouseCode}</td>
                      <td className="px-3 py-2 text-right">
                        {Number(row.grossDemandQuantity)} {row.uomSymbol}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {Number(row.availableFgQuantity)} {row.uomSymbol}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-brand-navy">
                        {Number(row.netRequirementQuantity)} {row.uomSymbol}
                      </td>
                      <td className="px-3 py-2">
                        {row.activeBom ? (
                          <Badge variant="teal">
                            {row.activeBom.bomCode} v{row.activeBom.versionNumber}
                          </Badge>
                        ) : (
                          <Badge variant="warning">No Active BOM</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {orderDemandLines.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-brand-navy mb-2">
            Source Confirmed Sales Order Lines
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Order #</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                  <th className="px-3 py-2 text-right">Already Planned</th>
                  <th className="px-3 py-2 text-right">Unplanned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderDemandLines.map(l => (
                  <tr key={l.salesOrderLineId}>
                    <td className="px-3 py-2 font-mono font-medium">{l.orderNumber}</td>
                    <td className="px-3 py-2">{l.customerName}</td>
                    <td className="px-3 py-2">{l.productName}</td>
                    <td className="px-3 py-2 text-right">{Number(l.remainingOrderQuantity)}</td>
                    <td className="px-3 py-2 text-right">{Number(l.alreadyPlannedQuantity)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {Number(l.unplannedQuantity)} {l.uomSymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
