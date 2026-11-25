import React from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * Standardized enterprise page header for consistent hierarchy across all ERP modules.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-xs text-slate-500 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
};
