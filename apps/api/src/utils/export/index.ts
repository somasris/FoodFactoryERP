import { ExportDocumentOptions, ExportFormat, ExportResult } from './export.types';
import { generateCsvExport } from './csv-exporter';
import { generateExcelExport } from './excel-exporter';
import { generatePdfExport } from './pdf-exporter';

export * from './export.types';
export * from './export-theme';
export { generateCsvExport, escapeCsvField, formatCsvCellValue } from './csv-exporter';
export { generateExcelExport } from './excel-exporter';
export { generatePdfExport } from './pdf-exporter';

/**
 * Unified entry point for generating standardized CSV, Excel (.xlsx), or PDF exports.
 */
export async function generateStandardExport(
  format: ExportFormat,
  options: ExportDocumentOptions,
): Promise<ExportResult> {
  if (format === 'csv') {
    return generateCsvExport(options);
  }
  if (format === 'excel') {
    return generateExcelExport(options);
  }
  return generatePdfExport(options);
}
