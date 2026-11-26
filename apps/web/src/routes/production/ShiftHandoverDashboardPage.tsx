import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FilePlus2,
  History,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  collaborationService,
  ShiftHandoverDetail,
  ShiftHandoverItem,
} from '../../services/collaboration.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const STATUS_VARIANTS: Record<ShiftHandoverItem['status'], 'neutral' | 'warning' | 'info' | 'danger' | 'success'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  ACKNOWLEDGED: 'info',
  RETURNED: 'danger',
  CLOSED: 'success',
};

const PRIORITY_VARIANTS: Record<ShiftHandoverItem['priority'], 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const ShiftHandoverDashboardPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();

  const [factoryFilter, setFactoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({
    factoryId: '',
    warehouseId: '',
    productionLine: '',
    shiftName: 'Morning Shift',
    shiftDate: new Date().toISOString().slice(0, 10),
    priority: 'NORMAL' as ShiftHandoverItem['priority'],
    equipmentIssues: '',
    pendingQualityNotes: '',
    productionDelays: '',
    safetyObservations: '',
    notes: '',
  });

  const canCreate = hasPermission('production.batches.create') || hasPermission('production.batches.update');
  const canTransition = hasPermission('production.batches.update');

  const { data: factoriesRes } = useQuery({
    queryKey: ['master-data', 'factories'],
    queryFn: () => masterDataService.factories.list(),
  });
  const factories = useMemo(() => factoriesRes?.data ?? [], [factoriesRes]);

  const { data: warehousesRes } = useQuery({
    queryKey: ['master-data', 'warehouses', 'handover'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100 }),
  });
  const warehouses = useMemo(() => warehousesRes?.data?.items ?? [], [warehousesRes]);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['collaboration', 'handovers', 'dashboard', factoryFilter],
    queryFn: () => collaborationService.getHandoverDashboard(factoryFilter || undefined),
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['collaboration', 'handovers', 'list', statusFilter, priorityFilter, search],
    queryFn: () =>
      collaborationService.listHandovers({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: search.trim() || undefined,
      }),
  });

  const { data: detail } = useQuery<ShiftHandoverDetail>({
    queryKey: ['collaboration', 'handovers', 'detail', selectedId],
    queryFn: () => collaborationService.getHandoverById(selectedId!),
    enabled: Boolean(selectedId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['collaboration', 'handovers'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      collaborationService.createHandover({
        factoryId: form.factoryId || factories[0]?.id,
        warehouseId: form.warehouseId || undefined,
        productionLine: form.productionLine.trim() || undefined,
        shiftName: form.shiftName.trim(),
        shiftDate: new Date(`${form.shiftDate}T00:00:00.000Z`).toISOString(),
        priority: form.priority,
        equipmentIssues: form.equipmentIssues.trim() || undefined,
        pendingQualityNotes: form.pendingQualityNotes.trim() || undefined,
        productionDelays: form.productionDelays.trim() || undefined,
        safetyObservations: form.safetyObservations.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (created) => {
      setActionError(null);
      setShowCreate(false);
      setSelectedId(created.id);
      refresh();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => collaborationService.submitHandover(id),
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) =>
      collaborationService.acknowledgeHandover(id, actionNotes.trim() || undefined),
    onSuccess: () => {
      setActionError(null);
      setActionNotes('');
      refresh();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const returnMut = useMutation({
    mutationFn: (id: string) => collaborationService.returnHandover(id, actionNotes.trim()),
    onSuccess: () => {
      setActionError(null);
      setActionNotes('');
      refresh();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => collaborationService.closeHandover(id),
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const handovers = listData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
            {t('collaboration.handoverTitle', 'Digital Shift Handover')}
          </h1>
          <p className="text-sm text-[#66756A] dark:text-[#96A69B]">
            {t(
              'collaboration.handoverSubtitle',
              'Structured shift-to-shift communication for active batches, unresolved issues, and pending QC.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('collaboration.filterFactory', 'Filter by Factory')}
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
            className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
          >
            <option value="">{t('collaboration.allFactories', 'All Factories')}</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {canCreate && (
            <Button
              onClick={() => {
                setActionError(null);
                setShowCreate((v) => !v);
              }}
            >
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              {t('collaboration.newHandover', 'New Shift Handover')}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {actionError}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#66756A] dark:text-[#96A69B]">
                  {t('collaboration.pendingAck', 'Pending Acknowledgement')}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
                  {dashLoading ? '...' : dashboard?.pendingAcknowledgement.length ?? 0}
                </p>
              </div>
              <Clock className="h-7 w-7 text-amber-500" />
            </div>
            {(dashboard?.overdueCount ?? 0) > 0 && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                {dashboard?.overdueCount} {t('collaboration.overdueLabel', 'overdue (>8h)')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#66756A] dark:text-[#96A69B]">
                  {t('collaboration.unresolvedIssues', 'Unresolved Issues')}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
                  {dashLoading ? '...' : dashboard?.unresolvedIssues.length ?? 0}
                </p>
              </div>
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#66756A] dark:text-[#96A69B]">
                  {t('collaboration.activeBatches', 'Active Batches')}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
                  {dashLoading ? '...' : dashboard?.activeBatches.length ?? 0}
                </p>
              </div>
              <ClipboardCheck className="h-7 w-7 text-[#2E7D32]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#66756A] dark:text-[#96A69B]">
                  {t('collaboration.pendingQc', 'Pending QC Inspections')}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
                  {dashLoading ? '...' : dashboard?.pendingQualityInspections.length ?? 0}
                </p>
              </div>
              <ShieldAlert className="h-7 w-7 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('collaboration.createHandoverTitle', 'Create Shift Handover')}</CardTitle>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded p-1 text-[#66756A] hover:bg-[#EEF3EC] dark:hover:bg-[#1E2620]"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.factory', 'Factory')}
                </label>
                <select
                  value={form.factoryId || factories[0]?.id || ''}
                  onChange={(e) => setForm((p) => ({ ...p, factoryId: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.warehouseOptional', 'Warehouse (Optional)')}
                </label>
                <select
                  value={form.warehouseId}
                  onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="">--</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.shiftName', 'Shift Name')}
                </label>
                <input
                  type="text"
                  value={form.shiftName}
                  onChange={(e) => setForm((p) => ({ ...p, shiftName: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.shiftDate', 'Shift Date')}
                </label>
                <input
                  type="date"
                  value={form.shiftDate}
                  onChange={(e) => setForm((p) => ({ ...p, shiftDate: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.productionLine', 'Production Line')}
                </label>
                <input
                  type="text"
                  placeholder="Line A"
                  value={form.productionLine}
                  onChange={(e) => setForm((p) => ({ ...p, productionLine: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.priority', 'Priority')}
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      priority: e.target.value as ShiftHandoverItem['priority'],
                    }))
                  }
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
              <div className="md:col-span-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <textarea
                  rows={2}
                  placeholder={t('collaboration.equipmentIssuesPlaceholder', 'Equipment issues or downtime...')}
                  value={form.equipmentIssues}
                  onChange={(e) => setForm((p) => ({ ...p, equipmentIssues: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
                <textarea
                  rows={2}
                  placeholder={t('collaboration.pendingQualityPlaceholder', 'Pending quality notes...')}
                  value={form.pendingQualityNotes}
                  onChange={(e) => setForm((p) => ({ ...p, pendingQualityNotes: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
                <textarea
                  rows={2}
                  placeholder={t('collaboration.productionDelaysPlaceholder', 'Production delays or material shortages...')}
                  value={form.productionDelays}
                  onChange={(e) => setForm((p) => ({ ...p, productionDelays: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
                <textarea
                  rows={2}
                  placeholder={t('collaboration.safetyNotesPlaceholder', 'Safety observations & general notes...')}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                disabled={createMut.isPending || !form.shiftName.trim()}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending
                  ? t('common.saving', 'Saving...')
                  : t('collaboration.saveDraft', 'Save Draft Handover')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handover List + Detail Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{t('collaboration.handoverLog', 'Shift Handover Log')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  placeholder={t('common.search', 'Search...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-1.5 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-2.5 py-1.5 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="">{t('collaboration.allStatuses', 'All Statuses')}</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="RETURNED">RETURNED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-2.5 py-1.5 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="">{t('collaboration.allPriorities', 'All Priorities')}</option>
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <p className="py-8 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                {t('common.loading', 'Loading...')}
              </p>
            ) : handovers.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                {t('collaboration.noHandovers', 'No shift handovers found.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E1E7DD] dark:border-[#253028] text-xs uppercase text-[#66756A] dark:text-[#96A69B]">
                      <th className="py-2 pr-3">{t('collaboration.number', 'Number')}</th>
                      <th className="py-2 pr-3">{t('collaboration.shiftName', 'Shift')}</th>
                      <th className="py-2 pr-3">{t('collaboration.shiftDate', 'Date')}</th>
                      <th className="py-2 pr-3">{t('collaboration.priority', 'Priority')}</th>
                      <th className="py-2 pr-3">{t('collaboration.status', 'Status')}</th>
                      <th className="py-2 text-right">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3EC] dark:divide-[#202922]">
                    {handovers.map((h) => (
                      <tr
                        key={h.id}
                        className={
                          selectedId === h.id
                            ? 'bg-[#EEF6EE] dark:bg-[#19281C]'
                            : 'hover:bg-[#FAFBF8] dark:hover:bg-[#182019]'
                        }
                      >
                        <td className="py-2.5 pr-3 font-medium text-[#1B2A1E] dark:text-[#EDF2ED]">
                          {h.handoverNumber}
                          <span className="ml-1.5 text-xs text-[#66756A] dark:text-[#96A69B]">
                            v{h.revisionNumber}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[#3D4E40] dark:text-[#B9C7BB]">
                          {h.shiftName}
                          {h.productionLine ? ` (${h.productionLine})` : ''}
                        </td>
                        <td className="py-2.5 pr-3 text-[#66756A] dark:text-[#96A69B]">
                          {formatDate(h.shiftDate)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={PRIORITY_VARIANTS[h.priority]}>{h.priority}</Badge>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={STATUS_VARIANTS[h.status]}>{h.status}</Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedId(h.id)}
                          >
                            {t('common.view', 'View')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail & Lifecycle Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#2E7D32]" />
              {t('collaboration.handoverDetails', 'Handover Details & History')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <p className="py-8 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                {t('collaboration.selectHandoverPrompt', 'Select a handover from the log to inspect notes and transitions.')}
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1B2A1E] dark:text-[#EDF2ED]">
                    {detail.handoverNumber}
                  </span>
                  <Badge variant={STATUS_VARIANTS[detail.status]}>{detail.status}</Badge>
                </div>

                {detail.equipmentIssues && (
                  <div className="rounded-lg border border-[#E1E7DD] dark:border-[#253028] p-2.5">
                    <p className="text-xs font-semibold text-[#66756A] dark:text-[#96A69B]">
                      {t('collaboration.equipmentIssues', 'Equipment Issues')}
                    </p>
                    <p className="mt-1 text-[#1B2A1E] dark:text-[#EDF2ED]">{detail.equipmentIssues}</p>
                  </div>
                )}

                {detail.pendingQualityNotes && (
                  <div className="rounded-lg border border-[#E1E7DD] dark:border-[#253028] p-2.5">
                    <p className="text-xs font-semibold text-[#66756A] dark:text-[#96A69B]">
                      {t('collaboration.pendingQualityNotes', 'Pending Quality Notes')}
                    </p>
                    <p className="mt-1 text-[#1B2A1E] dark:text-[#EDF2ED]">{detail.pendingQualityNotes}</p>
                  </div>
                )}

                {detail.productionDelays && (
                  <div className="rounded-lg border border-[#E1E7DD] dark:border-[#253028] p-2.5">
                    <p className="text-xs font-semibold text-[#66756A] dark:text-[#96A69B]">
                      {t('collaboration.productionDelays', 'Production Delays')}
                    </p>
                    <p className="mt-1 text-[#1B2A1E] dark:text-[#EDF2ED]">{detail.productionDelays}</p>
                  </div>
                )}

                {detail.returnReason && (
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-2.5 text-red-900 dark:text-red-200">
                    <p className="text-xs font-semibold">
                      {t('collaboration.returnReason', 'Return Reason')}
                    </p>
                    <p className="mt-1">{detail.returnReason}</p>
                  </div>
                )}

                {canTransition && detail.status !== 'CLOSED' && (
                  <div className="space-y-2 border-t border-[#E1E7DD] dark:border-[#253028] pt-3">
                    {(detail.status === 'SUBMITTED' || detail.status === 'ACKNOWLEDGED') && (
                      <input
                        type="text"
                        placeholder={t('collaboration.actionRemarksPlaceholder', 'Remarks or return reason...')}
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-1.5 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(detail.status === 'DRAFT' || detail.status === 'RETURNED') && (
                        <Button
                          size="sm"
                          disabled={submitMut.isPending}
                          onClick={() => submitMut.mutate(detail.id)}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {t('collaboration.submitHandover', 'Submit')}
                        </Button>
                      )}
                      {detail.status === 'SUBMITTED' && (
                        <>
                          <Button
                            size="sm"
                            disabled={acknowledgeMut.isPending}
                            onClick={() => acknowledgeMut.mutate(detail.id)}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            {t('collaboration.acknowledgeHandover', 'Acknowledge')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={returnMut.isPending || actionNotes.trim().length < 3}
                            onClick={() => returnMut.mutate(detail.id)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            {t('collaboration.returnHandover', 'Return')}
                          </Button>
                        </>
                      )}
                      {detail.status === 'ACKNOWLEDGED' && (
                        <Button
                          size="sm"
                          disabled={closeMut.isPending}
                          onClick={() => closeMut.mutate(detail.id)}
                        >
                          {t('collaboration.closeHandover', 'Close Handover')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-[#E1E7DD] dark:border-[#253028] pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-[#66756A] dark:text-[#96A69B]">
                    {t('collaboration.revisionHistory', 'Immutable History')}
                  </p>
                  <ul className="space-y-2 text-xs">
                    {detail.histories.map((ev) => (
                      <li
                        key={ev.id}
                        className="rounded border border-[#EEF3EC] dark:border-[#202922] p-2"
                      >
                        <div className="flex items-center justify-between font-medium text-[#1B2A1E] dark:text-[#EDF2ED]">
                          <span>
                            {ev.action} (v{ev.revisionNumber})
                          </span>
                          <span className="text-[#66756A] dark:text-[#96A69B]">
                            {ev.toStatus}
                          </span>
                        </div>
                        {ev.remarks && (
                          <p className="mt-1 text-[#66756A] dark:text-[#96A69B]">{ev.remarks}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
