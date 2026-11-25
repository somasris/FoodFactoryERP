import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Rocket, Send, XCircle } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

export const ProductionPlanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'plan', id],
    queryFn: () => productionService.plans.getById(id!),
    enabled: Boolean(id),
  });

  const { data: availData } = useQuery({
    queryKey: ['production', 'plan', id, 'availability'],
    queryFn: () => productionService.plans.getMaterialAvailability(id!),
    enabled: Boolean(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['production'] });

  const submitMut = useMutation({
    mutationFn: () => productionService.plans.submit(id!),
    onSuccess: () => {
      invalidate();
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Submit failed'),
  });

  const approveMut = useMutation({
    mutationFn: () => productionService.plans.approve(id!),
    onSuccess: () => {
      invalidate();
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Approve failed'),
  });

  const releaseMut = useMutation({
    mutationFn: () => productionService.plans.release(id!),
    onSuccess: () => {
      invalidate();
      setReleaseOpen(false);
      setActionError(null);
    },
    onError: err => {
      setReleaseOpen(false);
      setActionError(err instanceof Error ? err.message : 'Release failed');
    },
  });

  const reasonMut = useMutation({
    mutationFn: (r: string) =>
      modalMode === 'reject'
        ? productionService.plans.reject(id!, r)
        : productionService.plans.cancel(id!, r),
    onSuccess: () => {
      invalidate();
      setModalMode(null);
      setReason('');
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Action failed'),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading production plan...
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Production plan not found'}
      </div>
    );
  }

  const plan = data.data;
  const canSubmit =
    hasPermission('production.plans.submit') &&
    (plan.status === 'DRAFT' || plan.status === 'REJECTED');
  const canApprove = hasPermission('production.plans.approve') && plan.status === 'SUBMITTED';
  const canRelease = hasPermission('production.plans.release') && plan.status === 'APPROVED';
  const canCreateWorkOrder =
    hasPermission('production.work_orders.create') &&
    (plan.status === 'APPROVED' || plan.status === 'RELEASED');
  const canCancel =
    hasPermission('production.plans.cancel') &&
    ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED'].includes(plan.status);

  const liveAvailMap = new Map((availData?.data || []).map(a => [a.inventoryItemId, a]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/production/plans"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold text-brand-navy">{plan.planNumber}</h2>
              <Badge variant={plan.status === 'RELEASED' ? 'success' : 'teal'}>
                {plan.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {plan.name || 'Production Plan'} · Warehouse: {plan.warehouse.code} · Date:{' '}
              {new Date(plan.planDate).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                size="sm"
                variant="teal"
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReason('');
                  setModalMode('reject');
                }}
              >
                Reject
              </Button>
            </>
          )}
          {canRelease && (
            <Button size="sm" variant="teal" onClick={() => setReleaseOpen(true)}>
              <Rocket className="mr-1.5 h-3.5 w-3.5" /> Release Plan
            </Button>
          )}
          {canCreateWorkOrder && (
            <Link to={`/production/plans/${plan.id}/work-orders/new`}>
              <Button size="sm" variant="default">
                Create Work Order
              </Button>
            </Link>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => {
                setReason('');
                setModalMode('cancel');
              }}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {(plan.rejectionReason || plan.cancellationReason) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>Reason:</strong> {plan.rejectionReason || plan.cancellationReason}
        </div>
      )}

      {/* Product Requirements */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-brand-navy mb-2">
          Planned Product Requirements &amp; BOM Snapshots
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">BOM</th>
                <th className="px-3 py-2 text-right">Demand</th>
                <th className="px-3 py-2 text-right">Avail FG</th>
                <th className="px-3 py-2 text-right">Net Req</th>
                <th className="px-3 py-2 text-right">Planned Qty</th>
                <th className="px-3 py-2 text-right">Yield %</th>
                <th className="px-3 py-2 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(plan.items || []).map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.lineNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">
                      {item.productVariant?.product?.name} – {item.productVariant?.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {item.productVariant?.sku}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {item.bom?.code} v{item.bomVersion?.versionNumber}
                  </td>
                  <td className="px-3 py-2 text-right">{Number(item.demandQuantity)}</td>
                  <td className="px-3 py-2 text-right">{Number(item.availableFgQuantity)}</td>
                  <td className="px-3 py-2 text-right">{Number(item.netRequirementQuantity)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-brand-navy">
                    {Number(item.plannedQuantity)} {item.uom?.symbol}
                  </td>
                  <td className="px-3 py-2 text-right">{item.yieldPercentage}%</td>
                  <td className="px-3 py-2 text-right font-mono">
                    ₹{Number(item.estimatedTotalCost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material Availability Analysis (Read-Only) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-brand-navy mb-2">
          Material Requirements &amp; Availability Analysis (Read-Only)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Required</th>
                <th className="px-3 py-2 text-right">On Hand</th>
                <th className="px-3 py-2 text-right">Reserved</th>
                <th className="px-3 py-2 text-right">Net Available</th>
                <th className="px-3 py-2 text-right">Shortage</th>
                <th className="px-3 py-2 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(plan.materialRequirements || []).map(req => {
                const live = liveAvailMap.get(req.inventoryItemId);
                const shortage = Number(live?.shortageQuantity ?? req.shortageQuantity);
                return (
                  <tr key={req.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{req.inventoryItem?.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {req.inventoryItem?.code}
                      </div>
                    </td>
                    <td className="px-3 py-2">{req.itemType}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {Number(req.requiredBaseQuantity)} {req.inventoryItem?.uom?.symbol}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(live?.availableQuantity ?? req.availableQuantity)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(live?.reservedQuantity ?? req.reservedQuantity)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(live?.netAvailableQuantity ?? req.netAvailableQuantity)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {shortage > 0 ? (
                        <Badge variant="warning">Short {shortage}</Badge>
                      ) : (
                        <Badge variant="teal">OK</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      ₹{Number(req.estimatedCost).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status History */}
      {plan.statusHistory && plan.statusHistory.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-brand-navy mb-2">Plan Status History</h3>
          <div className="space-y-1.5 text-xs">
            {plan.statusHistory.map(h => (
              <div key={h.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                <div>
                  <span className="font-semibold text-slate-800">
                    {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                  </span>
                  {h.reason && <span className="ml-2 text-slate-500">({h.reason})</span>}
                </div>
                <div className="text-[11px] text-slate-400">
                  {h.changedBy?.fullName || 'System'} · {new Date(h.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        onConfirm={() => releaseMut.mutate()}
        title="Release Production Plan"
        message={`Release ${plan.planNumber} for downstream work order creation?`}
        confirmLabel="Release Plan"
        isLoading={releaseMut.isPending}
      />

      <Modal
        isOpen={Boolean(modalMode)}
        onClose={() => setModalMode(null)}
        title={modalMode === 'reject' ? 'Reject Production Plan' : 'Cancel Production Plan'}
      >
        <div className="space-y-3 text-xs">
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (minimum 3 characters)..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setModalMode(null)}>
              Close
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={reason.trim().length < 3 || reasonMut.isPending}
              onClick={() => reasonMut.mutate(reason.trim())}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
