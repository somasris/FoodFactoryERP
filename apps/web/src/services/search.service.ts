import { apiClient } from './api-client';

export interface SearchResultItem {
  category: 'Sales' | 'Inventory' | 'Production' | 'Master Data' | 'Administration';
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  documentNumber: string | null;
  status: string | null;
  navigationPath: string;
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

export const searchService = {
  search: (query: string, limit = 20, signal?: AbortSignal) => {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    return apiClient<GlobalSearchResponse>(`/search?${qs.toString()}`, { signal });
  },
};
