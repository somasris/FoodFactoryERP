import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface ModuleTab {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export interface ModuleLayoutHeaderProps {
  title: string;
  description: string;
  tabs: ModuleTab[];
  ariaLabel: string;
}

/**
 * Shared enterprise module header and horizontal sub-navigation bar.
 * Ensures uniform visual hierarchy and tab behavior across all ERP modules.
 */
export const ModuleLayoutHeader: React.FC<ModuleLayoutHeaderProps> = ({
  title,
  description,
  tabs,
  ariaLabel,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 pt-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="pb-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <nav
          aria-label={ariaLabel}
          className="-mb-px flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-1"
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-brand-navy text-brand-navy font-semibold'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
};
