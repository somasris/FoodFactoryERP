import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListQuery } from '../services/master-data.service';
import { PaginatedResponse } from '../types/master-data';
import { ApiResponse } from '../types/api';

interface CrudEndpoint<T> {
  list: (params: ListQuery) => Promise<ApiResponse<PaginatedResponse<T>>>;
  create: (payload: Record<string, unknown>) => Promise<ApiResponse<T>>;
  update: (id: string, payload: Record<string, unknown>) => Promise<ApiResponse<T>>;
  setStatus: (id: string, isActive: boolean) => Promise<ApiResponse<T>>;
}

export function useMasterDataList<T extends { id: string; isActive?: boolean }>(
  queryKey: string,
  api: CrudEndpoint<T>,
  extraParams: Record<string, string> = {},
) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const queryParams: ListQuery = {
    page,
    limit: 15,
    search,
    isActive: statusFilter === '' ? '' : statusFilter === 'true',
    ...extraParams,
  };

  const query = useQuery({
    queryKey: [queryKey, queryParams],
    queryFn: async () => {
      const res = await api.list(queryParams);
      return res.data!;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.create(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.update(id, payload),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.setStatus(id, isActive),
    onSuccess: invalidate,
  });

  return {
    items: query.data?.items ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    page,
    setPage,
    search,
    setSearch: (val: string) => {
      setSearch(val);
      setPage(1);
    },
    statusFilter,
    setStatusFilter: (val: string) => {
      setStatusFilter(val);
      setPage(1);
    },
    createMutation,
    updateMutation,
    statusMutation,
  };
}
