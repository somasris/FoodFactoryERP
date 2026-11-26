import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Check, Plus, Star, Trash2, X } from 'lucide-react';
import {
  FilterValue,
  SavedViewItem,
  SavedViewModule,
  uxService,
} from '../../services/ux.service';
import { useTranslation } from '../../i18n/I18nContext';

interface SavedViewsBarProps {
  module: SavedViewModule;
  currentFilters: Record<string, FilterValue>;
  onApplyView: (filters: Record<string, FilterValue>) => void;
  onResetFilters: () => void;
}

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
  module,
  currentFilters,
  onApplyView,
  onResetFilters,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['ux', 'saved-views', module],
    queryFn: () => uxService.listSavedViews(module),
    retry: false,
  });

  // Apply default saved view automatically once on initial load if present
  const [appliedInitialDefault, setAppliedInitialDefault] = useState(false);
  useEffect(() => {
    if (appliedInitialDefault || isLoading) return;
    const def = views.find(v => v.isDefault);
    if (def) {
      setActiveViewId(def.id);
      onApplyView(def.filters);
    }
    setAppliedInitialDefault(true);
  }, [views, isLoading, appliedInitialDefault, onApplyView]);

  const createMutation = useMutation({
    mutationFn: () =>
      uxService.createSavedView({
        module,
        name: newName.trim(),
        filters: currentFilters,
        isDefault: makeDefault,
      }),
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['ux', 'saved-views', module] });
      setActiveViewId(created.id);
      setCreating(false);
      setNewName('');
      setMakeDefault(false);
      setErrorMsg(null);
    },
    onError: err => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save view');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (view: SavedViewItem) =>
      uxService.updateSavedView(view.id, { isDefault: !view.isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ux', 'saved-views', module] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => uxService.deleteSavedView(id),
    onSuccess: (_res, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ux', 'saved-views', module] });
      if (activeViewId === deletedId) {
        setActiveViewId(null);
        onResetFilters();
      }
    },
  });

  return (
    <div
      data-tour="saved-views"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] px-3 py-2 text-xs"
    >
      <span className="inline-flex items-center gap-1 font-semibold text-[#17452C]">
        <Bookmark className="h-3.5 w-3.5" />
        <span>{t('savedViews.title', 'Views')}:</span>
      </span>

      <button
        type="button"
        onClick={() => {
          setActiveViewId(null);
          onResetFilters();
        }}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          activeViewId === null
            ? 'border-[#245C3A] bg-[#245C3A] text-white'
            : 'border-[#E1E7DD] bg-white text-[#24352A] hover:bg-[#EAF1E8]'
        }`}
      >
        {t('savedViews.allDefault', 'All (Default)')}
      </button>

      {views.map(view => {
        const isActive = activeViewId === view.id;
        return (
          <div
            key={view.id}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'border-[#245C3A] bg-[#EAF1E8] text-[#17452C]'
                : 'border-[#E1E7DD] bg-white text-[#24352A] hover:bg-[#EAF1E8]/60'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveViewId(view.id);
                onApplyView(view.filters);
              }}
              className="font-medium"
            >
              {view.name}
            </button>
            <button
              type="button"
              onClick={() => setDefaultMutation.mutate(view)}
              title={t('savedViews.toggleDefault', 'Toggle default view')}
              aria-label={`Set ${view.name} as default`}
              className={`rounded p-0.5 ${
                view.isDefault ? 'text-amber-600' : 'text-[#8A958C] hover:text-[#17452C]'
              }`}
            >
              <Star className={`h-3 w-3 ${view.isDefault ? 'fill-amber-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(view.id)}
              title={t('common.delete', 'Delete')}
              aria-label={`Delete view ${view.name}`}
              className="rounded p-0.5 text-[#8A958C] hover:text-[#C74440]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {creating ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate();
          }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('savedViews.namePlaceholder', 'View name...')}
            aria-label={t('savedViews.namePlaceholder', 'View name')}
            className="h-7 w-36 rounded border border-[#E1E7DD] bg-white px-2 text-xs focus:border-[#245C3A] focus:outline-none"
          />
          <label className="inline-flex items-center gap-1 text-[11px] text-[#66756A]">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={e => setMakeDefault(e.target.checked)}
            />
            <span>{t('savedViews.default', 'Default')}</span>
          </label>
          <button
            type="submit"
            disabled={!newName.trim() || createMutation.isPending}
            aria-label={t('common.save', 'Save')}
            className="inline-flex h-7 items-center gap-1 rounded bg-[#245C3A] px-2 text-[11px] font-semibold text-white hover:bg-[#17452C] disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            <span>{t('common.save', 'Save')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setErrorMsg(null);
            }}
            aria-label={t('common.cancel', 'Cancel')}
            className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#245C3A]/40 px-2 py-1 text-xs font-medium text-[#245C3A] hover:bg-[#EAF1E8]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('savedViews.saveCurrent', 'Save View')}</span>
        </button>
      )}

      {errorMsg && <span className="text-[11px] text-[#C74440]">{errorMsg}</span>}
    </div>
  );
};
