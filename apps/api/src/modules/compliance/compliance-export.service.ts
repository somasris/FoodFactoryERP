import PDFDocument from 'pdfkit';
import { GstComplianceService } from './gst-compliance.service';
import { StockAuditService } from './stock-audit.service';
import { ComplianceReportsService } from './compliance-reports.service';
import { DateRangeQuery } from './compliance.types';
import { UserContext } from '../inventory/inventory.utils';

export type ComplianceExportType =
  | 'gst-sales'
  | 'hsn-summary'
  | 'inventory-valuation'
  | 'production-costing'
  | 'traceability';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

const escapeCsv = (val: unknown): string => {
  const s = val === null || val === undefined ? '' : String(val);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

const escapeXml = (val: unknown): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export class ComplianceExportService {
  static async generateExport(
    reportType: ComplianceExportType,
    format: ExportFormat,
    query: DateRangeQuery,
    user: UserContext,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    let title = '';
    let columns: Array<{ key: string; label: string }> = [];
    let rows: Array<Record<string, unknown>> = [];

    if (reportType === 'gst-sales') {
      title = 'GST Sales Tax Summary';
      columns = [
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'financialYear', label: 'FY' },
        { key: 'status', label: 'Status' },
        { key: 'customerLegalName', label: 'Customer' },
        { key: 'customerGstin', label: 'Customer GSTIN' },
        { key: 'taxableAmount', label: 'Taxable (INR)' },
        { key: 'cgstAmount', label: 'CGST' },
        { key: 'sgstAmount', label: 'SGST' },
        { key: 'igstAmount', label: 'IGST' },
        { key: 'grandTotal', label: 'Grand Total' },
      ];
      rows = (await GstComplianceService.getGstSalesSummary(query)).invoices;
    } else if (reportType === 'hsn-summary') {
      title = 'GST HSN-Wise Sales Summary';
      columns = [
        { key: 'hsnCode', label: 'HSN Code' },
        { key: 'lineCount', label: 'Lines' },
        { key: 'totalQuantity', label: 'Total Qty' },
        { key: 'taxableAmount', label: 'Taxable (INR)' },
        { key: 'cgstAmount', label: 'CGST' },
        { key: 'sgstAmount', label: 'SGST' },
        { key: 'igstAmount', label: 'IGST' },
        { key: 'totalValue', label: 'Total Value' },
      ];
      rows = (await GstComplianceService.getGstSalesSummary(query)).hsnSummary;
    } else if (reportType === 'inventory-valuation') {
      title = 'Inventory Valuation Compliance Report';
      columns = [
        { key: 'warehouseCode', label: 'Warehouse' },
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'itemType', label: 'Type' },
        { key: 'valuationMethod', label: 'Method' },
        { key: 'batchNumber', label: 'Batch' },
        { key: 'quantityOnHand', label: 'On Hand' },
        { key: 'unitCost', label: 'Unit Cost' },
        { key: 'totalValue', label: 'Total Value (INR)' },
      ];
      rows = (await StockAuditService.getInventoryValuationReport(user, { warehouseId: query.warehouseId })).items;
    } else if (reportType === 'production-costing') {
      title = 'Production Cost Compliance Report';
      columns = [
        { key: 'batchNumber', label: 'Batch #' },
        { key: 'productName', label: 'Product' },
        { key: 'costingClassification', label: 'Classification' },
        { key: 'materialCost', label: 'Material' },
        { key: 'labourCost', label: 'Labour' },
        { key: 'overheadCost', label: 'Overhead' },
        { key: 'totalProductionCost', label: 'Total Cost' },
        { key: 'unitCostPerAcceptedUnit', label: 'Unit Cost' },
      ];
      rows = (await ComplianceReportsService.getProductionCostCompliance(query)).items;
    } else {
      title = 'Batch Traceability Compliance Report';
      columns = [
        { key: 'batchNumber', label: 'Batch #' },
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'itemType', label: 'Type' },
        { key: 'qualityStatus', label: 'Quality Status' },
      ];
      rows = (await ComplianceReportsService.getTraceabilityReport({})).items;
    }

    const generatedAt = new Date().toISOString();
    const dateStamp = generatedAt.slice(0, 10);
    const baseName = `compliance-${reportType}-${dateStamp}`;

    if (format === 'csv') {
      const lines = [
        `# ${title}`,
        `# Generated At: ${generatedAt}`,
        columns.map(c => escapeCsv(c.label)).join(','),
        ...rows.map(r => columns.map(c => escapeCsv(r[c.key])).join(',')),
      ];
      return {
        buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: `${baseName}.csv`,
      };
    }

    if (format === 'excel') {
      const headerRow = `<Row>${columns
        .map(c => `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = rows
        .map(
          r =>
            `<Row>${columns
              .map(c => `<Cell><Data ss:Type="String">${escapeXml(r[c.key])}</Data></Cell>`)
              .join('')}</Row>`,
        )
        .join('');
      const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Compliance">
    <Table>
      <Row><Cell><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
      return {
        buffer: Buffer.from(xml, 'utf8'),
        contentType: 'application/vnd.ms-excel; charset=utf-8',
        filename: `${baseName}.xls`,
      };
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text(title);
      doc.fontSize(8).fillColor('#555555').text(`Generated At: ${generatedAt} | Rows: ${rows.length}`);
      doc.moveDown(0.75).fillColor('#000000');

      const previewCols = columns.slice(0, 8);
      doc.fontSize(8).text(previewCols.map(c => c.label).join(' | '));
      doc.moveTo(36, doc.y + 2).lineTo(800, doc.y + 2).stroke();
      doc.moveDown(0.4);

      for (const row of rows.slice(0, 250)) {
        doc.fontSize(7).text(previewCols.map(c => String(row[c.key] ?? '-')).join(' | '));
      }
      doc.end();
    });

    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${baseName}.pdf`,
    };
  }
}
