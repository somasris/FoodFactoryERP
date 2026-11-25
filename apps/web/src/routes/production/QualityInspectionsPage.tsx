import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { QualityInspectionItem } from '../../types/production';

const DECISIONS = ['', 'PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'QUARANTINED', 'REJECTED'];

const DECISION_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  PARTIALLY_ACCEPTED: 'teal',
  QUARANTINED: 'secondary',
  REJECTED: 'default',
};

export const QualityInspectionsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [inspectTarget, setInspectTarget] = useState<QualityInspectionItem | null>(null);
  const [inspectDecision, setInspectDecision] = useState<'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'QUARANTINED' | 'REJECTED'>('ACCEPTED');
  const [goodQty, setGoodQty] = useState('');
  const [rejectedQty, setRejectedQty] = useState('0');
  const [defectCategory, setDefectCategory] = useState('');
  const [inspectNotes, setInspectNotes] = useState('');

  const [releaseTarget, setReleaseTarget] = useState<{
    item: QualityInspectionItem;
    mode: 'release' | 'disposition';
  } | null>(null);
  const [releaseNotes, setReleaseNotes] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'quality-inspections', page, search, decisionFilter],
    queryFn: () =>
      productionService.quality.list({
        page,
        limit: 15,
        search: search || undefined,
        decision: decisionFilter || undefined,
      }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['production', 'quality-inspections'] });
    queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
  };

  const inspectMut = useMutation({
    mutationFn: () =>
      productionService.quality.inspect(inspectTarget!.id, {
        decision: inspectDecision,
        ...(inspectDecision === 'PARTIALLY_ACCEPTED'
          ? { goodQuantity: goodQty, rejectedQuantity: rejectedQty }
          : {}),
        defectCategory: defectCategory || undefined,
        notes: inspectNotes || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setInspectTarget(null);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Inspection failed'),
  });

  const releaseMut = useMutation({
    mutationFn: () => {
      if (releaseTarget!.mode === 'release') {
        return productionService.quality.release(releaseTarget!.item.id, releaseNotes.trim());
      }
      return productionService.quality.disposition(releaseTarget!.item.id, releaseNotes.trim());
    },
    onSuccess: () => {
      setActionError(null);
      setReleaseTarget(null);
      refresh();
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Release action failed'),
  });

  const rows = data?.data?.items || [];
  const pagination = data?.data?.pagination;
  const canInspect = hasPermission('production.quality.inspect');
  const canRelease = hasPermission('production.quality.release');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search inspection # or batch #..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by inspection decision"
            value={decisionFilter}
            onChange={e => {
              setDecisionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          >
            {DECISIONS.map(d => (
              <option key={d || 'ALL'} value={d}>
                {d || 'All Decisions'}
              </option>
            ))}
          </select>
        </div>

        <Link to="/production/traceability" className="text-xs font-medium text-brand-teal hover:underline">
          Batch Traceability & Recall →
        </Link>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Loading quality inspections...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load quality inspections'}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No quality inspections found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Inspection #</th>
                  <th className="px-3 py-2.5 font-medium">Production Batch</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium text-right">Inspected Qty</th>
                  <th className="px-3 py-2.5 font-medium">Inventory Status</th>
                  <th className="px-3 py-2.5 font-medium">Decision</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(qi => (
                  <tr key={qi.id}>
                    <td className="px-3 py-2.5 font-medium text-brand-navy">{qi.inspectionNumber}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/production/batches/${qi.productionBatchId}`}
                        className="text-brand-teal hover:underline"
                      >
                        {qi.productionBatch?.batchNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">
                        {qi.productionBatch?.productVariant?.sku}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {qi.productionBatch?.productVariant?.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {Number(qi.inspectedQuantity).toFixed(2)} {qi.productionBatch?.uom?.symbol}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={qi.inventoryBatch?.qualityStatus === 'ACCEPTED' ? 'success' : 'outline'}>
                        {qi.inventoryBatch?.qualityStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={DECISION_BADGE[qi.decision] || 'outline'}>{qi.decision}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {qi.decision === 'PENDING' && canInspect && (
                          <Button
                            size="sm"
                            variant="teal"
                            onClick={() => {
                              setInspectTarget(qi);
                              setInspectDecision('ACCEPTED');
                              setGoodQty(String(Number(qi.inspectedQuantity)));
                              setRejectedQty('0');
                              setDefectCategory('');
                              setInspectNotes('');
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Inspect
                          </Button>
                        )}
                        {qi.decision === 'QUARANTINED' && canRelease && (
                          <>
                            <Button
                              size="sm"
                              variant="teal"
                              onClick={() => {
                                setReleaseTarget({ item: qi, mode: 'release' });
                                setReleaseNotes('');
                              }}
                            >
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Release
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReleaseTarget({ item: qi, mode: 'disposition' });
                                setReleaseNotes('');
                              }}
                            >
                              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {inspectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              Quality Inspection ({inspectTarget.inspectionNumber})
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Batch {inspectTarget.productionBatch?.batchNumber} · Total:{' '}
              {Number(inspectTarget.inspectedQuantity).toFixed(4)}
            </p>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Decision</label>
                <select
                  value={inspectDecision}
                  onChange={e =>
                    setInspectDecision(
                      e.target.value as 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'QUARANTINED' | 'REJECTED',
                    )
                  }
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                >
                  <option value="ACCEPTED">ACCEPTED (Release to Saleable Stock)</option>
                  <option value="PARTIALLY_ACCEPTED">PARTIALLY_ACCEPTED (Split Good & Rejected)</option>
                  <option value="QUARANTINED">QUARANTINED (Hold for Review)</option>
                  <option value="REJECTED">REJECTED (Block from Sales)</option>
                </select>
              </div>
              {inspectDecision === 'PARTIALLY_ACCEPTED' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">Good Quantity</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={goodQty}
                      onChange={e => setGoodQty(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">Rejected Quantity</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rejectedQty}
                      onChange={e => setRejectedQty(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block font-medium text-slate-700">Defect Category</label>
                <input
                  type="text"
                  value={defectCategory}
                  onChange={e => setDefectCategory(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                  placeholder="e.g. Packaging Seal, Moisture"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Inspection Notes</label>
                <textarea
                  rows={2}
                  value={inspectNotes}
                  onChange={e => setInspectNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setInspectTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={inspectMut.isPending}
                onClick={() => inspectMut.mutate()}
              >
                {inspectMut.isPending ? 'Saving...' : 'Submit Inspection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {releaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-navy">
              {releaseTarget.mode === 'release'
                ? 'Release Quarantined Stock'
                : 'Reject Quarantined Stock'}
            </h3>
            <textarea
              rows={3}
              value={releaseNotes}
              onChange={e => setReleaseNotes(e.target.value)}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              placeholder="Enter release or disposition notes (min 3 characters)..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReleaseTarget(null)}>
                Close
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={releaseNotes.trim().length < 3 || releaseMut.isPending}
                onClick={() => releaseMut.mutate()}
              >
                {releaseMut.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
