import { apiClient } from './api-client';

export type DashboardId = 'executive' | 'sales' | 'inventory' | 'production';
export type SavedViewModule =
  | 'sales_orders'
  | 'inventory_balances'
  | 'batch_expiry'
  | 'work_orders'
  | 'quality_inspections';

export interface DashboardLayoutConfig {
  hiddenWidgetIds: string[];
  widgetOrder: string[];
}

export interface UserPreferencesData {
  dashboardLayout: Record<string, DashboardLayoutConfig>;
  tourCompleted: boolean;
  tourCompletedAt: string | null;
}

export type FilterValue = string | number | boolean | null;

export interface SavedViewItem {
  id: string;
  userId: string;
  module: SavedViewModule;
  name: string;
  filters: Record<string, FilterValue>;
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  columns?: string[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTimelineItem {
  id: string;
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  remarks: string | null;
  actor: { id: string; username: string; fullName: string } | null;
  navigationPath: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface ActivityTimelineResponse {
  items: ActivityTimelineItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const uxService = {
  async getPreferences(): Promise<UserPreferencesData> {
    const res = await apiClient<UserPreferencesData>('/preferences');
    return res.data!;
  },

  async updateDashboardPreference(
    dashboardId: DashboardId,
    config: DashboardLayoutConfig,
  ): Promise<UserPreferencesData> {
    const res = await apiClient<UserPreferencesData>('/preferences/dashboard', {
      method: 'PUT',
      body: JSON.stringify({ dashboardId, ...config }),
    });
    return res.data!;
  },

  async resetDashboardPreference(dashboardId: DashboardId): Promise<UserPreferencesData> {
    const res = await apiClient<UserPreferencesData>(`/preferences/dashboard/${dashboardId}`, {
      method: 'DELETE',
    });
    return res.data!;
  },

  async updateTourPreference(completed: boolean): Promise<UserPreferencesData> {
    const res = await apiClient<UserPreferencesData>('/preferences/tour', {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    });
    return res.data!;
  },

  async listSavedViews(module?: SavedViewModule): Promise<SavedViewItem[]> {
    const qs = module ? `?module=${encodeURIComponent(module)}` : '';
    const res = await apiClient<SavedViewItem[]>(`/saved-views${qs}`);
    return res.data ?? [];
  },

  async createSavedView(payload: {
    module: SavedViewModule;
    name: string;
    filters: Record<string, FilterValue>;
    sort?: { field: string; direction: 'asc' | 'desc' } | null;
    columns?: string[] | null;
    isDefault?: boolean;
  }): Promise<SavedViewItem> {
    const res = await apiClient<SavedViewItem>('/saved-views', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async updateSavedView(
    id: string,
    payload: {
      name?: string;
      filters?: Record<string, FilterValue>;
      sort?: { field: string; direction: 'asc' | 'desc' } | null;
      columns?: string[] | null;
      isDefault?: boolean;
    },
  ): Promise<SavedViewItem> {
    const res = await apiClient<SavedViewItem>(`/saved-views/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },

  async deleteSavedView(id: string): Promise<void> {
    await apiClient(`/saved-views/${id}`, { method: 'DELETE' });
  },

  async getActivityTimeline(params: {
    category?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<ActivityTimelineResponse> {
    const search = new URLSearchParams();
    if (params.category && params.category !== 'ALL') search.set('category', params.category);
    if (params.startDate) search.set('startDate', params.startDate);
    if (params.endDate) search.set('endDate', params.endDate);
    if (params.userId) search.set('userId', params.userId);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    const res = await apiClient<ActivityTimelineResponse>(
      `/activity-timeline${qs ? `?${qs}` : ''}`,
    );
    return res.data!;
  },
};
