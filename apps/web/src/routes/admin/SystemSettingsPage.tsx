import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Sliders } from 'lucide-react';
import { adminService, SystemSettingRecord } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';

const CATEGORIES = [
  'GENERAL',
  'INVENTORY',
  'PRODUCTION',
  'SALES',
  'TAX',
  'NOTIFICATIONS',
  'SECURITY',
];

export const SystemSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('administration.settings.update');

  const [activeCategory, setActiveCategory] = useState('GENERAL');
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminService.listSettings(),
  });

  useEffect(() => {
    if (data?.items) {
      const next: Record<string, string> = {};
      for (const item of data.items) {
        next[item.key] = item.value;
      }
      setDraftValues(next);
    }
  }, [data]);

  const categoryItems: SystemSettingRecord[] = data?.grouped?.[activeCategory] || [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = categoryItems
        .filter(item => draftValues[item.key] !== undefined && draftValues[item.key] !== item.value)
        .map(item => ({
          key: item.key,
          value: draftValues[item.key],
          expectedVersion: item.version,
        }));

      if (payload.length === 0) {
        return Promise.resolve([]);
      }
      return adminService.updateSettings(payload);
    },
    onSuccess: res => {
      if (res.length === 0) {
        setFeedback({ type: 'success', message: 'No changes to save in this category.' });
      } else {
        setFeedback({
          type: 'success',
          message: `Updated ${res.length} setting(s) in ${activeCategory}.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setFeedback(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-brand-navy text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
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

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand-navy" />
            <h2 className="text-base font-semibold text-slate-900">{activeCategory} Settings</h2>
          </div>
          {canUpdate && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading settings...</p>
        ) : !categoryItems.length ? (
          <p className="text-sm text-slate-500">No settings in this category.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {categoryItems.map(item => (
              <div key={item.id} className="grid grid-cols-1 gap-2 py-4 md:grid-cols-3 md:items-center">
                <div className="md:col-span-2">
                  <div className="font-mono text-xs font-semibold text-slate-800">{item.key}</div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Version {item.version}
                    {item.updatedBy ? ` • Last updated by ${item.updatedBy.username}` : ''}
                  </p>
                </div>
                <div>
                  {item.valueType === 'BOOLEAN' ? (
                    <select
                      disabled={!canUpdate}
                      value={draftValues[item.key] ?? item.value}
                      onChange={e =>
                        setDraftValues({ ...draftValues, [item.key]: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                    >
                      <option value="true">Enabled (true)</option>
                      <option value="false">Disabled (false)</option>
                    </select>
                  ) : (
                    <input
                      type={item.valueType === 'NUMBER' ? 'number' : 'text'}
                      disabled={!canUpdate}
                      value={draftValues[item.key] ?? item.value}
                      onChange={e =>
                        setDraftValues({ ...draftValues, [item.key]: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
