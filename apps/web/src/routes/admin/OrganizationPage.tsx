import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, History, Save } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const OrganizationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('administration.organization.update');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'organization'],
    queryFn: () => adminService.getOrganization(),
  });

  const historyQuery = useQuery({
    queryKey: ['admin', 'organization', 'history'],
    queryFn: () => adminService.getOrganizationHistory(1, 10),
  });

  const [form, setForm] = useState({
    legalName: '',
    tradeName: '',
    gstin: '',
    pan: '',
    state: '',
    stateCode: '',
    email: '',
    phone: '',
    address: '',
    logoUrl: '',
    registrationNumber: '',
    fssaiLicense: '',
    financialYearStartMonth: 4,
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (data) {
      setForm({
        legalName: data.legalName || '',
        tradeName: data.tradeName || '',
        gstin: data.gstin || '',
        pan: data.pan || '',
        state: data.state || '',
        stateCode: data.stateCode || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        logoUrl: data.logoUrl || '',
        registrationNumber: data.registrationNumber || '',
        fssaiLicense: data.fssaiLicense || '',
        financialYearStartMonth: data.financialYearStartMonth ?? 4,
        defaultCurrency: data.defaultCurrency || 'INR',
        defaultTimezone: data.defaultTimezone || 'Asia/Kolkata',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      adminService.updateOrganization({
        ...form,
        tradeName: form.tradeName || null,
        email: form.email || null,
        phone: form.phone || null,
        logoUrl: form.logoUrl || null,
        registrationNumber: form.registrationNumber || null,
        fssaiLicense: form.fssaiLicense || null,
      }),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Organization profile updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization'] });
    },
    onError: (err: Error) => {
      setFeedback({ type: 'error', message: err.message });
    },
  });

  if (isLoading) {
    return <div className="rounded-lg bg-white p-6 text-sm text-slate-500">Loading organization profile...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load organization profile: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-navy" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Organization &amp; Company Profile</h2>
              <p className="text-xs text-slate-500">
                Code: <span className="font-mono font-medium">{data?.code}</span> &bull; Factories:{' '}
                {data?._count?.factories ?? 0} &bull; Users: {data?._count?.users ?? 0}
              </p>
            </div>
          </div>
          <Badge variant={data?.isActive ? 'success' : 'outline'}>
            {data?.isActive ? 'Active Company' : 'Inactive'}
          </Badge>
        </div>

        {feedback && (
          <div
            className={`mb-4 rounded-md px-3 py-2 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault();
            setFeedback(null);
            updateMutation.mutate();
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Legal Business Name *</label>
            <input
              type="text"
              required
              disabled={!canUpdate}
              value={form.legalName}
              onChange={e => setForm({ ...form, legalName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Trade Name</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.tradeName}
              onChange={e => setForm({ ...form, tradeName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">GSTIN (15-char) *</label>
            <input
              type="text"
              required
              disabled={!canUpdate}
              value={form.gstin}
              onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">PAN (10-char) *</label>
            <input
              type="text"
              required
              disabled={!canUpdate}
              value={form.pan}
              onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">State *</label>
            <input
              type="text"
              required
              disabled={!canUpdate}
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">State Code (2 digits) *</label>
            <input
              type="text"
              required
              maxLength={2}
              disabled={!canUpdate}
              value={form.stateCode}
              onChange={e => setForm({ ...form, stateCode: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
            <input
              type="email"
              disabled={!canUpdate}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">FSSAI License Number</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.fssaiLicense}
              onChange={e => setForm({ ...form, fssaiLicense: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">CIN / Registration Number</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.registrationNumber}
              onChange={e => setForm({ ...form, registrationNumber: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Default Currency</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.defaultCurrency}
              onChange={e => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Default Timezone</label>
            <input
              type="text"
              disabled={!canUpdate}
              value={form.defaultTimezone}
              onChange={e => setForm({ ...form, defaultTimezone: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Registered Business Address *</label>
            <textarea
              rows={2}
              required
              disabled={!canUpdate}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>

          {canUpdate && (
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Organization Profile'}
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Configuration Change History</h3>
        </div>
        {historyQuery.isLoading ? (
          <p className="text-xs text-slate-500">Loading change history...</p>
        ) : !historyQuery.data?.items?.length ? (
          <p className="text-xs text-slate-500">No organization updates recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {historyQuery.data.items.map((item: Record<string, unknown>) => (
              <div key={String(item.id)} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-slate-800">{String(item.remarks || 'Updated')}</span>
                  <span className="ml-2 text-slate-500">
                    by {(item.user as { username?: string } | null)?.username || 'system'}
                  </span>
                </div>
                <span className="text-slate-400">
                  {new Date(String(item.createdAt)).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
