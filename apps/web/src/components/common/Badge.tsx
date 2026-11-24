import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-navy text-white shadow',
        secondary: 'border-transparent bg-brand-blue text-white',
        teal: 'border-transparent bg-teal-100 text-teal-800 border-teal-200',
        warning: 'border-transparent bg-amber-100 text-amber-800 border-amber-200',
        outline: 'text-slate-700 border-slate-300',
        success: 'border-transparent bg-emerald-100 text-emerald-800 border-emerald-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
