import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Thermometer } from 'lucide-react';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const WarehouseLayoutPage: React.FC = () => {
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['warehouse', 'layout', warehouseId],
    queryFn: () => warehouseService.getLayout(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const layout = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Warehouse Layout</h1>
          <p className="text-xs text-[#66756A]">
            Factory → Warehouse → Zone → Rack → Shelf → Bin hierarchy & live capacity utilization.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      {!warehouseId ? (
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
          Select a warehouse to inspect its physical layout.
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
          Loading warehouse layout...
        </div>
      ) : isError || !layout ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-[#C74440]">
          Unable to load warehouse layout.
        </div>
      ) : (
        <div className="space-y-4">
          {layout.factory && (
            <div className="rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-4 py-2 text-xs text-[#24352A]">
              <span className="font-semibold">Factory:</span> {layout.factory.code} —{' '}
              {layout.factory.name} ({layout.factory.state}) ·{' '}
              <span className="font-semibold">Warehouse:</span> {layout.code} ({layout.warehouseType})
            </div>
          )}

          {layout.zones.length === 0 ? (
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
              No zones configured in this warehouse yet.
            </div>
          ) : (
            layout.zones.map(zone => (
              <div
                key={zone.id}
                className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F4ED] pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#245C3A]" />
                    <span className="font-mono text-xs font-bold text-[#17452C]">{zone.code}</span>
                    <span className="text-sm font-semibold text-[#24352A]">{zone.name}</span>
                    <span className="rounded bg-[#EAF1E8] px-2 py-0.5 text-[10px] font-semibold text-[#17452C]">
                      {zone.storageCondition}
                    </span>
                    {zone.isTemperatureControlled && (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                        <Thermometer className="h-3 w-3" /> Temp Controlled
                      </span>
                    )}
                  </div>
                  {zone.allergenProfile && (
                    <span className="text-[11px] text-amber-700">
                      Allergen: {zone.allergenProfile}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {zone.racks.map(rack => (
                    <div
                      key={rack.id}
                      className="rounded-md border border-[#E1E7DD] bg-[#FAFBF8] p-3 space-y-2"
                    >
                      <div className="text-xs font-semibold text-[#24352A]">
                        Rack <span className="font-mono">{rack.code}</span> — {rack.name}
                        {rack.aisle ? ` (Aisle ${rack.aisle})` : ''}
                      </div>
                      {rack.shelves.map(shelf => (
                        <div key={shelf.id} className="space-y-1.5 pl-2 border-l-2 border-[#CBD5C5]">
                          <div className="text-[11px] font-medium text-[#66756A]">
                            Shelf {shelf.code} (Level {shelf.levelNumber})
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {shelf.bins.map(bin => (
                              <div
                                key={bin.id}
                                className={`rounded border p-2 text-[11px] ${
                                  bin.isActive
                                    ? 'border-[#E1E7DD] bg-white'
                                    : 'border-slate-200 bg-slate-100 opacity-70'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-[#17452C]">
                                    {bin.code}
                                  </span>
                                  <span className="text-[10px] text-[#66756A]">
                                    {bin.utilizationPercent ?? 0}%
                                  </span>
                                </div>
                                <div className="mt-0.5 truncate text-[10px] text-[#66756A]">
                                  {bin.usedQuantity ?? '0'} / {bin.capacityQuantity}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
