import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ExportColumn,
  ExportDocumentOptions,
  generateCsvExport,
  generateExcelExport,
  generatePdfExport,
  resolveOfficialLogoPath,
} from '../src/utils/export';

const SAMPLE_COLUMNS: ExportColumn[] = [
  { key: 'planNumber', label: 'Plan #', type: 'string' },
  { key: 'productName', label: 'Product', type: 'string' },
  { key: 'planDate', label: 'Plan Date', type: 'date' },
  { key: 'plannedQty', label: 'Planned Qty', type: 'number', includeInTotal: true },
  { key: 'actualCost', label: 'Actual Cost', type: 'currency', includeInTotal: true },
  { key: 'yieldPercent', label: 'Yield %', type: 'percent' },
  { key: 'notes', label: 'Notes', type: 'string' },
];

function buildSampleOptions(overrides: Partial<ExportDocumentOptions> = {}): ExportDocumentOptions {
  return {
    title: 'Production Plan vs Actual Report',
    subtitle: 'Standardized ERP export verification',
    module: 'Production Reports',
    filenamePrefix: 'Production_Plan_vs_Actual',
    sheetName: 'Plan vs Actual',
    company: {
      name: 'Sri Annapurna Foods Pvt Ltd',
      gstin: '33AABCS1234F1Z5',
      address: 'Chennai, Tamil Nadu',
    },
    reportingPeriod: 'This Financial Year',
    appliedFilters: [{ label: 'Status', value: 'COMPLETED' }],
    columns: SAMPLE_COLUMNS,
    rows: [
      {
        planNumber: 'PP-2026-001',
        productName: 'Traditional Butter Murukku 200g Family Pack',
        planDate: '2026-11-27',
        plannedQty: '1500.50',
        actualCost: '45250.75',
        yieldPercent: '94.25',
        notes: 'Batch completed on schedule',
      },
      {
        planNumber: 'PP-2026-002',
        productName: 'Masala Mixture, "Special" Edition',
        planDate: new Date('2026-11-26T10:00:00Z'),
        plannedQty: '-12.50',
        actualCost: '18900.00',
        yieldPercent: '91.00',
        notes: '=CMD|calc',
      },
    ],
    summaryMetrics: [
      { label: 'Total Plans', value: 2, type: 'integer' },
      { label: 'Total Cost', value: 64150.75, type: 'currency' },
    ],
    ...overrides,
  };
}

describe('Standardized Export Utilities', () => {
  describe('CSV Exporter', () => {
    it('generates clean UTF-8 BOM CSV with RFC 4180 escaping, precision, and formula-injection protection', () => {
      const result = generateCsvExport(buildSampleOptions());
      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.filename).toMatch(/^Production_Plan_vs_Actual_\d{4}-\d{2}-\d{2}\.csv$/);

      const text = result.buffer.toString('utf8');
      // UTF-8 BOM present
      expect(text.charCodeAt(0)).toBe(0xfeff);

      const lines = text.slice(1).split('\r\n');
      // No decorative # title rows — header is row 0
      expect(lines[0]).toBe(
        'Plan #,Product,Plan Date,Planned Qty,Actual Cost,Yield %,Notes',
      );
      expect(lines).toHaveLength(3);

      // Exact decimal precision preserved
      expect(lines[1]).toContain('1500.50,45250.75,94.25');

      // Quoting & embedded double-quote escaping, negative number NOT corrupted, formula text prefixed with '
      expect(lines[2]).toContain('"Masala Mixture, ""Special"" Edition"');
      expect(lines[2]).toContain(',-12.50,');
      expect(lines[2]).toContain("'=CMD|calc");
    });
  });

  describe('Excel (.xlsx) Exporter', () => {
    it('generates a formatted .xlsx workbook with numeric types, freeze panes, autoFilter, totals, and Summary sheet', async () => {
      const result = await generateExcelExport(buildSampleOptions());
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(result.filename).toMatch(/^Production_Plan_vs_Actual_\d{4}-\d{2}-\d{2}\.xlsx$/);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);

      const dataSheet = wb.getWorksheet('Plan vs Actual');
      expect(dataSheet).toBeDefined();
      expect(dataSheet!.views[0]?.state).toBe('frozen');
      expect(dataSheet!.autoFilter).toBeDefined();

      // Find header row
      let headerRowNum = 0;
      dataSheet!.eachRow((row, rowNumber) => {
        if (row.getCell(1).value === 'Plan #') {
          headerRowNum = rowNumber;
        }
      });
      expect(headerRowNum).toBeGreaterThan(1);

      const firstDataRow = dataSheet!.getRow(headerRowNum + 1);
      expect(firstDataRow.getCell(1).value).toBe('PP-2026-001');
      expect(typeof firstDataRow.getCell(4).value).toBe('number');
      expect(firstDataRow.getCell(4).value).toBe(1500.5);
      expect(firstDataRow.getCell(5).value).toBe(45250.75);
      expect(firstDataRow.getCell(5).numFmt).toBe('₹#,##0.00');
      expect(firstDataRow.getCell(6).numFmt).toBe('0.00"%"');

      // Totals row
      const totalsRow = dataSheet!.getRow(headerRowNum + 3);
      expect(totalsRow.getCell(1).value).toBe('Total');
      expect(totalsRow.getCell(5).value).toBe(64150.75);

      // Summary worksheet
      const summarySheet = wb.getWorksheet('Summary');
      expect(summarySheet).toBeDefined();

      // Official brand symbol embedded in header
      expect(resolveOfficialLogoPath()).toMatch(/foodfactory-symbol-256\.png$/);
      expect(dataSheet!.getImages().length).toBe(1);
    });
  });

  describe('PDF Exporter', () => {
    it('generates a valid multi-page landscape PDF for wide tables with long wrapped text', async () => {
      const manyRows = Array.from({ length: 85 }, (_, i) => ({
        planNumber: `PP-2026-${String(i + 1).padStart(3, '0')}`,
        productName: `Artisanal South Indian Spiced Murukku Variant #${i + 1} with Extended Packaging Description`,
        planDate: '2026-11-27',
        plannedQty: '250.00',
        actualCost: '12345.67',
        yieldPercent: '95.50',
        notes: 'Long operational note that should wrap cleanly inside the table cell without clipping.',
      }));

      const result = await generatePdfExport(buildSampleOptions({ rows: manyRows }));
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^Production_Plan_vs_Actual_\d{4}-\d{2}-\d{2}\.pdf$/);
      expect(result.buffer.toString('utf8', 0, 5)).toBe('%PDF-');
      expect(result.buffer.length).toBeGreaterThan(4000);
    });

    it('handles empty reports and portrait layout (<= 6 columns) cleanly', async () => {
      const result = await generatePdfExport(
        buildSampleOptions({
          columns: SAMPLE_COLUMNS.slice(0, 4),
          rows: [],
          summaryMetrics: [],
        }),
      );
      expect(result.contentType).toBe('application/pdf');
      expect(result.buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });
  });
});
