import { ExportColumn, ExportDocumentOptions, ExportResult } from './export.types';
import {
  buildExportFilename,
  formatDateIso,
  formatDateTimeReadable,
  isNumericColumnType,
} from './export-theme';

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const VALID_NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

function formatNumericString(value: unknown, decimals?: number): string {
  if (value === null || value === undefined || value === '') return '';
  const raw = typeof value === 'object' && value !== null && 'toString' in value
    ? String((value as { toString: () => string }).toString())
    : String(value).trim();
  if (raw === '') return '';

  // Preserve exact string if it's already a clean decimal and no fixed decimals forced
  if (VALID_NUMBER_RE.test(raw)) {
    if (decimals === undefined) return raw;
    const num = Number(raw);
    return Number.isFinite(num) ? num.toFixed(decimals) : raw;
  }

  const num = Number(raw);
  if (Number.isFinite(num)) {
    return decimals !== undefined ? num.toFixed(decimals) : String(num);
  }
  return raw;
}

/**
 * Formats a cell value for clean CSV output according to its column type.
 */
export function formatCsvCellValue(value: unknown, col: ExportColumn): string {
  if (value === null || value === undefined) return '';

  switch (col.type) {
    case 'integer':
      return formatNumericString(value, col.decimals ?? 0);
    case 'currency':
    case 'number':
    case 'percent':
      return formatNumericString(value, col.decimals ?? 2);
    case 'date':
      return formatDateIso(value);
    case 'datetime':
      return formatDateTimeReadable(value);
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : String(value);
    default: {
      if (value instanceof Date) return formatDateIso(value);
      return String(value);
    }
  }
}

/**
 * Escapes a single CSV cell per RFC 4180 and protects untrusted text fields
 * from spreadsheet formula injection without corrupting legitimate numbers.
 */
export function escapeCsvField(raw: string, isNumericColumn = false): string {
  let value = raw;

  if (!isNumericColumn && FORMULA_PREFIX_RE.test(value) && !VALID_NUMBER_RE.test(value.trim())) {
    value = `'${value}`;
  }

  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a clean, RFC 4180 compliant UTF-8 CSV (with BOM for Windows Excel).
 * Contains only structured header + data rows (no decorative title/comment rows).
 */
export function generateCsvExport(options: ExportDocumentOptions): ExportResult {
  const generatedAt = options.generatedAt ?? new Date();
  const headerLine = options.columns
    .map(col => escapeCsvField(col.label, false))
    .join(',');

  const dataLines = options.rows.map(row =>
    options.columns
      .map(col => {
        const formatted = formatCsvCellValue(row[col.key], col);
        return escapeCsvField(formatted, isNumericColumnType(col.type));
      })
      .join(','),
  );

  const csvContent = `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;

  return {
    buffer: Buffer.from(csvContent, 'utf8'),
    contentType: 'text/csv; charset=utf-8',
    filename: buildExportFilename(options.filenamePrefix, 'csv', generatedAt),
  };
}
