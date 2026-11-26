import React from 'react';
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, CloudOff, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { useOffline } from '../../context/OfflineContext';
import { ConnectivityState } from '../../offline/types';
import { useTranslation } from '../../i18n/I18nContext';

const STATE_CONFIG: Record<
  ConnectivityState,
  {
    labelKey: string;
    dotClass: string;
    pillClass: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  ONLINE: {
    labelKey: 'offline.online',
    dotClass: 'bg-[#27834A]',
    pillClass: 'border-[#E1E7DD] bg-[#FAFBF8] text-[#17452C]',
    Icon: Wifi,
  },
  OFFLINE: {
    labelKey: 'offline.offline',
    dotClass: 'bg-[#C58A25]',
    pillClass: 'border-[#C58A25]/40 bg-[#F4F0E4] text-[#8A5D12]',
    Icon: WifiOff,
  },
  SERVER_UNAVAILABLE: {
    labelKey: 'offline.serverUnavailable',
    dotClass: 'bg-[#C74440]',
    pillClass: 'border-[#C74440]/40 bg-[#C74440]/10 text-[#C74440]',
    Icon: CloudOff,
  },
  SYNCING: {
    labelKey: 'offline.syncing',
    dotClass: 'bg-[#3977A8]',
    pillClass: 'border-[#3977A8]/40 bg-[#3977A8]/10 text-[#215780]',
    Icon: RefreshCw,
  },
  SYNC_ERROR: {
    labelKey: 'offline.syncFailed',
    dotClass: 'bg-[#C74440]',
    pillClass: 'border-[#C74440]/40 bg-[#C74440]/10 text-[#C74440]',
    Icon: AlertTriangle,
  },
};

export const OfflineStatusBadge: React.FC = () => {
  const { t } = useTranslation();
  const {
    connectivityState,
    counts,
    lastSuccessfulSyncAt,
    canInstallPwa,
    promptInstallPwa,
  } = useOffline();

  const cfg = STATE_CONFIG[connectivityState];
  const Icon = cfg.Icon;
  const label = t(cfg.labelKey);
  const totalAttention = counts.pending + counts.failed + counts.conflict;

  return (
    <div className="flex items-center gap-2">
      {canInstallPwa && (
        <button
          type="button"
          onClick={() => void promptInstallPwa()}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#245C3A] bg-[#EAF1E8] px-2.5 py-1 text-[11px] font-semibold text-[#17452C] hover:bg-[#DCE7D8] transition-colors"
          title="Install FoodFactory ERP as an offline-capable app"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t('offline.installApp')}</span>
        </button>
      )}

      <Link
        to="/sync"
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-90 ${cfg.pillClass}`}
        title={
          lastSuccessfulSyncAt
            ? `${label} | ${new Date(lastSuccessfulSyncAt).toLocaleString()}`
            : label
        }
        data-testid="offline-status-badge"
      >
        <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
        <Icon
          className={`h-3.5 w-3.5 ${connectivityState === 'SYNCING' ? 'animate-spin' : ''}`}
        />
        <span className="hidden sm:inline">{label}</span>
        {totalAttention > 0 && (
          <span className="ml-0.5 rounded-full bg-[#245C3A] px-1.5 py-0.2 text-[10px] font-semibold text-white">
            {totalAttention}
          </span>
        )}
      </Link>
    </div>
  );
};
