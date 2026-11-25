import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading records...' }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-12 px-4 text-center">
    <Loader2 className="h-6 w-6 animate-spin text-brand-blue" aria-hidden="true" />
    <p className="mt-2.5 text-xs font-medium text-slate-600">{label}</p>
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
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-12 px-4 text-center">
    <div className="rounded-full bg-slate-100 p-3 text-slate-400">
      <Inbox className="h-5 w-5" aria-hidden="true" />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
    <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
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
    className="flex flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50/60 py-10 px-4 text-center"
  >
    <AlertCircle className="h-6 w-6 text-rose-700" aria-hidden="true" />
    <h3 className="mt-2.5 text-sm font-semibold text-rose-900">{title}</h3>
    <p className="mt-1 max-w-md text-xs text-rose-700">{message}</p>
    {onRetry && (
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    )}
  </div>
);
