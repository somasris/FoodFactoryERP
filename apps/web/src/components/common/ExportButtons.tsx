import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from './Button';

export type ExportFormatOption = 'csv' | 'excel' | 'pdf';

interface ExportButtonsProps {
  onExport: (format: ExportFormatOption) => Promise<void>;
  formats?: ExportFormatOption[];
  size?: 'sm' | 'default';
}

const FORMAT_META: Record<
  ExportFormatOption,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  csv: { label: 'CSV', Icon: Download },
  excel: { label: 'Excel', Icon: FileSpreadsheet },
  pdf: { label: 'PDF', Icon: FileText },
};

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  onExport,
  formats = ['csv', 'excel', 'pdf'],
  size = 'sm',
}) => {
  const [activeFormat, setActiveFormat] = useState<ExportFormatOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (fmt: ExportFormatOption) => {
    setActiveFormat(fmt);
    setError(null);
    try {
      await onExport(fmt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setActiveFormat(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {formats.map(fmt => {
          const { label, Icon } = FORMAT_META[fmt];
          const isBusy = activeFormat === fmt;
          return (
            <Button
              key={fmt}
              type="button"
              size={size}
              variant="outline"
              disabled={activeFormat !== null}
              onClick={() => handleClick(fmt)}
              className="gap-1.5"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {isBusy ? `Exporting ${label}...` : label}
            </Button>
          );
        })}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
};
