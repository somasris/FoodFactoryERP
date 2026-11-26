import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';

interface WidgetStateItem {
  id: string;
  label: string;
  visible: boolean;
}

interface DashboardCustomizerProps {
  widgets: WidgetStateItem[];
  isCustomized: boolean;
  isSaving: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onReset: () => void;
}

export const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
  widgets,
  isCustomized,
  isSaving,
  onToggle,
  onMove,
  onReset,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        data-tour="dashboard-customizer"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E1E7DD] bg-white px-2.5 text-xs font-medium text-[#17452C] hover:bg-[#EAF1E8] transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>{t('dashboard.customize', 'Customize')}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('dashboard.customizeTitle', 'Customize Dashboard')}
          className="absolute right-0 mt-2 w-72 rounded-xl border border-[#E1E7DD] bg-white p-3 shadow-xl z-40"
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-[#E1E7DD] pb-2">
            <span className="text-xs font-semibold text-[#17452C]">
              {t('dashboard.customizeTitle', 'Customize Dashboard')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('common.close', 'Close')}
              className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {widgets.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onToggle(w.id)}
                  disabled={isSaving}
                  className="flex items-center gap-2 text-left font-medium text-[#24352A] hover:text-[#17452C]"
                >
                  {w.visible ? (
                    <Eye className="h-3.5 w-3.5 text-[#245C3A]" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-[#8A958C]" />
                  )}
                  <span className={w.visible ? '' : 'line-through text-[#8A958C]'}>
                    {w.label}
                  </span>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMove(w.id, 'up')}
                    disabled={isSaving || idx === 0}
                    aria-label={`Move ${w.label} up`}
                    className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(w.id, 'down')}
                    disabled={isSaving || idx === widgets.length - 1}
                    aria-label={`Move ${w.label} down`}
                    className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#E1E7DD] pt-2">
            <button
              type="button"
              onClick={onReset}
              disabled={isSaving || !isCustomized}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#66756A] hover:text-[#17452C] disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t('dashboard.resetDefault', 'Reset to Default')}</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-[#245C3A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#17452C]"
            >
              {t('common.done', 'Done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
