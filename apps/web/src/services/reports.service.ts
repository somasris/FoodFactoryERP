import { cachedApiGet } from '../offline/offline-cache';
import { ApiResponse } from '../types/api';

const unwrap = <T>(promise: Promise<ApiResponse<T>>): Promise<T> =>
  promise.then(res => res.data as T);

export interface ExecutiveDashboardData {
  businessKpis: {
    issuedInvoiceValue: string;
    issuedTaxableSales: string;
    issuedInvoiceCount: number;
    salesOrderCount: number;
    productionOutputQty: string;
    inventoryValue: string;
    finalizedProductionCost: string;
    qualityRejectionRatePercent: string;
    materialWastageQty: string;
    pendingApprovalsCount: number;
  };
  operationalKpis: {
    activeWorkOrders: number;
    activeProductionBatches: number;
    pendingInspections: number;
    lowStockItemsCount: number;
    expiringBatchesCount: number;
    delayedProductionPlans: number;
  };
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  financialYear?: string;
}

const toQuery = (f?: AnalyticsFilters) => {
  const qs = new URLSearchParams();
  if (f?.startDate) qs.set('startDate', f.startDate);
  if (f?.endDate) qs.set('endDate', f.endDate);
  if (f?.financialYear) qs.set('financialYear', f.financialYear);
  const str = qs.toString();
  return str ? `?${str}` : '';
};

export const reportsService = {
  getExecutiveDashboard: (f?: AnalyticsFilters) =>
    unwrap(
      cachedApiGet<ExecutiveDashboardData>(
        'REPORTS_EXECUTIVE',
        `/reports/executive-dashboard${toQuery(f)}`,
      ),
    ),
  getSalesAnalytics: (f?: AnalyticsFilters) =>
    unwrap(cachedApiGet<Record<string, unknown>>('REPORTS_SALES', `/reports/sales${toQuery(f)}`)),
  getInventoryAnalytics: (f?: AnalyticsFilters) =>
    unwrap(
      cachedApiGet<Record<string, unknown>>(
        'REPORTS_INVENTORY',
        `/reports/inventory${toQuery(f)}`,
      ),
    ),
  getProductionAnalytics: (f?: AnalyticsFilters) =>
    unwrap(
      cachedApiGet<Record<string, unknown>>(
        'REPORTS_PRODUCTION',
        `/reports/production${toQuery(f)}`,
      ),
    ),
  getProfitability: (f?: AnalyticsFilters) =>
    unwrap(
      cachedApiGet<Record<string, unknown>>(
        'REPORTS_PROFITABILITY',
        `/reports/profitability${toQuery(f)}`,
      ),
    ),
  getFactoryPerformance: (f?: AnalyticsFilters) =>
    unwrap(
      cachedApiGet<Record<string, unknown>>(
        'REPORTS_FACTORY',
        `/reports/factory-performance${toQuery(f)}`,
      ),
    ),
  downloadExport: async (
    reportType: 'sales' | 'inventory' | 'profitability' | 'factory-performance',
    format: 'csv' | 'excel' | 'pdf',
    f?: AnalyticsFilters,
  ) => {
    const { downloadAuthenticatedExport } = await import('../utils/export-download');
    const qs = new URLSearchParams();
    qs.set('format', format);
    if (f?.financialYear) qs.set('financialYear', f.financialYear);
    if (f?.startDate) qs.set('startDate', f.startDate);
    if (f?.endDate) qs.set('endDate', f.endDate);
    const ext = format === 'excel' ? 'xlsx' : format;
    await downloadAuthenticatedExport(
      `/reports/export/${reportType}?${qs.toString()}`,
      `bi-${reportType}.${ext}`,
    );
  },
};

