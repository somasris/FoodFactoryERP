import React from 'react';
import { ProductionTrendPoint } from '../../types/production';

interface ProductionTrendChartProps {
  title: string;
  series: ProductionTrendPoint[];
  mode?: 'quantity' | 'yield' | 'cost';
}

export const ProductionTrendChart: React.FC<ProductionTrendChartProps> = ({
  title,
  series,
  mode = 'quantity',
}) => {
  if (!series || series.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        No trend data available for the selected filters.
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...series.flatMap(pt => {
      if (mode === 'yield') return [Number(pt.yieldPercent), Number(pt.wastagePercent), 100];
      if (mode === 'cost') return [Number(pt.totalCost || 0)];
      return [Number(pt.plannedQuantity), Number(pt.actualQuantity)];
    }),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-800">{title}</h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          {mode === 'quantity' && (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-slate-300" /> Planned
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-brand-navy" /> Actual
              </span>
            </>
          )}
          {mode === 'yield' && (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> Yield %
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Wastage %
              </span>
            </>
          )}
          {mode === 'cost' && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-600" /> Total Cost (₹)
            </span>
          )}
        </div>
      </div>

      <div className="flex h-44 items-end gap-2 overflow-x-auto pb-1">
        {series.map(pt => {
          if (mode === 'quantity') {
            const pPct = Math.min(100, Math.round((Number(pt.plannedQuantity) / maxVal) * 100));
            const aPct = Math.min(100, Math.round((Number(pt.actualQuantity) / maxVal) * 100));
            return (
              <div
                key={pt.period}
                className="flex min-w-[44px] flex-1 flex-col items-center gap-1"
                title={`${pt.period}: Planned ${pt.plannedQuantity} | Actual ${pt.actualQuantity}`}
              >
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t bg-slate-300 transition-all"
                    style={{ height: `${Math.max(4, pPct)}%` }}
                  />
                  <div
                    className="w-3 rounded-t bg-brand-navy transition-all"
                    style={{ height: `${Math.max(4, aPct)}%` }}
                  />
                </div>
                <span className="truncate text-[10px] text-slate-500">{pt.period}</span>
              </div>
            );
          }

          if (mode === 'yield') {
            const yPct = Math.min(100, Math.round((Number(pt.yieldPercent) / maxVal) * 100));
            const wPct = Math.min(100, Math.round((Number(pt.wastagePercent) / maxVal) * 100));
            return (
              <div
                key={pt.period}
                className="flex min-w-[44px] flex-1 flex-col items-center gap-1"
                title={`${pt.period}: Yield ${pt.yieldPercent}% | Wastage ${pt.wastagePercent}%`}
              >
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t bg-emerald-600 transition-all"
                    style={{ height: `${Math.max(4, yPct)}%` }}
                  />
                  <div
                    className="w-3 rounded-t bg-red-500 transition-all"
                    style={{ height: `${Math.max(4, wPct)}%` }}
                  />
                </div>
                <span className="truncate text-[10px] text-slate-500">{pt.period}</span>
              </div>
            );
          }

          const cPct = Math.min(100, Math.round((Number(pt.totalCost || 0) / maxVal) * 100));
          return (
            <div
              key={pt.period}
              className="flex min-w-[44px] flex-1 flex-col items-center gap-1"
              title={`${pt.period}: ₹${pt.totalCost || '0.00'}`}
            >
              <div className="flex h-36 w-full items-end justify-center">
                <div
                  className="w-5 rounded-t bg-amber-500 transition-all"
                  style={{ height: `${Math.max(4, cPct)}%` }}
                />
              </div>
              <span className="truncate text-[10px] text-slate-500">{pt.period}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
