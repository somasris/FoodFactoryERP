import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading records...' }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-[#E1E7DD] bg-white py-12 px-4 text-center">
    <Loader2 className="h-6 w-6 animate-spin text-[#245C3A]" aria-hidden="true" />
    <p className="mt-2.5 text-xs font-medium text-[#66756A]">{label}</p>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
}> = ({
  title = 'No records found',
  description = 'Adjust your search or filter criteria, or create a new record.',
  action,
}) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E1E7DD] bg-white py-12 px-4 text-center">
    <div className="rounded-full bg-[#EAF1E8] p-3 text-[#6F9478]">
      <Inbox className="h-5 w-5" aria-hidden="true" />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-[#24352A]">{title}</h3>
    <p className="mt-1 max-w-sm text-xs text-[#66756A]">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Unable to load data', message, onRetry }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-lg border border-[#C74440]/30 bg-[#C74440]/5 py-10 px-4 text-center"
  >
    <AlertCircle className="h-6 w-6 text-[#C74440]" aria-hidden="true" />
    <h3 className="mt-2.5 text-sm font-semibold text-[#C74440]">{title}</h3>
    <p className="mt-1 max-w-md text-xs text-[#C74440]/90">{message}</p>
    {onRetry && (
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    )}
  </div>
);
