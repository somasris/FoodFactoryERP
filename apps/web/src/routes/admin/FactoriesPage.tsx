import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory, Plus, Search, Power } from 'lucide-react';
import { adminService, FactoryRecord } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const FactoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('administration.factories.manage');

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FactoryRecord | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    address: '',
    email: '',
    phone: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'factories', search],
    queryFn: () => adminService.listFactories({ search: search || undefined, limit: 50 }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? adminService.updateFactory(editing.id, form)
        : adminService.createFactory(form),
    onSuccess: () => {
      setShowModal(false);
      setEditing(null);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'factories'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminService.setFactoryStatus(id, isActive),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'factories'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      state: 'Tamil Nadu',
      stateCode: '33',
      address: '',
      email: '',
      phone: '',
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEdit = (f: FactoryRecord) => {
    setEditing(f);
    setForm({
      code: f.code,
      name: f.name,
      state: f.state,
      stateCode: f.stateCode,
      address: f.address,
      email: f.email || '',
      phone: f.phone || '',
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search factories by code, name, or state..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Factory
          </button>
        )}
      </div>

      {errorMsg && !showModal && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading ? (
          <div className="col-span-2 rounded-lg bg-white p-6 text-sm text-slate-500">
            Loading factories...
          </div>
        ) : !data?.items?.length ? (
          <div className="col-span-2 rounded-lg bg-white p-6 text-sm text-slate-500">
            No factories found.
          </div>
        ) : (
          data.items.map(factory => (
            <div
              key={factory.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-brand-navy" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{factory.name}</h3>
                      <span className="font-mono text-xs text-slate-500">{factory.code}</span>
                    </div>
                  </div>
                  <Badge variant={factory.isActive ? 'success' : 'outline'}>
                    {factory.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <p className="mt-3 text-xs text-slate-600">{factory.address}</p>
                <p className="mt-1 text-xs text-slate-500">
                  State: {factory.state} ({factory.stateCode})
                  {factory.phone ? ` • ${factory.phone}` : ''}
                </p>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Associated Warehouses ({factory.warehouses?.length ?? 0})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {factory.warehouses?.map(w => (
                      <span
                        key={w.id}
                        className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        {w.code} ({w.warehouseType})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => openEdit(factory)}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      statusMutation.mutate({ id: factory.id, isActive: !factory.isActive })
                    }
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Power className="h-3 w-3" />
                    {factory.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {editing ? `Edit Factory (${editing.code})` : 'Register New Factory'}
            </h3>
            {errorMsg && (
              <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">{errorMsg}</div>
            )}
            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Code *</label>
                  <input
                    required
                    disabled={!!editing}
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="FAC-02"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">State *</label>
                  <input
                    required
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">State Code *</label>
                  <input
                    required
                    maxLength={2}
                    value={form.stateCode}
                    onChange={e => setForm({ ...form, stateCode: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Address *</label>
                <textarea
                  required
                  rows={2}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Factory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
