import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, Edit, RefreshCw } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { useAuth } from '../../hooks/useAuth';
import { offlineRepo } from '../../offline/offline-repository';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog, Modal } from '../../components/master-data/Modal';

export const SalesOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const offlineQueuedMessage = (location.state as { offlineQueuedMessage?: string } | null)
    ?.offlineQueuedMessage;

  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [fulfillNotes, setFulfillNotes] = useState('');

  const localOpQuery = useQuery({
    queryKey: ['offline', 'sales-order-op', user?.id, id],
    queryFn: () => offlineRepo.findOperationByEntityId(user!.id, 'SALES_ORDER', id!),
    enabled: Boolean(user?.id && id),
  });

  const localOp = localOpQuery.data;
  const reconciledServerId =
    localOp?.status === 'SYNCED' &&
    localOp.serverResultEntityId &&
    localOp.serverResultEntityId !== id
      ? localOp.serverResultEntityId
      : null;

  useEffect(() => {
    if (reconciledServerId) {
      navigate(`/sales/orders/${reconciledServerId}`, { replace: true });
    }
  }, [reconciledServerId, navigate]);

  const isLocalOnlyPending = Boolean(
    localOp && localOp.status !== 'SYNCED' && localOp.operationType === 'SALES_ORDER_DRAFT_CREATE',
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'order', id],
    queryFn: () => salesService.orders.getById(id!),
    enabled: Boolean(id) && !isLocalOnlyPending && !reconciledServerId,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sales'] });

  const submitMut = useMutation({
    mutationFn: () => salesService.orders.submit(id!),
    onSuccess: () => {
      invalidate();
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Submit failed'),
  });

  const approveMut = useMutation({
    mutationFn: () => salesService.orders.approve(id!),
    onSuccess: () => {
      invalidate();
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Approve failed'),
  });

  const rejectMut = useMutation({
    mutationFn: (r: string) => salesService.orders.reject(id!, r),
    onSuccess: () => {
      invalidate();
      setRejectOpen(false);
      setReason('');
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Reject failed'),
  });

  const confirmMut = useMutation({
    mutationFn: () => salesService.orders.confirm(id!),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setConfirmOpen(false);
      setActionError(null);
    },
    onError: err => {
      setConfirmOpen(false);
      setActionError(err instanceof Error ? err.message : 'Confirmation failed');
    },
  });

  const cancelMut = useMutation({
    mutationFn: (r: string) => salesService.orders.cancel(id!, r),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setCancelOpen(false);
      setReason('');
      setActionError(null);
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Cancellation failed'),
  });

  const fulfillMut = useMutation({
    mutationFn: (notes?: string) => salesService.orders.fulfill(id!, { notes }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setFulfillOpen(false);
      setFulfillNotes('');
      setActionError(null);
    },
    onError: err => {
      setFulfillOpen(false);
      setActionError(err instanceof Error ? err.message : 'Fulfillment failed');
    },
  });

  if (isLoading || localOpQuery.isLoading || reconciledServerId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading sales order...
      </div>
    );
  }

  if (localOp && localOp.status !== 'SYNCED' && !data?.data) {
    const payload = localOp.payload as {
      customerId?: string;
      warehouseId?: string;
      expectedDeliveryDate?: string;
      notes?: string;
      deliveryInstructions?: string;
      lines?: Array<{
        productVariantId: string;
        uomId: string;
        orderedQuantity: string;
        discountPercent?: string;
      }>;
    };
    const isFailedOrConflict = localOp.status === 'FAILED' || localOp.status === 'CONFLICT';
    return (
      <div className="space-y-4">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs ${
            isFailedOrConflict
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">
                {localOp.status === 'CONFLICT'
                  ? 'Sync Conflict — Action Required'
                  : localOp.status === 'FAILED'
                    ? 'Sync Failed — Local Draft Preserved'
                    : offlineQueuedMessage || 'Order saved offline – waiting for sync (Pending Sync)'}
              </div>
              {localOp.lastErrorMessage && (
                <div className="mt-0.5 text-[11px]">{localOp.lastErrorMessage}</div>
              )}
            </div>
          </div>
          <Link to="/sync-center">
            <Button size="sm" variant="outline">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Open Sync Center
            </Button>
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <Link
                to="/sales/orders"
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-base font-bold text-brand-navy">
                    LOCAL-DRAFT ({localOp.entityId.slice(0, 8)})
                  </h2>
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Pending Sync ({localOp.status})
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Saved locally at {new Date(localOp.clientCreatedAt).toLocaleString('en-IN')} ·
                  Customer ID: {payload.customerId || '-'} · Warehouse ID: {payload.warehouseId || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Product Variant ID</th>
                  <th className="px-3 py-2">UOM ID</th>
                  <th className="px-3 py-2 text-right">Ordered Qty</th>
                  <th className="px-3 py-2 text-right">Discount %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payload.lines || []).map((l, idx) => (
                  <tr key={`${l.productVariantId}-${idx}`}>
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono">{l.productVariantId}</td>
                    <td className="px-3 py-2 font-mono">{l.uomId}</td>
                    <td className="px-3 py-2 text-right font-medium">{l.orderedQuantity}</td>
                    <td className="px-3 py-2 text-right">{l.discountPercent || '0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(payload.notes || payload.deliveryInstructions) && (
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {payload.notes && <div>Notes: {payload.notes}</div>}
              {payload.deliveryInstructions && (
                <div>Delivery Instructions: {payload.deliveryInstructions}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Sales order not found'}
      </div>
    );
  }

  const order = data.data;
  const canEdit =
    hasPermission('sales.orders.update') &&
    (order.status === 'DRAFT' || order.status === 'REJECTED');
  const canSubmit =
    hasPermission('sales.orders.submit') &&
    (order.status === 'DRAFT' || order.status === 'REJECTED');
  const canApprove = hasPermission('sales.orders.approve') && order.status === 'SUBMITTED';
  const canReject = hasPermission('sales.orders.reject') && order.status === 'SUBMITTED';
  const canConfirm = hasPermission('sales.orders.confirm') && order.status === 'APPROVED';
  const canFulfill =
    hasPermission('sales.orders.fulfill') &&
    (order.status === 'CONFIRMED' || order.status === 'PARTIALLY_FULFILLED');
  const canInvoice =
    hasPermission('sales.invoices.create') &&
    (order.status === 'PARTIALLY_FULFILLED' || order.status === 'FULFILLED');
  const canCancel =
    hasPermission('sales.orders.cancel') &&
    ['DRAFT', 'SUBMITTED', 'APPROVED', 'CONFIRMED'].includes(order.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/sales/orders"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold text-brand-navy">{order.orderNumber}</h2>
              <SalesStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-slate-500">
              Customer: {order.customer.legalName} ({order.customer.code}) · Warehouse:{' '}
              {order.warehouse.code}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/sales/orders/${order.id}/edit`)}
              className="gap-1"
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              Submit Order
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              Approve
            </Button>
          )}
          {canReject && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReason('');
                setRejectOpen(true);
              }}
            >
              Reject
            </Button>
          )}
          {canConfirm && (
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              Confirm &amp; Reserve Stock
            </Button>
          )}
          {canFulfill && (
            <Button size="sm" onClick={() => setFulfillOpen(true)}>
              Fulfill Remaining
            </Button>
          )}
          {canInvoice && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/sales/orders/${order.id}/invoices/new`)}
            >
              Create Invoice
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReason('');
                setCancelOpen(true);
              }}
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-brand-navy">Order Lines</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2.5 py-2">#</th>
                  <th className="px-2.5 py-2">Product Variant</th>
                  <th className="px-2.5 py-2 text-right">Ordered</th>
                  <th className="px-2.5 py-2 text-right">Reserved</th>
                  <th className="px-2.5 py-2 text-right">Fulfilled</th>
                  <th className="px-2.5 py-2 text-right">Unit Price</th>
                  <th className="px-2.5 py-2 text-right">Tax %</th>
                  <th className="px-2.5 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.lines?.map(l => (
                  <tr key={l.id}>
                    <td className="px-2.5 py-2">{l.lineNumber}</td>
                    <td className="px-2.5 py-2">
                      <div className="font-mono font-medium">{l.productVariant?.sku}</div>
                      <div className="text-[11px] text-slate-500">{l.productVariant?.name}</div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono">
                      {Number(l.orderedQuantity).toFixed(2)} {l.uom?.symbol}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-amber-700">
                      {Number(l.reservedBaseQuantity).toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-emerald-700">
                      {Number(l.fulfilledBaseQuantity).toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono">
                      ₹{Number(l.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono">
                      {Number(l.taxPercentage).toFixed(2)}%
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-semibold">
                      ₹{Number(l.lineTotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end space-y-1 border-t border-slate-100 pt-3 text-xs">
            <div>
              Subtotal: <span className="font-mono">₹{Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div>
              Discount:{' '}
              <span className="font-mono">-₹{Number(order.discountAmount).toFixed(2)}</span>
            </div>
            <div>
              GST Tax: <span className="font-mono">₹{Number(order.taxAmount).toFixed(2)}</span>
            </div>
            <div className="text-sm font-bold text-brand-navy">
              Grand Total:{' '}
              <span className="font-mono">₹{Number(order.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-brand-navy">Order Metadata</h3>
            <div>
              <span className="text-slate-500">Order Date:</span>{' '}
              {new Date(order.orderDate).toLocaleDateString()}
            </div>
            {order.expectedDeliveryDate && (
              <div>
                <span className="text-slate-500">Expected Delivery:</span>{' '}
                {new Date(order.expectedDeliveryDate).toLocaleDateString()}
              </div>
            )}
            {order.shippingAddress && (
              <div>
                <span className="text-slate-500">Shipping Address:</span>{' '}
                {order.shippingAddress.addressLine1}, {order.shippingAddress.city},{' '}
                {order.shippingAddress.state} - {order.shippingAddress.pincode}
              </div>
            )}
            {order.notes && (
              <div>
                <span className="text-slate-500">Notes:</span> {order.notes}
              </div>
            )}
            {order.rejectionReason && (
              <div className="rounded bg-red-50 p-2 text-red-700">
                <strong>Rejection Reason:</strong> {order.rejectionReason}
              </div>
            )}
            {order.cancellationReason && (
              <div className="rounded bg-slate-100 p-2 text-slate-700">
                <strong>Cancellation Reason:</strong> {order.cancellationReason}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-brand-navy">Status History</h3>
            <div className="space-y-2">
              {order.statusHistory?.map(h => (
                <div key={h.id} className="border-l-2 border-brand-navy pl-2.5">
                  <div className="font-medium text-slate-800">
                    {h.fromStatus ? `${h.fromStatus} → ` : ''}
                    {h.toStatus}
                  </div>
                  {h.reason && <div className="text-[11px] text-slate-600">{h.reason}</div>}
                  <div className="text-[10px] text-slate-400">
                    {h.changedBy?.fullName || 'System'} · {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => confirmMut.mutate()}
        title="Confirm Sales Order & Reserve Stock"
        message="Confirming this order will atomically reserve the ordered quantities in the fulfillment warehouse. Continue?"
        confirmLabel="Confirm & Reserve"
        isLoading={confirmMut.isPending}
      />

      <ConfirmDialog
        isOpen={fulfillOpen}
        onClose={() => setFulfillOpen(false)}
        onConfirm={() => fulfillMut.mutate(fulfillNotes || undefined)}
        title="Fulfill Sales Order"
        message="Fulfilling will release the reserved stock and post an Inventory Issue ledger transaction using FEFO batch picking. Continue?"
        confirmLabel="Fulfill Order"
        isLoading={fulfillMut.isPending}
      />

      <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Sales Order" maxWidth="max-w-md">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (reason.trim().length >= 3) rejectMut.mutate(reason.trim());
          }}
          className="space-y-3"
        >
          <textarea
            required
            minLength={3}
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={rejectMut.isPending || reason.trim().length < 3}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Sales Order" maxWidth="max-w-md">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (reason.trim().length >= 3) cancelMut.mutate(reason.trim());
          }}
          className="space-y-3"
        >
          <p className="text-xs text-slate-600">
            If the order is currently CONFIRMED, cancelling will release all reserved stock.
          </p>
          <textarea
            required
            minLength={3}
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for cancellation..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button type="submit" disabled={cancelMut.isPending || reason.trim().length < 3}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
