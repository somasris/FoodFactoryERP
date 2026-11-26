import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ShieldAlert,
  CircleDot,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n/I18nContext';

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  COMPLETED: 'success',
  FINALIZED: 'success',
  FULFILLED: 'success',
  ISSUED: 'success',
  PASSED: 'success',
  POSTED: 'success',
  RECEIVED: 'success',
  RELEASED: 'info',
  CONFIRMED: 'info',
  IN_PROGRESS: 'info',
  DISPATCHED: 'info',
  PARTIALLY_FULFILLED: 'warning',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  SUBMITTED: 'warning',
  QUARANTINE: 'warning',
  PROVISIONAL: 'warning',
  DRAFT: 'neutral',
  OBSOLETE: 'neutral',
  CANCELLED: 'danger',
  REJECTED: 'danger',
  FAILED: 'danger',
  EXPIRED: 'danger',
  INACTIVE: 'neutral',
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'border-[#27834A]/35 bg-[#27834A]/10 text-[#27834A]',
  warning: 'border-[#C58A25]/35 bg-[#C58A25]/10 text-[#946414]',
  danger: 'border-[#C74440]/35 bg-[#C74440]/10 text-[#C74440]',
  info: 'border-[#3977A8]/35 bg-[#3977A8]/10 text-[#3977A8]',
  neutral: 'border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]',
};

function getStatusIcon(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'warning':
      return <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'danger':
      return <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'info':
      return <CircleDot className="h-3 w-3 shrink-0" aria-hidden="true" />;
    default:
      return <PauseCircle className="h-3 w-3 shrink-0" aria-hidden="true" />;
  }
}

export interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  className?: string;
}

/**
 * Accessible status indicator combining icon, text label, and restrained semantic color.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, tone, className }) => {
  const { t, language } = useTranslation();
  const normalized = status?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';
  const resolvedTone = tone || STATUS_TONE_MAP[normalized] || 'neutral';
  const fallbackLabel = status.replace(/_/g, ' ');
  const displayLabel = language === 'ta' ? t(`status.${normalized}`, fallbackLabel) : fallbackLabel;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-4',
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      {normalized === 'QUARANTINE' ? (
        <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : resolvedTone === 'warning' && normalized.includes('LOW') ? (
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        getStatusIcon(resolvedTone)
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
