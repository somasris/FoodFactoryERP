import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, CheckCircle, Lock, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../hooks/useAuth';
import { productionService } from '../../services/production.service';
import {
  BatchCostingDetailResponse,
  OverheadAllocationMethod,
  ProductionCostEntryType,
} from '../../types/production';

export const BatchCostingDetailPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const { hasPermission } = useAuth();
  const [detail, setDetail] = useState<BatchCostingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cost entry form state
  const [entryType, setEntryType] = useState<ProductionCostEntryType>('DIRECT_LABOUR');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryQty, setEntryQty] = useState('1');
  const [entryRate, setEntryRate] = useState('0');
  const [entryRef, setEntryRef] = useState('');

  // Overhead form state
  const [ohType, setOhType] = useState<'LABOUR' | 'UTILITY' | 'MACHINE_DEPRECIATION' | 'DIRECT_OVERHEAD'>('UTILITY');
  const [ohDesc, setOhDesc] = useState('');
  const [ohMethod, setOhMethod] = useState<OverheadAllocationMethod>('PER_BATCH');
  const [ohRate, setOhRate] = useState('0');

  // Post-finalization note
  const [postNote, setPostNote] = useState('');

  const canEntry = hasPermission('production.costing.entry');
  const canReview = hasPermission('production.costing.review');
  const canFinalize = hasPermission('production.costing.finalize');

  const loadDetail = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await productionService.costing.getBatchDetail(batchId);
      setDetail(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch costing');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleCalculate = async () => {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await productionService.costing.calculate(batchId, { includeBomOverheads: true });
      setNotice('Batch costing calculated successfully.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async () => {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      await productionService.costing.review(batchId, 'Reviewed via Batch Costing Detail');
      setNotice('Batch costing marked as REVIEWED.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      await productionService.costing.finalize(batchId, {
        idempotencyKey: `UI-FINALIZE-${batchId}`,
      });
      setNotice('Batch costing finalized and finished-goods valuation updated.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalization failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      await productionService.costing.addEntry(batchId, {
        entryType,
        description: entryDesc,
        quantityOrHours: entryQty,
        rate: entryRate,
        reference: entryRef || undefined,
      });
      setEntryDesc('');
      setEntryQty('1');
      setEntryRate('0');
      setEntryRef('');
      setNotice('Cost entry recorded. Recalculate costing to update totals.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cost entry');
    } finally {
      setBusy(false);
    }
  };

  const handleAddOverhead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      await productionService.costing.addOverhead(batchId, {
        costType: ohType,
        description: ohDesc,
        allocationMethod: ohMethod,
        rateOrAmount: ohRate,
      });
      setOhDesc('');
      setOhRate('0');
      setNotice('Overhead allocation added. Recalculate costing to update totals.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add overhead');
    } finally {
      setBusy(false);
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !postNote.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await productionService.costing.addPostFinalizationNote(batchId, postNote.trim());
      setPostNote('');
      setNotice('Post-finalization adjustment note recorded.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record note');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-xs text-slate-500">Loading batch costing details...</div>;
  }

  if (!detail) {
    return <div className="p-6 text-xs text-red-600">{error || 'Batch not found'}</div>;
  }

  const { batch, costing, materialBreakdown } = detail;
  const isFinalized = costing?.status === 'FINALIZED';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to="/production/costing"
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Costing
          </Link>
          <h2 className="text-lg font-semibold text-brand-navy">
            Batch Costing: {batch.batchNumber}
          </h2>
          <Badge variant={isFinalized ? 'success' : 'teal'}>
            {costing ? costing.status : 'NOT_CALCULATED'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEntry && !isFinalized && (
            <Button size="sm" onClick={handleCalculate} disabled={busy}>
              <Calculator className="mr-1.5 h-3.5 w-3.5" />
              {costing ? 'Recalculate Costing' : 'Calculate Costing'}
            </Button>
          )}
          {canReview && costing?.status === 'CALCULATED' && (
            <Button size="sm" variant="secondary" onClick={handleReview} disabled={busy}>
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Mark Reviewed
            </Button>
          )}
          {canFinalize && costing?.status === 'REVIEWED' && (
            <Button size="sm" onClick={handleFinalize} disabled={busy}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Finalize &amp; Value FG
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      {/* Summary & Standard vs Actual Comparison */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Cost Derivation &amp; Unit Economics
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-slate-500">Product</dt>
            <dd className="font-medium text-slate-900">{batch.productVariant?.name}</dd>
            <dt className="text-slate-500">Net Material Cost (Gross - Returns)</dt>
            <dd className="font-mono">
              ₹{Number(materialBreakdown.netMaterialCost).toFixed(4)} (₹
              {Number(materialBreakdown.grossMaterialCost).toFixed(2)} - ₹
              {Number(materialBreakdown.materialReturnCost).toFixed(2)})
            </dd>
            <dt className="text-slate-500">Direct Labour / Machine / Other</dt>
            <dd className="font-mono">
              ₹{Number(costing?.actualLabourCost || 0).toFixed(2)} / ₹
              {Number(costing?.actualMachineCost || 0).toFixed(2)} / ₹
              {Number(costing?.otherDirectCost || 0).toFixed(2)}
            </dd>
            <dt className="text-slate-500">Allocated Production Overhead</dt>
            <dd className="font-mono">₹{Number(costing?.actualOverheadCost || 0).toFixed(2)}</dd>
            <dt className="text-slate-500">Total Actual Production Cost</dt>
            <dd className="font-mono font-semibold text-brand-navy">
              ₹{Number(costing?.totalActualCost || 0).toFixed(4)}
            </dd>
            <dt className="text-slate-500">Wastage &amp; Rejection Cost (Separated)</dt>
            <dd className="font-mono text-red-600">
              ₹{Number(costing?.wastageAndRejectionCost || 0).toFixed(4)}
            </dd>
            <dt className="text-slate-500">Accepted Good Output / Unit Cost</dt>
            <dd className="font-mono font-bold text-emerald-700">
              {Number(costing?.acceptedQuantity || batch.actualGoodQuantity).toFixed(4)}{' '}
              {batch.uom?.symbol} @ ₹{Number(costing?.costPerAcceptedUnit || 0).toFixed(4)}
            </dd>
            <dt className="text-slate-500">FG Valuation Applied</dt>
            <dd>
              {costing?.fgValuationApplied ? (
                <Badge variant="success">
                  Applied (₹{Number(costing.fgValuationUnitCost || 0).toFixed(4)})
                </Badge>
              ) : (
                <Badge variant="default">Pending Finalization</Badge>
              )}
            </dd>
          </dl>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Standard vs Actual Variance
          </h3>
          {costing ? (
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5">Component</th>
                  <th className="py-1.5 text-right">Standard</th>
                  <th className="py-1.5 text-right">Actual</th>
                  <th className="py-1.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-1.5 font-sans">Material</td>
                  <td className="py-1.5 text-right">₹{Number(costing.standardMaterialCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">₹{Number(costing.netMaterialCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">
                    ₹{Number(costing.materialVarianceAmount).toFixed(2)} ({costing.materialVariancePercent}%)
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans">Direct Labour</td>
                  <td className="py-1.5 text-right">₹{Number(costing.standardLabourCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">₹{Number(costing.actualLabourCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">
                    ₹{Number(costing.labourVarianceAmount).toFixed(2)} ({costing.labourVariancePercent}%)
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans">Machine &amp; Overhead</td>
                  <td className="py-1.5 text-right">₹{Number(costing.standardOverheadCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">
                    ₹
                    {(
                      Number(costing.actualMachineCost) +
                      Number(costing.otherDirectCost) +
                      Number(costing.actualOverheadCost)
                    ).toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right">
                    ₹{Number(costing.overheadVarianceAmount).toFixed(2)} ({costing.overheadVariancePercent}%)
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1.5 font-sans">Total Batch Cost</td>
                  <td className="py-1.5 text-right">₹{Number(costing.standardTotalCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">₹{Number(costing.totalActualCost).toFixed(2)}</td>
                  <td className="py-1.5 text-right">
                    ₹{Number(costing.totalVarianceAmount).toFixed(2)} ({costing.totalVariancePercent}%)
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-500">
              Click Calculate Costing to generate standard vs actual variance analysis.
            </p>
          )}
        </Card>
      </div>

      {/* Material Cost Breakdown */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Material Cost Breakdown (Historical Inventory Transactions)
          </h3>
          <Badge variant={materialBreakdown.isLedgerReconciled ? 'success' : 'warning'}>
            {materialBreakdown.isLedgerReconciled ? 'Ledger Reconciled' : 'Ledger Mismatch'}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5 text-right">Consumed</th>
                <th className="px-2 py-1.5 text-right">Returned</th>
                <th className="px-2 py-1.5 text-right">Net Qty</th>
                <th className="px-2 py-1.5 text-right">Gross Cost</th>
                <th className="px-2 py-1.5 text-right">Return Cost</th>
                <th className="px-2 py-1.5 text-right">Net Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materialBreakdown.lines.map(line => (
                <tr key={line.inventoryItemId}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{line.itemCode}</span> – {line.itemName}
                  </td>
                  <td className="px-2 py-1.5">{line.itemType}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {line.consumedQuantity} {line.baseUomSymbol}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{line.returnedQuantity}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{line.netQuantity}</td>
                  <td className="px-2 py-1.5 text-right font-mono">₹{line.grossCost}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                    -₹{line.returnCost}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-medium">₹{line.netCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Labour & Machine Cost Entries + Overhead Allocations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Labour, Machine &amp; Direct Cost Entries
          </h3>
          {canEntry && !isFinalized && (
            <form onSubmit={handleAddEntry} className="mb-3 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2.5 text-xs">
              <select
                aria-label="Cost entry type"
                value={entryType}
                onChange={e => setEntryType(e.target.value as ProductionCostEntryType)}
                className="rounded border border-slate-200 px-2 py-1"
              >
                <option value="DIRECT_LABOUR">Direct Labour</option>
                <option value="MACHINE_COST">Machine Cost</option>
                <option value="OTHER_DIRECT_EXPENSE">Other Direct Expense</option>
              </select>
              <input
                type="text"
                required
                placeholder="Description"
                value={entryDesc}
                onChange={e => setEntryDesc(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <input
                type="number"
                step="0.0001"
                required
                placeholder="Hours / Qty"
                value={entryQty}
                onChange={e => setEntryQty(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <input
                type="number"
                step="0.0001"
                required
                placeholder="Rate per unit/hr"
                value={entryRate}
                onChange={e => setEntryRate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <input
                type="text"
                placeholder="Reference (optional)"
                value={entryRef}
                onChange={e => setEntryRef(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <Button type="submit" size="sm" disabled={busy}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Entry
              </Button>
            </form>
          )}
          <div className="space-y-1.5 text-xs">
            {(costing?.costEntries || []).map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5"
              >
                <div>
                  <div className="font-medium">
                    {entry.entryType} – {entry.description}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {entry.quantityOrHours} × ₹{entry.rate} = ₹{entry.totalAmount} ·{' '}
                    <Badge
                      variant={
                        entry.approvalStatus === 'APPROVED'
                          ? 'success'
                          : entry.approvalStatus === 'REJECTED'
                            ? 'outline'
                            : 'warning'
                      }
                    >
                      {entry.approvalStatus}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canReview && entry.approvalStatus === 'PENDING' && !isFinalized && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await productionService.costing.reviewEntry(entry.id, 'APPROVED');
                          await loadDetail();
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await productionService.costing.reviewEntry(entry.id, 'REJECTED');
                          await loadDetail();
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {canEntry && !isFinalized && (
                    <button
                      type="button"
                      aria-label="Delete cost entry"
                      onClick={async () => {
                        await productionService.costing.deleteEntry(entry.id);
                        await loadDetail();
                      }}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(!costing?.costEntries || costing.costEntries.length === 0) && (
              <p className="text-slate-400">No labour or machine cost entries recorded yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Overhead Allocations</h3>
          {canEntry && !isFinalized && (
            <form onSubmit={handleAddOverhead} className="mb-3 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2.5 text-xs">
              <select
                aria-label="Overhead cost type"
                value={ohType}
                onChange={e => setOhType(e.target.value as typeof ohType)}
                className="rounded border border-slate-200 px-2 py-1"
              >
                <option value="UTILITY">Utility</option>
                <option value="MACHINE_DEPRECIATION">Machine Depreciation</option>
                <option value="DIRECT_OVERHEAD">Direct Overhead</option>
                <option value="LABOUR">Labour Overhead</option>
              </select>
              <select
                aria-label="Overhead allocation method"
                value={ohMethod}
                onChange={e => setOhMethod(e.target.value as OverheadAllocationMethod)}
                className="rounded border border-slate-200 px-2 py-1"
              >
                <option value="PER_BATCH">Per Batch</option>
                <option value="PER_UNIT">Per Unit</option>
                <option value="PERCENT_OF_MATERIAL">% of Material Cost</option>
                <option value="PER_LABOUR_HOUR">Per Labour Hour</option>
              </select>
              <input
                type="text"
                required
                placeholder="Description"
                value={ohDesc}
                onChange={e => setOhDesc(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <input
                type="number"
                step="0.0001"
                required
                placeholder="Rate / Amount"
                value={ohRate}
                onChange={e => setOhRate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
              <Button type="submit" size="sm" disabled={busy} className="col-span-2">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Overhead Allocation
              </Button>
            </form>
          )}
          <div className="space-y-1.5 text-xs">
            {(costing?.overheadAllocations || []).map(oh => (
              <div
                key={oh.id}
                className="flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5"
              >
                <div>
                  <div className="font-medium">
                    {oh.costType} – {oh.description}{' '}
                    {oh.isFromBom && <Badge variant="teal">BOM</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {oh.allocationMethod} (Basis: {oh.basisValue} × {oh.rateOrAmount}) = ₹
                    {oh.allocatedAmount}
                  </div>
                </div>
                {canEntry && !isFinalized && (
                  <button
                    type="button"
                    aria-label="Delete overhead allocation"
                    onClick={async () => {
                      await productionService.costing.deleteOverhead(oh.id);
                      await loadDetail();
                    }}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {(!costing?.overheadAllocations || costing.overheadAllocations.length === 0) && (
              <p className="text-slate-400">No overhead allocations yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Post-finalization note & Costing History */}
      {isFinalized && canFinalize && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Post-Finalization Adjustment Note (Immutable Costing)
          </h3>
          {costing?.postFinalizationAdjustmentNote && (
            <pre className="mb-2 whitespace-pre-wrap rounded bg-amber-50 p-2 text-xs text-amber-900">
              {costing.postFinalizationAdjustmentNote}
            </pre>
          )}
          <form onSubmit={handlePostNote} className="flex gap-2">
            <input
              type="text"
              required
              value={postNote}
              onChange={e => setPostNote(e.target.value)}
              placeholder="Record post-finalization return/quality variance note..."
              className="flex-1 rounded border border-slate-200 px-2.5 py-1.5 text-xs"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Record Note
            </Button>
          </form>
        </Card>
      )}

      {costing?.history && costing.history.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Costing Audit History</h3>
          <div className="space-y-1.5 text-xs">
            {costing.history.map(h => (
              <div key={h.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                <div>
                  <span className="font-medium">{h.action}</span> ({h.fromStatus || 'NEW'} →{' '}
                  {h.toStatus}) – {h.notes}
                </div>
                <span className="text-[11px] text-slate-400">
                  {h.changedBy?.fullName} · {new Date(h.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
