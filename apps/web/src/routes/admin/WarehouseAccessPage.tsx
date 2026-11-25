import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Warehouse } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const WarehouseAccessPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('administration.warehouse_access.manage');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [accessLevel, setAccessLevel] = useState<'READ' | 'READ_WRITE'>('READ_WRITE');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const mappingsQuery = useQuery({
    queryKey: ['admin', 'warehouse-access'],
    queryFn: () => adminService.listWarehouseAccess(),
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => adminService.listUsers({ limit: 100 }),
  });

  const warehousesQuery = useQuery({
    queryKey: ['admin', 'warehouses', 'all'],
    queryFn: () => adminService.listAllWarehouses(),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const existingForUser =
        mappingsQuery.data
          ?.filter(m => m.userId === selectedUserId && m.warehouseId !== selectedWarehouseId)
          .map(m => ({ warehouseId: m.warehouseId, accessLevel: m.accessLevel })) || [];

      return adminService.assignUserWarehouseAccess(selectedUserId, [
        ...existingForUser,
        { warehouseId: selectedWarehouseId, accessLevel },
      ]);
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Warehouse access assigned successfully.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouse-access'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ userId, warehouseId }: { userId: string; warehouseId: string }) =>
      adminService.revokeWarehouseAccess(userId, warehouseId),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Warehouse access revoked.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouse-access'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Warehouse className="h-4 w-4 text-brand-navy" />
            Assign User Warehouse Access
          </h2>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (selectedUserId && selectedWarehouseId) {
                assignMutation.mutate();
              }
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">User</label>
              <select
                required
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select user...</option>
                {usersQuery.data?.items?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">Warehouse</label>
              <select
                required
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select warehouse...</option>
                {warehousesQuery.data?.items?.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs font-medium text-slate-700">Access Level</label>
              <select
                value={accessLevel}
                onChange={e => setAccessLevel(e.target.value as 'READ' | 'READ_WRITE')}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="READ_WRITE">READ_WRITE</option>
                <option value="READ">READ</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={assignMutation.isPending}
              className="rounded-md bg-brand-navy px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Assign Access
            </button>
          </form>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Factory</th>
              <th className="px-4 py-3">Access Level</th>
              {canManage && <th className="px-4 py-3 text-right">Revoke</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mappingsQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading warehouse access mappings...
                </td>
              </tr>
            ) : !mappingsQuery.data?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No explicit warehouse access mappings configured. Note: OWNER &amp; ADMIN have global access.
                </td>
              </tr>
            ) : (
              mappingsQuery.data.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.fullName}</div>
                    <div className="text-slate-500">@{m.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.userRoles.map(r => (
                        <Badge key={r} variant="outline">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{m.warehouseName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{m.warehouseCode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.factory.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.accessLevel === 'READ_WRITE' ? 'teal' : 'warning'}>
                      {m.accessLevel}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          revokeMutation.mutate({ userId: m.userId, warehouseId: m.warehouseId })
                        }
                        title="Revoke access"
                        className="rounded border border-slate-200 p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
