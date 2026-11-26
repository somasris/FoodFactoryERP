import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { Printer, RefreshCw, X, ExternalLink, QrCode } from 'lucide-react';
import { batchQrService, BatchQrResponse } from '../../services/batch-qr.service';
import { useTranslation } from '../../i18n/I18nContext';

interface BatchQrLabelModalProps {
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BatchQrLabelModal: React.FC<BatchQrLabelModalProps> = ({
  batchId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [qrData, setQrData] = useState<BatchQrResponse | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQr = async (regenerate = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = regenerate
        ? await batchQrService.revokeAndRegenerate(batchId, 'Regenerated from batch label view')
        : await batchQrService.generateOrGet(batchId);
      const data = res.data!;
      setQrData(data);

      const traceUrl = `${window.location.origin}${data.tracePath}`;
      const dataUrl = await QRCode.toDataURL(traceUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#17452C', light: '#FFFFFF' },
      });
      setQrImageUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR label');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && batchId) {
      void loadQr(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label="Batch QR Label Preview"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#E1E7DD] bg-white p-5 shadow-xl print:border-none print:shadow-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm font-bold text-[#17452C]">
            <QrCode className="h-4 w-4 text-[#245C3A]" />
            <span>{t('traceability.batchQrLabelPreview')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR label modal"
            className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center text-xs text-[#66756A]">Generating QR label...</div>
        )}

        {error && (
          <div className="rounded-lg bg-[#C74440]/10 p-3 text-xs text-[#C74440]">{error}</div>
        )}

        {qrData && !loading && (
          <>
            {/* Printable Label Card */}
            <div className="rounded-lg border-2 border-[#17452C] bg-white p-4 text-[#24352A]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#245C3A]">
                    {qrData.labelData.companyName}
                  </div>
                  <div className="text-base font-bold text-[#17452C]">
                    {qrData.labelData.productName}
                  </div>
                  <div className="text-xs text-[#66756A]">
                    {qrData.labelData.variantName} ({qrData.labelData.sku})
                  </div>
                  <div className="pt-1 font-mono text-xs font-bold">
                    Batch: {qrData.labelData.batchNumber}
                  </div>
                  <div className="text-xs">
                    Qty: {qrData.labelData.actualGoodQuantity} / {qrData.labelData.plannedQuantity}{' '}
                    {qrData.labelData.uomSymbol}
                  </div>
                  <div className="text-[11px] text-[#66756A]">
                    Mfg:{' '}
                    {qrData.labelData.manufacturingDate
                      ? new Date(qrData.labelData.manufacturingDate).toLocaleDateString()
                      : '—'}{' '}
                    • Exp:{' '}
                    {qrData.labelData.expiryDate
                      ? new Date(qrData.labelData.expiryDate).toLocaleDateString()
                      : '—'}
                  </div>
                  <div className="text-[11px] text-[#66756A]">
                    Plant: {qrData.labelData.factoryName}
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt={`QR code for batch ${qrData.labelData.batchNumber}`}
                      className="h-28 w-28 border border-[#E1E7DD] p-1"
                    />
                  )}
                  <span className="mt-1 font-mono text-[9px] text-[#66756A]">
                    Scan to Trace
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#245C3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Label</span>
                </button>
                <button
                  type="button"
                  onClick={() => void loadQr(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1E7DD] px-3 py-1.5 text-xs font-semibold text-[#17452C] hover:bg-[#EAF1E8]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Regenerate QR</span>
                </button>
              </div>
              <Link
                to={qrData.tracePath}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#245C3A] hover:underline"
              >
                <span>Open Traceability</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
