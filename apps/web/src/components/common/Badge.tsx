import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-brand-navy bg-brand-navy text-white',
        secondary: 'border-brand-blue bg-brand-blue text-white',
        teal: 'border-teal-200 bg-teal-50 text-teal-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        danger: 'border-rose-200 bg-rose-50 text-rose-800',
        info: 'border-blue-200 bg-blue-50 text-blue-800',
        outline: 'border-slate-300 bg-white text-slate-700',
        neutral: 'border-slate-200 bg-slate-100 text-slate-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
