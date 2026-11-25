import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BatchReconciliation, BatchReconciliationLine } from '../../types/production';

export const MaterialReconciliationPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<{
    batch: BatchReconciliation;
    line: BatchReconciliationLine;
  } | null>(null);
  const [returnQty, setReturnQty] = useState('');
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const [approvalTarget, setApprovalTarget] = useState<{
    batch: BatchReconciliation;
    line: BatchReconciliationLine;
  } | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalReason, setApprovalReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'reconciliation'],
    queryFn: () => productionService.reconciliation.dashboard(),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['master-data', 'warehouses', 'all'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100 }),
    enabled: Boolean(returnTarget),
  });

  const warehouses = warehousesData?.data?.items || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['production', 'reconciliation'] });
    queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
  };

  const returnMut = useMutation({
    mutationFn: () =>
      productionService.reconciliation.returnMaterials(returnTarget!.batch.batchId, {
        lines: [
          {
            inventoryItemId: returnTarget!.line.inventoryItemId,
            warehouseId: returnWarehouseId,
            uomId: returnTarget!.line.uomId,
            quantity: returnQty,
            reason: returnReason.trim(),
          },
        ],
      }),
    onSuccess: () => {
      setActionError(null);
      setReturnTarget(null);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Return failed'),
  });

  const approvalMut = useMutation({
    mutationFn: () =>
      productionService.reconciliation.approveVariance(approvalTarget!.batch.batchId, {
        inventoryItemId: approvalTarget!.line.inventoryItemId,
        decision: approvalDecision,
        reason: approvalReason.trim(),
      }),
    onSuccess: () => {
      setActionError(null);
      setApprovalTarget(null);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Approval failed'),
  });

  const canReturn = hasPermission('production.batches.return');
  const canApproveVariance = hasPermission('production.variances.approve');
  const batches = data?.data || [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading material consumption reconciliation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Failed to load reconciliation'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-slate-500">
            No active or completed production batches to reconcile yet.
          </CardContent>
        </Card>
      ) : (
        batches.map(batch => (
          <Card key={batch.batchId}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-brand-navy">
                  <Link to={`/production/batches/${batch.batchId}`} className="hover:underline">
                    {batch.batchNumber}
                  </Link>{' '}
                  — {batch.productVariant?.sku}
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  WO: {batch.workOrder?.workOrderNumber} · Planned: {Number(batch.plannedQuantity).toFixed(2)}{' '}
                  {batch.uom?.symbol} · Expected Output Wastage: {Number(batch.expectedOutputWastage).toFixed(2)} ·
                  Actual Output Wastage: {Number(batch.actualOutputWastage).toFixed(2)}
                </p>
              </div>
              <Badge variant={batch.status === 'COMPLETED' ? 'success' : 'warning'}>{batch.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Material</th>
                      <th className="px-3 py-2 font-medium text-right">BOM Std</th>
                      <th className="px-3 py-2 font-medium text-right">Exp Wastage</th>
                      <th className="px-3 py-2 font-medium text-right">Consumed</th>
                      <th className="px-3 py-2 font-medium text-right">Returned</th>
                      <th className="px-3 py-2 font-medium text-right">Net Consumed</th>
                      <th className="px-3 py-2 font-medium text-right">Variance</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batch.lines.map(line => (
                      <tr key={line.inventoryItemId}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{line.itemCode}</div>
                          <div className="text-[11px] text-slate-500">{line.itemName}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Number(line.bomStandardQuantity).toFixed(4)} {line.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {Number(line.expectedWastage).toFixed(4)} {line.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Number(line.actualConsumedQuantity).toFixed(4)} {line.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {Number(line.returnedQuantity).toFixed(4)} {line.uomSymbol}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-brand-navy">
                          {Number(line.netConsumedQuantity).toFixed(4)} {line.uomSymbol}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            line.exceedsThreshold ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {Number(line.quantityVariance) > 0 ? '+' : ''}
                          {Number(line.quantityVariance).toFixed(4)} ({line.variancePercent}%)
                        </td>
                        <td className="px-3 py-2">
                          {line.approval ? (
                            <Badge variant={line.approval.status === 'APPROVED' ? 'success' : 'default'}>
                              {line.approval.status}
                            </Badge>
                          ) : line.exceedsThreshold ? (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> Excess (&gt;{line.thresholdPercent}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Within Tolerance
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            {canReturn &&
                              batch.status !== 'COMPLETED' &&
                              Number(line.netConsumedQuantity) > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReturnTarget({ batch, line });
                                    setReturnQty(line.netConsumedQuantity);
                                    setReturnWarehouseId('');
                                    setReturnReason('');
                                  }}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" /> Return
                                </Button>
                              )}
                            {canApproveVariance && line.exceedsThreshold && !line.approval && (
                              <Button
                                size="sm"
                                variant="teal"
                                onClick={() => {
                                  setApprovalTarget({ batch, line });
                                  setApprovalDecision('APPROVED');
                                  setApprovalReason('');
                                }}
                              >
                                Approve Variance
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              Return Material ({returnTarget.line.itemCode})
            </h3>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Target Warehouse</label>
                <select
                  value={returnWarehouseId}
                  onChange={e => setReturnWarehouseId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Return Quantity ({returnTarget.line.uomSymbol})
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={returnQty}
                  onChange={e => setReturnQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Return Reason *</label>
                <textarea
                  rows={2}
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  placeholder="Unused material returned to warehouse..."
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReturnTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={!returnWarehouseId || returnReason.trim().length < 3 || returnMut.isPending}
                onClick={() => returnMut.mutate()}
              >
                {returnMut.isPending ? 'Returning...' : 'Confirm Return'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              Variance Approval ({approvalTarget.line.itemCode}: {approvalTarget.line.variancePercent}%)
            </h3>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Decision</label>
                <select
                  value={approvalDecision}
                  onChange={e => setApprovalDecision(e.target.value as 'APPROVED' | 'REJECTED')}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Justification / Notes *</label>
                <textarea
                  rows={3}
                  value={approvalReason}
                  onChange={e => setApprovalReason(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setApprovalTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={approvalReason.trim().length < 3 || approvalMut.isPending}
                onClick={() => approvalMut.mutate()}
              >
                {approvalMut.isPending ? 'Saving...' : 'Save Decision'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
