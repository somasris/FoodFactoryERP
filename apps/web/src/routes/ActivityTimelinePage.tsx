import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Clock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { uxService } from '../services/ux.service';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews';
import { Pagination } from '../components/common/Pagination';
import { useTranslation } from '../i18n/I18nContext';

const CATEGORIES = [
  'ALL',
  'SALES',
  'INVENTORY',
  'PRODUCTION',
  'QUALITY',
  'ADMINISTRATION',
  'AUTH',
] as const;

export const ActivityTimelinePage: React.FC = () => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ux', 'activity-timeline', category, startDate, endDate, page],
    queryFn: () =>
      uxService.getActivityTimeline({
        category,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 20,
      }),
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ux.activityTimeline', 'Recent Activity Timeline')}
        description={t(
          'ux.activityTimelineSubtitle',
          'Verified audit trail of permitted business & security events (distinct from alert notifications).',
        )}
      />

      <div
        data-tour="activity-timeline"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E1E7DD] bg-white p-3"
      >
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Activity categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-[#245C3A] text-white'
                  : 'bg-[#FAFBF8] text-[#24352A] border border-[#E1E7DD] hover:bg-[#EAF1E8]'
              }`}
            >
              {t(`ux.category_${cat}`, cat)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            aria-label={t('common.startDate', 'Start date')}
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded border border-[#E1E7DD] bg-white px-2 text-xs"
          />
          <span className="text-[#66756A]">–</span>
          <input
            type="date"
            aria-label={t('common.endDate', 'End date')}
            value={endDate}
            onChange={e => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded border border-[#E1E7DD] bg-white px-2 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-3 py-2 text-xs text-[#66756A]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#245C3A]" />
        <span>
          {t(
            'ux.auditNotice',
            'Audit events are immutable system records scoped to your role permissions; sensitive credentials are always redacted.',
          )}
        </span>
      </div>

      {isLoading ? (
        <LoadingState label={t('common.loading', 'Loading...')} />
      ) : error ? (
        <ErrorState
          title={t('common.error', 'Error')}
          message={error instanceof Error ? error.message : 'Failed to load activity timeline'}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('ux.noActivityTitle', 'No recent activity')}
          description={t('ux.noActivityMessage', 'No permitted audit events match the selected filters.')}
        />
      ) : (
        <div className="divide-y divide-[#E1E7DD] rounded-lg border border-[#E1E7DD] bg-white">
          {items.map(item => (
            <div key={item.id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF1E8] text-[#245C3A]">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-[#F4F0E4] px-1.5 py-0.5 font-semibold text-[#17452C]">
                      {item.action}
                    </span>
                    <span className="font-semibold text-[#24352A]">{item.entityType}</span>
                    <span className="text-[#8A958C]">•</span>
                    <span className="text-[#66756A]">{item.category}</span>
                  </div>
                  <p className="text-xs text-[#24352A]">
                    {item.remarks || `${item.action} ${item.entityType}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#66756A]">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {item.actor ? item.actor.fullName : 'System'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {item.navigationPath && (
                <Link
                  to={item.navigationPath}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1 text-xs font-medium text-[#17452C] hover:bg-[#EAF1E8]"
                >
                  <span>{t('ux.openRecord', 'View Record')}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
