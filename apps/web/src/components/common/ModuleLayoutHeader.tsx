import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n/I18nContext';

export interface ModuleTab {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export interface ModuleLayoutHeaderProps {
  title: string;
  description?: string;
  tabs: ModuleTab[];
  ariaLabel: string;
}

/**
 * Clean, borderless horizontal sub-navigation strip for ERP modules.
 */
export const ModuleLayoutHeader: React.FC<ModuleLayoutHeaderProps> = ({
  title,
  description,
  tabs,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="border-b border-[#E1E7DD]">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-[#17452C] sm:text-2xl">
            {t(`navigation.${title}`, title)}
          </h1>
          {description && (
            <p className="text-xs text-[#66756A]">
              {t(`moduleDescriptions.${title}`, description)}
            </p>
          )}
        </div>
        <nav
          aria-label={ariaLabel}
          className="-mb-px flex max-w-full items-center gap-2 overflow-x-auto pb-0.5"
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
                    'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-[#245C3A] text-[#17452C] font-semibold'
                      : 'border-transparent text-[#66756A] hover:border-[#6F9478]/60 hover:text-[#24352A]',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span>{t(`navigation.${tab.label}`, tab.label)}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
};
