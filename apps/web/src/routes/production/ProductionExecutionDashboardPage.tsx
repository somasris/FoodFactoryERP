import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, Layers, PauseCircle, PlayCircle, PlusCircle } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { WorkOrder } from '../../types/production';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  CREATED: 'outline',
  IN_PROGRESS: 'warning',
  PAUSED: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export const ProductionExecutionDashboardPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createWo, setCreateWo] = useState<WorkOrder | null>(null);
  const [batchQty, setBatchQty] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'batches', 'dashboard'],
    queryFn: () => productionService.batches.dashboard(),
  });

  const { data: releasedData } = useQuery({
    queryKey: ['production', 'work-orders', 'executable'],
    queryFn: () => productionService.workOrders.list({ limit: 20, status: 'RELEASED' }),
  });

  const createBatchMut = useMutation({
    mutationFn: () =>
      productionService.batches.create({
        workOrderId: createWo!.id,
        plannedQuantity: batchQty || undefined,
        manufacturingDate: mfgDate || undefined,
        expiryDate: expDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      setCreateWo(null);
      if (res.data?.id) {
        navigate(`/production/batches/${res.data.id}`);
      }
    },
    onError: err => {
      setFormError(err instanceof Error ? err.message : 'Failed to create production batch');
    },
  });

  const summary = data?.data;
  const releasedWos = (releasedData?.data?.items || []).filter(wo => {
    const rem = Number(wo.plannedQuantity) - Number(wo.allocatedBatchQuantity ?? 0);
    return rem > 0.0001;
  });

  if (isLoading) {
    return <LoadingState label="Loading production execution dashboard..." />;
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Failed to load execution dashboard"
        message={error instanceof Error ? error.message : 'Failed to load execution dashboard'}
      />
    );
  }

  const canCreateBatch = hasPermission('production.batches.create');

  const openCreateModal = (wo: WorkOrder) => {
    const rem = Math.max(0, Number(wo.plannedQuantity) - Number(wo.allocatedBatchQuantity ?? 0));
    setCreateWo(wo);
    setBatchQty(rem.toFixed(4).replace(/\.?0+$/, ''));
    setMfgDate(new Date().toISOString().slice(0, 10));
    setExpDate('');
    setNotes('');
    setFormError(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Production Execution Dashboard"
        description="Monitor active shop-floor batches, released work orders, and batch completion status."
        actions={
          <Link to="/production/batches">
            <Button variant="outline" size="sm">
              View All Batches
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Batches"
          value={summary.totalBatches}
          sublabel={`${summary.createdCount} created · ${summary.cancelledCount} cancelled`}
          icon={<Layers className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="In Progress"
          value={summary.inProgressCount}
          sublabel="Active batches on shop floor"
          icon={<PlayCircle className="h-4 w-4" />}
          tone="warning"
        />
        <KpiCard
          label="Paused"
          value={summary.pausedCount}
          sublabel="Temporarily held batches"
          icon={<PauseCircle className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Completed"
          value={summary.completedCount}
          sublabel={`${summary.releasedWorkOrdersCount} work orders open for execution`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-brand-navy">
            Released Work Orders Ready for Execution
          </CardTitle>
          <Link to="/production/work-orders" className="text-xs font-medium text-brand-teal hover:underline">
            All Work Orders →
          </Link>
        </CardHeader>
        <CardContent>
          {releasedWos.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              No released work orders with remaining unbatched quantity.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Work Order #</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Planned</th>
                    <th className="px-3 py-2 font-medium text-right">Remaining</th>
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {releasedWos.map(wo => {
                    const rem = Math.max(0, Number(wo.plannedQuantity) - Number(wo.allocatedBatchQuantity ?? 0));
                    return (
                      <tr key={wo.id}>
                        <td className="px-3 py-2 font-medium text-brand-navy">
                          <Link to={`/production/work-orders/${wo.id}`} className="hover:underline">
                            {wo.workOrderNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{wo.productVariant?.sku}</div>
                          <div className="text-[11px] text-slate-500">{wo.productVariant?.name}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Number(wo.plannedQuantity).toFixed(2)} {wo.uom?.symbol}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-brand-teal">
                          {rem.toFixed(2)} {wo.uom?.symbol}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{wo.productionLine || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {canCreateBatch && (
                            <Button size="sm" variant="teal" onClick={() => openCreateModal(wo)}>
                              <PlusCircle className="mr-1 h-3.5 w-3.5" /> Create Batch
                            </Button>
                          )}
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-brand-navy">Recent Production Batches</CardTitle>
          <Link to="/production/batches" className="text-xs font-medium text-brand-teal hover:underline">
            View All Batches →
          </Link>
        </CardHeader>
        <CardContent>
          {summary.recentBatches.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">No production batches created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Batch #</th>
                    <th className="px-3 py-2 font-medium">Work Order #</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Planned / Good</th>
                    <th className="px-3 py-2 font-medium text-right">Yield %</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentBatches.map(b => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 font-medium text-brand-navy">{b.batchNumber}</td>
                      <td className="px-3 py-2 text-slate-700">{b.workOrder?.workOrderNumber}</td>
                      <td className="px-3 py-2">{b.productVariant?.sku}</td>
                      <td className="px-3 py-2 text-right">
                        {Number(b.plannedQuantity).toFixed(2)} / {Number(b.actualGoodQuantity).toFixed(2)}{' '}
                        {b.uom?.symbol}
                      </td>
                      <td className="px-3 py-2 text-right">{Number(b.actualYieldPercent).toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_BADGE[b.status] || 'outline'}>{b.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/production/batches/${b.id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-teal hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" /> Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {createWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              Create Production Batch ({createWo.workOrderNumber})
            </h3>
            {formError && (
              <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{formError}</div>
            )}
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Batch Planned Quantity</label>
                <input
                  type="number"
                  step="0.0001"
                  value={batchQty}
                  onChange={e => setBatchQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Manufacturing Date</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={e => setMfgDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Expiry Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateWo(null)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={createBatchMut.isPending}
                onClick={() => createBatchMut.mutate()}
              >
                {createBatchMut.isPending ? 'Creating...' : 'Create Batch'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
