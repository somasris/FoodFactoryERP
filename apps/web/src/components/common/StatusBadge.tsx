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
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
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
  const normalized = status?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';
  const resolvedTone = tone || STATUS_TONE_MAP[normalized] || 'neutral';
  const displayLabel = status.replace(/_/g, ' ');

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
