import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { WorkOrderPriority } from '../../types/production';

export const WorkOrderFormPage: React.FC = () => {
  const { planId = '' } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'plans', planId],
    queryFn: () => productionService.plans.getById(planId),
    enabled: Boolean(planId),
  });

  const plan = data?.data;
  const eligibleItems = (plan?.items || []).filter(item => {
    const remaining = Number(item.plannedQuantity) - Number(item.workOrderedQuantity ?? 0);
    return remaining > 0.0001;
  });

  const [selectedItemId, setSelectedItemId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('NORMAL');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [notes, setNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedItemId && eligibleItems.length > 0) {
      const first = eligibleItems[0];
      setSelectedItemId(first.id);
      const rem = Math.max(0, Number(first.plannedQuantity) - Number(first.workOrderedQuantity ?? 0));
      setPlannedQuantity(rem.toFixed(4).replace(/\.?0+$/, ''));
    }
  }, [eligibleItems, selectedItemId]);

  const selectedItem = eligibleItems.find(i => i.id === selectedItemId);
  const remainingQty = selectedItem
    ? Math.max(0, Number(selectedItem.plannedQuantity) - Number(selectedItem.workOrderedQuantity ?? 0))
    : 0;

  const createMutation = useMutation({
    mutationFn: () =>
      productionService.workOrders.create({
        productionPlanId: planId,
        productionPlanItemId: selectedItemId,
        plannedQuantity,
        priority,
        plannedStartDate: plannedStartDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
        productionLine: productionLine || undefined,
        notes: notes || undefined,
        instructions: instructions || undefined,
      }),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['production', 'plans', planId] });
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      if (res.data?.id) {
        navigate(`/production/work-orders/${res.data.id}`);
      }
    },
    onError: err => {
      setFormError(err instanceof Error ? err.message : 'Failed to create work order');
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading production plan...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Production plan not found'}
      </div>
    );
  }

  const isPlanEligible = plan.status === 'APPROVED' || plan.status === 'RELEASED';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedItemId) {
      setFormError('Please select a production plan item.');
      return;
    }
    const qty = Number(plannedQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Planned quantity must be greater than zero.');
      return;
    }
    if (qty > remainingQty + 0.0001) {
      setFormError(`Planned quantity cannot exceed remaining unallocated quantity (${remainingQty}).`);
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/production/plans/${plan.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-brand-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Plan {plan.planNumber}
        </Link>
        <Badge variant="teal">{plan.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-brand-navy">
            Create Work Order from {plan.planNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isPlanEligible ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Work orders can only be generated from APPROVED or RELEASED production plans. Current status: {plan.status}.
            </div>
          ) : eligibleItems.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              All items in this production plan have already been fully allocated to work orders.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="planItemSelect">
                  Production Plan Item *
                </label>
                <select
                  id="planItemSelect"
                  value={selectedItemId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedItemId(id);
                    const found = eligibleItems.find(i => i.id === id);
                    if (found) {
                      const rem = Math.max(
                        0,
                        Number(found.plannedQuantity) - Number(found.workOrderedQuantity ?? 0),
                      );
                      setPlannedQuantity(rem.toFixed(4).replace(/\.?0+$/, ''));
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                >
                  {eligibleItems.map(item => {
                    const rem = Math.max(0, Number(item.plannedQuantity) - Number(item.workOrderedQuantity ?? 0));
                    return (
                      <option key={item.id} value={item.id}>
                        Line #{item.lineNumber} — {item.productVariant?.sku} ({item.productVariant?.name}) | BOM:{' '}
                        {item.bom?.code} v{item.bomVersion?.versionNumber} | Remaining: {rem} {item.uom?.symbol}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedItem && (
                <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <div className="text-slate-500">Warehouse</div>
                    <div className="font-medium text-slate-800">{plan.warehouse.name}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Pinned BOM Version</div>
                    <div className="font-medium text-slate-800">
                      {selectedItem.bom?.code} v{selectedItem.bomVersion?.versionNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Plan Qty / Allocated</div>
                    <div className="font-medium text-slate-800">
                      {Number(selectedItem.plannedQuantity).toFixed(2)} /{' '}
                      {Number(selectedItem.workOrderedQuantity ?? 0).toFixed(2)} {selectedItem.uom?.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Remaining Available</div>
                    <div className="font-semibold text-brand-teal">
                      {remainingQty.toFixed(4)} {selectedItem.uom?.symbol}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="plannedQuantityInput">
                    Work Order Quantity ({selectedItem?.uom?.symbol || ''}) *
                  </label>
                  <input
                    id="plannedQuantityInput"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max={remainingQty}
                    value={plannedQuantity}
                    onChange={e => setPlannedQuantity(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="prioritySelect">
                    Priority
                  </label>
                  <select
                    id="prioritySelect"
                    value={priority}
                    onChange={e => setPriority(e.target.value as WorkOrderPriority)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="productionLineInput">
                    Production Line
                  </label>
                  <input
                    id="productionLineInput"
                    type="text"
                    placeholder="e.g. Line-A1"
                    value={productionLine}
                    onChange={e => setProductionLine(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="plannedStartDateInput">
                    Planned Start Date
                  </label>
                  <input
                    id="plannedStartDateInput"
                    type="date"
                    value={plannedStartDate}
                    onChange={e => setPlannedStartDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="plannedEndDateInput">
                    Planned End Date
                  </label>
                  <input
                    id="plannedEndDateInput"
                    type="date"
                    value={plannedEndDate}
                    onChange={e => setPlannedEndDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="notesInput">
                    Notes
                  </label>
                  <textarea
                    id="notesInput"
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                    placeholder="Internal scheduling or batch notes..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="instructionsInput">
                    Shop Floor Instructions
                  </label>
                  <textarea
                    id="instructionsInput"
                    rows={3}
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                    placeholder="Special handling, hygiene, or mixing instructions..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/production/plans/${plan.id}`)}>
                  Cancel
                </Button>
                <Button type="submit" variant="teal" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Draft Work Order'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
