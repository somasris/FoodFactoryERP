import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, GitBranch, MinusCircle } from 'lucide-react';
import { BatchJourneyData } from '../../services/manufacturing-intelligence.service';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { useTranslation } from '../../i18n/I18nContext';

interface BatchJourneyTimelineProps {
  journey?: BatchJourneyData | null;
  isLoading?: boolean;
}

export const BatchJourneyTimeline: React.FC<BatchJourneyTimelineProps> = ({
  journey,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-[#66756A]">
          {t('common.loading', 'Loading...')}
        </CardContent>
      </Card>
    );
  }

  if (!journey) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#17452C]">
          <GitBranch className="h-4 w-4 text-[#245C3A]" />
          <span>{t('mi.batchJourneyTitle', 'Batch Journey & Genealogy Timeline')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y divide-[#E1E7DD] rounded-lg border border-[#E1E7DD]">
          {journey.stages.map(stage => {
            const isOccurred = stage.status === 'OCCURRED';
            const isPending = stage.status === 'PENDING';
            return (
              <div
                key={stage.key}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {isOccurred ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#27834A]" />
                  ) : isPending ? (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#C58A25]" />
                  ) : (
                    <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8A958C]" />
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#17452C]">{stage.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          isOccurred
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {stage.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#24352A]">{stage.summary}</p>
                    {(stage.timestamp || stage.actor) && (
                      <div className="text-[11px] text-[#66756A]">
                        {stage.actor ? `${stage.actor} • ` : ''}
                        {stage.timestamp ? new Date(stage.timestamp).toLocaleString() : ''}
                      </div>
                    )}
                  </div>
                </div>

                {stage.navigationPath && (
                  <Link
                    to={stage.navigationPath}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-[#E1E7DD] bg-[#FAFBF8] px-2 py-1 text-[11px] font-medium text-[#17452C] hover:bg-[#EAF1E8]"
                  >
                    <span>{t('ux.openRecord', 'View Record')}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {journey.genealogy.splitSiblingBatches.length > 0 && (
          <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3 text-xs">
            <div className="mb-1.5 font-semibold text-[#17452C]">
              {t('mi.splitSiblingBatches', 'Split / Sibling Batches on Same Work Order')}
            </div>
            <div className="flex flex-wrap gap-2">
              {journey.genealogy.splitSiblingBatches.map(sb => (
                <Link
                  key={sb.id}
                  to={`/production/batches/${sb.id}`}
                  className="rounded border border-[#E1E7DD] bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-[#245C3A] hover:bg-[#EAF1E8]"
                >
                  {sb.batchNumber} ({sb.status})
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
