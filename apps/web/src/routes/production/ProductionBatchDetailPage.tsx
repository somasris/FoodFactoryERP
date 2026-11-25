import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, PackageCheck, PauseCircle, PlayCircle, XCircle } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  CREATED: 'outline',
  IN_PROGRESS: 'warning',
  PAUSED: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export const ProductionBatchDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ mode: 'pause' | 'cancel' } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const [consumeModalOpen, setConsumeModalOpen] = useState(false);
  const [consumeItemId, setConsumeItemId] = useState('');
  const [consumeUomId, setConsumeUomId] = useState('');
  const [consumeWarehouseId, setConsumeWarehouseId] = useState('');
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeNotes, setConsumeNotes] = useState('');

  const [outputGood, setOutputGood] = useState('');
  const [outputRejected, setOutputRejected] = useState('0');
  const [outputWastage, setOutputWastage] = useState('0');
  const [outputReason, setOutputReason] = useState('');
  const [outputOpen, setOutputOpen] = useState(false);

  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeMfgDate, setCompleteMfgDate] = useState('');
  const [completeExpDate, setCompleteExpDate] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'batches', id],
    queryFn: () => productionService.batches.getById(id),
    enabled: Boolean(id),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['master-data', 'warehouses', 'all'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100 }),
    enabled: consumeModalOpen,
  });

  const batch = data?.data;
  const warehouses = warehousesData?.data?.items || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['production', 'batches', id] });
    queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
  };

  const statusMut = useMutation({
    mutationFn: async (action: 'start' | 'resume' | 'reserve') => {
      if (action === 'start') return productionService.batches.start(id);
      if (action === 'resume') return productionService.batches.resume(id);
      return productionService.batches.reserveMaterials(id);
    },
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Action failed'),
  });

  const reasonMut = useMutation({
    mutationFn: async () => {
      if (!reasonModal) return;
      if (reasonModal.mode === 'pause') {
        return productionService.batches.pause(id, reasonText.trim());
      }
      return productionService.batches.cancel(id, reasonText.trim());
    },
    onSuccess: () => {
      setActionError(null);
      setReasonModal(null);
      setReasonText('');
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Action failed'),
  });

  const consumeMut = useMutation({
    mutationFn: () =>
      productionService.batches.consume(id, {
        lines: [
          {
            inventoryItemId: consumeItemId,
            warehouseId: consumeWarehouseId,
            uomId: consumeUomId,
            quantity: consumeQty,
            notes: consumeNotes || undefined,
          },
        ],
      }),
    onSuccess: () => {
      setActionError(null);
      setConsumeModalOpen(false);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Consumption failed'),
  });

  const outputMut = useMutation({
    mutationFn: () =>
      productionService.batches.recordOutput(id, {
        goodQuantity: outputGood,
        rejectedQuantity: outputRejected || '0',
        wastageQuantity: outputWastage || '0',
        wastageReason: outputReason || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setOutputOpen(false);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Failed to record output'),
  });

  const completeMut = useMutation({
    mutationFn: () =>
      productionService.batches.complete(id, {
        manufacturingDate: completeMfgDate || undefined,
        expiryDate: completeExpDate || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setCompleteModalOpen(false);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Completion failed'),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading production batch...
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Production batch not found'}
      </div>
    );
  }

  const canExecute = hasPermission('production.batches.execute');
  const canConsume = hasPermission('production.batches.consume');
  const canComplete = hasPermission('production.batches.complete');
  const canCancel = hasPermission('production.batches.cancel');

  const expectedMaterials = batch.expectedMaterials || [];
  const consumptions = batch.consumptions || [];

  const openConsumeModal = () => {
    if (expectedMaterials.length > 0) {
      setConsumeItemId(expectedMaterials[0].inventoryItemId);
      setConsumeUomId(expectedMaterials[0].uomId);
      setConsumeQty(expectedMaterials[0].remainingQuantity);
    }
    setConsumeWarehouseId(batch.warehouseId);
    setConsumeNotes('');
    setConsumeModalOpen(true);
  };

  const openOutputModal = () => {
    setOutputGood(String(Number(batch.actualGoodQuantity) || Number(batch.plannedQuantity)));
    setOutputRejected(String(Number(batch.rejectedQuantity)));
    setOutputWastage(String(Number(batch.wastageQuantity)));
    setOutputReason(batch.wastageReason || '');
    setOutputOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/production/batches"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Batches
          </Link>
          <span className="text-slate-300">/</span>
          <h2 className="text-lg font-bold text-brand-navy">{batch.batchNumber}</h2>
          <Badge variant={STATUS_BADGE[batch.status] || 'outline'}>{batch.status}</Badge>
          {batch.materialsReserved && <Badge variant="teal">Materials Reserved</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {batch.status === 'CREATED' && canExecute && (
            <Button size="sm" variant="teal" disabled={statusMut.isPending} onClick={() => statusMut.mutate('start')}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" /> Start Production
            </Button>
          )}
          {batch.status === 'IN_PROGRESS' && canExecute && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReasonText('');
                setReasonModal({ mode: 'pause' });
              }}
            >
              <PauseCircle className="mr-1 h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {batch.status === 'PAUSED' && canExecute && (
            <Button size="sm" variant="teal" disabled={statusMut.isPending} onClick={() => statusMut.mutate('resume')}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {['CREATED', 'IN_PROGRESS', 'PAUSED'].includes(batch.status) && !batch.materialsReserved && canConsume && (
            <Button
              size="sm"
              variant="outline"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate('reserve')}
            >
              <Lock className="mr-1 h-3.5 w-3.5" /> Reserve Materials
            </Button>
          )}
          {['IN_PROGRESS', 'PAUSED'].includes(batch.status) && canConsume && (
            <Button size="sm" variant="secondary" onClick={openConsumeModal}>
              Record Consumption
            </Button>
          )}
          {['IN_PROGRESS', 'PAUSED'].includes(batch.status) && canExecute && (
            <Button size="sm" variant="outline" onClick={openOutputModal}>
              Record Output & Wastage
            </Button>
          )}
          {['IN_PROGRESS', 'PAUSED'].includes(batch.status) && canComplete && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setCompleteMfgDate(batch.manufacturingDate ? batch.manufacturingDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
                setCompleteExpDate(batch.expiryDate ? batch.expiryDate.slice(0, 10) : '');
                setCompleteModalOpen(true);
              }}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete Batch
            </Button>
          )}
          {['CREATED', 'IN_PROGRESS', 'PAUSED'].includes(batch.status) && canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReasonText('');
                setReasonModal({ mode: 'cancel' });
              }}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel Batch
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</div>
      )}

      {batch.finishedGoodsBatch && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-center gap-1.5 font-semibold">
            <PackageCheck className="h-4 w-4 text-emerald-700" /> Finished Goods Received into Inventory
          </div>
          <p className="mt-1">
            FG Inventory Batch: <strong>{batch.finishedGoodsBatch.batchNumber}</strong> · Unit Cost:{' '}
            <strong>{Number(batch.finishedGoodsBatch.unitCost).toFixed(4)}</strong> · Warehouse:{' '}
            <strong>{batch.warehouse?.code}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-brand-navy">Batch Execution Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
              <div>
                <div className="text-slate-500">Product</div>
                <div className="font-semibold text-slate-900">{batch.productVariant?.sku}</div>
                <div className="text-slate-600">{batch.productVariant?.name}</div>
              </div>
              <div>
                <div className="text-slate-500">Work Order</div>
                <Link
                  to={`/production/work-orders/${batch.workOrderId}`}
                  className="font-medium text-brand-teal hover:underline"
                >
                  {batch.workOrder?.workOrderNumber}
                </Link>
                <div className="text-[11px] text-slate-500">Status: {batch.workOrder?.status}</div>
              </div>
              <div>
                <div className="text-slate-500">Locked BOM Version</div>
                <div className="font-medium text-slate-900">
                  {batch.bom?.code} v{batch.bomVersion?.versionNumber}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Planned / Good Output</div>
                <div className="font-bold text-brand-navy">
                  {Number(batch.plannedQuantity).toFixed(4)} / {Number(batch.actualGoodQuantity).toFixed(4)}{' '}
                  {batch.uom?.symbol}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Rejected / Wastage</div>
                <div className="font-medium text-red-700">
                  {Number(batch.rejectedQuantity).toFixed(4)} / {Number(batch.wastageQuantity).toFixed(4)}{' '}
                  {batch.uom?.symbol}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Actual Yield / Completion</div>
                <div className="font-semibold text-emerald-700">
                  {Number(batch.actualYieldPercent).toFixed(2)}% yield ·{' '}
                  {Number(batch.completionPercent).toFixed(2)}% complete
                </div>
              </div>
            </div>
            {batch.wastageReason && (
              <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-700">
                <strong>Wastage / Rejection Reason:</strong> {batch.wastageReason}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-brand-navy">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            {!batch.statusHistory || batch.statusHistory.length === 0 ? (
              <div className="text-xs text-slate-500">No history recorded.</div>
            ) : (
              <div className="space-y-2 text-xs">
                {batch.statusHistory.map(h => (
                  <div key={h.id} className="border-l-2 border-brand-teal pl-2.5">
                    <div className="font-medium text-slate-800">
                      {h.fromStatus ? `${h.fromStatus} → ` : ''}
                      {h.toStatus}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {h.changedBy?.fullName || 'System'} · {new Date(h.createdAt).toLocaleString()}
                    </div>
                    {h.reason && <div className="text-[11px] text-slate-700">{h.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-brand-navy">
            Expected vs. Consumed BOM Materials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 font-medium text-right">Expected (BOM)</th>
                  <th className="px-3 py-2 font-medium text-right">Consumed</th>
                  <th className="px-3 py-2 font-medium text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expectedMaterials.map(m => (
                  <tr key={m.inventoryItemId}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{m.itemCode}</div>
                      <div className="text-[11px] text-slate-500">{m.itemName}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(m.expectedQuantity).toFixed(4)} {m.uomSymbol}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-brand-teal">
                      {Number(m.consumedQuantity).toFixed(4)} {m.uomSymbol}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(m.remainingQuantity).toFixed(4)} {m.uomSymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-brand-navy">
            Material Consumption & Batch Traceability Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consumptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">No material consumptions posted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Material</th>
                    <th className="px-3 py-2 font-medium">Warehouse</th>
                    <th className="px-3 py-2 font-medium">RM Batch</th>
                    <th className="px-3 py-2 font-medium text-right">Consumed Qty</th>
                    <th className="px-3 py-2 font-medium text-right">Total Cost</th>
                    <th className="px-3 py-2 font-medium">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consumptions.map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {c.inventoryItem?.code} — {c.inventoryItem?.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{c.warehouse?.code}</td>
                      <td className="px-3 py-2 text-slate-600">{c.batch?.batchNumber || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {Number(c.consumedQuantity).toFixed(4)} {c.uom?.symbol}
                      </td>
                      <td className="px-3 py-2 text-right">{Number(c.totalCost).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{c.consumedBy?.fullName || 'System'}</td>
                    </tr>
                  ))}
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
              {reasonModal.mode === 'pause' ? 'Pause Production Batch' : 'Cancel Production Batch'}
            </h3>
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
                disabled={reasonText.trim().length < 3 || reasonMut.isPending}
                onClick={() => reasonMut.mutate()}
              >
                {reasonMut.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {consumeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">Record Material Consumption</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Deducts inventory transactionally via the inventory ledger (FEFO/FIFO).
            </p>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Material</label>
                <select
                  value={consumeItemId}
                  onChange={e => {
                    const idVal = e.target.value;
                    setConsumeItemId(idVal);
                    const found = expectedMaterials.find(m => m.inventoryItemId === idVal);
                    if (found) {
                      setConsumeUomId(found.uomId);
                      setConsumeQty(found.remainingQuantity);
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                >
                  {expectedMaterials.map(m => (
                    <option key={m.inventoryItemId} value={m.inventoryItemId}>
                      {m.itemCode} — {m.itemName} (Rem: {m.remainingQuantity} {m.uomSymbol})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Source Warehouse</label>
                <select
                  value={consumeWarehouseId}
                  onChange={e => setConsumeWarehouseId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                >
                  {warehouses.length === 0 ? (
                    <option value={batch.warehouseId}>{batch.warehouse?.name}</option>
                  ) : (
                    warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Quantity Consumed</label>
                <input
                  type="number"
                  step="0.0001"
                  value={consumeQty}
                  onChange={e => setConsumeQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Notes</label>
                <input
                  type="text"
                  value={consumeNotes}
                  onChange={e => setConsumeNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConsumeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={consumeMut.isPending}
                onClick={() => consumeMut.mutate()}
              >
                {consumeMut.isPending ? 'Posting...' : 'Post Consumption'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {outputOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">Record Production Output & Wastage</h3>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Good Quantity</label>
                <input
                  type="number"
                  step="0.0001"
                  value={outputGood}
                  onChange={e => setOutputGood(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Rejected Quantity</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={outputRejected}
                    onChange={e => setOutputRejected(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Wastage Quantity</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={outputWastage}
                    onChange={e => setOutputWastage(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Rejection / Wastage Reason</label>
                <input
                  type="text"
                  value={outputReason}
                  onChange={e => setOutputReason(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  placeholder="Required if rejected or wastage > 0"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOutputOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={outputMut.isPending}
                onClick={() => outputMut.mutate()}
              >
                {outputMut.isPending ? 'Saving...' : 'Save Output'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {completeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">Confirm Batch Completion</h3>
            <p className="mt-1 text-xs text-slate-600">
              Completing this batch will permanently post a Finished Goods Inventory Receipt for{' '}
              <strong>
                {Number(batch.actualGoodQuantity).toFixed(4)} {batch.uom?.symbol}
              </strong>{' '}
              into <strong>{batch.warehouse?.code}</strong> under batch{' '}
              <strong>{batch.batchNumber}</strong>.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Manufacturing Date</label>
                <input
                  type="date"
                  value={completeMfgDate}
                  onChange={e => setCompleteMfgDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Expiry Date</label>
                <input
                  type="date"
                  value={completeExpDate}
                  onChange={e => setCompleteExpDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCompleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={completeMut.isPending}
                onClick={() => completeMut.mutate()}
              >
                {completeMut.isPending ? 'Completing...' : 'Complete & Receive FG'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
