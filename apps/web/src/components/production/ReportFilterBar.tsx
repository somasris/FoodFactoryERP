import React, { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { productionService } from '../../services/production.service';
import { ProductionReportQuery, ReportPeriod } from '../../types/production';

interface ReportFilterBarProps {
  query: ProductionReportQuery;
  onChange: (next: ProductionReportQuery) => void;
  reportType?: string;
  statusOptions?: string[];
  showSearch?: boolean;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  query,
  onChange,
  reportType,
  statusOptions = [],
  showSearch = true,
}) => {
  const { hasPermission } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExport = Boolean(reportType) && hasPermission('production.reports.export');

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!reportType) return;
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await productionService.reports.downloadExport(
        reportType,
        format,
        query,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Report period"
          value={query.period || 'month'}
          onChange={e =>
            onChange({
              ...query,
              period: e.target.value as ReportPeriod,
              page: 1,
            })
          }
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="fy">This Financial Year</option>
          <option value="custom">Custom Range</option>
        </select>

        {(query.period === 'custom' || query.fromDate || query.toDate) && (
          <>
            <input
              aria-label="From date"
              type="date"
              value={query.fromDate || ''}
              onChange={e =>
                onChange({ ...query, period: 'custom', fromDate: e.target.value, page: 1 })
              }
              className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
            />
            <input
              aria-label="To date"
              type="date"
              value={query.toDate || ''}
              onChange={e =>
                onChange({ ...query, period: 'custom', toDate: e.target.value, page: 1 })
              }
              className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
            />
          </>
        )}

        {statusOptions.length > 0 && (
          <select
            aria-label="Filter by status"
            value={query.status || ''}
            onChange={e =>
              onChange({ ...query, status: e.target.value || undefined, page: 1 })
            }
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            {statusOptions.map(st => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        )}

        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={query.search || ''}
              onChange={e =>
                onChange({ ...query, search: e.target.value || undefined, page: 1 })
              }
              className="rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
        )}
      </div>

      {canExport && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={exporting}
              onClick={() => handleExport('csv')}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={exporting}
              onClick={() => handleExport('excel')}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={exporting}
              onClick={() => handleExport('pdf')}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
          {exportError && <p className="text-[11px] text-rose-600">{exportError}</p>}
        </div>
      )}
    </div>
  );
};
