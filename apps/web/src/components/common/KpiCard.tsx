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
  neutral: 'bg-[#6F9478]',
  info: 'bg-[#3977A8]',
  success: 'bg-[#27834A]',
  warning: 'bg-[#C58A25]',
  danger: 'bg-[#C74440]',
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
        'relative overflow-hidden rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-[0_1px_2px_rgba(16,59,40,0.04)]',
        className,
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', toneBar[tone])} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#66756A] truncate">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-[#24352A] tabular-nums">
            {value}
          </div>
          {sublabel && <div className="mt-0.5 text-xs text-[#66756A] truncate">{sublabel}</div>}
        </div>
        {icon && (
          <div className="rounded-md border border-[#E1E7DD] bg-[#EAF1E8] p-2 text-[#245C3A] shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
