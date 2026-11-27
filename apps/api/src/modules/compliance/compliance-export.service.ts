import { GstComplianceService } from './gst-compliance.service';
import { StockAuditService } from './stock-audit.service';
import { ComplianceReportsService } from './compliance-reports.service';
import { DateRangeQuery } from './compliance.types';
import { UserContext } from '../inventory/inventory.utils';
import { CustomerPaymentService } from '../sales/customer-payment.service';
import { SupplierInvoiceService } from '../purchases/supplier-invoice.service';
import {
  ExportColumn,
  ExportFilterItem,
  ExportFormat,
  ExportResult,
  ExportSummaryMetric,
  generateStandardExport,
  getExportCompanyInfo,
} from '../../utils/export';

export type ComplianceExportType =
  | 'gst-sales'
  | 'hsn-summary'
  | 'inventory-valuation'
  | 'production-costing'
  | 'traceability';

export type { ExportFormat };

function buildDatePeriod(fromDate?: string, toDate?: string, extra?: string): string {
  if (extra) return extra;
  if (fromDate || toDate) return `${fromDate || 'Start'} to ${toDate || 'Present'}`;
  return 'All Available Dates';
}

export class ComplianceExportService {
  static async generateExport(
    reportType: ComplianceExportType,
    format: ExportFormat,
    query: DateRangeQuery,
    user: UserContext,
  ): Promise<ExportResult> {
    let title = '';
    let subtitle = '';
    let filenamePrefix = '';
    let sheetName = '';
    let columns: ExportColumn[] = [];
    let rows: Array<Record<string, unknown>> = [];
    let summaryMetrics: ExportSummaryMetric[] = [];
    const appliedFilters: ExportFilterItem[] = [];

    if (query.financialYear) appliedFilters.push({ label: 'FY', value: query.financialYear });
    if (query.warehouseId) appliedFilters.push({ label: 'Warehouse ID', value: query.warehouseId });

    if (reportType === 'gst-sales') {
      title = 'GST Sales Tax Summary';
      subtitle = 'Invoice-wise GST output tax register (CGST, SGST, IGST)';
      filenamePrefix = 'GST_Sales_Summary';
      sheetName = 'GST Sales';
      columns = [
        { key: 'invoiceNumber', label: 'Invoice #', type: 'string', widthWeight: 14 },
        { key: 'financialYear', label: 'FY', type: 'string', align: 'center', widthWeight: 9 },
        { key: 'status', label: 'Status', type: 'string', align: 'center', widthWeight: 10 },
        { key: 'customerLegalName', label: 'Customer', type: 'string', widthWeight: 22 },
        { key: 'customerGstin', label: 'Customer GSTIN', type: 'string', widthWeight: 16 },
        { key: 'taxableAmount', label: 'Taxable Value', type: 'currency', includeInTotal: true },
        { key: 'cgstAmount', label: 'CGST', type: 'currency', includeInTotal: true },
        { key: 'sgstAmount', label: 'SGST', type: 'currency', includeInTotal: true },
        { key: 'igstAmount', label: 'IGST', type: 'currency', includeInTotal: true },
        { key: 'grandTotal', label: 'Grand Total', type: 'currency', includeInTotal: true },
      ];
      const gst = await GstComplianceService.getGstSalesSummary(query);
      rows = gst.invoices;
      summaryMetrics = [
        { label: 'Invoices', value: rows.length, type: 'integer' },
        { label: 'Taxable Value', value: gst.totals.taxableSalesValue, type: 'currency' },
        { label: 'Total GST', value: gst.totals.totalGstCollected, type: 'currency' },
        { label: 'Grand Total', value: gst.totals.grandTotal, type: 'currency' },
      ];
    } else if (reportType === 'hsn-summary') {
      title = 'GST HSN-Wise Sales Summary';
      subtitle = 'HSN classification breakdown for GST return filing';
      filenamePrefix = 'GST_HSN_Summary';
      sheetName = 'HSN Summary';
      columns = [
        { key: 'hsnCode', label: 'HSN Code', type: 'string', align: 'center', widthWeight: 12 },
        { key: 'lineCount', label: 'Lines', type: 'integer', includeInTotal: true },
        { key: 'totalQuantity', label: 'Total Qty', type: 'number', includeInTotal: true },
        { key: 'taxableAmount', label: 'Taxable Value', type: 'currency', includeInTotal: true },
        { key: 'cgstAmount', label: 'CGST', type: 'currency', includeInTotal: true },
        { key: 'sgstAmount', label: 'SGST', type: 'currency', includeInTotal: true },
        { key: 'igstAmount', label: 'IGST', type: 'currency', includeInTotal: true },
        { key: 'totalValue', label: 'Total Value', type: 'currency', includeInTotal: true },
      ];
      const gst = await GstComplianceService.getGstSalesSummary(query);
      rows = gst.hsnSummary;
      summaryMetrics = [
        { label: 'HSN Codes', value: rows.length, type: 'integer' },
        { label: 'Taxable Value', value: gst.totals.taxableSalesValue, type: 'currency' },
        { label: 'Grand Total', value: gst.totals.grandTotal, type: 'currency' },
      ];
    } else if (reportType === 'inventory-valuation') {
      title = 'Inventory Valuation Compliance Report';
      subtitle = 'Batch-level stock on hand, valuation method, and closing inventory value';
      filenamePrefix = 'Inventory_Valuation';
      sheetName = 'Inventory Valuation';
      columns = [
        { key: 'warehouseCode', label: 'Warehouse', type: 'string', widthWeight: 12 },
        { key: 'itemCode', label: 'Item Code', type: 'string', widthWeight: 12 },
        { key: 'itemName', label: 'Item Name', type: 'string', widthWeight: 22 },
        { key: 'itemType', label: 'Type', type: 'string', align: 'center', widthWeight: 11 },
        { key: 'valuationMethod', label: 'Method', type: 'string', align: 'center', widthWeight: 10 },
        { key: 'batchNumber', label: 'Batch', type: 'string', widthWeight: 14 },
        { key: 'quantityOnHand', label: 'On Hand', type: 'number', includeInTotal: true },
        { key: 'unitCost', label: 'Unit Cost', type: 'currency' },
        { key: 'totalValue', label: 'Total Value', type: 'currency', includeInTotal: true },
      ];
      const val = await StockAuditService.getInventoryValuationReport(user, {
        warehouseId: query.warehouseId,
      });
      rows = val.items;
      summaryMetrics = [
        { label: 'Stock Lots', value: rows.length, type: 'integer' },
        { label: 'Total Stock Value', value: val.summary?.totalValuation ?? 0, type: 'currency' },
      ];
    } else if (reportType === 'production-costing') {
      title = 'Production Cost Compliance Report';
      subtitle = 'Audit-ready batch production costing breakdown and unit cost';
      filenamePrefix = 'Production_Cost_Compliance';
      sheetName = 'Production Costing';
      columns = [
        { key: 'batchNumber', label: 'Batch #', type: 'string', widthWeight: 14 },
        { key: 'productName', label: 'Product', type: 'string', widthWeight: 22 },
        { key: 'costingClassification', label: 'Classification', type: 'string', align: 'center', widthWeight: 13 },
        { key: 'materialCost', label: 'Material Cost', type: 'currency', includeInTotal: true },
        { key: 'labourCost', label: 'Labour Cost', type: 'currency', includeInTotal: true },
        { key: 'overheadCost', label: 'Overhead Cost', type: 'currency', includeInTotal: true },
        { key: 'totalProductionCost', label: 'Total Cost', type: 'currency', includeInTotal: true },
        { key: 'unitCostPerAcceptedUnit', label: 'Unit Cost', type: 'currency' },
      ];
      const pc = await ComplianceReportsService.getProductionCostCompliance(query);
      rows = pc.items;
      summaryMetrics = [
        { label: 'Total Batches', value: rows.length, type: 'integer' },
        { label: 'Finalized Costings', value: pc.summary.finalizedCount ?? 0, type: 'integer' },
      ];
    } else {
      title = 'Batch Traceability Compliance Report';
      subtitle = 'FSSAI batch lineage, material classification, and quality release status';
      filenamePrefix = 'Batch_Traceability';
      sheetName = 'Batch Traceability';
      columns = [
        { key: 'batchNumber', label: 'Batch #', type: 'string', widthWeight: 16 },
        { key: 'itemCode', label: 'Item Code', type: 'string', widthWeight: 14 },
        { key: 'itemName', label: 'Item Name', type: 'string', widthWeight: 26 },
        { key: 'itemType', label: 'Type', type: 'string', align: 'center', widthWeight: 14 },
        { key: 'qualityStatus', label: 'Quality Status', type: 'string', align: 'center', widthWeight: 14 },
      ];
      rows = (await ComplianceReportsService.getTraceabilityReport({})).items;
      summaryMetrics = [{ label: 'Tracked Batches', value: rows.length, type: 'integer' }];
    }

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title,
      subtitle,
      module: 'Compliance & Audit',
      filenamePrefix,
      sheetName,
      company,
      reportingPeriod: buildDatePeriod(query.startDate, query.endDate, query.financialYear),
      appliedFilters,
      columns,
      rows,
      summaryMetrics,
    });
  }

  static async generateReceivablesAgeingExport(
    format: ExportFormat,
    user: UserContext,
    filters: {
      asOfDate?: string;
      customerId?: string;
      invoiceId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<ExportResult> {
    const ageing = await CustomerPaymentService.getAgeingReport(user, filters);
    const columns: ExportColumn[] = [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'string', widthWeight: 14 },
      { key: 'customerLegalName', label: 'Customer', type: 'string', widthWeight: 24 },
      { key: 'grandTotal', label: 'Invoice Amount', type: 'currency', includeInTotal: true },
      { key: 'paidAmount', label: 'Amount Paid', type: 'currency', includeInTotal: true },
      { key: 'creditNoteAmount', label: 'Credit Notes', type: 'currency', includeInTotal: true },
      { key: 'outstandingAmount', label: 'Outstanding', type: 'currency', includeInTotal: true },
      { key: 'daysPastDue', label: 'Days Past Due', type: 'integer' },
      { key: 'bucket', label: 'Ageing Bucket', type: 'string', align: 'center', widthWeight: 13 },
    ];

    const appliedFilters: ExportFilterItem[] = [];
    if (filters.asOfDate) appliedFilters.push({ label: 'As Of Date', value: filters.asOfDate });
    if (filters.customerId) appliedFilters.push({ label: 'Customer ID', value: filters.customerId });

    const totalOutstanding = ageing.invoices.reduce(
      (sum, inv) => sum + Number(inv.outstandingAmount || 0),
      0,
    );
    const totalPaid = ageing.invoices.reduce(
      (sum, inv) => sum + Number(inv.paidAmount || 0),
      0,
    );
    const overdueAmount = ageing.invoices
      .filter(inv => Number(inv.daysPastDue || 0) > 0)
      .reduce((sum, inv) => sum + Number(inv.outstandingAmount || 0), 0);

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title: 'Customer Receivables Ageing Report',
      subtitle: 'Open invoice balances, credit note adjustments, and overdue ageing buckets',
      module: 'Sales & Receivables',
      filenamePrefix: 'Receivables_Ageing',
      sheetName: 'Receivables Ageing',
      company,
      reportingPeriod: filters.asOfDate ? `As of ${filters.asOfDate}` : buildDatePeriod(filters.fromDate, filters.toDate),
      appliedFilters,
      columns,
      rows: ageing.invoices,
      summaryMetrics: [
        { label: 'Open Invoices', value: ageing.invoices.length, type: 'integer' },
        { label: 'Total Paid', value: totalPaid, type: 'currency' },
        { label: 'Total Outstanding', value: totalOutstanding, type: 'currency' },
        { label: 'Overdue Amount', value: overdueAmount, type: 'currency' },
      ],
    });
  }

  static async generatePurchaseRegisterExport(
    format: ExportFormat,
    filters: {
      supplierId?: string;
      factoryId?: string;
      status?: string;
      matchingStatus?: string;
      itcStatus?: string;
      gstin?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<ExportResult> {
    const reg = await SupplierInvoiceService.getPurchaseRegister(filters);
    const columns: ExportColumn[] = [
      { key: 'supplierName', label: 'Supplier', type: 'string', widthWeight: 20 },
      { key: 'supplierGstin', label: 'Supplier GSTIN', type: 'string', widthWeight: 15 },
      { key: 'supplierInvoiceNumber', label: 'Supplier Inv #', type: 'string', widthWeight: 13 },
      { key: 'internalInvoiceNumber', label: 'Internal Inv #', type: 'string', widthWeight: 13 },
      { key: 'hsnCode', label: 'HSN', type: 'string', align: 'center', widthWeight: 9 },
      { key: 'itemDescription', label: 'Item', type: 'string', widthWeight: 18 },
      { key: 'quantity', label: 'Qty', type: 'number', includeInTotal: true },
      { key: 'taxableValue', label: 'Taxable Value', type: 'currency', includeInTotal: true },
      { key: 'cgstAmount', label: 'CGST', type: 'currency', includeInTotal: true },
      { key: 'sgstAmount', label: 'SGST', type: 'currency', includeInTotal: true },
      { key: 'igstAmount', label: 'IGST', type: 'currency', includeInTotal: true },
      { key: 'totalInvoiceValue', label: 'Invoice Total', type: 'currency', includeInTotal: true },
      { key: 'matchingStatus', label: 'Match Status', type: 'string', align: 'center', widthWeight: 11 },
      { key: 'itcStatus', label: 'ITC Status', type: 'string', align: 'center', widthWeight: 12 },
    ];

    const appliedFilters: ExportFilterItem[] = [];
    if (filters.itcStatus) appliedFilters.push({ label: 'ITC Status', value: filters.itcStatus });
    if (filters.matchingStatus) appliedFilters.push({ label: 'Match Status', value: filters.matchingStatus });
    if (filters.status) appliedFilters.push({ label: 'Status', value: filters.status });
    if (filters.gstin) appliedFilters.push({ label: 'GSTIN', value: filters.gstin });

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title: 'GST Purchase Register',
      subtitle: 'Supplier invoice lines, 3-way matching, input GST, and ITC eligibility',
      module: 'Purchases & Input GST',
      filenamePrefix: 'GST_Purchase_Register',
      sheetName: 'Purchase Register',
      company,
      reportingPeriod: buildDatePeriod(filters.fromDate, filters.toDate),
      appliedFilters,
      columns,
      rows: reg.rows,
      summaryMetrics: [
        { label: 'Posted Invoices', value: reg.invoiceCount, type: 'integer' },
        { label: 'Taxable Value', value: reg.totals.taxableValue, type: 'currency' },
        {
          label: 'Total Input GST',
          value:
            Number(reg.totals.cgstAmount) +
            Number(reg.totals.sgstAmount) +
            Number(reg.totals.igstAmount),
          type: 'currency',
        },
        { label: 'Invoice Total', value: reg.totals.grandTotal, type: 'currency' },
      ],
    });
  }

  static async generateCollectionReportExport(
    format: ExportFormat,
    filters: {
      fromDate?: string;
      toDate?: string;
      paymentMode?: string;
      customerId?: string;
      groupBy?: 'daily' | 'monthly';
    },
  ): Promise<ExportResult> {
    const report = await CustomerPaymentService.getCollectionReport(filters);
    const columns: ExportColumn[] = [
      { key: 'period', label: 'Period', type: 'string', widthWeight: 16 },
      { key: 'transactionCount', label: 'Transactions', type: 'integer', includeInTotal: true },
      { key: 'grossReceived', label: 'Gross Received', type: 'currency', includeInTotal: true },
      { key: 'reversedAmount', label: 'Reversed', type: 'currency', includeInTotal: true },
      { key: 'netCollected', label: 'Net Collected', type: 'currency', includeInTotal: true },
      { key: 'unallocatedAdvances', label: 'Unallocated Advances', type: 'currency', includeInTotal: true },
    ];

    const appliedFilters: ExportFilterItem[] = [];
    if (filters.paymentMode) appliedFilters.push({ label: 'Payment Mode', value: filters.paymentMode });
    if (filters.groupBy) appliedFilters.push({ label: 'Group By', value: filters.groupBy });

    const totalCollected = report.byPeriod.reduce(
      (sum, r) => sum + Number(r.netCollected || 0),
      0,
    );
    const totalTx = report.byPeriod.reduce(
      (sum, r) => sum + Number(r.transactionCount || 0),
      0,
    );

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title: 'Customer Collection Summary Report',
      subtitle: 'Period-wise customer receipts, reversals, and net collections',
      module: 'Sales & Receivables',
      filenamePrefix: 'Collection_Summary',
      sheetName: 'Collection Summary',
      company,
      reportingPeriod: buildDatePeriod(filters.fromDate, filters.toDate),
      appliedFilters,
      columns,
      rows: report.byPeriod,
      summaryMetrics: [
        { label: 'Periods', value: report.byPeriod.length, type: 'integer' },
        { label: 'Transactions', value: totalTx, type: 'integer' },
        { label: 'Net Collected', value: totalCollected, type: 'currency' },
      ],
    });
  }
}
