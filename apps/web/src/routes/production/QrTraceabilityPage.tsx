import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Package, ShieldCheck, Truck, Clock, ArrowLeft } from 'lucide-react';
import { batchQrService } from '../../services/batch-qr.service';
import { useTranslation } from '../../i18n/I18nContext';

export const QrTraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const { reference } = useParams<{ reference: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'qr-trace', reference],
    queryFn: async () => {
      const res = await batchQrService.resolveTraceability(reference || '');
      return res.data!;
    },
    enabled: Boolean(reference),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
        Resolving batch QR traceability...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-3 rounded-xl border border-[#C74440]/30 bg-white p-6 text-xs text-[#C74440]">
        <div className="font-bold">Traceability Lookup Failed</div>
        <p>{error instanceof Error ? error.message : 'Invalid or revoked QR reference.'}</p>
        <Link
          to="/production/traceability"
          className="inline-flex items-center gap-1 font-semibold text-[#245C3A] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Batch Traceability</span>
        </Link>
      </div>
    );
  }

  const { batchIdentity, recipeAndInputs, productionHistory, qualityHistory, finishedGoodsAndMovement, timeline } =
    data;

  return (
    <div className="space-y-5">
      {/* Batch Identity Header */}
      <div className="rounded-xl border border-[#E1E7DD] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#245C3A]">
              <GitBranch className="h-4 w-4" />
              <span>{t('traceability.scanToTraceTitle')}</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-[#17452C]">
              {batchIdentity.batchNumber} — {batchIdentity.productName}
            </h1>
            <p className="text-xs text-[#66756A]">
              {batchIdentity.variantName} ({batchIdentity.sku}) • Category: {batchIdentity.categoryName} •
              Plant: {batchIdentity.factoryName}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-[#EAF1E8] px-3 py-1 text-xs font-semibold text-[#17452C]">
              Batch: {batchIdentity.status}
            </span>
            <span className="rounded-full bg-[#F4F0E4] px-3 py-1 text-xs font-semibold text-[#8A5D12]">
              Quality: {batchIdentity.qualityStatus}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#E1E7DD] pt-4 text-xs sm:grid-cols-4">
          <div>
            <div className="text-[#66756A]">Work Order</div>
            <Link
              to={`/production/work-orders/${batchIdentity.workOrderId}`}
              className="font-mono font-semibold text-[#245C3A] hover:underline"
            >
              {batchIdentity.workOrderNumber}
            </Link>
          </div>
          <div>
            <div className="text-[#66756A]">Good / Planned Qty</div>
            <div className="font-semibold text-[#24352A]">
              {batchIdentity.actualGoodQuantity} / {batchIdentity.plannedQuantity} {batchIdentity.uomSymbol}
            </div>
          </div>
          <div>
            <div className="text-[#66756A]">Manufacturing Date</div>
            <div className="font-semibold text-[#24352A]">
              {batchIdentity.manufacturingDate
                ? new Date(batchIdentity.manufacturingDate).toLocaleDateString()
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-[#66756A]">Expiry Date</div>
            <div className="font-semibold text-[#24352A]">
              {batchIdentity.expiryDate ? new Date(batchIdentity.expiryDate).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Recipe & Input Materials + Quality */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17452C]">
            <Package className="h-4 w-4 text-[#245C3A]" />
            <span>
              {t('traceability.recipeAndInputs')} (BOM {recipeAndInputs.bomCode} v
              {recipeAndInputs.bomVersionNumber})
            </span>
          </h2>
          <div className="space-y-2 text-xs">
            {recipeAndInputs.consumptions.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded border border-[#E1E7DD] p-2.5"
              >
                <div>
                  <div className="font-semibold text-[#24352A]">
                    {c.itemName} ({c.itemCode})
                  </div>
                  <div className="text-[11px] text-[#66756A]">
                    Source Batch: <span className="font-mono">{c.sourceBatchNumber}</span>
                  </div>
                </div>
                <span className="font-mono font-semibold text-[#17452C]">
                  {c.quantity} {c.uomSymbol}
                </span>
              </div>
            ))}
            {recipeAndInputs.consumptions.length === 0 && (
              <div className="text-[#66756A]">No material consumption recorded yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E1E7DD] bg-white p-4 space-y-4">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#17452C]">
              <ShieldCheck className="h-4 w-4 text-[#245C3A]" />
              <span>{t('traceability.qualityHistory')}</span>
            </h2>
            {qualityHistory ? (
              <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3 text-xs space-y-1">
                <div className="font-mono font-semibold text-[#17452C]">
                  {qualityHistory.inspectionNumber} • {qualityHistory.decision}
                </div>
                <div>
                  Accepted: {qualityHistory.acceptedQuantity} • Rejected: {qualityHistory.rejectedQuantity} •
                  Quarantined: {qualityHistory.quarantinedQuantity}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#66756A]">No quality inspection recorded yet.</div>
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#17452C]">
              <Truck className="h-4 w-4 text-[#245C3A]" />
              <span>{t('traceability.finishedGoodsDispatch')}</span>
            </h2>
            <div className="text-xs text-[#66756A]">
              FG Batch:{' '}
              <span className="font-mono font-semibold text-[#24352A]">
                {finishedGoodsAndMovement.finishedGoodsBatchNumber ?? 'Not yet received into FG'}
              </span>
            </div>
            {finishedGoodsAndMovement.dispatches.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {finishedGoodsAndMovement.dispatches.map(d => (
                  <li key={d.fulfillmentNumber} className="text-[#24352A]">
                    Order{' '}
                    <Link
                      to={`/sales/orders/${d.salesOrderId}`}
                      className="font-mono font-semibold text-[#245C3A] hover:underline"
                    >
                      {d.salesOrderNumber}
                    </Link>{' '}
                    ({d.fulfillmentNumber})
                  </li>
                ))}
              </ul>
            )}
            {productionHistory.costing && (
              <div className="mt-3 rounded border border-[#E1E7DD] bg-[#EAF1E8]/50 p-2 text-xs text-[#17452C]">
                Costing ({productionHistory.costing.status}): Total ₹
                {productionHistory.costing.totalProductionCost} • Unit ₹
                {productionHistory.costing.costPerGoodUnit}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chronological Traceability Timeline */}
      <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17452C]">
          <Clock className="h-4 w-4 text-[#245C3A]" />
          <span>{t('traceability.timeline')}</span>
        </h2>
        <div className="space-y-2.5">
          {timeline.map((step, i) => (
            <div key={i} className="flex items-start gap-3 border-l-2 border-[#245C3A] pl-3 text-xs">
              <div className="flex-1">
                <div className="font-semibold text-[#17452C]">{step.title}</div>
                <div className="text-[#66756A]">{step.detail}</div>
              </div>
              <span className="text-[11px] text-[#8A958C]">
                {new Date(step.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
