export type ExportFormat = 'csv' | 'excel' | 'pdf';

export type ExportColumnType =
  | 'string'
  | 'number'
  | 'integer'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'boolean';

export interface ExportColumn {
  key: string;
  label: string;
  type?: ExportColumnType;
  align?: 'left' | 'center' | 'right';
  widthWeight?: number;
  minWidth?: number;
  maxWidth?: number;
  decimals?: number;
  includeInTotal?: boolean;
}

export interface ExportSummaryMetric {
  label: string;
  value: string | number;
  type?: ExportColumnType;
  decimals?: number;
}

export interface ExportCompanyInfo {
  name: string;
  tradeName?: string | null;
  gstin?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

export interface ExportFilterItem {
  label: string;
  value: string;
}

export interface ExportDocumentOptions {
  title: string;
  subtitle?: string;
  module: string;
  filenamePrefix: string;
  sheetName?: string;
  company?: ExportCompanyInfo | null;
  generatedAt?: Date;
  reportingPeriod?: string;
  appliedFilters?: ExportFilterItem[];
  warehouseOrFactory?: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  summaryMetrics?: ExportSummaryMetric[];
  footerNote?: string;
  orientation?: 'auto' | 'portrait' | 'landscape';
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}
