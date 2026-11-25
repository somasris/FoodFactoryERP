import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#245C3A] bg-[#245C3A] text-white',
        secondary: 'border-[#E1E7DD] bg-[#EAF1E8] text-[#17452C]',
        teal: 'border-[#E1E7DD] bg-[#EAF1E8] text-[#245C3A]',
        gold: 'border-[#E8D7AA] bg-[#F4F0E4] text-[#8A671D]',
        warning: 'border-[#C58A25]/35 bg-[#C58A25]/10 text-[#946414]',
        danger: 'border-[#C74440]/35 bg-[#C74440]/10 text-[#C74440]',
        info: 'border-[#3977A8]/35 bg-[#3977A8]/10 text-[#3977A8]',
        outline: 'border-[#E1E7DD] bg-white text-[#24352A]',
        neutral: 'border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]',
        success: 'border-[#27834A]/35 bg-[#27834A]/10 text-[#27834A]',
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
