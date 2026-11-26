import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  Maximize2,
  RefreshCw,
  AlertTriangle,
  Package,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { factoryPulseService } from '../../services/factory-pulse.service';
import { FactoryPulseTvView } from '../../components/production/FactoryPulseTvView';
import { useTranslation } from '../../i18n/I18nContext';

export const FactoryPulsePage: React.FC = () => {
  const { t } = useTranslation();
  const [factoryId, setFactoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [tvMode, setTvMode] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
  );

  useEffect(() => {
    const onVisChange = () => setIsTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['production', 'factory-pulse', factoryId, warehouseId, status],
    queryFn: async () => {
      const res = await factoryPulseService.getPulse({
        factoryId: factoryId || undefined,
        warehouseId: warehouseId || undefined,
        status: status || undefined,
      });
      return res.data!;
    },
    refetchInterval: isTabVisible && (typeof navigator === 'undefined' || navigator.onLine) ? 15000 : false,
  });

  const connectionLabel = (() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Offline';
    if (isError) return 'Delayed';
    if (isFetching) return 'Reconnecting';
    return 'Live';
  })();

  const enterTvMode = async () => {
    setTvMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen API unavailable or denied; fallback to full-viewport overlay
    }
  };

  const exitTvMode = () => {
    setTvMode(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  };

  if (tvMode && data) {
    return (
      <FactoryPulseTvView data={data} connectionLabel={connectionLabel} onExit={exitTvMode} />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E1E7DD] bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF1E8] text-[#245C3A]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#17452C]">{t('factoryPulse.title')}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  connectionLabel === 'Live'
                    ? 'bg-[#EAF1E8] text-[#27834A]'
                    : connectionLabel === 'Offline'
                      ? 'bg-[#F4F0E4] text-[#8A5D12]'
                      : 'bg-[#C74440]/10 text-[#C74440]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {connectionLabel}
              </span>
            </div>
            <p className="text-xs text-[#66756A]">
              {data?.generatedAt
                ? `Last updated: ${new Date(data.generatedAt).toLocaleString()}`
                : 'Connecting to live factory telemetry...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by factory"
            value={factoryId}
            onChange={e => {
              setFactoryId(e.target.value);
              setWarehouseId('');
            }}
            className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1.5 text-xs text-[#24352A]"
          >
            <option value="">All Factories</option>
            {data?.scopes.factories.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by warehouse"
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1.5 text-xs text-[#24352A]"
          >
            <option value="">All Warehouses</option>
            {data?.scopes.warehouses
              .filter(w => !factoryId || w.factoryId === factoryId)
              .map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
          </select>

          <select
            aria-label="Filter by status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1.5 text-xs text-[#24352A]"
          >
            <option value="">Active Statuses</option>
            <option value="CREATED">CREATED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="PAUSED">PAUSED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>

          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1E7DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#17452C] hover:bg-[#EAF1E8]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => void enterTvMode()}
            disabled={!data}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#245C3A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>{t('tvMode.enterTvMode')}</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[#E1E7DD] bg-white p-8 text-center text-xs text-[#66756A]">
          Loading Factory Pulse...
        </div>
      )}

      {data && (
        <>
          {/* Overview KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="text-xs text-[#66756A]">{t('dashboard.activeBatches')}</div>
              <div className="mt-1 text-2xl font-bold text-[#17452C]">
                {data.overview.activeBatchesCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="text-xs text-[#66756A]">{t('dashboard.runningWorkOrders')}</div>
              <div className="mt-1 text-2xl font-bold text-[#24352A]">
                {data.overview.runningWorkOrdersCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="text-xs text-[#66756A]">{t('dashboard.completedToday')}</div>
              <div className="mt-1 text-2xl font-bold text-[#27834A]">
                {data.overview.completedTodayCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="text-xs text-[#66756A]">{t('dashboard.delayedWorkOrders')}</div>
              <div className="mt-1 text-2xl font-bold text-[#C74440]">
                {data.overview.delayedWorkOrdersCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4 col-span-2 sm:col-span-1">
              <div className="text-xs text-[#66756A]">{t('dashboard.activeOutputPlanned')}</div>
              <div className="mt-1 text-lg font-bold text-[#24352A]">
                {data.overview.actualGoodQtyTotal} / {data.overview.plannedQtyTotal}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Production Activity */}
            <div className="lg:col-span-2 rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#17452C]">
                  <Clock className="h-4 w-4 text-[#245C3A]" />
                  <span>Production Activity</span>
                </h2>
                <Link
                  to="/production/batches"
                  className="text-xs font-semibold text-[#245C3A] hover:underline"
                >
                  View All Batches
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E1E7DD] text-[#66756A]">
                      <th className="py-2 pr-3">Batch</th>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Work Order</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Output / Planned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E7DD]/60">
                    {data.productionActivity.map(b => (
                      <tr key={b.batchId} className="hover:bg-[#FAFBF8]">
                        <td className="py-2 pr-3 font-mono font-semibold text-[#17452C]">
                          <Link to={`/production/batches/${b.batchId}`} className="hover:underline">
                            {b.batchNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{b.productName}</td>
                        <td className="py-2 pr-3 font-mono">
                          <Link
                            to={`/production/work-orders/${b.workOrderId}`}
                            className="text-[#245C3A] hover:underline"
                          >
                            {b.workOrderNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="rounded bg-[#EAF1E8] px-2 py-0.5 text-[10px] font-semibold text-[#17452C]">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {b.actualGoodQuantity} / {b.plannedQuantity} {b.uomSymbol}
                          {b.progressPercent !== null ? ` (${b.progressPercent}%)` : ''}
                        </td>
                      </tr>
                    ))}
                    {data.productionActivity.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#66756A]">
                          No active production batches in selected scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attention Required */}
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17452C]">
                <AlertTriangle className="h-4 w-4 text-[#C74440]" />
                <span>Attention Required ({data.attentionRequired.length})</span>
              </h2>
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {data.attentionRequired.map(item => (
                  <Link
                    key={item.id}
                    to={item.navigationPath}
                    className={`block rounded-lg border p-2.5 transition-colors hover:bg-[#FAFBF8] ${
                      item.severity === 'CRITICAL'
                        ? 'border-[#C74440]/30 bg-[#C74440]/5'
                        : 'border-[#C58A25]/30 bg-[#F4F0E4]/60'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#24352A]">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-[#66756A]">{item.detail}</div>
                  </Link>
                ))}
                {data.attentionRequired.length === 0 && (
                  <div className="py-6 text-center text-xs text-[#66756A]">
                    No urgent factory exceptions.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Material Readiness & Quality Monitoring */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17452C]">
                <Package className="h-4 w-4 text-[#245C3A]" />
                <span>Material Readiness & Shortages</span>
              </h2>
              <div className="space-y-2">
                {data.materialReadiness.map(m => (
                  <div
                    key={m.itemId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E1E7DD] p-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#24352A]">
                        {m.name} ({m.code})
                      </div>
                      <div className="text-[11px] text-[#66756A]">
                        Physical: {m.physicalStock} • Reserved: {m.reservedStock} • Available:{' '}
                        {m.availableStock} • Req: {m.requiredStock} {m.uomSymbol}
                      </div>
                    </div>
                    <span className="rounded bg-[#C74440]/10 px-2 py-0.5 text-[11px] font-bold text-[#C74440]">
                      Short: {m.shortageQuantity} {m.uomSymbol}
                    </span>
                  </div>
                ))}
                {data.materialReadiness.length === 0 && (
                  <div className="py-4 text-center text-xs text-[#66756A]">
                    No material shortages detected.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E1E7DD] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#17452C]">
                  <ShieldCheck className="h-4 w-4 text-[#245C3A]" />
                  <span>Quality Monitoring</span>
                </h2>
                <Link
                  to="/production/quality"
                  className="text-xs font-semibold text-[#245C3A] hover:underline"
                >
                  Open Quality Queue
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-2.5 text-center">
                  <div className="text-[11px] text-[#66756A]">Pending</div>
                  <div className="text-lg font-bold text-[#C58A25]">
                    {data.qualityMonitoring.pendingInspectionsCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-2.5 text-center">
                  <div className="text-[11px] text-[#66756A]">Quarantined</div>
                  <div className="text-lg font-bold text-[#C58A25]">
                    {data.qualityMonitoring.quarantinedBatchesCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-2.5 text-center">
                  <div className="text-[11px] text-[#66756A]">Rejected</div>
                  <div className="text-lg font-bold text-[#C74440]">
                    {data.qualityMonitoring.rejectedBatchesCount}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {data.qualityMonitoring.recentInspections.slice(0, 5).map(qi => (
                  <div
                    key={qi.id}
                    className="flex items-center justify-between rounded border border-[#E1E7DD] px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono font-semibold text-[#17452C]">
                      {qi.inspectionNumber} (Batch {qi.batchNumber})
                    </span>
                    <span className="rounded bg-[#F4F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#8A5D12]">
                      {qi.decision}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
