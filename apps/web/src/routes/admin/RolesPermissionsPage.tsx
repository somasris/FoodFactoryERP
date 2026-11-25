import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, ShieldCheck } from 'lucide-react';
import { adminService, RoleRecord } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const RolesPermissionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('administration.roles.manage');

  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name: '', description: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.listRoles(),
  });

  const permsQuery = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => adminService.listPermissions(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminService.createRole({
        code: newRole.code,
        name: newRole.name,
        description: newRole.description || undefined,
        permissionCodes: [],
      }),
    onSuccess: created => {
      setShowCreate(false);
      setNewRole({ code: '', name: '', description: '' });
      setFeedback({ type: 'success', message: `Role '${created.code}' created.` });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const savePermsMutation = useMutation({
    mutationFn: () => adminService.updateRolePermissions(selectedRole!.id, draftPerms),
    onSuccess: () => {
      setFeedback({ type: 'success', message: `Permissions updated for '${selectedRole?.code}'.` });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const selectRole = (role: RoleRecord) => {
    setSelectedRole(role);
    setDraftPerms(role.permissions);
    setFeedback(null);
  };

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">ERP Roles</h2>
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 rounded bg-brand-navy px-2.5 py-1 text-xs font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                New Role
              </button>
            )}
          </div>

          <div className="space-y-2">
            {rolesQuery.data?.map(role => (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selectedRole?.id === role.id
                    ? 'border-brand-navy bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">{role.code}</span>
                  <div className="flex gap-1">
                    {role.isSystem && (
                      <Badge variant="outline">
                        <Lock className="mr-1 h-2.5 w-2.5" />
                        System
                      </Badge>
                    )}
                    <Badge variant="teal">{role.permissionCount} perms</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{role.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{role.userCount} assigned user(s)</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedRole ? (
            <div className="flex h-48 flex-col items-center justify-center text-slate-400">
              <ShieldCheck className="mb-2 h-8 w-8" />
              <p className="text-sm">Select a role on the left to inspect or manage its permissions.</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedRole.code} — {selectedRole.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedRole.description || 'No description'}
                    {selectedRole.code === 'OWNER' && ' • Protected system role (all permissions)'}
                    {selectedRole.code === 'AUDITOR' && ' • Strictly read-only permissions enforced'}
                  </p>
                </div>
                {canManage && selectedRole.code !== 'OWNER' && (
                  <button
                    onClick={() => savePermsMutation.mutate()}
                    disabled={savePermsMutation.isPending}
                    className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {savePermsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 max-h-[520px] overflow-y-auto pr-1">
                {permsQuery.data?.grouped &&
                  Object.entries(permsQuery.data.grouped).map(([mod, perms]) => (
                    <div key={mod} className="rounded border border-slate-200 p-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        {mod}
                      </h4>
                      <div className="space-y-1.5">
                        {perms.map(p => {
                          const checked =
                            selectedRole.code === 'OWNER' || draftPerms.includes(p.code);
                          const disabled = !canManage || selectedRole.code === 'OWNER';
                          return (
                            <label key={p.id} className="flex items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setDraftPerms([...draftPerms, p.code]);
                                  } else {
                                    setDraftPerms(draftPerms.filter(c => c !== p.code));
                                  }
                                }}
                                className="mt-0.5"
                              />
                              <div>
                                <span className="font-mono text-[11px] font-medium text-slate-800">
                                  {p.code}
                                </span>
                                {p.description && (
                                  <p className="text-[11px] text-slate-500">{p.description}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Create Custom Role</h3>
            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="mt-4 space-y-3 text-sm"
            >
              <input
                required
                placeholder="Role Code (e.g. QA_LEAD)"
                value={newRole.code}
                onChange={e => setNewRole({ ...newRole, code: e.target.value.toUpperCase() })}
                className="w-full rounded border border-slate-300 px-3 py-1.5 font-mono"
              />
              <input
                required
                placeholder="Display Name"
                value={newRole.name}
                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                placeholder="Description"
                value={newRole.description}
                onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
