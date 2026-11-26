import React from 'react';
import { Database, WifiOff } from 'lucide-react';
import { useOffline } from '../../context/OfflineContext';

interface OfflineDataBannerProps {
  lastUpdatedAt?: string | null;
  pendingCount?: number;
  className?: string;
}

export const OfflineDataBanner: React.FC<OfflineDataBannerProps> = ({
  lastUpdatedAt,
  pendingCount = 0,
  className = '',
}) => {
  const { connectivityState, lastSuccessfulSyncAt } = useOffline();
  const isOfflineMode =
    connectivityState === 'OFFLINE' || connectivityState === 'SERVER_UNAVAILABLE';

  if (!isOfflineMode && pendingCount === 0) {
    return null;
  }

  const timestamp = lastUpdatedAt ?? lastSuccessfulSyncAt;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C58A25]/40 bg-[#F4F0E4] px-3.5 py-2 text-xs text-[#6B480C] ${className}`}
    >
      <div className="flex items-center gap-2">
        {isOfflineMode ? (
          <WifiOff className="h-4 w-4 shrink-0 text-[#8A5D12]" />
        ) : (
          <Database className="h-4 w-4 shrink-0 text-[#245C3A]" />
        )}
        <span>
          <strong className="font-semibold">Last synchronized data</strong>
          {timestamp ? ` (as of ${new Date(timestamp).toLocaleString()})` : ''}.
          {isOfflineMode &&
            ' Live updates and server-authoritative approvals are paused until connectivity returns.'}
        </span>
      </div>
      {pendingCount > 0 && (
        <span className="rounded-full bg-[#245C3A] px-2 py-0.5 text-[11px] font-semibold text-white">
          {pendingCount} pending sync
        </span>
      )}
    </div>
  );
};
