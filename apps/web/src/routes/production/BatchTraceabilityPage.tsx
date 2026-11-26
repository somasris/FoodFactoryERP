import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { GitBranch, Search } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { ScannerInput } from '../../components/warehouse/ScannerInput';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const BatchTraceabilityPage: React.FC = () => {
  const navigate = useNavigate();
  const [inputBatch, setInputBatch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [qrInput, setQrInput] = useState('');

  const handleQrNavigate = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const match = trimmed.match(/\/trace\/batch\/([^/?#]+)/);
    const token = match ? match[1] : trimmed;
    navigate(`/trace/batch/${encodeURIComponent(token)}`);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'traceability', searchTerm],
    queryFn: () => productionService.traceability.recall(searchTerm),
    enabled: Boolean(searchTerm),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputBatch.trim()) {
      setSearchTerm(inputBatch.trim());
    }
  };

  const matches = data?.data?.matches || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
            <GitBranch className="h-4 w-4 text-brand-teal" /> Batch Genealogy & Recall Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Enter Finished Goods Batch # (PB/...) or Raw Material Batch #..."
                value={inputBatch}
                onChange={e => setInputBatch(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-2 pr-3 pl-8 text-xs"
              />
            </div>
            <Button type="submit" variant="teal" size="sm">
              Trace Batch
            </Button>
          </form>
          <div className="mt-4 border-t border-[#E1E7DD] pt-3">
            <ScannerInput
              label="Scan-to-Trace Batch QR (Camera or Manual Token)"
              value={qrInput}
              onChange={setQrInput}
              onScanSubmit={handleQrNavigate}
              placeholder="Scan QR code or enter QR reference token..."
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Tracing batch genealogy...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Recall lookup failed'}
        </div>
      )}

      {searchTerm && !isLoading && matches.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
          No inventory or production batches matched "{searchTerm}".
        </div>
      )}

      {matches.map(m => (
        <Card key={m.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-brand-navy">
                Batch: {m.batchNumber} ({m.inventoryItem?.code} — {m.inventoryItem?.name})
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Type: {m.inventoryItem?.itemType} · Mfg:{' '}
                {m.manufacturingDate ? new Date(m.manufacturingDate).toLocaleDateString() : '—'} · Expiry:{' '}
                {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}
              </p>
            </div>
            <Badge variant={m.qualityStatus === 'ACCEPTED' ? 'success' : 'warning'}>{m.qualityStatus}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {m.producedFromBatches && m.producedFromBatches.length > 0 && (
              <div>
                <div className="mb-1 font-semibold text-slate-700">
                  Source Production & Consumed Raw Materials (Upstream)
                </div>
                {m.producedFromBatches.map(pb => (
                  <div key={pb.id} className="rounded border border-slate-200 bg-slate-50 p-2.5">
                    <div>
                      Production Batch:{' '}
                      <Link to={`/production/batches/${pb.id}`} className="font-medium text-brand-teal hover:underline">
                        {pb.batchNumber}
                      </Link>{' '}
                      · Work Order: <strong>{pb.workOrder?.workOrderNumber}</strong>
                      {pb.qualityInspection && ` · QI: ${pb.qualityInspection.inspectionNumber} (${pb.qualityInspection.decision})`}
                    </div>
                    {pb.consumptions && pb.consumptions.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-slate-600">
                        {pb.consumptions.map(c => (
                          <li key={c.id}>
                            {c.inventoryItem?.code} ({c.inventoryItem?.name}) — RM Batch:{' '}
                            <strong>{c.batch?.batchNumber || 'Unbatched'}</strong> · Qty: {Number(c.baseQuantity).toFixed(4)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {m.consumedInBatches && m.consumedInBatches.length > 0 && (
              <div>
                <div className="mb-1 font-semibold text-slate-700">
                  Finished Goods Batches Produced Using This Material (Downstream Recall)
                </div>
                <ul className="list-disc space-y-1 pl-5 text-slate-700">
                  {m.consumedInBatches.map(cb => (
                    <li key={cb.id}>
                      Production Batch:{' '}
                      <Link
                        to={`/production/batches/${cb.productionBatch?.id}`}
                        className="font-medium text-brand-teal hover:underline"
                      >
                        {cb.productionBatch?.batchNumber}
                      </Link>{' '}
                      → FG Batch:{' '}
                      <strong>{cb.productionBatch?.finishedGoodsBatch?.batchNumber || 'Pending'}</strong> (
                      {cb.productionBatch?.finishedGoodsBatch?.qualityStatus || 'N/A'})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {m.transactionLines && m.transactionLines.length > 0 && (
              <div>
                <div className="mb-1 font-semibold text-slate-700">Sales Order Dispatches</div>
                <ul className="list-disc space-y-0.5 pl-5 text-slate-700">
                  {m.transactionLines.map(tl => (
                    <li key={tl.id}>
                      Sales Order: <strong>{tl.transaction?.referenceNumber}</strong> · Qty:{' '}
                      {Math.abs(Number(tl.quantity)).toFixed(4)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
