import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { EfficiencyScorecardData } from '../../services/manufacturing-intelligence.service';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { useTranslation } from '../../i18n/I18nContext';

interface EfficiencyScorecardSectionProps {
  scorecard?: EfficiencyScorecardData | null;
  isLoading?: boolean;
}

export const EfficiencyScorecardSection: React.FC<EfficiencyScorecardSectionProps> = ({
  scorecard,
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

  if (!scorecard) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-[#17452C]">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#245C3A]" />
            <span>{t('mi.efficiencyScorecardTitle', 'Production Efficiency Scorecard')}</span>
          </span>
          <span className="text-[11px] font-normal text-[#66756A]">
            {scorecard.recordCounts.totalBatches} {t('mi.batchesAnalyzed', 'batches')} •{' '}
            {scorecard.recordCounts.COMPLETED} {t('mi.completed', 'completed')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3">
            <div className="text-[11px] text-[#66756A]">
              {t('mi.avgCompletionTime', 'Avg Batch Time')}
            </div>
            <div className="mt-1 text-base font-bold text-[#17452C]">
              {scorecard.performance.avgBatchCompletionHours !== null
                ? `${scorecard.performance.avgBatchCompletionHours} h`
                : 'N/A'}
            </div>
            <div className="text-[10px] text-[#8A958C]">
              n={scorecard.recordCounts.completionTimeRecordCount}
            </div>
          </div>
          <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3">
            <div className="text-[11px] text-[#66756A]">
              {t('mi.woCompletionRate', 'WO Completion Rate')}
            </div>
            <div className="mt-1 text-base font-bold text-[#17452C]">
              {scorecard.performance.workOrderCompletionRatePercent !== null
                ? `${scorecard.performance.workOrderCompletionRatePercent}%`
                : 'N/A'}
            </div>
            <div className="text-[10px] text-[#8A958C]">
              {scorecard.recordCounts.completedWorkOrders}/{scorecard.recordCounts.totalWorkOrders} WOs
            </div>
          </div>
          <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3">
            <div className="text-[11px] text-[#66756A]">
              {t('mi.materialCostVariance', 'Material Cost Variance')}
            </div>
            <div className="mt-1 text-base font-bold text-[#17452C]">
              ₹{scorecard.performance.totalMaterialCostVariance}
            </div>
            <div className="text-[10px] text-[#8A958C]">
              n={scorecard.recordCounts.costedBatchCount} costed
            </div>
          </div>
          <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3">
            <div className="text-[11px] text-[#66756A]">
              {t('mi.totalCostVariance', 'Total Production Variance')}
            </div>
            <div className="mt-1 text-base font-bold text-[#17452C]">
              ₹{scorecard.performance.totalProductionCostVariance}
            </div>
            <div className="text-[10px] text-[#8A958C]">
              {scorecard.recordCounts.IN_PROGRESS} active / {scorecard.recordCounts.CANCELLED} cancelled
            </div>
          </div>
        </div>

        {scorecard.quantityMetricsByUom.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[#E1E7DD]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E1E7DD] bg-[#FAFBF8] text-[#66756A]">
                <tr>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2 text-right">Batches</th>
                  <th className="px-3 py-2 text-right">Planned</th>
                  <th className="px-3 py-2 text-right">Actual Good</th>
                  <th className="px-3 py-2 text-right">Yield %</th>
                  <th className="px-3 py-2 text-right">Wastage %</th>
                  <th className="px-3 py-2 text-right">Rejection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7DD]">
                {scorecard.quantityMetricsByUom.map(row => (
                  <tr key={row.uomCode}>
                    <td className="px-3 py-2 font-semibold">{row.uomCode}</td>
                    <td className="px-3 py-2 text-right">{row.completedBatchCount}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.plannedQuantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.actualGoodQuantity}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {row.yieldPercentage !== null ? `${row.yieldPercentage}%` : 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.wastagePercentage !== null ? `${row.wastagePercentage}%` : 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.rejectionPercentage !== null ? `${row.rejectionPercentage}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scorecard.sourceBatches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#66756A]">
            <span className="font-semibold">{t('mi.sourceBatches', 'Source Batches')}:</span>
            {scorecard.sourceBatches.slice(0, 6).map(b => (
              <Link
                key={b.id}
                to={`/production/batches/${b.id}`}
                className="rounded border border-[#E1E7DD] bg-[#FAFBF8] px-2 py-0.5 font-mono text-[#17452C] hover:bg-[#EAF1E8]"
              >
                {b.batchNumber}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
