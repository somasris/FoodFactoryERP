import { apiClient } from './api-client';
import { ApiResponse } from '../types/api';

const unwrap = <T>(promise: Promise<ApiResponse<T>>): Promise<T> =>
  promise.then(res => res.data as T);

export interface OrganizationProfile {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string;
  email: string | null;
  phone: string | null;
  address: string;
  logoUrl: string | null;
  registrationNumber: string | null;
  fssaiLicense: string | null;
  financialYearStartMonth: number;
  defaultCurrency: string;
  defaultTimezone: string;
  preferences: Record<string, unknown> | null;
  isActive: boolean;
  updatedAt: string;
  _count?: { factories: number; users: number };
}

export interface FactoryRecord {
  id: string;
  companyId: string;
  code: string;
  name: string;
  state: string;
  stateCode: string;
  address: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  warehouses?: Array<{
    id: string;
    code: string;
    name: string;
    warehouseType: string;
    isActive: boolean;
  }>;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  registrationStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  lastLoginAt: string | null;
  activeSessions: number;
  roles: string[];
  warehouseAccess: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    accessLevel: string;
  }>;
  createdAt: string;
}

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissionCount: number;
  permissions: string[];
}

export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export interface WarehouseAccessRecord {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  userIsActive: boolean;
  userRoles: string[];
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  factory: { id: string; code: string; name: string };
  accessLevel: 'READ' | 'READ_WRITE';
  assignedAt: string;
}

export interface SystemSettingRecord {
  id: string;
  key: string;
  value: string;
  category: string;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  description: string | null;
  version: number;
  updatedAt: string;
  updatedBy?: { id: string; username: string; fullName: string } | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminService = {
  // Organization
  getOrganization: () => unwrap(apiClient<OrganizationProfile>('/admin/organization')),
  updateOrganization: (data: Partial<OrganizationProfile>) =>
    unwrap(
      apiClient<OrganizationProfile>('/admin/organization', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    ),
  getOrganizationHistory: (page = 1, limit = 10) =>
    unwrap(
      apiClient<PaginatedResponse<Record<string, unknown>>>(
        `/admin/organization/history?page=${page}&limit=${limit}`,
      ),
    ),

  // Factories
  listFactories: (params?: { search?: string; isActive?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.isActive) qs.set('isActive', params.isActive);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return unwrap(apiClient<PaginatedResponse<FactoryRecord>>(`/admin/factories?${qs.toString()}`));
  },
  createFactory: (data: Record<string, unknown>) =>
    unwrap(
      apiClient<FactoryRecord>('/admin/factories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  updateFactory: (id: string, data: Record<string, unknown>) =>
    unwrap(
      apiClient<FactoryRecord>(`/admin/factories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    ),
  setFactoryStatus: (id: string, isActive: boolean) =>
    unwrap(
      apiClient<FactoryRecord>(`/admin/factories/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    ),

  // Users
  listUsers: (params?: {
    search?: string;
    role?: string;
    isActive?: string;
    registrationStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    if (params?.isActive) qs.set('isActive', params.isActive);
    if (params?.registrationStatus) qs.set('registrationStatus', params.registrationStatus);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return unwrap(apiClient<PaginatedResponse<AdminUserRecord>>(`/admin/users?${qs.toString()}`));
  },
  createUser: (data: Record<string, unknown>) =>
    unwrap(
      apiClient<AdminUserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  updateUser: (id: string, data: Record<string, unknown>) =>
    unwrap(
      apiClient<AdminUserRecord>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    ),
  assignUserRoles: (id: string, roleCodes: string[]) =>
    unwrap(
      apiClient<{ userId: string; roles: string[] }>(`/users/${id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleCodes }),
      }),
    ),
  setUserStatus: (id: string, isActive: boolean) =>
    unwrap(
      apiClient<{ id: string; isActive: boolean }>(`/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    ),
  resetUserPassword: (id: string, newPassword: string, reason?: string) =>
    unwrap(
      apiClient<{ userId: string; sessionsRevoked: boolean }>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword, reason }),
      }),
    ),
  reviewRegistration: (
    id: string,
    data: { decision: 'APPROVED' | 'REJECTED'; roleCodes?: string[]; reason?: string },
  ) =>
    unwrap(
      apiClient<{
        userId: string;
        registrationStatus: 'APPROVED' | 'REJECTED';
        isActive: boolean;
        roles: string[];
      }>(`/admin/users/${id}/review-registration`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  revokeUserSessions: (id: string) =>
    unwrap(apiClient(`/users/${id}/revoke-sessions`, { method: 'POST', body: JSON.stringify({}) })),
  getUserActivity: (id: string, page = 1) =>
    unwrap(
      apiClient<{ user: AdminUserRecord; items: Array<Record<string, unknown>> }>(
        `/admin/users/${id}/activity?page=${page}&limit=15`,
      ),
    ),

  // Roles & Permissions
  listRoles: () => unwrap(apiClient<RoleRecord[]>('/admin/roles')),
  listPermissions: () =>
    unwrap(
      apiClient<{ items: PermissionRecord[]; grouped: Record<string, PermissionRecord[]> }>(
        '/admin/permissions',
      ),
    ),
  createRole: (data: { code: string; name: string; description?: string; permissionCodes: string[] }) =>
    unwrap(
      apiClient<RoleRecord>('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ),
  updateRole: (id: string, data: { name?: string; description?: string | null; isActive?: boolean }) =>
    unwrap(
      apiClient<RoleRecord>(`/admin/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    ),
  updateRolePermissions: (id: string, permissionCodes: string[]) =>
    unwrap(
      apiClient<{ roleId: string; permissions: string[] }>(`/admin/roles/${id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes }),
      }),
    ),

  // Warehouse Access
  listWarehouseAccess: (params?: { userId?: string; warehouseId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
    return unwrap(apiClient<WarehouseAccessRecord[]>(`/admin/warehouse-access?${qs.toString()}`));
  },
  assignUserWarehouseAccess: (
    userId: string,
    assignments: Array<{ warehouseId: string; accessLevel: 'READ' | 'READ_WRITE' }>,
  ) =>
    unwrap(
      apiClient<WarehouseAccessRecord[]>(`/admin/warehouse-access/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ assignments }),
      }),
    ),
  revokeWarehouseAccess: (userId: string, warehouseId: string) =>
    unwrap(
      apiClient(`/admin/warehouse-access/users/${userId}/warehouses/${warehouseId}`, {
        method: 'DELETE',
      }),
    ),
  listAllWarehouses: () =>
    unwrap(
      apiClient<{ items: Array<{ id: string; code: string; name: string; warehouseType: string }> }>(
        '/master-data/warehouses?limit=100',
      ),
    ),

  // System Settings
  listSettings: (category?: string) =>
    unwrap(
      apiClient<{ items: SystemSettingRecord[]; grouped: Record<string, SystemSettingRecord[]> }>(
        category ? `/admin/settings?category=${category}` : '/admin/settings',
      ),
    ),
  updateSettings: (
    settings: Array<{ key: string; value: string; expectedVersion?: number }>,
  ) =>
    unwrap(
      apiClient<SystemSettingRecord[]>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }),
    ),
  getSettingsHistory: (page = 1) =>
    unwrap(
      apiClient<PaginatedResponse<Record<string, unknown>>>(
        `/admin/settings/history?page=${page}&limit=15`,
      ),
    ),
};
