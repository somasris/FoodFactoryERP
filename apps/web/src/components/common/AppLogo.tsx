import React from 'react';
import { cn } from '../../lib/utils';

export type AppLogoVariant = 'default' | 'white' | 'mono' | 'auto';
export type AppLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AppLogoProps {
  /** Color variant: 'auto' adapts to light/dark theme; 'white' is for dark surfaces. */
  variant?: AppLogoVariant;
  /** Predefined icon dimensions. */
  size?: AppLogoSize;
  /** Optional additional classes for the SVG element. */
  className?: string;
  /** When true, marks the SVG aria-hidden for decorative use next to visible brand text. */
  decorative?: boolean;
  /** Accessible label when not decorative. */
  label?: string;
  /** Optionally render the application name as normal UI text beside the symbol. */
  showWordmark?: boolean;
  /** Optional classes for the wordmark text. */
  wordmarkClassName?: string;
}

const SIZE_CLASSES: Record<AppLogoSize, string> = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
};

/**
 * Centralized, symbol-only FoodFactoryERP brand mark.
 * Renders a clean geometric vector symbol with no embedded text or letters.
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  variant = 'auto',
  size = 'md',
  className,
  decorative = false,
  label = 'FoodFactory ERP',
  showWordmark = false,
  wordmarkClassName,
}) => {
  const frameFill =
    variant === 'white'
      ? 'fill-white'
      : variant === 'mono'
        ? 'fill-current'
        : variant === 'default'
          ? 'fill-[#245C3A]'
          : 'fill-[#245C3A] dark:fill-white';

  const rightLeafFill =
    variant === 'white'
      ? 'fill-white/90'
      : variant === 'mono'
        ? 'fill-current'
        : variant === 'default'
          ? 'fill-[#3D7651]'
          : 'fill-[#3D7651] dark:fill-white/90';

  const coreFill =
    variant === 'white'
      ? 'fill-[#E8D7AA]'
      : variant === 'mono'
        ? 'fill-current'
        : variant === 'default'
          ? 'fill-[#C39A45]'
          : 'fill-[#C39A45] dark:fill-[#E8D7AA]';

  const svgElement = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={cn('shrink-0 select-none', SIZE_CLASSES[size], className)}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      <path
        className={frameFill}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28.6 7.4a6.8 6.8 0 0 1 6.8 0l15.6 9a6.8 6.8 0 0 1 3.4 5.9v19.4a6.8 6.8 0 0 1-3.4 5.9l-15.6 9a6.8 6.8 0 0 1-6.8 0l-15.6-9a6.8 6.8 0 0 1-3.4-5.9V22.3a6.8 6.8 0 0 1 3.4-5.9l15.6-9Zm1.9 6.7a3 3 0 0 1 3 0l12.8 7.4a3 3 0 0 1 1.5 2.6v14.8a3 3 0 0 1-1.5 2.6l-12.8 7.4a3 3 0 0 1-3 0l-12.8-7.4a3 3 0 0 1-1.5-2.6V24.1a3 3 0 0 1 1.5-2.6l12.8-7.4Z"
      />
      <path
        className={frameFill}
        d="M20.5 31.2c0-5.4 3.6-10.2 9.4-12.5-1 5.1.2 9.9 2.1 13.7-2.6 1.5-4.3 4.1-4.8 7.1-4.1-1.4-6.7-4.5-6.7-8.3Z"
      />
      <path
        className={rightLeafFill}
        d="M43.5 31.2c0-5.4-3.6-10.2-9.4-12.5 1 5.1-.2 9.9-2.1 13.7 2.6 1.5 4.3 4.1 4.8 7.1 4.1-1.4 6.7-4.5 6.7-8.3Z"
      />
      <path className={coreFill} d="M32 23.2l4.2 5.3-4.2 5.3-4.2-5.3 4.2-5.3Z" />
      <rect className={frameFill} x="22" y="40.5" width="20" height="4" rx="2" />
    </svg>
  );

  if (!showWordmark) {
    return svgElement;
  }

  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      {svgElement}
      <span
        className={cn(
          'text-sm font-bold tracking-tight text-[#17452C] dark:text-[#E7F0E8] sm:text-base',
          wordmarkClassName,
        )}
      >
        {label}
      </span>
    </span>
  );
};
