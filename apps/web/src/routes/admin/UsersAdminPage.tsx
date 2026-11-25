import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, KeyRound, Plus, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { adminService, AdminUserRecord } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const UsersAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, hasPermission, hasRole } = useAuth();
  const canCreate = hasPermission('users.create');
  const canManage = hasPermission('administration.users.manage');
  const canDisable = hasPermission('users.disable');
  const canAssignRoles = hasPermission('users.roles.assign');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<
    '' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  >('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUserRecord | null>(null);
  const [rolesTarget, setRolesTarget] = useState<AdminUserRecord | null>(null);
  const [reviewTarget, setReviewTarget] = useState<AdminUserRecord | null>(null);
  const [reviewRole, setReviewRole] = useState('SALESMAN');
  const [reviewReason, setReviewReason] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    roleCode: 'PRODUCTION',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter, registrationStatusFilter, page],
    queryFn: () =>
      adminService.listUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        registrationStatus: registrationStatusFilter || undefined,
        page,
        limit: 15,
      }),
  });

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.listRoles(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminService.createUser({
        username: createForm.username,
        email: createForm.email,
        fullName: createForm.fullName,
        phone: createForm.phone || null,
        password: createForm.password,
        roleCodes: [createForm.roleCode],
      }),
    onSuccess: () => {
      setShowCreateModal(false);
      setCreateForm({ username: '', email: '', fullName: '', phone: '', password: '', roleCode: 'PRODUCTION' });
      setFeedback({ type: 'success', message: 'User created successfully.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminService.setUserStatus(id, isActive),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'User account status updated.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      adminService.resetUserPassword(resetTarget!.id, newPassword, resetReason || undefined),
    onSuccess: () => {
      setResetTarget(null);
      setNewPassword('');
      setResetReason('');
      setFeedback({
        type: 'success',
        message: 'Password reset and all active sessions revoked.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const assignRolesMutation = useMutation({
    mutationFn: () => adminService.assignUserRoles(rolesTarget!.id, selectedRoles),
    onSuccess: () => {
      setRolesTarget(null);
      setFeedback({ type: 'success', message: 'User roles updated.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      adminService.reviewRegistration(reviewTarget!.id, {
        decision,
        roleCodes: decision === 'APPROVED' ? [reviewRole] : [],
        reason: reviewReason.trim() || undefined,
      }),
    onSuccess: res => {
      setReviewTarget(null);
      setReviewReason('');
      setReviewRole('SALESMAN');
      setFeedback({
        type: 'success',
        message:
          res.registrationStatus === 'APPROVED'
            ? `Registration approved and activated with role ${res.roles.join(', ')}.`
            : 'Registration rejected.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search username, name, email..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">All Roles</option>
            {rolesQuery.data?.map(r => (
              <option key={r.id} value={r.code}>
                {r.code}
              </option>
            ))}
          </select>
          <select
            value={registrationStatusFilter}
            onChange={e => {
              setRegistrationStatusFilter(
                e.target.value as '' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED',
              );
              setPage(1);
            }}
            aria-label="Filter by registration status"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">All Registrations</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              setFeedback(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create User
          </button>
        )}
      </div>

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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No users matched the selected filters.
                  </td>
                </tr>
              ) : (
                data.items.map(u => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                        <div className="text-slate-500">
                          @{u.username} &bull; {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <Badge key={r} variant="teal">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {u.registrationStatus === 'PENDING_APPROVAL' ? (
                            <>
                              <Badge variant="warning">Pending Approval</Badge>
                              {u.requestedRole && (
                                <Badge variant="outline">Requested: {u.requestedRole}</Badge>
                              )}
                            </>
                          ) : u.registrationStatus === 'REJECTED' ? (
                            <Badge variant="outline">Rejected</Badge>
                          ) : (
                            <Badge variant={u.isActive ? 'success' : 'outline'}>
                              {u.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.activeSessions}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canManage && u.registrationStatus === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => {
                                setReviewTarget(u);
                                setReviewRole(u.requestedRole || 'SALESMAN');
                                setReviewReason('');
                              }}
                              title="Review Registration"
                              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Review
                            </button>
                          )}
                          {canAssignRoles && (
                            <button
                              onClick={() => {
                                setRolesTarget(u);
                                setSelectedRoles(u.roles);
                              }}
                              title="Assign Roles"
                              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setResetTarget(u)}
                              title="Reset Password"
                              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDisable && !isSelf && (
                            <button
                              onClick={() =>
                                statusMutation.mutate({ id: u.id, isActive: !u.isActive })
                              }
                              title={u.isActive ? 'Deactivate User' : 'Activate User'}
                              className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                            >
                              {u.isActive ? (
                                <UserX className="h-3.5 w-3.5 text-red-600" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} users)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Create New User</h3>
            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="mt-4 space-y-3 text-sm"
            >
              <input
                required
                placeholder="Username"
                value={createForm.username}
                onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                placeholder="Full Name"
                value={createForm.fullName}
                onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                type="password"
                placeholder="Temporary Password (Min 8 chars, upper/lower/digit/special)"
                value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <select
                value={createForm.roleCode}
                onChange={e => setCreateForm({ ...createForm, roleCode: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              >
                {rolesQuery.data?.map(r => (
                  <option key={r.id} value={r.code}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Reset Password for @{resetTarget.username}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              All active sessions for this user will be immediately revoked.
            </p>
            <form
              onSubmit={e => {
                e.preventDefault();
                resetMutation.mutate();
              }}
              className="mt-4 space-y-3 text-sm"
            >
              <input
                required
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                placeholder="Reason (optional)"
                value={resetReason}
                onChange={e => setResetReason(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="rounded border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
                >
                  {resetMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Roles Modal */}
      {rolesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Assign Roles for @{rolesTarget.username}
            </h3>
            <div className="mt-3 space-y-2">
              {rolesQuery.data?.map(role => {
                const checked = selectedRoles.includes(role.code);
                return (
                  <label key={role.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role.code]);
                        } else {
                          setSelectedRoles(selectedRoles.filter(c => c !== role.code));
                        }
                      }}
                    />
                    <span className="font-medium">{role.code}</span>
                    <span className="text-slate-500">({role.name})</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRolesTarget(null)}
                className="rounded border px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => assignRolesMutation.mutate()}
                disabled={assignRolesMutation.isPending || selectedRoles.length === 0}
                className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Save Roles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Pending Registration Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Review Registration</h3>
            <p className="mt-1 text-xs text-slate-500">
              {reviewTarget.fullName} ({reviewTarget.email})
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Assign Role (for approval)
                </label>
                <select
                  value={reviewRole}
                  onChange={e => setReviewRole(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {(rolesQuery.data ?? [])
                    .filter(r => r.isActive && (r.code !== 'OWNER' || hasRole('OWNER')))
                    .map(r => (
                      <option key={r.id} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Remarks / Reason (optional)
                </label>
                <input
                  placeholder="Optional approval or rejection note"
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                disabled={reviewMutation.isPending}
                className="rounded border px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => reviewMutation.mutate('REJECTED')}
                disabled={reviewMutation.isPending}
                className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => reviewMutation.mutate('APPROVED')}
                disabled={reviewMutation.isPending}
                className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {reviewMutation.isPending ? 'Processing...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
