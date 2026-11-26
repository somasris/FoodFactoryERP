import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { warehouseService } from '../../services/warehouse.service';
import { WarehouseSelector } from '../../components/warehouse/WarehouseSelector';

export const WarehouseAnalyticsPage: React.FC = () => {
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['warehouse', 'analytics', warehouseId],
    queryFn: () => warehouseService.getAnalytics(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const analytics = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#17452C]">Warehouse Analytics</h1>
          <p className="text-xs text-[#66756A]">
            Bin utilization, empty bin availability, cycle-count accuracy, expiry risk, and movement volume.
          </p>
        </div>
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
          Loading warehouse analytics...
        </div>
      ) : isError || !analytics ? (
        <div className="rounded-lg border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
          Select a warehouse to view analytics.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-3.5 shadow-sm">
              <div className="text-[11px] text-[#66756A]">Bin Utilization</div>
              <div className="mt-1 text-xl font-bold text-[#17452C]">
                {analytics.locationUtilization.utilizationPercent}%
              </div>
              <div className="text-[11px] text-[#66756A]">
                {analytics.locationUtilization.totalUsed} / {analytics.locationUtilization.totalCapacity}
              </div>
            </div>
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-3.5 shadow-sm">
              <div className="text-[11px] text-[#66756A]">Empty Active Bins</div>
              <div className="mt-1 text-xl font-bold text-[#17452C]">
                {analytics.locationUtilization.emptyBinsCount}
              </div>
              <div className="text-[11px] text-[#66756A]">
                of {analytics.locationUtilization.activeBins} active bins
              </div>
            </div>
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-3.5 shadow-sm">
              <div className="text-[11px] text-[#66756A]">Cycle Count Accuracy</div>
              <div className="mt-1 text-xl font-bold text-[#17452C]">
                {analytics.pickingAccuracyPercent}%
              </div>
              <div className="text-[11px] text-[#66756A]">
                Net variance: ₹{analytics.cycleCountVariance.netVarianceValue}
              </div>
            </div>
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-3.5 shadow-sm">
              <div className="text-[11px] text-[#66756A]">Expiry Risk (30d)</div>
              <div className="mt-1 text-xl font-bold text-[#C74440]">
                {analytics.expiryRiskByLocation.length}
              </div>
              <div className="text-[11px] text-[#66756A]">batches in bins</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-bold uppercase text-[#17452C]">Stock by Location</h2>
              {analytics.stockByLocation.length === 0 ? (
                <p className="text-xs text-[#66756A]">No bin stock allocated yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E1E7DD] text-[#66756A]">
                    <tr>
                      <th className="py-1.5">Bin</th>
                      <th className="py-1.5 text-right">Quantity</th>
                      <th className="py-1.5 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F4ED]">
                    {analytics.stockByLocation.map(s => (
                      <tr key={s.binId}>
                        <td className="py-1.5 font-mono font-semibold text-[#17452C]">{s.binCode}</td>
                        <td className="py-1.5 text-right font-mono">{s.quantity}</td>
                        <td className="py-1.5 text-right font-mono">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-bold uppercase text-[#17452C]">
                Movement Volume (30 Days)
              </h2>
              {analytics.movementVolume.last30Days.length === 0 ? (
                <p className="text-xs text-[#66756A]">No bin movements in the last 30 days.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.movementVolume.last30Days.map(m => (
                    <div
                      key={m.type}
                      className="flex items-center justify-between rounded border border-[#E1E7DD] bg-[#FAFBF8] px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[#24352A]">{m.type}</span>
                      <span className="font-mono font-bold text-[#17452C]">{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
