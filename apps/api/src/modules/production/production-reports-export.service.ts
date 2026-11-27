import {
  BaseReportQuery,
  ExportFormat,
  ExportReportType,
} from './production-reports.types';
import { ProductionReportsService } from './production-reports.service';
import {
  ExportColumn,
  ExportFilterItem,
  ExportResult,
  ExportSummaryMetric,
  generateStandardExport,
  getExportCompanyInfo,
} from '../../utils/export';

interface ReportSpec {
  title: string;
  subtitle: string;
  filenamePrefix: string;
  sheetName: string;
  columns: ExportColumn[];
}

const REPORT_CONFIG: Record<ExportReportType, ReportSpec> = {
  'plan-vs-actual': {
    title: 'Production Plan vs Actual Report',
    subtitle: 'Planned quantities, work-order allocation, actual output, and variance analysis',
    filenamePrefix: 'Production_Plan_vs_Actual',
    sheetName: 'Plan vs Actual',
    columns: [
      { key: 'planNumber', label: 'Plan #', type: 'string', widthWeight: 12 },
      { key: 'planStatus', label: 'Plan Status', type: 'string', align: 'center', widthWeight: 11 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 22 },
      { key: 'sku', label: 'SKU', type: 'string', widthWeight: 12 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'plannedQuantity', label: 'Planned Qty', type: 'number', includeInTotal: true },
      { key: 'workOrderedQuantity', label: 'Work Ordered Qty', type: 'number', includeInTotal: true },
      { key: 'actualProducedQuantity', label: 'Actual Produced Qty', type: 'number', includeInTotal: true },
      { key: 'acceptedQuantity', label: 'Accepted Qty', type: 'number', includeInTotal: true },
      { key: 'rejectedQuantity', label: 'Rejected Qty', type: 'number', includeInTotal: true },
      { key: 'remainingQuantity', label: 'Remaining Qty', type: 'number', includeInTotal: true },
      { key: 'completionPercent', label: 'Completion %', type: 'percent' },
      { key: 'varianceClassification', label: 'Classification', type: 'string', align: 'center', widthWeight: 13 },
    ],
  },
  'work-order-performance': {
    title: 'Work Order Performance Report',
    subtitle: 'Execution status, good output, scrap, cycle duration, and schedule adherence',
    filenamePrefix: 'Work_Order_Performance',
    sheetName: 'Work Order Perf',
    columns: [
      { key: 'workOrderNumber', label: 'Work Order #', type: 'string', widthWeight: 13 },
      { key: 'productionPlanNumber', label: 'Plan #', type: 'string', widthWeight: 12 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 22 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'status', label: 'Status', type: 'string', align: 'center', widthWeight: 11 },
      { key: 'priority', label: 'Priority', type: 'string', align: 'center', widthWeight: 9 },
      { key: 'plannedQuantity', label: 'Planned Qty', type: 'number', includeInTotal: true },
      { key: 'actualGoodQuantity', label: 'Actual Good Qty', type: 'number', includeInTotal: true },
      { key: 'scrapQuantity', label: 'Scrap Qty', type: 'number', includeInTotal: true },
      { key: 'executionDurationHours', label: 'Duration (hrs)', type: 'number' },
      { key: 'delayDays', label: 'Delay (days)', type: 'integer' },
      { key: 'isOverdue', label: 'Overdue', type: 'boolean' },
      { key: 'batchCount', label: 'Batches', type: 'integer', includeInTotal: true },
    ],
  },
  'batch-yield': {
    title: 'Batch Production & Yield Report',
    subtitle: 'Batch-level output, QC acceptance, scrap, and expected vs actual yield',
    filenamePrefix: 'Batch_Production_Yield',
    sheetName: 'Batch Yield',
    columns: [
      { key: 'batchNumber', label: 'Batch #', type: 'string', widthWeight: 14 },
      { key: 'workOrderNumber', label: 'Work Order #', type: 'string', widthWeight: 13 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 22 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'status', label: 'Status', type: 'string', align: 'center', widthWeight: 11 },
      { key: 'plannedQuantity', label: 'Planned Qty', type: 'number', includeInTotal: true },
      { key: 'actualOutputQuantity', label: 'Actual Output Qty', type: 'number', includeInTotal: true },
      { key: 'acceptedQuantity', label: 'Accepted Qty', type: 'number', includeInTotal: true },
      { key: 'rejectedQuantity', label: 'Rejected Qty', type: 'number', includeInTotal: true },
      { key: 'scrapQuantity', label: 'Scrap Qty', type: 'number', includeInTotal: true },
      { key: 'actualYieldPercent', label: 'Actual Yield %', type: 'percent' },
      { key: 'expectedYieldPercent', label: 'Expected Yield %', type: 'percent' },
      { key: 'yieldVariancePercent', label: 'Yield Variance %', type: 'percent' },
    ],
  },
  'material-consumption': {
    title: 'Material Consumption & Wastage Report',
    subtitle: 'BOM standard vs actual raw material consumption, returns, and wastage cost',
    filenamePrefix: 'Material_Consumption_Wastage',
    sheetName: 'Material Consumption',
    columns: [
      { key: 'batchNumber', label: 'Batch #', type: 'string', widthWeight: 13 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 18 },
      { key: 'itemCode', label: 'Material Code', type: 'string', widthWeight: 12 },
      { key: 'itemName', label: 'Material Name', type: 'string', widthWeight: 20 },
      { key: 'itemType', label: 'Type', type: 'string', align: 'center', widthWeight: 10 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'sourceBatchNumbers', label: 'Source Batches', type: 'string', widthWeight: 16 },
      { key: 'bomPlannedQuantity', label: 'BOM Planned Qty', type: 'number', includeInTotal: true },
      { key: 'actualConsumedQuantity', label: 'Consumed Qty', type: 'number', includeInTotal: true },
      { key: 'returnedQuantity', label: 'Returned Qty', type: 'number', includeInTotal: true },
      { key: 'netConsumption', label: 'Net Consumption', type: 'number', includeInTotal: true },
      { key: 'expectedWastage', label: 'Expected Wastage', type: 'number', includeInTotal: true },
      { key: 'actualWastage', label: 'Actual Wastage', type: 'number', includeInTotal: true },
      { key: 'wastagePercent', label: 'Wastage %', type: 'percent' },
      { key: 'materialCost', label: 'Material Cost', type: 'currency', includeInTotal: true },
    ],
  },
  quality: {
    title: 'Finished Goods & Quality Analytics Report',
    subtitle: 'Inspection decisions, accepted, rejected, quarantined, and pending quantities',
    filenamePrefix: 'Quality_Analytics',
    sheetName: 'Quality Analytics',
    columns: [
      { key: 'inspectionNumber', label: 'Inspection #', type: 'string', widthWeight: 14 },
      { key: 'productionBatchNumber', label: 'Prod Batch #', type: 'string', widthWeight: 14 },
      { key: 'inventoryBatchNumber', label: 'FG Batch #', type: 'string', widthWeight: 14 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 22 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'decision', label: 'Decision', type: 'string', align: 'center', widthWeight: 11 },
      { key: 'qualityStatus', label: 'Quality Status', type: 'string', align: 'center', widthWeight: 12 },
      { key: 'inspectedQuantity', label: 'Inspected Qty', type: 'number', includeInTotal: true },
      { key: 'acceptedQuantity', label: 'Accepted Qty', type: 'number', includeInTotal: true },
      { key: 'rejectedQuantity', label: 'Rejected Qty', type: 'number', includeInTotal: true },
      { key: 'quarantinedQuantity', label: 'Quarantined Qty', type: 'number', includeInTotal: true },
      { key: 'pendingQuantity', label: 'Pending Qty', type: 'number', includeInTotal: true },
    ],
  },
  costing: {
    title: 'Production Cost & Variance Analytics Report',
    subtitle: 'Standard vs actual material, labour, machine, and overhead costing per batch',
    filenamePrefix: 'Production_Costing_Variance',
    sheetName: 'Production Costing',
    columns: [
      { key: 'batchNumber', label: 'Batch #', type: 'string', widthWeight: 13 },
      { key: 'productName', label: 'Product', type: 'string', widthWeight: 20 },
      { key: 'uomSymbol', label: 'UOM', type: 'string', align: 'center', widthWeight: 7 },
      { key: 'status', label: 'Costing Status', type: 'string', align: 'center', widthWeight: 12 },
      { key: 'standardMaterialCost', label: 'Std Material', type: 'currency', includeInTotal: true },
      { key: 'actualMaterialCost', label: 'Actual Material', type: 'currency', includeInTotal: true },
      { key: 'labourCost', label: 'Labour', type: 'currency', includeInTotal: true },
      { key: 'machineCost', label: 'Machine', type: 'currency', includeInTotal: true },
      { key: 'overheadCost', label: 'Overhead', type: 'currency', includeInTotal: true },
      { key: 'standardTotalCost', label: 'Std Total', type: 'currency', includeInTotal: true },
      { key: 'totalActualCost', label: 'Actual Total', type: 'currency', includeInTotal: true },
      { key: 'costVariance', label: 'Variance', type: 'currency', includeInTotal: true },
      { key: 'costVariancePercent', label: 'Variance %', type: 'percent' },
      { key: 'acceptedGoodQuantity', label: 'Accepted Qty', type: 'number', includeInTotal: true },
      { key: 'costPerAcceptedUnit', label: 'Unit Cost', type: 'currency' },
      { key: 'wastageAndRejectionCost', label: 'Wastage/Rej Cost', type: 'currency', includeInTotal: true },
    ],
  },
};

async function fetchAllPaginatedRows<T extends Record<string, unknown>, R extends { items: T[]; pagination: { totalPages: number } }>(
  fetcher: (q: BaseReportQuery) => Promise<R>,
  baseQuery: BaseReportQuery,
): Promise<{ items: T[]; firstPage: R }> {
  const first = await fetcher({ ...baseQuery, page: 1, limit: 2000 });
  const items: T[] = [...first.items];
  const totalPages = first.pagination?.totalPages ?? 1;
  for (let p = 2; p <= totalPages; p += 1) {
    const next = await fetcher({ ...baseQuery, page: p, limit: 2000 });
    items.push(...next.items);
  }
  return { items, firstPage: first };
}

function buildPeriodLabel(query: BaseReportQuery): string {
  if (query.fromDate || query.toDate) {
    return `${query.fromDate || 'Start'} to ${query.toDate || 'Present'}`;
  }
  const map: Record<string, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    fy: 'This Financial Year',
    custom: 'Custom Range',
  };
  return map[query.period || 'month'] || 'This Month';
}

function buildAppliedFilters(query: BaseReportQuery): ExportFilterItem[] {
  const filters: ExportFilterItem[] = [];
  if (query.status) filters.push({ label: 'Status', value: query.status });
  if (query.priority) filters.push({ label: 'Priority', value: query.priority });
  if (query.search) filters.push({ label: 'Search', value: query.search });
  return filters;
}

export class ProductionReportsExportService {
  static async generateExport(
    reportType: ExportReportType,
    format: ExportFormat,
    query: BaseReportQuery,
  ): Promise<ExportResult> {
    const config = REPORT_CONFIG[reportType];
    let rows: Array<Record<string, unknown>> = [];
    let summaryMetrics: ExportSummaryMetric[] = [];

    const sumField = (key: string) =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

    switch (reportType) {
      case 'plan-vs-actual': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getPlanVsActualReport(q),
          query,
        );
        rows = res.items;
        const planned = sumField('plannedQuantity');
        const produced = sumField('actualProducedQuantity');
        const completionPct = planned > 0 ? (produced / planned) * 100 : 0;
        summaryMetrics = [
          { label: 'Total Plans', value: rows.length, type: 'integer' },
          { label: 'Total Planned Qty', value: planned, type: 'number' },
          { label: 'Actual Produced Qty', value: produced, type: 'number' },
          { label: 'Overall Completion', value: completionPct, type: 'percent' },
        ];
        break;
      }
      case 'work-order-performance': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getWorkOrderPerformanceReport(q),
          query,
        );
        rows = res.items;
        const s = res.firstPage.summary as Record<string, unknown>;
        summaryMetrics = [
          { label: 'Total Work Orders', value: Number(s.totalWorkOrders ?? rows.length), type: 'integer' },
          { label: 'Completed', value: Number(s.completedCount ?? 0), type: 'integer' },
          { label: 'Overdue', value: Number(s.overdueCount ?? 0), type: 'integer' },
          { label: 'Actual Good Qty', value: sumField('actualGoodQuantity'), type: 'number' },
        ];
        break;
      }
      case 'batch-yield': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getBatchYieldReport(q),
          query,
        );
        rows = res.items;
        const avgYield =
          rows.length > 0 ? sumField('actualYieldPercent') / rows.length : 0;
        summaryMetrics = [
          { label: 'Total Batches', value: rows.length, type: 'integer' },
          { label: 'Planned Qty', value: sumField('plannedQuantity'), type: 'number' },
          { label: 'Actual Output Qty', value: sumField('actualOutputQuantity'), type: 'number' },
          { label: 'Avg Actual Yield', value: avgYield, type: 'percent' },
        ];
        break;
      }
      case 'material-consumption': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getMaterialConsumptionReport(q),
          query,
        );
        rows = res.items;
        summaryMetrics = [
          { label: 'Material Lines', value: rows.length, type: 'integer' },
          { label: 'BOM Planned Qty', value: sumField('bomPlannedQuantity'), type: 'number' },
          { label: 'Net Consumption', value: sumField('netConsumption'), type: 'number' },
          { label: 'Total Material Cost', value: sumField('materialCost'), type: 'currency' },
        ];
        break;
      }
      case 'quality': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getQualityReport(q),
          query,
        );
        rows = res.items;
        const s = res.firstPage.summary as Record<string, unknown>;
        summaryMetrics = [
          { label: 'Inspections', value: Number(s.totalInspections ?? rows.length), type: 'integer' },
          { label: 'Accepted Qty', value: sumField('acceptedQuantity'), type: 'number' },
          { label: 'Rejected Qty', value: sumField('rejectedQuantity'), type: 'number' },
          { label: 'Pass Rate', value: Number(s.passRatePercent ?? 0), type: 'percent' },
        ];
        break;
      }
      case 'costing': {
        const res = await fetchAllPaginatedRows(
          q => ProductionReportsService.getCostingReport(q),
          query,
        );
        rows = res.items;
        const s = res.firstPage.summary as Record<string, unknown>;
        summaryMetrics = [
          { label: 'Batches Costed', value: Number(s.totalBatches ?? rows.length), type: 'integer' },
          { label: 'Standard Cost', value: sumField('standardTotalCost'), type: 'currency' },
          { label: 'Actual Cost', value: sumField('totalActualCost'), type: 'currency' },
          { label: 'Cost Variance', value: sumField('costVariance'), type: 'currency' },
        ];
        break;
      }
    }

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title: config.title,
      subtitle: config.subtitle,
      module: 'Production Reports',
      filenamePrefix: config.filenamePrefix,
      sheetName: config.sheetName,
      company,
      reportingPeriod: buildPeriodLabel(query),
      appliedFilters: buildAppliedFilters(query),
      columns: config.columns,
      rows,
      summaryMetrics,
    });
  }
}
