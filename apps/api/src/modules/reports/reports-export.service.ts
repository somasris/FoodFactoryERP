import PDFDocument from 'pdfkit';
import { ReportsService } from './reports.service';
import { AnalyticsFilter } from './reports.types';
import { UserContext } from '../inventory/inventory.utils';

export type AnalyticsExportType = 'sales' | 'inventory' | 'profitability' | 'factory-performance';
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

export class ReportsExportService {
  static async generateExport(
    reportType: AnalyticsExportType,
    format: ExportFormat,
    filter: AnalyticsFilter,
    user: UserContext,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    let title = '';
    let columns: Array<{ key: string; label: string }> = [];
    let rows: Array<Record<string, unknown>> = [];

    if (reportType === 'sales') {
      title = 'Sales Analytics by Product';
      columns = [
        { key: 'productName', label: 'Product' },
        { key: 'categoryName', label: 'Category' },
        { key: 'quantity', label: 'Sold Qty' },
        { key: 'revenue', label: 'Taxable Revenue (INR)' },
      ];
      rows = (await ReportsService.getSalesAnalytics(filter)).salesByProduct;
    } else if (reportType === 'inventory') {
      title = 'Inventory Analytics by Warehouse';
      columns = [
        { key: 'warehouseCode', label: 'Warehouse Code' },
        { key: 'warehouseName', label: 'Warehouse Name' },
        { key: 'itemCount', label: 'Active Items' },
        { key: 'value', label: 'Total Value (INR)' },
      ];
      rows = (await ReportsService.getInventoryAnalytics(filter, user)).warehouseComparison;
    } else if (reportType === 'profitability') {
      title = 'Product Gross Margin Report';
      columns = [
        { key: 'productCode', label: 'Code' },
        { key: 'productName', label: 'Product' },
        { key: 'soldQuantity', label: 'Sold Qty' },
        { key: 'revenue', label: 'Revenue (INR)' },
        { key: 'productionCost', label: 'Production Cost' },
        { key: 'grossMargin', label: 'Gross Margin' },
        { key: 'grossMarginPercent', label: 'Margin %' },
      ];
      rows = (await ReportsService.getProfitabilityReport(filter)).products;
    } else {
      title = 'Factory Performance Comparison';
      columns = [
        { key: 'factoryCode', label: 'Factory Code' },
        { key: 'factoryName', label: 'Factory Name' },
        { key: 'warehouseCount', label: 'Warehouses' },
        { key: 'inventoryValue', label: 'Inventory Value' },
        { key: 'completedWorkOrders', label: 'Completed WOs' },
        { key: 'productionOutputQty', label: 'Good Output' },
      ];
      rows = (await ReportsService.getFactoryPerformance(filter, user)).items;
    }

    const generatedAt = new Date().toISOString();
    const baseName = `bi-${reportType}-${generatedAt.slice(0, 10)}`;

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
  <Worksheet ss:Name="Analytics">
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

      doc.fontSize(8).text(columns.map(c => c.label).join(' | '));
      doc.moveTo(36, doc.y + 2).lineTo(800, doc.y + 2).stroke();
      doc.moveDown(0.4);

      for (const row of rows.slice(0, 250)) {
        doc.fontSize(7).text(columns.map(c => String(row[c.key] ?? '-')).join(' | '));
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
