import { apiClient } from './api-client';
import { cachedApiGet } from '../offline/offline-cache';
import {
  BOM,
  BOMAuditLogEntry,
  BOMCostEstimate,
  BOMVersion,
  CategoryEntity,
  Customer,
  Factory,
  InventoryItemRef,
  PaginatedResponse,
  Product,
  ProductVariant,
  RawMaterial,
  Supplier,
  TaxConfiguration,
  TaxRate,
  UnitConversion,
  UnitOfMeasure,
  Warehouse,
} from '../types/master-data';

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean | '';
  [key: string]: string | number | boolean | undefined;
}

const buildQuery = (params: ListQuery): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

function createCrudApi<T>(basePath: string) {
  const entityType = `MASTER_${basePath.toUpperCase()}`;
  return {
    list: (params: ListQuery = {}) =>
      cachedApiGet<PaginatedResponse<T>>(entityType, `/master-data/${basePath}${buildQuery(params)}`),
    getById: (id: string) => cachedApiGet<T>(entityType, `/master-data/${basePath}/${id}`),
    create: (payload: Record<string, unknown>) =>
      apiClient<T>(`/master-data/${basePath}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiClient<T>(`/master-data/${basePath}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    setStatus: (id: string, isActive: boolean) =>
      apiClient<T>(`/master-data/${basePath}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
  };
}

export const masterDataService = {
  uoms: createCrudApi<UnitOfMeasure>('uoms'),
  unitConversions: {
    ...createCrudApi<UnitConversion>('unit-conversions'),
    calculate: (payload: { fromUomId: string; toUomId: string; quantity: string }) =>
      apiClient<{
        fromUomId: string;
        toUomId: string;
        inputQuantity: string;
        multiplier: string;
        convertedQuantity: string;
      }>('/master-data/unit-conversions/calculate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  taxRates: createCrudApi<TaxRate>('tax-rates'),
  taxConfigurations: createCrudApi<TaxConfiguration>('tax-configurations'),
  rawMaterialCategories: createCrudApi<CategoryEntity>('raw-material-categories'),
  rawMaterials: createCrudApi<RawMaterial>('raw-materials'),
  productCategories: createCrudApi<CategoryEntity>('product-categories'),
  products: createCrudApi<Product>('products'),
  productVariants: createCrudApi<ProductVariant>('product-variants'),
  suppliers: createCrudApi<Supplier>('suppliers'),
  customers: createCrudApi<Customer>('customers'),
  warehouses: createCrudApi<Warehouse>('warehouses'),
  factories: {
    list: () => apiClient<Factory[]>('/master-data/factories'),
  },
  inventoryItems: {
    list: (params: ListQuery = {}) =>
      apiClient<PaginatedResponse<InventoryItemRef>>(
        `/master-data/inventory-items${buildQuery(params)}`,
      ),
  },
  boms: {
    ...createCrudApi<BOM>('boms'),
    createVersion: (bomId: string, payload: Record<string, unknown>) =>
      apiClient<BOMVersion>(`/master-data/boms/${bomId}/versions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateVersion: (bomId: string, versionId: string, payload: Record<string, unknown>) =>
      apiClient<BOMVersion>(`/master-data/boms/${bomId}/versions/${versionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    activateVersion: (bomId: string, versionId: string) =>
      apiClient<BOMVersion>(`/master-data/boms/${bomId}/versions/${versionId}/activate`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    obsoleteVersion: (bomId: string, versionId: string, reason?: string) =>
      apiClient<BOMVersion>(`/master-data/boms/${bomId}/versions/${versionId}/obsolete`, {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    getCostEstimate: (bomId: string, versionId: string, batchQuantity?: string) =>
      apiClient<BOMCostEstimate>(
        `/master-data/boms/${bomId}/versions/${versionId}/cost-estimate${
          batchQuantity ? `?batchQuantity=${encodeURIComponent(batchQuantity)}` : ''
        }`,
      ),
    getHistory: (bomId: string) =>
      apiClient<BOMAuditLogEntry[]>(`/master-data/boms/${bomId}/history`),
  },
};
