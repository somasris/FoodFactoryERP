import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardId, DashboardLayoutConfig, uxService } from '../services/ux.service';

export interface DashboardWidgetDef {
  id: string;
  label: string;
}

export function useDashboardPreferences(
  dashboardId: DashboardId,
  defaultWidgets: DashboardWidgetDef[],
) {
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['ux', 'preferences'],
    queryFn: () => uxService.getPreferences(),
    staleTime: 60_000,
    retry: false,
  });

  const savedConfig = prefs?.dashboardLayout?.[dashboardId];

  const orderedWidgets = useMemo(() => {
    const defaultIds = defaultWidgets.map(w => w.id);
    const savedOrder = savedConfig?.widgetOrder ?? [];
    const validSaved = savedOrder.filter(id => defaultIds.includes(id));
    const missing = defaultIds.filter(id => !validSaved.includes(id));
    const fullOrder = [...validSaved, ...missing];
    const hiddenSet = new Set(savedConfig?.hiddenWidgetIds ?? []);
    return fullOrder.map(id => ({
      ...defaultWidgets.find(w => w.id === id)!,
      visible: !hiddenSet.has(id),
    }));
  }, [defaultWidgets, savedConfig]);

  const saveMutation = useMutation({
    mutationFn: (config: DashboardLayoutConfig) =>
      uxService.updateDashboardPreference(dashboardId, config),
    onSuccess: updated => {
      queryClient.setQueryData(['ux', 'preferences'], updated);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => uxService.resetDashboardPreference(dashboardId),
    onSuccess: updated => {
      queryClient.setQueryData(['ux', 'preferences'], updated);
    },
  });

  const toggleWidget = (widgetId: string) => {
    const hidden = new Set(savedConfig?.hiddenWidgetIds ?? []);
    if (hidden.has(widgetId)) {
      hidden.delete(widgetId);
    } else {
      hidden.add(widgetId);
    }
    saveMutation.mutate({
      hiddenWidgetIds: Array.from(hidden),
      widgetOrder: orderedWidgets.map(w => w.id),
    });
  };

  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    const ids = orderedWidgets.map(w => w.id);
    const idx = ids.indexOf(widgetId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    saveMutation.mutate({
      hiddenWidgetIds: savedConfig?.hiddenWidgetIds ?? [],
      widgetOrder: ids,
    });
  };

  const resetToDefault = () => resetMutation.mutate();

  return {
    orderedWidgets,
    isCustomized: Boolean(savedConfig),
    isSaving: saveMutation.isPending || resetMutation.isPending,
    toggleWidget,
    moveWidget,
    resetToDefault,
  };
}
