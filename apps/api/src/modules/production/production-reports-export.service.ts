import PDFDocument from 'pdfkit';
import { BaseReportQuery, ExportFormat, ExportReportType } from './production-reports.types';
import { ProductionReportsService } from './production-reports.service';

interface ExportColumn {
  key: string;
  label: string;
}

const REPORT_CONFIG: Record<ExportReportType, { title: string; columns: ExportColumn[] }> = {
  'plan-vs-actual': {
    title: 'Production Plan vs Actual Report',
    columns: [
      { key: 'planNumber', label: 'Plan #' },
      { key: 'planStatus', label: 'Plan Status' },
      { key: 'productName', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'plannedQuantity', label: 'Planned Qty' },
      { key: 'workOrderedQuantity', label: 'Work Ordered Qty' },
      { key: 'actualProducedQuantity', label: 'Actual Produced Qty' },
      { key: 'acceptedQuantity', label: 'Accepted Qty' },
      { key: 'rejectedQuantity', label: 'Rejected Qty' },
      { key: 'remainingQuantity', label: 'Remaining Qty' },
      { key: 'completionPercent', label: 'Completion %' },
      { key: 'varianceClassification', label: 'Classification' },
    ],
  },
  'work-order-performance': {
    title: 'Work Order Performance Report',
    columns: [
      { key: 'workOrderNumber', label: 'Work Order #' },
      { key: 'productionPlanNumber', label: 'Plan #' },
      { key: 'productName', label: 'Product' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'plannedQuantity', label: 'Planned Qty' },
      { key: 'actualGoodQuantity', label: 'Actual Good Qty' },
      { key: 'scrapQuantity', label: 'Scrap Qty' },
      { key: 'executionDurationHours', label: 'Duration (hrs)' },
      { key: 'delayDays', label: 'Delay (days)' },
      { key: 'isOverdue', label: 'Overdue' },
      { key: 'batchCount', label: 'Batches' },
    ],
  },
  'batch-yield': {
    title: 'Batch Production & Yield Report',
    columns: [
      { key: 'batchNumber', label: 'Batch #' },
      { key: 'workOrderNumber', label: 'Work Order #' },
      { key: 'productName', label: 'Product' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'status', label: 'Status' },
      { key: 'plannedQuantity', label: 'Planned Qty' },
      { key: 'actualOutputQuantity', label: 'Actual Output Qty' },
      { key: 'acceptedQuantity', label: 'Accepted Qty' },
      { key: 'rejectedQuantity', label: 'Rejected Qty' },
      { key: 'scrapQuantity', label: 'Scrap Qty' },
      { key: 'actualYieldPercent', label: 'Actual Yield %' },
      { key: 'expectedYieldPercent', label: 'Expected Yield %' },
      { key: 'yieldVariancePercent', label: 'Yield Variance %' },
    ],
  },
  'material-consumption': {
    title: 'Material Consumption & Wastage Report',
    columns: [
      { key: 'batchNumber', label: 'Batch #' },
      { key: 'productName', label: 'Product' },
      { key: 'itemCode', label: 'Material Code' },
      { key: 'itemName', label: 'Material Name' },
      { key: 'itemType', label: 'Type' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'sourceBatchNumbers', label: 'Source Batches' },
      { key: 'bomPlannedQuantity', label: 'BOM Planned Qty' },
      { key: 'actualConsumedQuantity', label: 'Consumed Qty' },
      { key: 'returnedQuantity', label: 'Returned Qty' },
      { key: 'netConsumption', label: 'Net Consumption' },
      { key: 'expectedWastage', label: 'Expected Wastage' },
      { key: 'actualWastage', label: 'Actual Wastage' },
      { key: 'wastagePercent', label: 'Wastage %' },
      { key: 'materialCost', label: 'Material Cost (INR)' },
    ],
  },
  quality: {
    title: 'Finished Goods & Quality Analytics Report',
    columns: [
      { key: 'inspectionNumber', label: 'Inspection #' },
      { key: 'productionBatchNumber', label: 'Prod Batch #' },
      { key: 'inventoryBatchNumber', label: 'FG Batch #' },
      { key: 'productName', label: 'Product' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'decision', label: 'Decision' },
      { key: 'qualityStatus', label: 'Quality Status' },
      { key: 'inspectedQuantity', label: 'Inspected Qty' },
      { key: 'acceptedQuantity', label: 'Accepted Qty' },
      { key: 'rejectedQuantity', label: 'Rejected Qty' },
      { key: 'quarantinedQuantity', label: 'Quarantined Qty' },
      { key: 'pendingQuantity', label: 'Pending Qty' },
    ],
  },
  costing: {
    title: 'Production Cost & Variance Analytics Report',
    columns: [
      { key: 'batchNumber', label: 'Batch #' },
      { key: 'productName', label: 'Product' },
      { key: 'uomSymbol', label: 'UOM' },
      { key: 'status', label: 'Costing Status' },
      { key: 'standardMaterialCost', label: 'Std Material (INR)' },
      { key: 'actualMaterialCost', label: 'Actual Material (INR)' },
      { key: 'labourCost', label: 'Labour (INR)' },
      { key: 'machineCost', label: 'Machine (INR)' },
      { key: 'overheadCost', label: 'Overhead (INR)' },
      { key: 'standardTotalCost', label: 'Std Total (INR)' },
      { key: 'totalActualCost', label: 'Actual Total (INR)' },
      { key: 'costVariance', label: 'Variance (INR)' },
      { key: 'costVariancePercent', label: 'Variance %' },
      { key: 'acceptedGoodQuantity', label: 'Accepted Qty' },
      { key: 'costPerAcceptedUnit', label: 'Unit Cost (INR)' },
      { key: 'wastageAndRejectionCost', label: 'Wastage/Rej Cost (INR)' },
    ],
  },
};

function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeXml(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ProductionReportsExportService {
  static async generateExport(
    reportType: ExportReportType,
    format: ExportFormat,
    query: BaseReportQuery,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const config = REPORT_CONFIG[reportType];
    let rows: Array<Record<string, unknown>> = [];

    switch (reportType) {
      case 'plan-vs-actual':
        rows = (await ProductionReportsService.getPlanVsActualReport(query)).items;
        break;
      case 'work-order-performance':
        rows = (await ProductionReportsService.getWorkOrderPerformanceReport(query)).items;
        break;
      case 'batch-yield':
        rows = (await ProductionReportsService.getBatchYieldReport(query)).items;
        break;
      case 'material-consumption':
        rows = (await ProductionReportsService.getMaterialConsumptionReport(query)).items;
        break;
      case 'quality':
        rows = (await ProductionReportsService.getQualityReport(query)).items;
        break;
      case 'costing':
        rows = (await ProductionReportsService.getCostingReport(query)).items;
        break;
    }

    const generatedAt = new Date().toISOString();
    const dateStamp = generatedAt.slice(0, 10);
    const safeBase = `foodfactory-${reportType}-${dateStamp}`;

    if (format === 'csv') {
      const headerMeta = [
        `# ${config.title}`,
        `# Generated At: ${generatedAt}`,
        config.columns.map(c => escapeCsvCell(c.label)).join(','),
      ];
      const dataLines = rows.map(r =>
        config.columns.map(c => escapeCsvCell(r[c.key])).join(','),
      );
      const csv = `\uFEFF${[...headerMeta, ...dataLines].join('\r\n')}`;
      return {
        buffer: Buffer.from(csv, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: `${safeBase}.csv`,
      };
    }

    if (format === 'excel') {
      const headerRow = `<Row>${config.columns
        .map(c => `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = rows
        .map(
          r =>
            `<Row>${config.columns
              .map(c => `<Cell><Data ss:Type="String">${escapeXml(r[c.key])}</Data></Cell>`)
              .join('')}</Row>`,
        )
        .join('');
      const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Report">
    <Table>
      <Row><Cell><Data ss:Type="String">${escapeXml(config.title)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Generated At: ${escapeXml(generatedAt)}</Data></Cell></Row>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
      return {
        buffer: Buffer.from(xml, 'utf8'),
        contentType: 'application/vnd.ms-excel; charset=utf-8',
        filename: `${safeBase}.xls`,
      };
    }

    // PDF export via pdfkit
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text(config.title, { align: 'left' });
      doc.fontSize(8).fillColor('#555555').text(`Generated At: ${generatedAt} | Rows: ${rows.length}`);
      doc.moveDown(0.75);
      doc.fillColor('#000000');

      const previewCols = config.columns.slice(0, 8);
      doc.fontSize(8).text(previewCols.map(c => c.label).join(' | '));
      doc.moveTo(36, doc.y + 2).lineTo(800, doc.y + 2).stroke();
      doc.moveDown(0.4);

      for (const row of rows.slice(0, 250)) {
        const line = previewCols.map(c => String(row[c.key] ?? '-')).join(' | ');
        doc.fontSize(7).text(line);
      }
      doc.end();
    });

    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${safeBase}.pdf`,
    };
  }
}
