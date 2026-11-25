import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { notificationService } from '../../services/notification.service';
import { NotificationCategory, NotificationPreferenceItem } from '../../types/notifications';

const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  SALES: {
    label: 'Sales & Orders',
    description: 'Order approvals, rejections, confirmations, and fulfillment updates.',
  },
  INVENTORY: {
    label: 'Inventory & Warehouse',
    description: 'Low stock, zero stock, receipts, issues, transfers, and adjustments.',
  },
  PRODUCTION: {
    label: 'Production & Planning',
    description: 'Production plans, work orders, batch execution, and material shortages.',
  },
  QUALITY: {
    label: 'Quality Management',
    description: 'Quality inspections, rejections, quarantine, and disposition alerts.',
  },
  FINANCE: {
    label: 'Finance & Costing',
    description: 'Sales invoices and finalized batch costing events.',
  },
  ADMINISTRATION: {
    label: 'Administration & Access',
    description: 'User registrations, role updates, and warehouse access changes.',
  },
  SYSTEM: {
    label: 'System & Operations',
    description: 'System settings, maintenance mode, backups, and restore requests.',
  },
};

export const NotificationPreferencesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationPreferenceItem[]>([]);
  const [savedBanner, setSavedBanner] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationService.getPreferences(),
  });

  useEffect(() => {
    if (data?.data) {
      setDraft(data.data);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      notificationService.updatePreferences(
        draft.map(d => ({ category: d.category, inAppEnabled: d.inAppEnabled })),
      ),
    onSuccess: res => {
      if (res.data) setDraft(res.data);
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    },
  });

  const toggleCategory = (category: NotificationCategory) => {
    setDraft(prev =>
      prev.map(item =>
        item.category === category ? { ...item, inAppEnabled: !item.inAppEnabled } : item,
      ),
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E1E7DD] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            aria-label="Back to notifications"
            className="rounded-md border border-[#E1E7DD] p-1.5 text-[#66756A] hover:bg-[#EAF1E8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#17452C]">Notification Preferences</h1>
            <p className="text-xs text-[#66756A]">
              Manage in-app notification delivery by ERP category.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || isLoading || draft.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#245C3A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saveMut.isPending ? 'Saving...' : 'Save Preferences'}</span>
        </button>
      </div>

      {savedBanner && (
        <div className="rounded-md border border-[#27834A]/30 bg-[#EAF1E8] px-3.5 py-2 text-xs font-medium text-[#17452C]">
          Notification preferences saved.
        </div>
      )}

      {saveMut.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-[#C74440]">
          Failed to save preferences. Please try again.
        </div>
      )}

      <div className="rounded-lg border border-[#E1E7DD] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#66756A]">Loading preferences...</div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-[#C74440]">
            Unable to load notification preferences.
          </div>
        ) : (
          <div className="divide-y divide-[#F0F4ED]">
            {draft.map(pref => {
              const info = CATEGORY_LABELS[pref.category] ?? {
                label: pref.category,
                description: '',
              };
              return (
                <div
                  key={pref.category}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#24352A]">{info.label}</div>
                    <div className="mt-0.5 text-[11px] text-[#66756A]">{info.description}</div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#24352A]">
                    <input
                      type="checkbox"
                      checked={pref.inAppEnabled}
                      onChange={() => toggleCategory(pref.category)}
                      aria-label={`In-app notifications for ${info.label}`}
                      className="h-4 w-4 rounded border-[#CBD5C5] text-[#245C3A] focus:ring-[#245C3A]"
                    />
                    <span>In-App</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
