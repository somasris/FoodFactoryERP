import { ReportsService } from './reports.service';
import { AnalyticsFilter } from './reports.types';
import { UserContext } from '../inventory/inventory.utils';
import {
  ExportColumn,
  ExportFilterItem,
  ExportFormat,
  ExportResult,
  ExportSummaryMetric,
  generateStandardExport,
  getExportCompanyInfo,
} from '../../utils/export';

export type AnalyticsExportType = 'sales' | 'inventory' | 'profitability' | 'factory-performance';
export type { ExportFormat };

export class ReportsExportService {
  static async generateExport(
    reportType: AnalyticsExportType,
    format: ExportFormat,
    filter: AnalyticsFilter,
    user: UserContext,
  ): Promise<ExportResult> {
    let title = '';
    let subtitle = '';
    let filenamePrefix = '';
    let sheetName = '';
    let columns: ExportColumn[] = [];
    let rows: Array<Record<string, unknown>> = [];
    let summaryMetrics: ExportSummaryMetric[] = [];

    if (reportType === 'sales') {
      title = 'Sales Analytics by Product';
      subtitle = 'Issued invoice product-wise sales volume and taxable revenue';
      filenamePrefix = 'BI_Sales_Analytics';
      sheetName = 'Sales Analytics';
      columns = [
        { key: 'productName', label: 'Product', type: 'string', widthWeight: 26 },
        { key: 'categoryName', label: 'Category', type: 'string', widthWeight: 18 },
        { key: 'quantity', label: 'Sold Qty', type: 'number', includeInTotal: true },
        { key: 'revenue', label: 'Taxable Revenue', type: 'currency', includeInTotal: true },
      ];
      const data = await ReportsService.getSalesAnalytics(filter);
      rows = data.salesByProduct;
      summaryMetrics = [
        { label: 'Products Sold', value: rows.length, type: 'integer' },
        { label: 'Total Taxable Revenue', value: data.totalTaxableRevenue ?? 0, type: 'currency' },
      ];
    } else if (reportType === 'inventory') {
      title = 'Inventory Analytics by Warehouse';
      subtitle = 'Warehouse-wise active SKU counts and closing stock valuation';
      filenamePrefix = 'BI_Inventory_Analytics';
      sheetName = 'Inventory Analytics';
      columns = [
        { key: 'warehouseCode', label: 'Warehouse Code', type: 'string', widthWeight: 16 },
        { key: 'warehouseName', label: 'Warehouse Name', type: 'string', widthWeight: 26 },
        { key: 'itemCount', label: 'Active Items', type: 'integer', includeInTotal: true },
        { key: 'value', label: 'Total Value', type: 'currency', includeInTotal: true },
      ];
      const data = await ReportsService.getInventoryAnalytics(filter, user);
      rows = data.warehouseComparison;
      const totalVal = rows.reduce((sum, r) => sum + Number(r.value || 0), 0);
      summaryMetrics = [
        { label: 'Warehouses', value: rows.length, type: 'integer' },
        { label: 'Total Inventory Value', value: totalVal, type: 'currency' },
      ];
    } else if (reportType === 'profitability') {
      title = 'Product Gross Margin Report';
      subtitle = 'Revenue, production cost, gross margin, and margin percentage by product';
      filenamePrefix = 'BI_Product_Profitability';
      sheetName = 'Profitability';
      columns = [
        { key: 'productCode', label: 'Code', type: 'string', widthWeight: 12 },
        { key: 'productName', label: 'Product', type: 'string', widthWeight: 24 },
        { key: 'soldQuantity', label: 'Sold Qty', type: 'number', includeInTotal: true },
        { key: 'revenue', label: 'Revenue', type: 'currency', includeInTotal: true },
        { key: 'productionCost', label: 'Production Cost', type: 'currency', includeInTotal: true },
        { key: 'grossMargin', label: 'Gross Margin', type: 'currency', includeInTotal: true },
        { key: 'grossMarginPercent', label: 'Margin %', type: 'percent' },
      ];
      const data = await ReportsService.getProfitabilityReport(filter);
      rows = data.products;
      const totalRev = rows.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
      const totalMargin = rows.reduce((sum, r) => sum + Number(r.grossMargin || 0), 0);
      summaryMetrics = [
        { label: 'Products', value: rows.length, type: 'integer' },
        { label: 'Total Revenue', value: totalRev, type: 'currency' },
        { label: 'Total Gross Margin', value: totalMargin, type: 'currency' },
      ];
    } else {
      title = 'Factory Performance Comparison';
      subtitle = 'Cross-factory warehouse count, inventory value, work orders, and output';
      filenamePrefix = 'BI_Factory_Performance';
      sheetName = 'Factory Performance';
      columns = [
        { key: 'factoryCode', label: 'Factory Code', type: 'string', widthWeight: 14 },
        { key: 'factoryName', label: 'Factory Name', type: 'string', widthWeight: 24 },
        { key: 'warehouseCount', label: 'Warehouses', type: 'integer', includeInTotal: true },
        { key: 'inventoryValue', label: 'Inventory Value', type: 'currency', includeInTotal: true },
        { key: 'completedWorkOrders', label: 'Completed WOs', type: 'integer', includeInTotal: true },
        { key: 'productionOutputQty', label: 'Good Output', type: 'number', includeInTotal: true },
      ];
      const data = await ReportsService.getFactoryPerformance(filter, user);
      rows = data.items;
      const totalOutput = rows.reduce((sum, r) => sum + Number(r.productionOutputQty || 0), 0);
      summaryMetrics = [
        { label: 'Factories', value: rows.length, type: 'integer' },
        { label: 'Total Good Output', value: totalOutput, type: 'number' },
      ];
    }

    const appliedFilters: ExportFilterItem[] = [];
    if (filter.financialYear) appliedFilters.push({ label: 'FY', value: filter.financialYear });
    if (filter.factoryId) appliedFilters.push({ label: 'Factory ID', value: filter.factoryId });

    const reportingPeriod =
      filter.startDate || filter.endDate
        ? `${filter.startDate || 'Start'} to ${filter.endDate || 'Present'}`
        : filter.financialYear || 'Current Period';

    const company = await getExportCompanyInfo();

    return generateStandardExport(format, {
      title,
      subtitle,
      module: 'Business Intelligence',
      filenamePrefix,
      sheetName,
      company,
      reportingPeriod,
      appliedFilters,
      columns,
      rows,
      summaryMetrics,
    });
  }
}
