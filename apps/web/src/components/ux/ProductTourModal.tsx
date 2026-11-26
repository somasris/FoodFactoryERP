import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { isEditableTarget } from '../../config/shortcuts';

export interface TourStep {
  id: string;
  selector: string;
  route?: string;
  titleKey: string;
  defaultTitle: string;
  bodyKey: string;
  defaultBody: string;
  requiredPermissions?: string[];
  /** Optional predicate to avoid duplicate module steps across multi-role accounts */
  when?: (hasPermission: (p: string) => boolean) => boolean;
}

export const PRODUCT_TOUR_STEPS: TourStep[] = [
  {
    id: 'sidebar',
    selector: '[data-tour="sidebar"]',
    titleKey: 'tour.sidebarTitle',
    defaultTitle: 'Module Navigation Sidebar',
    bodyKey: 'tour.sidebarBody',
    defaultBody:
      'Use this sidebar to switch between ERP modules authorized for your role. Click any item to open its workspace, or collapse the panel for more screen space.',
  },
  {
    id: 'command-center',
    selector: '[data-tour="command-center"]',
    titleKey: 'tour.commandTitle',
    defaultTitle: 'Command Center (Ctrl+K)',
    bodyKey: 'tour.commandBody',
    defaultBody:
      'Click here or press Ctrl+K (Cmd+K) anywhere to search orders, products, batches, and jump directly to quick actions.',
  },
  {
    id: 'dashboard-kpis',
    selector: '[data-tour="dashboard-kpis"]',
    route: '/reports/executive',
    titleKey: 'tour.dashboardKpisTitle',
    defaultTitle: 'Executive KPI Overview',
    bodyKey: 'tour.dashboardKpisBody',
    defaultBody:
      'Review live financial, sales, inventory, and production KPIs calculated directly from PostgreSQL records.',
    requiredPermissions: ['analytics.dashboard.read'],
  },
  {
    id: 'dashboard-customizer',
    selector: '[data-tour="dashboard-customizer"]',
    route: '/reports/executive',
    titleKey: 'tour.dashboardTitle',
    defaultTitle: 'Personalize Dashboard Widgets',
    bodyKey: 'tour.dashboardBody',
    defaultBody:
      'Click Customize to show, hide, or reorder KPI cards on your dashboard. Your layout is saved per user.',
    requiredPermissions: ['analytics.dashboard.read'],
  },
  {
    id: 'saved-views-sales',
    selector: '[data-tour="saved-views"]',
    route: '/sales/orders',
    titleKey: 'tour.salesTitle',
    defaultTitle: 'Saved Views on Sales Orders',
    bodyKey: 'tour.salesBody',
    defaultBody:
      'Filter sales orders and click Save View to store your favorite filter presets for one-click reuse.',
    requiredPermissions: ['sales.orders.read'],
  },
  {
    id: 'saved-views-production',
    selector: '[data-tour="saved-views"]',
    route: '/production/work-orders',
    titleKey: 'tour.productionViewsTitle',
    defaultTitle: 'Saved Views on Work Orders',
    bodyKey: 'tour.productionViewsBody',
    defaultBody:
      'Save your active work order status and priority filters here for quick shift-level tracking.',
    requiredPermissions: ['production.work_orders.read'],
    when: hasPerm => !hasPerm('sales.orders.read'),
  },
  {
    id: 'notifications',
    selector: '[data-tour="notifications"]',
    titleKey: 'tour.notificationsTitle',
    defaultTitle: 'Operational Notifications',
    bodyKey: 'tour.notificationsBody',
    defaultBody:
      'Click the bell icon to view real-time operational alerts, approval requests, and low-stock warnings.',
  },
  {
    id: 'activity-timeline',
    selector: '[data-tour="activity-timeline"]',
    route: '/activity',
    titleKey: 'tour.timelineTitle',
    defaultTitle: 'Recent Activity Timeline',
    bodyKey: 'tour.timelineBody',
    defaultBody:
      'Filter immutable audit events by category or date range and open permitted records directly from each entry.',
  },
  {
    id: 'theme-switcher',
    selector: '[data-tour="theme-switcher"]',
    titleKey: 'tour.themeTitle',
    defaultTitle: 'Light, Dark & System Theme',
    bodyKey: 'tour.themeBody',
    defaultBody:
      'Switch instantly between Light, Dark, or System appearance. Your preference is saved to your account.',
  },
  {
    id: 'language-switcher',
    selector: '[data-tour="language-switcher"]',
    titleKey: 'tour.languageTitle',
    defaultTitle: 'English & Tamil Language',
    bodyKey: 'tour.languageBody',
    defaultBody:
      'Toggle between English (EN) and Tamil (தமிழ்) across navigation, tables, and dialogs at any time.',
  },
  {
    id: 'user-profile',
    selector: '[data-tour="user-profile"]',
    titleKey: 'tour.profileTitle',
    defaultTitle: 'Profile Menu & Restart Tour',
    bodyKey: 'tour.profileBody',
    defaultBody:
      'Open your profile menu to view your role, open Activity Timeline, restart this Product Tour anytime, or sign out.',
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ProductTourModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onEnsureSidebarOpen?: (open: boolean) => void;
}

const TARGET_WAIT_TIMEOUT_MS = 2500;
const SPOTLIGHT_PAD = 4;

export const ProductTourModal: React.FC<ProductTourModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
  onEnsureSidebarOpen,
}) => {
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = useMemo(
    () =>
      PRODUCT_TOUR_STEPS.filter(
        s =>
          (!s.requiredPermissions?.length || s.requiredPermissions.every(p => hasPermission(p))) &&
          (!s.when || s.when(hasPermission)),
      ),
    [hasPermission],
  );

  const progressStorageKey = user?.id ? `ff_tour_step_${user.id}` : null;

  const [stepIdx, setStepIdx] = useState<number>(() => {
    if (!progressStorageKey) return 0;
    try {
      const saved = Number(window.sessionStorage.getItem(progressStorageKey));
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch {
      return 0;
    }
  });

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetStatus, setTargetStatus] = useState<'locating' | 'ready' | 'missing'>('locating');
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // Keep stepIdx within bounds and persist across route transitions
  const safeStepIdx = Math.min(stepIdx, Math.max(0, steps.length - 1));
  const current = steps[safeStepIdx];

  useEffect(() => {
    if (!isOpen || !progressStorageKey) return;
    try {
      window.sessionStorage.setItem(progressStorageKey, String(safeStepIdx));
    } catch {
      // Ignore storage errors
    }
  }, [isOpen, progressStorageKey, safeStepIdx]);

  const clearProgressAndFinish = useCallback(() => {
    if (progressStorageKey) {
      try {
        window.sessionStorage.removeItem(progressStorageKey);
      } catch {
        // Ignore
      }
    }
    onEnsureSidebarOpen?.(false);
    setStepIdx(0);
    onComplete();
  }, [progressStorageKey, onEnsureSidebarOpen, onComplete]);

  const clearProgressAndSkip = useCallback(() => {
    if (progressStorageKey) {
      try {
        window.sessionStorage.removeItem(progressStorageKey);
      } catch {
        // Ignore
      }
    }
    onEnsureSidebarOpen?.(false);
    setStepIdx(0);
    onSkip();
  }, [progressStorageKey, onEnsureSidebarOpen, onSkip]);

  // Navigate to step route & locate target DOM element
  useEffect(() => {
    if (!isOpen || !current) return;

    let cancelled = false;
    setTargetStatus('locating');
    setTargetRect(null);

    if (current.id === 'sidebar' && typeof window !== 'undefined' && window.innerWidth < 768) {
      onEnsureSidebarOpen?.(true);
    } else if (current.id !== 'sidebar') {
      onEnsureSidebarOpen?.(false);
    }

    if (current.route && location.pathname !== current.route) {
      navigate(current.route);
    }

    let resizeObserver: ResizeObserver | null = null;
    let observedEl: HTMLElement | null = null;

    const measure = (el: HTMLElement) => {
      if (cancelled) return;
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    const attach = (el: HTMLElement) => {
      observedEl = el;
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      measure(el);
      setTargetStatus('ready');

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => measure(el));
        resizeObserver.observe(el);
      }
    };

    const startTime = Date.now();
    const tryFind = (): boolean => {
      if (cancelled) return true;
      const el = document.querySelector(current.selector);
      if (el instanceof HTMLElement) {
        attach(el);
        return true;
      }
      return false;
    };

    let intervalId: number | undefined;
    let observer: MutationObserver | undefined;

    if (!tryFind()) {
      observer = new MutationObserver(() => {
        if (tryFind()) {
          observer?.disconnect();
          if (intervalId !== undefined) window.clearInterval(intervalId);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      intervalId = window.setInterval(() => {
        if (tryFind()) {
          observer?.disconnect();
          window.clearInterval(intervalId);
          return;
        }
        if (Date.now() - startTime >= TARGET_WAIT_TIMEOUT_MS) {
          observer?.disconnect();
          window.clearInterval(intervalId);
          if (!cancelled) {
            if (safeStepIdx < steps.length - 1) {
              setStepIdx(i => i + 1);
            } else {
              setTargetStatus('missing');
            }
          }
        }
      }, 50);
    }

    const handleScrollOrResize = () => {
      if (observedEl) measure(observedEl);
      else setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (intervalId !== undefined) window.clearInterval(intervalId);
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, current, location.pathname, navigate, onEnsureSidebarOpen, safeStepIdx, steps.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        clearProgressAndSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (safeStepIdx < steps.length - 1) setStepIdx(i => i + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (safeStepIdx > 0) setStepIdx(i => i - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, safeStepIdx, steps.length, clearProgressAndSkip]);

  if (!isOpen || !current || steps.length === 0) return null;

  const isFirst = safeStepIdx === 0;
  const isLast = safeStepIdx === steps.length - 1;
  const progressPercent = Math.round(((safeStepIdx + 1) / steps.length) * 100);

  // Compute non-overlapping tooltip position adjacent to targetRect
  const tooltipWidth = Math.min(340, Math.max(260, viewport.width - 24));
  const tooltipEstimatedHeight = 210;
  const gap = 14;

  let tooltipStyle: React.CSSProperties;
  if (targetRect && (targetRect.width > 0 || targetRect.height > 0)) {
    const spaceBelow = viewport.height - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;
    const spaceRight = viewport.width - (targetRect.left + targetRect.width);
    const spaceLeft = targetRect.left;

    let top = targetRect.top + targetRect.height + gap;
    let left = Math.min(
      Math.max(12, targetRect.left),
      Math.max(12, viewport.width - tooltipWidth - 12),
    );

    if (spaceBelow >= tooltipEstimatedHeight + gap) {
      top = targetRect.top + targetRect.height + gap;
    } else if (spaceAbove >= tooltipEstimatedHeight + gap) {
      top = Math.max(12, targetRect.top - tooltipEstimatedHeight - gap);
    } else if (spaceRight >= tooltipWidth + gap) {
      left = targetRect.left + targetRect.width + gap;
      top = Math.min(
        Math.max(12, targetRect.top),
        Math.max(12, viewport.height - tooltipEstimatedHeight - 12),
      );
    } else if (spaceLeft >= tooltipWidth + gap) {
      left = Math.max(12, targetRect.left - tooltipWidth - gap);
      top = Math.min(
        Math.max(12, targetRect.top),
        Math.max(12, viewport.height - tooltipEstimatedHeight - 12),
      );
    } else {
      top = Math.max(12, viewport.height - tooltipEstimatedHeight - 12);
    }

    tooltipStyle = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${tooltipWidth}px`,
    };
  } else {
    // Fallback centered positioning (e.g., jsdom zero-rect or locating state)
    tooltipStyle = {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${tooltipWidth}px`,
    };
  }

  const spotTop = targetRect ? Math.max(0, targetRect.top - SPOTLIGHT_PAD) : 0;
  const spotLeft = targetRect ? Math.max(0, targetRect.left - SPOTLIGHT_PAD) : 0;
  const spotRight = targetRect
    ? Math.min(viewport.width, targetRect.left + targetRect.width + SPOTLIGHT_PAD)
    : 0;
  const spotBottom = targetRect
    ? Math.min(viewport.height, targetRect.top + targetRect.height + SPOTLIGHT_PAD)
    : 0;
  const hasSpotlightRect =
    targetStatus === 'ready' && targetRect && (targetRect.width > 0 || targetRect.height > 0);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-live="polite">
      {/* 4-panel dark backdrop leaving the highlighted target element unobstructed */}
      {hasSpotlightRect ? (
        <>
          <div
            className="fixed left-0 right-0 top-0 bg-[#103B28]/55 pointer-events-auto transition-all duration-200"
            style={{ height: `${spotTop}px` }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 bg-[#103B28]/55 pointer-events-auto transition-all duration-200"
            style={{ top: `${spotBottom}px` }}
          />
          <div
            className="fixed left-0 bg-[#103B28]/55 pointer-events-auto transition-all duration-200"
            style={{
              top: `${spotTop}px`,
              height: `${Math.max(0, spotBottom - spotTop)}px`,
              width: `${spotLeft}px`,
            }}
          />
          <div
            className="fixed right-0 bg-[#103B28]/55 pointer-events-auto transition-all duration-200"
            style={{
              top: `${spotTop}px`,
              height: `${Math.max(0, spotBottom - spotTop)}px`,
              left: `${spotRight}px`,
            }}
          />
          {/* Glowing Spotlight Ring */}
          <div
            data-testid="product-tour-spotlight"
            className="fixed pointer-events-none rounded-lg border-2 border-[#E8D7AA] shadow-[0_0_0_4px_rgba(36,92,58,0.45)] transition-all duration-200"
            style={{
              top: `${spotTop}px`,
              left: `${spotLeft}px`,
              width: `${Math.max(0, spotRight - spotLeft)}px`,
              height: `${Math.max(0, spotBottom - spotTop)}px`,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-[#103B28]/45 pointer-events-auto" />
      )}

      {/* Adjacent Tour Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('tour.dialogLabel', 'Product Tour')}
        data-testid="product-tour-tooltip"
        data-tour-target={current.id}
        style={tooltipStyle}
        className="pointer-events-auto overflow-hidden rounded-xl border border-[#E1E7DD] bg-white shadow-2xl transition-all duration-200"
      >
        <div className="flex items-center justify-between bg-[#245C3A] px-4 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#E8D7AA]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#E8D7AA]">
              {t('tour.stepCounter', 'Step')} {safeStepIdx + 1} {t('tour.of', 'of')} {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={clearProgressAndSkip}
            aria-label={t('tour.skip', 'Skip tour')}
            className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[#EAF1E8]">
          <div
            className="h-full bg-[#245C3A] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="space-y-2 p-4">
          <h2 className="text-sm font-bold text-[#17452C]">
            {t(current.titleKey, current.defaultTitle)}
          </h2>
          <p className="text-xs leading-relaxed text-[#24352A]">
            {targetStatus === 'missing'
              ? t(
                  'tour.targetUnavailable',
                  'This control is currently unavailable on your viewport. Click Finish or Previous to continue.',
                )
              : t(current.bodyKey, current.defaultBody)}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[#E1E7DD] bg-[#FAFBF8] px-4 py-2.5">
          <button
            type="button"
            onClick={clearProgressAndSkip}
            className="text-xs font-medium text-[#66756A] hover:text-[#17452C]"
          >
            {t('tour.skip', 'Skip Tour')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1 text-xs font-medium text-[#24352A] hover:bg-[#EAF1E8] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>{t('tour.previous', 'Previous')}</span>
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={clearProgressAndFinish}
                className="inline-flex items-center gap-1 rounded-md bg-[#245C3A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#17452C]"
              >
                <span>{t('tour.finish', 'Finish Tour')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-md bg-[#245C3A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#17452C]"
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
