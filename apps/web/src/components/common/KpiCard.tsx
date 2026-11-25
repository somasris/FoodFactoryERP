import React from 'react';
import { cn } from '../../lib/utils';

export interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

const toneBar: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-brand-blue',
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  danger: 'bg-rose-600',
};

/**
 * Compact, restrained enterprise KPI summary card with tabular-nums alignment.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  tone = 'neutral',
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', toneBar[tone])} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
          {sublabel && <div className="mt-0.5 text-xs text-slate-500 truncate">{sublabel}</div>}
        </div>
        {icon && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
