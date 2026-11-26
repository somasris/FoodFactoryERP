import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';
import { ScannerInput } from '../../components/warehouse/ScannerInput';

export const ScanOperationsPage: React.FC = () => {
  const [warehouseId, setWarehouseId] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [operation, setOperation] = useState<'PUT_AWAY' | 'BIN_TRANSFER' | 'PICK'>('PUT_AWAY');
  const [itemBarcode, setItemBarcode] = useState('');
  const [fromBinBarcode, setFromBinBarcode] = useState('');
  const [toBinBarcode, setToBinBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [execMessage, setExecMessage] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const lookupMut = useMutation({
    mutationFn: (code: string) => warehouseService.lookupBarcode(code),
    onSuccess: res => {
      setLookupResult((res.data as Record<string, unknown>) ?? null);
      setLookupError(null);
    },
    onError: e => {
      setLookupResult(null);
      setLookupError(e instanceof Error ? e.message : 'Lookup failed');
    },
  });

  const execMut = useMutation({
    mutationFn: () =>
      warehouseService.executeScan({
        operation,
        warehouseId,
        itemOrBatchBarcode: itemBarcode,
        fromBinBarcode: fromBinBarcode || undefined,
        toBinBarcode: toBinBarcode || undefined,
        quantity,
      }),
    onSuccess: res => {
      setExecError(null);
      setExecMessage(`Completed ${operation}: ${res.data?.movementNumber ?? 'OK'}`);
    },
    onError: e => {
      setExecMessage(null);
      setExecError(e instanceof Error ? e.message : 'Scan operation failed');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Scan Operations</h1>
          <p className="text-xs text-[#66756A]">
            Camera, keyboard-wedge scanner, or manual code lookup and scan-driven bin workflows.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-[#17452C]">Barcode / QR Lookup</h2>
          <ScannerInput
            label="Scan or Enter Barcode / Code"
            value={lookupCode}
            onChange={setLookupCode}
            onScanSubmit={code => lookupMut.mutate(code)}
          />
          {lookupError && <p className="text-xs text-[#C74440]">{lookupError}</p>}
          {lookupResult && (
            <pre className="max-h-60 overflow-auto rounded border border-[#E1E7DD] bg-[#FAFBF8] p-2.5 text-[11px] text-[#24352A]">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          )}
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            execMut.mutate();
          }}
          className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-bold text-[#17452C]">Execute Scan Workflow</h2>
          <div className="flex gap-2">
            {(['PUT_AWAY', 'BIN_TRANSFER', 'PICK'] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setOperation(op)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  operation === op
                    ? 'bg-[#245C3A] text-white'
                    : 'border border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]'
                }`}
              >
                {op.replace('_', ' ')}
              </button>
            ))}
          </div>

          <ScannerInput
            label="Item or Batch Barcode / Code"
            value={itemBarcode}
            onChange={setItemBarcode}
          />
          {(operation === 'BIN_TRANSFER' || operation === 'PICK') && (
            <ScannerInput
              label="From Bin Barcode / Code"
              value={fromBinBarcode}
              onChange={setFromBinBarcode}
            />
          )}
          {(operation === 'PUT_AWAY' || operation === 'BIN_TRANSFER') && (
            <ScannerInput
              label="To Bin Barcode / Code"
              value={toBinBarcode}
              onChange={setToBinBarcode}
            />
          )}
          <div>
            <label className="block text-xs font-semibold text-[#24352A]">Quantity</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="mt-1 w-32 rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={!warehouseId || execMut.isPending}
            className="rounded bg-[#245C3A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            Confirm Scan Operation
          </button>

          {execMessage && <p className="text-xs font-medium text-[#17452C]">{execMessage}</p>}
          {execError && <p className="text-xs text-[#C74440]">{execError}</p>}
        </form>
      </div>
    </div>
  );
};
