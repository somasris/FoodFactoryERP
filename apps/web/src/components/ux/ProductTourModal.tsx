import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';

interface TourStep {
  id: string;
  titleKey: string;
  defaultTitle: string;
  bodyKey: string;
  defaultBody: string;
  requiredPermissions?: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    titleKey: 'tour.welcomeTitle',
    defaultTitle: 'Welcome to FoodFactory ERP',
    bodyKey: 'tour.welcomeBody',
    defaultBody:
      'Your workspace is tailored to your role and warehouse permissions. Use the sidebar and header controls to move between modules.',
  },
  {
    id: 'command-center',
    titleKey: 'tour.commandTitle',
    defaultTitle: 'Command Center (Ctrl+K) & Shortcuts (?)',
    bodyKey: 'tour.commandBody',
    defaultBody:
      'Press Ctrl+K (or Cmd+K) anywhere to search orders, batches, products, or jump to quick actions. Press ? to view all keyboard shortcuts.',
  },
  {
    id: 'notifications-timeline',
    titleKey: 'tour.timelineTitle',
    defaultTitle: 'Notifications & Activity Timeline',
    bodyKey: 'tour.timelineBody',
    defaultBody:
      'The bell icon surfaces operational alerts, while Recent Activity Timeline (/activity) shows an immutable, redacted audit trail of permitted events.',
  },
  {
    id: 'sales-workflow',
    titleKey: 'tour.salesTitle',
    defaultTitle: 'Sales Orders & Saved Views',
    bodyKey: 'tour.salesBody',
    defaultBody:
      'Filter sales orders and save your most-used filter presets using the Saved Views bar for one-click access.',
    requiredPermissions: ['sales.orders.read'],
  },
  {
    id: 'inventory-workflow',
    titleKey: 'tour.inventoryTitle',
    defaultTitle: 'Inventory & Batch Expiry Control',
    bodyKey: 'tour.inventoryBody',
    defaultBody:
      'Track warehouse stock balances, FEFO/FIFO picking, and expiring batches in real time.',
    requiredPermissions: ['inventory.read'],
  },
  {
    id: 'production-workflow',
    titleKey: 'tour.productionTitle',
    defaultTitle: 'Production & Quality Inspections',
    bodyKey: 'tour.productionBody',
    defaultBody:
      'Monitor Live Factory Pulse, release Work Orders, execute batches, and record quality inspections.',
    requiredPermissions: ['production.batches.read'],
  },
  {
    id: 'executive-customizer',
    titleKey: 'tour.dashboardTitle',
    defaultTitle: 'Personalizable Executive Dashboard',
    bodyKey: 'tour.dashboardBody',
    defaultBody:
      'Click Customize on the Executive Dashboard to show, hide, or reorder KPI cards for your daily review.',
    requiredPermissions: ['analytics.dashboard.read'],
  },
];

interface ProductTourModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const ProductTourModal: React.FC<ProductTourModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);

  const steps = useMemo(
    () =>
      TOUR_STEPS.filter(
        s => !s.requiredPermissions?.length || s.requiredPermissions.every(p => hasPermission(p)),
      ),
    [hasPermission],
  );

  useEffect(() => {
    if (isOpen) setStepIdx(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (stepIdx < steps.length - 1) setStepIdx(i => i + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (stepIdx > 0) setStepIdx(i => i - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, stepIdx, steps.length, onSkip]);

  if (!isOpen || steps.length === 0) return null;

  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#103B28]/35 p-4 sm:items-center backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.dialogLabel', 'Product Tour')}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#E1E7DD] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#245C3A] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#E8D7AA]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#E8D7AA]">
              {t('tour.stepCounter', 'Step')} {stepIdx + 1} / {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label={t('tour.skip', 'Skip tour')}
            className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-5">
          <h2 className="text-base font-bold text-[#17452C]">
            {t(current.titleKey, current.defaultTitle)}
          </h2>
          <p className="text-xs leading-relaxed text-[#24352A]">
            {t(current.bodyKey, current.defaultBody)}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[#E1E7DD] bg-[#FAFBF8] px-5 py-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-[#66756A] hover:text-[#17452C]"
          >
            {t('tour.skip', 'Skip')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#24352A] hover:bg-[#EAF1E8] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>{t('tour.previous', 'Previous')}</span>
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={onComplete}
                className="inline-flex items-center gap-1 rounded-md bg-[#245C3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C]"
              >
                <span>{t('tour.finish', 'Finish')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-md bg-[#245C3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C]"
              >
                <span>{t('tour.next', 'Next')}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
