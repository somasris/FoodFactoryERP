import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';
import { StorageCondition, WarehouseLocationType } from '../../types/warehouse';

export const ZoneBinManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [storageCondition, setStorageCondition] = useState<StorageCondition>('AMBIENT');

  const [rackZoneId, setRackZoneId] = useState('');
  const [rackCode, setRackCode] = useState('');
  const [rackName, setRackName] = useState('');

  const [shelfRackId, setShelfRackId] = useState('');
  const [shelfCode, setShelfCode] = useState('');
  const [shelfName, setShelfName] = useState('');

  const [binShelfId, setBinShelfId] = useState('');
  const [binCode, setBinCode] = useState('');
  const [binName, setBinName] = useState('');
  const [binCapacity, setBinCapacity] = useState('100');
  const [binType, setBinType] = useState<WarehouseLocationType>('BIN');

  const { data: layoutData } = useQuery({
    queryKey: ['warehouse', 'layout', warehouseId],
    queryFn: () => warehouseService.getLayout(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const invalidate = () => {
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['warehouse'] });
  };

  const zoneMut = useMutation({
    mutationFn: () =>
      warehouseService.createZone({
        warehouseId,
        code: zoneCode,
        name: zoneName,
        storageCondition,
      }),
    onSuccess: () => {
      setZoneCode('');
      setZoneName('');
      invalidate();
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to create zone'),
  });

  const rackMut = useMutation({
    mutationFn: () =>
      warehouseService.createRack({ warehouseId, zoneId: rackZoneId, code: rackCode, name: rackName }),
    onSuccess: () => {
      setRackCode('');
      setRackName('');
      invalidate();
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to create rack'),
  });

  const shelfMut = useMutation({
    mutationFn: () =>
      warehouseService.createShelf({
        warehouseId,
        rackId: shelfRackId,
        code: shelfCode,
        name: shelfName,
      }),
    onSuccess: () => {
      setShelfCode('');
      setShelfName('');
      invalidate();
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to create shelf'),
  });

  const binMut = useMutation({
    mutationFn: () =>
      warehouseService.createBin({
        warehouseId,
        shelfId: binShelfId,
        code: binCode,
        name: binName,
        locationType: binType,
        storageCondition,
        capacityQuantity: binCapacity,
      }),
    onSuccess: () => {
      setBinCode('');
      setBinName('');
      invalidate();
    },
    onError: e => setError(e instanceof Error ? e.message : 'Failed to create bin'),
  });

  const zones = layoutData?.data?.zones ?? [];
  const racks = zones.flatMap(z => z.racks);
  const shelves = racks.flatMap(r => r.shelves);
  const bins = shelves.flatMap(s => s.bins);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Zone & Bin Management</h1>
          <p className="text-xs text-[#66756A]">
            Configure physical Zones, Racks, Shelves, and Bins with capacity and storage rules.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-[#C74440]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Create Zone */}
        <form
          onSubmit={e => {
            e.preventDefault();
            zoneMut.mutate();
          }}
          className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-2.5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#17452C]">1. Add Zone</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={zoneCode}
              onChange={e => setZoneCode(e.target.value)}
              placeholder="Zone Code (e.g. Z-AMB)"
              className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              placeholder="Zone Name"
              className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <select
              value={storageCondition}
              onChange={e => setStorageCondition(e.target.value as StorageCondition)}
              className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            >
              {(['AMBIENT', 'CHILLED', 'FROZEN', 'DRY', 'HAZMAT', 'QUARANTINE'] as StorageCondition[]).map(
                c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
            <button
              type="submit"
              disabled={!warehouseId || zoneMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add Zone
            </button>
          </div>
        </form>

        {/* Create Rack */}
        <form
          onSubmit={e => {
            e.preventDefault();
            rackMut.mutate();
          }}
          className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-2.5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#17452C]">2. Add Rack</h2>
          <select
            required
            value={rackZoneId}
            onChange={e => setRackZoneId(e.target.value)}
            className="w-full rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Select Parent Zone...</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>
                {z.code} — {z.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              value={rackCode}
              onChange={e => setRackCode(e.target.value)}
              placeholder="Rack Code (e.g. R01)"
              className="flex-1 rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={rackName}
              onChange={e => setRackName(e.target.value)}
              placeholder="Rack Name"
              className="flex-1 rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={!rackZoneId || rackMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </form>

        {/* Create Shelf */}
        <form
          onSubmit={e => {
            e.preventDefault();
            shelfMut.mutate();
          }}
          className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-2.5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#17452C]">3. Add Shelf</h2>
          <select
            required
            value={shelfRackId}
            onChange={e => setShelfRackId(e.target.value)}
            className="w-full rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Select Parent Rack...</option>
            {racks.map(r => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              value={shelfCode}
              onChange={e => setShelfCode(e.target.value)}
              placeholder="Shelf Code (e.g. S01)"
              className="flex-1 rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={shelfName}
              onChange={e => setShelfName(e.target.value)}
              placeholder="Shelf Name"
              className="flex-1 rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={!shelfRackId || shelfMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </form>

        {/* Create Bin */}
        <form
          onSubmit={e => {
            e.preventDefault();
            binMut.mutate();
          }}
          className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-2.5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#17452C]">4. Add Bin</h2>
          <select
            required
            value={binShelfId}
            onChange={e => setBinShelfId(e.target.value)}
            className="w-full rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
          >
            <option value="">Select Parent Shelf...</option>
            {shelves.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={binCode}
              onChange={e => setBinCode(e.target.value)}
              placeholder="Bin Code (e.g. B-01-01)"
              className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={binName}
              onChange={e => setBinName(e.target.value)}
              placeholder="Bin Name"
              className="rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={binType}
              onChange={e => setBinType(e.target.value as WarehouseLocationType)}
              className="rounded border border-[#E1E7DD] px-2 py-1.5 text-xs"
            >
              <option value="BIN">BIN</option>
              <option value="STAGING">STAGING</option>
              <option value="QUARANTINE">QUARANTINE</option>
              <option value="COLD_STORAGE">COLD_STORAGE</option>
              <option value="DISPATCH">DISPATCH</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={binCapacity}
              onChange={e => setBinCapacity(e.target.value)}
              placeholder="Capacity"
              className="w-24 rounded border border-[#E1E7DD] px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={!binShelfId || binMut.isPending}
              className="ml-auto inline-flex items-center gap-1 rounded bg-[#245C3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#17452C] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add Bin
            </button>
          </div>
        </form>
      </div>

      {/* Bins Table */}
      <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
            <tr>
              <th className="px-3 py-2">Bin Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Condition</th>
              <th className="px-3 py-2 text-right">Used / Capacity</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4ED]">
            {bins.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#66756A]">
                  No bins configured yet.
                </td>
              </tr>
            ) : (
              bins.map(b => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono font-semibold text-[#17452C]">{b.code}</td>
                  <td className="px-3 py-2">{b.name}</td>
                  <td className="px-3 py-2">{b.locationType}</td>
                  <td className="px-3 py-2">{b.storageCondition}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {b.usedQuantity ?? '0'} / {b.capacityQuantity}
                  </td>
                  <td className="px-3 py-2">{b.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
