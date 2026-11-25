import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Edit3, Rocket, Send, XCircle } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { WorkOrderPriority } from '../../types/production';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  APPROVED: 'teal',
  REJECTED: 'default',
  RELEASED: 'success',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

const PRIORITY_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  LOW: 'outline',
  NORMAL: 'secondary',
  HIGH: 'warning',
  URGENT: 'default',
};

export const WorkOrderDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ mode: 'reject' | 'cancel' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const [editQty, setEditQty] = useState('');
  const [editPriority, setEditPriority] = useState<WorkOrderPriority>('NORMAL');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editLine, setEditLine] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInstructions, setEditInstructions] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'work-orders', id],
    queryFn: () => productionService.workOrders.getById(id),
    enabled: Boolean(id),
  });

  const wo = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['production', 'work-orders', id] });
    queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
  };

  const transitionMutation = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'release') => {
      if (action === 'submit') return productionService.workOrders.submit(id);
      if (action === 'approve') return productionService.workOrders.approve(id);
      return productionService.workOrders.release(id);
    },
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    },
  });

  const reasonMutation = useMutation({
    mutationFn: async () => {
      if (!reasonModal) return;
      if (reasonModal.mode === 'reject') {
        return productionService.workOrders.reject(id, reasonText.trim());
      }
      return productionService.workOrders.cancel(id, reasonText.trim());
    },
    onSuccess: () => {
      setActionError(null);
      setReasonModal(null);
      setReasonText('');
      refresh();
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: () =>
      productionService.workOrders.update(id, {
        plannedQuantity: editQty || undefined,
        priority: editPriority,
        plannedStartDate: editStartDate || null,
        plannedEndDate: editEndDate || null,
        productionLine: editLine || null,
        notes: editNotes || null,
        instructions: editInstructions || null,
      }),
    onSuccess: () => {
      setActionError(null);
      setEditOpen(false);
      refresh();
    },
    onError: err => {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading work order...
      </div>
    );
  }

  if (error || !wo) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Work order not found'}
      </div>
    );
  }

  const openEditModal = () => {
    setEditQty(String(Number(wo.plannedQuantity)));
    setEditPriority(wo.priority);
    setEditStartDate(wo.plannedStartDate ? wo.plannedStartDate.slice(0, 10) : '');
    setEditEndDate(wo.plannedEndDate ? wo.plannedEndDate.slice(0, 10) : '');
    setEditLine(wo.productionLine || '');
    setEditNotes(wo.notes || '');
    setEditInstructions(wo.instructions || '');
    setEditOpen(true);
  };

  const canEdit = wo.status === 'DRAFT' && hasPermission('production.work_orders.update');
  const canSubmit = wo.status === 'DRAFT' && hasPermission('production.work_orders.submit');
  const canApprove = wo.status === 'SUBMITTED' && hasPermission('production.work_orders.approve');
  const canRelease = wo.status === 'APPROVED' && hasPermission('production.work_orders.release');
  const canCancel =
    ['DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED'].includes(wo.status) &&
    hasPermission('production.work_orders.cancel');

  const requirements = wo.materialRequirements || [];
  const conflicts = wo.scheduleConflicts || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/production/work-orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Work Orders
          </Link>
          <span className="text-slate-300">/</span>
          <h2 className="text-lg font-bold text-brand-navy">{wo.workOrderNumber}</h2>
          <Badge variant={STATUS_BADGE[wo.status] || 'outline'}>{wo.status}</Badge>
          <Badge variant={PRIORITY_BADGE[wo.priority] || 'outline'}>{wo.priority}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEditModal}>
              <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit Draft
            </Button>
          )}
          {canSubmit && (
            <Button
              variant="teal"
              size="sm"
              disabled={transitionMutation.isPending}
              onClick={() => transitionMutation.mutate('submit')}
            >
              <Send className="mr-1 h-3.5 w-3.5" /> Submit
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                variant="teal"
                size="sm"
                disabled={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate('approve')}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReasonText('');
                  setReasonModal({ mode: 'reject' });
                }}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {canRelease && (
            <Button
              variant="default"
              size="sm"
              disabled={transitionMutation.isPending}
              onClick={() => transitionMutation.mutate('release')}
            >
              <Rocket className="mr-1 h-3.5 w-3.5" /> Release to Floor
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReasonText('');
                setReasonModal({ mode: 'cancel' });
              }}
            >
              Cancel Work Order
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</div>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-700" /> Schedule Conflict Warning
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {conflicts.map(c => (
              <li key={c.workOrderId}>
                <Link to={`/production/work-orders/${c.workOrderId}`} className="font-medium underline">
                  {c.workOrderNumber}
                </Link>{' '}
                ({c.status}): {c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wo.rejectionReason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <strong>Rejection Reason:</strong> {wo.rejectionReason}
        </div>
      )}
      {wo.cancellationReason && (
        <div className="rounded-md border border-slate-300 bg-slate-100 p-3 text-xs text-slate-800">
          <strong>Cancellation Reason:</strong> {wo.cancellationReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-brand-navy">Order & BOM Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
              <div>
                <div className="text-slate-500">Product</div>
                <div className="font-semibold text-slate-900">{wo.productVariant?.sku}</div>
                <div className="text-slate-600">{wo.productVariant?.name}</div>
              </div>
              <div>
                <div className="text-slate-500">Source Plan</div>
                <Link to={`/production/plans/${wo.productionPlanId}`} className="font-medium text-brand-teal hover:underline">
                  {wo.productionPlan?.planNumber}
                </Link>
                <div className="text-[11px] text-slate-500">
                  Line #{wo.productionPlanItem?.lineNumber}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Warehouse</div>
                <div className="font-medium text-slate-900">
                  {wo.warehouse?.code} — {wo.warehouse?.name}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Planned Quantity</div>
                <div className="text-sm font-bold text-brand-navy">
                  {Number(wo.plannedQuantity).toFixed(4)} {wo.uom?.symbol}
                </div>
              </div>
              <div>
                <div className="text-slate-500">BOM Version (Locked)</div>
                <div className="font-medium text-slate-900">
                  {wo.bom?.code} v{wo.bomVersion?.versionNumber}
                </div>
                <div className="text-[11px] text-slate-500">
                  Yield {Number(wo.bomVersion?.yieldPercentage || 100).toFixed(1)}% · Wastage{' '}
                  {Number(wo.bomVersion?.expectedWastagePercent || 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-slate-500">Schedule & Line</div>
                <div className="font-medium text-slate-900">
                  {wo.plannedStartDate ? new Date(wo.plannedStartDate).toLocaleDateString() : 'Unscheduled'}
                  {wo.plannedEndDate ? ` → ${new Date(wo.plannedEndDate).toLocaleDateString()}` : ''}
                </div>
                <div className="text-[11px] text-slate-500">{wo.productionLine || 'No line assigned'}</div>
              </div>
            </div>
            {(wo.notes || wo.instructions) && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
                {wo.notes && (
                  <div>
                    <div className="font-medium text-slate-600">Notes</div>
                    <p className="mt-0.5 text-slate-800">{wo.notes}</p>
                  </div>
                )}
                {wo.instructions && (
                  <div>
                    <div className="font-medium text-slate-600">Shop Floor Instructions</div>
                    <p className="mt-0.5 text-slate-800">{wo.instructions}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-brand-navy">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            {!wo.statusHistory || wo.statusHistory.length === 0 ? (
              <div className="text-xs text-slate-500">No history recorded.</div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {wo.statusHistory.map(h => (
                  <div key={h.id} className="border-l-2 border-brand-teal pl-2.5">
                    <div className="font-medium text-slate-800">
                      {h.fromStatus ? `${h.fromStatus} → ` : ''}
                      {h.toStatus}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {h.changedBy?.fullName || 'System'} · {new Date(h.createdAt).toLocaleString()}
                    </div>
                    {h.reason && <div className="mt-0.5 text-[11px] text-slate-700">{h.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-brand-navy">
            BOM Material Requirements (Read-Only Preview)
          </CardTitle>
          <span className="text-[11px] text-slate-500">
            Inventory is not deducted or reserved until batch execution (Phase 3.4)
          </span>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">No BOM material lines found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Material</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium text-right">Required</th>
                    <th className="px-3 py-2 font-medium text-right">On Hand</th>
                    <th className="px-3 py-2 font-medium text-right">Reserved</th>
                    <th className="px-3 py-2 font-medium text-right">Net Available</th>
                    <th className="px-3 py-2 font-medium text-right">Shortage</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requirements.map(req => {
                    const hasShortage = Number(req.shortageQuantity) > 0;
                    return (
                      <tr key={req.inventoryItemId}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{req.itemCode}</div>
                          <div className="text-[11px] text-slate-500">{req.itemName}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{req.itemType}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {Number(req.requiredQuantity).toFixed(4)} {req.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {Number(req.availableQuantity).toFixed(4)} {req.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {Number(req.reservedQuantity).toFixed(4)} {req.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800">
                          {Number(req.netAvailableQuantity).toFixed(4)} {req.uomSymbol}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${hasShortage ? 'text-red-600' : 'text-emerald-700'}`}>
                          {Number(req.shortageQuantity).toFixed(4)} {req.uomSymbol}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={hasShortage ? 'default' : 'success'}>
                            {hasShortage ? 'Shortage' : 'Sufficient'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              {reasonModal.mode === 'reject' ? 'Reject Work Order' : 'Cancel Work Order'}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {reasonModal.mode === 'cancel'
                ? 'Cancelling releases its allocated quantity back to the production plan. Please enter a reason.'
                : 'Please provide a clear rejection reason.'}
            </p>
            <textarea
              aria-label="Reason"
              rows={3}
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              placeholder="Minimum 3 characters..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReasonModal(null)}>
                Close
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={reasonText.trim().length < 3 || reasonMutation.isPending}
                onClick={() => reasonMutation.mutate()}
              >
                {reasonMutation.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">Edit Draft Work Order</h3>
            <div className="mt-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Planned Quantity</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editQty}
                    onChange={e => setEditQty(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Priority</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value as WorkOrderPriority)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={e => setEditEndDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Production Line</label>
                <input
                  type="text"
                  value={editLine}
                  onChange={e => setEditLine(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Instructions</label>
                <textarea
                  rows={2}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={updateDraftMutation.isPending}
                onClick={() => updateDraftMutation.mutate()}
              >
                {updateDraftMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
