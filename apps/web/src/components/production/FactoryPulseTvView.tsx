import React, { useEffect, useState } from 'react';
import {
  Minimize2,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { FactoryPulseData } from '../../services/factory-pulse.service';
import { useTranslation } from '../../i18n/I18nContext';
import { AppLogo } from '../common/AppLogo';

const TV_SECTIONS = [
  'Overview',
  'Production Activity',
  'Material Readiness',
  'Quality Monitoring',
  'Attention Required',
] as const;

interface FactoryPulseTvViewProps {
  data: FactoryPulseData;
  connectionLabel: string;
  onExit: () => void;
}

export const FactoryPulseTvView: React.FC<FactoryPulseTvViewProps> = ({
  data,
  connectionLabel,
  onExit,
}) => {
  const { t } = useTranslation();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [intervalSec, setIntervalSec] = useState(15);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Keep TV view open as fallback if fullscreen was exited or unavailable; Escape exits
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onExit]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setSectionIndex(prev => (prev + 1) % TV_SECTIONS.length);
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [paused, intervalSec]);

  const currentSection = TV_SECTIONS[sectionIndex];

  const stepSection = (delta: number) => {
    setPaused(true);
    setSectionIndex(prev => (prev + delta + TV_SECTIONS.length) % TV_SECTIONS.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#103B28] text-white p-6 overflow-auto"
      data-testid="tv-mode-container"
    >
      {/* Top TV Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-4">
        <div className="flex items-center gap-3">
          <AppLogo variant="white" size="md" decorative />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#E8D7AA]">
              FoodFactory ERP • Live Factory Pulse
            </h1>
            <p className="text-xs text-white/75">
              {connectionLabel} • Updated {new Date(data.generatedAt).toLocaleTimeString()} • Section:{' '}
              <strong className="text-white">{currentSection}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Rotation interval"
            value={intervalSec}
            onChange={e => setIntervalSec(Number(e.target.value))}
            className="rounded-lg border border-white/20 bg-[#17452C] px-2.5 py-1.5 text-xs text-white"
          >
            <option value={10}>10s</option>
            <option value={15}>15s</option>
            <option value={30}>30s</option>
          </select>
          <button
            type="button"
            onClick={() => stepSection(-1)}
            aria-label="Previous section"
            className="rounded-lg border border-white/20 bg-[#17452C] p-2 hover:bg-[#245C3A]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPaused(p => !p)}
            aria-label={paused ? 'Resume rotation' : 'Pause rotation'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-[#17452C] px-3 py-1.5 text-xs font-semibold hover:bg-[#245C3A]"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            type="button"
            onClick={() => stepSection(1)}
            aria-label="Next section"
            className="rounded-lg border border-white/20 bg-[#17452C] p-2 hover:bg-[#245C3A]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E8D7AA] px-3.5 py-1.5 text-xs font-bold text-[#103B28] hover:bg-white"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span>{t('tvMode.exitTvMode')}</span>
          </button>
        </div>
      </div>

      {/* Large KPI Strip */}
      <div className="my-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-white/15 bg-[#17452C] p-5">
          <div className="text-sm text-white/75">Active Batches</div>
          <div className="mt-1 text-4xl font-extrabold text-[#E8D7AA]">
            {data.overview.activeBatchesCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-[#17452C] p-5">
          <div className="text-sm text-white/75">Running Work Orders</div>
          <div className="mt-1 text-4xl font-extrabold text-white">
            {data.overview.runningWorkOrdersCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-[#17452C] p-5">
          <div className="text-sm text-white/75">Completed Today</div>
          <div className="mt-1 text-4xl font-extrabold text-[#7CE0A0]">
            {data.overview.completedTodayCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-[#17452C] p-5">
          <div className="text-sm text-white/75">Delayed Work Orders</div>
          <div className="mt-1 text-4xl font-extrabold text-[#FF9E9B]">
            {data.overview.delayedWorkOrdersCount}
          </div>
        </div>
      </div>

      {/* Rotating Main Panel */}
      <div className="flex-1 rounded-2xl border border-white/15 bg-[#17452C]/80 p-6">
        <h2 className="mb-4 text-xl font-bold text-[#E8D7AA]">{currentSection}</h2>

        {(currentSection === 'Overview' || currentSection === 'Production Activity') && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.productionActivity.slice(0, 9).map(b => (
              <div key={b.batchId} className="rounded-xl border border-white/15 bg-[#103B28] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-[#E8D7AA]">
                    {b.batchNumber}
                  </span>
                  <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-semibold">
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{b.productName}</div>
                <div className="mt-1 text-xs text-white/70">
                  WO: {b.workOrderNumber} • {b.factoryName}
                </div>
                <div className="mt-2 text-sm text-white/90">
                  Output: {b.actualGoodQuantity} / {b.plannedQuantity} {b.uomSymbol}
                  {b.progressPercent !== null ? ` (${b.progressPercent}%)` : ''}
                </div>
              </div>
            ))}
            {data.productionActivity.length === 0 && (
              <div className="text-sm text-white/70">No active production batches.</div>
            )}
          </div>
        )}

        {currentSection === 'Material Readiness' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.materialReadiness.map(m => (
              <div key={m.itemId} className="rounded-xl border border-white/15 bg-[#103B28] p-4">
                <div className="flex justify-between">
                  <span className="text-base font-bold text-white">
                    {m.name} ({m.code})
                  </span>
                  <span className="text-sm font-bold text-[#FF9E9B]">
                    Shortage: {m.shortageQuantity} {m.uomSymbol}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/75">
                  Physical: {m.physicalStock} • Reserved: {m.reservedStock} • Available:{' '}
                  {m.availableStock} • Required: {m.requiredStock}
                </div>
              </div>
            ))}
            {data.materialReadiness.length === 0 && (
              <div className="text-sm text-white/70">All active production materials are available.</div>
            )}
          </div>
        )}

        {currentSection === 'Quality Monitoring' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-[#103B28] p-5">
              <div className="text-sm text-white/75">Pending Inspections</div>
              <div className="mt-2 text-4xl font-bold text-[#E8D7AA]">
                {data.qualityMonitoring.pendingInspectionsCount}
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#103B28] p-5">
              <div className="text-sm text-white/75">Quarantined Batches</div>
              <div className="mt-2 text-4xl font-bold text-[#FFD166]">
                {data.qualityMonitoring.quarantinedBatchesCount}
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#103B28] p-5">
              <div className="text-sm text-white/75">Rejected Batches</div>
              <div className="mt-2 text-4xl font-bold text-[#FF9E9B]">
                {data.qualityMonitoring.rejectedBatchesCount}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'Attention Required' && (
          <div className="space-y-3">
            {data.attentionRequired.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[#FF9E9B]/30 bg-[#103B28] p-4"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#FFD166]" />
                <div>
                  <div className="text-base font-bold text-white">{item.title}</div>
                  <div className="text-xs text-white/75">{item.detail}</div>
                </div>
              </div>
            ))}
            {data.attentionRequired.length === 0 && (
              <div className="text-sm text-white/70">No critical factory exceptions.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
