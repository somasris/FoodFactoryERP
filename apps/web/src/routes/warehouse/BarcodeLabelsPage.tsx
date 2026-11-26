import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import { warehouseService } from '../../services/warehouse.service';
import { BarcodeEntityType } from '../../types/warehouse';
import { BarcodeGraphic } from '../../components/warehouse/BarcodeGraphic';

const ENTITY_TYPES: BarcodeEntityType[] = [
  'WAREHOUSE_BIN',
  'INVENTORY_BATCH',
  'RAW_MATERIAL',
  'PACKAGING_MATERIAL',
  'FINISHED_PRODUCT',
  'PURCHASE_RECEIPT',
  'WORK_ORDER',
];

export const BarcodeLabelsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<BarcodeEntityType>('WAREHOUSE_BIN');
  const [entityId, setEntityId] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [labelFormat, setLabelFormat] = useState<'CODE128' | 'QR'>('CODE128');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse', 'barcodes'],
    queryFn: () => warehouseService.listBarcodes(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      warehouseService.createBarcode({
        entityType,
        entityId,
        barcodeValue: customValue.trim() || undefined,
        labelFormat,
      }),
    onSuccess: () => {
      setEntityId('');
      setCustomValue('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'barcodes'] });
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to generate barcode'),
  });

  const labels = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-[#17452C]">Barcode & QR Label Management</h1>
        <p className="text-xs text-[#66756A]">
          Generate and print CODE128 barcodes and QR labels for bins, batches, materials, receipts, and work orders.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            createMut.mutate();
          }}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5"
        >
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value as BarcodeEntityType)}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            {ENTITY_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            required
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            placeholder="Entity UUID"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 font-mono text-xs"
          />
          <input
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            placeholder="Custom Barcode (optional)"
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 font-mono text-xs"
          />
          <select
            value={labelFormat}
            onChange={e => setLabelFormat(e.target.value as 'CODE128' | 'QR')}
            className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="CODE128">CODE128</option>
            <option value="QR">QR</option>
          </select>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="inline-flex items-center justify-center gap-1 rounded bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Generate Label
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-[#C74440]">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
            Loading barcode labels...
          </div>
        ) : labels.length === 0 ? (
          <div className="col-span-full rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
            No barcode labels generated yet.
          </div>
        ) : (
          labels.map(lbl => (
            <div
              key={lbl.id}
              className="flex flex-col items-center justify-between gap-2 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm"
            >
              <div className="w-full flex items-center justify-between text-[11px]">
                <span className="rounded bg-[#EAF1E8] px-2 py-0.5 font-semibold text-[#17452C]">
                  {lbl.entityType}
                </span>
                <span className="font-mono text-[10px] text-[#66756A]">
                  {lbl.entityId.slice(0, 8)}...
                </span>
              </div>
              <BarcodeGraphic value={lbl.barcodeValue} format={lbl.labelFormat} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
