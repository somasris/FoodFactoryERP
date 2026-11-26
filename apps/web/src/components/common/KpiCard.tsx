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

const toneIcon: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'bg-[#EAF1E8] text-[#245C3A]',
  info: 'bg-[#3977A8]/10 text-[#3977A8]',
  success: 'bg-[#27834A]/10 text-[#27834A]',
  warning: 'bg-[#C58A25]/10 text-[#C58A25]',
  danger: 'bg-[#C74440]/10 text-[#C74440]',
};

/**
 * Spacious, minimal enterprise KPI summary card with tabular-nums alignment.
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
        'rounded-xl border border-[#E1E7DD] bg-white p-5 transition-colors',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="text-xs font-medium text-[#66756A] truncate">
            {label}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-[#24352A] tabular-nums">
            {value}
          </div>
          {sublabel && <div className="text-xs text-[#66756A] truncate">{sublabel}</div>}
        </div>
        {icon && (
          <div className={cn('rounded-lg p-2.5 shrink-0', toneIcon[tone])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
