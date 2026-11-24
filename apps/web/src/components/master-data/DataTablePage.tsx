import React from 'react';
import { Plus, Search, RefreshCw, Eye, Pencil, Power, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { PaginationMeta } from '../../types/master-data';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTablePageProps<T extends { id: string; isActive?: boolean }> {
  title: string;
  subtitle?: string;
  items: T[];
  pagination?: PaginationMeta;
  columns: ColumnDef<T>[];
  isLoading: boolean;
  error?: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  extraFilters?: React.ReactNode;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  canCreate?: boolean;
  onCreate?: () => void;
  createLabel?: string;
  onView?: (row: T) => void;
  canUpdate?: boolean;
  onEdit?: (row: T) => void;
  onToggleStatus?: (row: T) => void;
  extraRowActions?: (row: T) => React.ReactNode;
}

export function DataTablePage<T extends { id: string; isActive?: boolean }>({
  title,
  subtitle,
  items,
  pagination,
  columns,
  isLoading,
  error,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  extraFilters,
  page,
  onPageChange,
  onRefresh,
  canCreate,
  onCreate,
  createLabel = 'Add New',
  onView,
  canUpdate,
  onEdit,
  onToggleStatus,
  extraRowActions,
}: DataTablePageProps<T>) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            {canCreate && onCreate && (
              <Button type="button" size="sm" onClick={onCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {createLabel}
              </Button>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>

          {onStatusFilterChange && (
            <select
              aria-label="Filter by status"
              value={statusFilter ?? ''}
              onChange={e => onStatusFilterChange(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          )}

          {extraFilters}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading records...</div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No records found</p>
            <p className="mt-1 text-xs text-slate-400">
              Try adjusting your search or filters, or create a new entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} className={`px-3 py-2.5 font-semibold ${col.className || ''}`}>
                      {col.header}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    {columns.map((col, idx) => (
                      <td key={idx} className={`px-3 py-2.5 text-slate-700 ${col.className || ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {extraRowActions && extraRowActions(row)}
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(row)}
                            title="View details"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-navy"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {canUpdate && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            title="Edit"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-blue"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canUpdate && onToggleStatus && row.isActive !== undefined && (
                          <button
                            type="button"
                            onClick={() => onToggleStatus(row)}
                            title={row.isActive ? 'Deactivate' : 'Activate'}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <Badge variant={isActive ? 'teal' : 'warning'}>{isActive ? 'Active' : 'Inactive'}</Badge>
);
