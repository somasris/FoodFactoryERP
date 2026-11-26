import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  collaborationService,
  SubstitutionEvaluationData,
  SubstitutionRequestItem,
} from '../../services/collaboration.service';
import { masterDataService } from '../../services/master-data.service';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const COMPAT_BADGE: Record<
  SubstitutionEvaluationData['compatibilityStatus'],
  'success' | 'warning' | 'info' | 'danger'
> = {
  COMPATIBLE: 'success',
  COMPATIBLE_WITH_WARNING: 'warning',
  REQUIRES_REVIEW: 'info',
  NOT_COMPATIBLE: 'danger',
};

const REQUEST_STATUS_BADGE: Record<
  SubstitutionRequestItem['status'],
  'warning' | 'info' | 'danger' | 'success' | 'neutral'
> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  APPLIED: 'success',
  CANCELLED: 'neutral',
};

export const MaterialSubstitutionPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState('');
  const [bomId, setBomId] = useState('');
  const [bomVersionId, setBomVersionId] = useState('');
  const [originalItemId, setOriginalItemId] = useState('');
  const [substituteItemId, setSubstituteItemId] = useState('');
  const [requiredQuantity, setRequiredQuantity] = useState('10');
  const [uomId, setUomId] = useState('');
  const [reason, setReason] = useState('');
  const [evaluation, setEvaluation] = useState<SubstitutionEvaluationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEvaluate = hasPermission('bom.read') || hasPermission('production.batches.read');
  const canCreateRequest = hasPermission('production.batches.create') || hasPermission('bom.update');
  const canApprove = hasPermission('bom.update') || hasPermission('production.batches.update');

  const { data: warehousesRes } = useQuery({
    queryKey: ['master-data', 'warehouses', 'sub'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100 }),
  });
  const warehouses = useMemo(() => warehousesRes?.data?.items ?? [], [warehousesRes]);

  const { data: bomsRes } = useQuery({
    queryKey: ['master-data', 'boms', 'sub'],
    queryFn: () => masterDataService.boms.list({ limit: 100 }),
  });
  const boms = useMemo(() => bomsRes?.data?.items ?? [], [bomsRes]);

  const { data: itemsRes } = useQuery({
    queryKey: ['master-data', 'inventory-items', 'sub'],
    queryFn: () => masterDataService.inventoryItems.list({ limit: 200 }),
  });
  const inventoryItems = useMemo(() => itemsRes?.data?.items ?? [], [itemsRes]);

  const { data: uomsRes } = useQuery({
    queryKey: ['master-data', 'uoms', 'sub'],
    queryFn: () => masterDataService.uoms.list({ limit: 100 }),
  });
  const uoms = useMemo(() => uomsRes?.data?.items ?? [], [uomsRes]);

  const selectedBom = useMemo(() => boms.find((b) => b.id === bomId), [boms, bomId]);
  const bomVersions = selectedBom?.versions ?? [];

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['collaboration', 'substitutions', 'list'],
    queryFn: () => collaborationService.listSubstitutions(),
  });

  const evaluateMut = useMutation({
    mutationFn: () =>
      collaborationService.evaluateSubstitution({
        warehouseId,
        bomId,
        bomVersionId,
        originalItemId,
        substituteItemId,
        requiredQuantity,
        uomId,
      }),
    onSuccess: (res) => {
      setErrorMsg(null);
      setEvaluation(res);
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const createRequestMut = useMutation({
    mutationFn: () =>
      collaborationService.createSubstitutionRequest({
        warehouseId,
        bomId,
        bomVersionId,
        originalItemId,
        substituteItemId,
        requiredQuantity,
        uomId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setErrorMsg(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['collaboration', 'substitutions'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => collaborationService.approveSubstitution(id),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['collaboration', 'substitutions'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) =>
      collaborationService.rejectSubstitution(id, 'Rejected during production review'),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['collaboration', 'substitutions'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const applyMut = useMutation({
    mutationFn: (id: string) => collaborationService.applySubstitution(id),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['collaboration', 'substitutions'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const canSubmitEval =
    Boolean(warehouseId && bomId && bomVersionId && originalItemId && substituteItemId && uomId) &&
    Number(requiredQuantity) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
          {t('collaboration.substitutionTitle', 'Material Substitution Checker')}
        </h1>
        <p className="text-sm text-[#66756A] dark:text-[#96A69B]">
          {t(
            'collaboration.substitutionSubtitle',
            'Read-only safety, allergen, UOM, and usable stock evaluation before requesting a controlled substitution.',
          )}
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Read-only Compatibility Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[#2E7D32]" />
            {t('collaboration.evaluateCompatibility', 'Evaluate Substitute Compatibility')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                {t('collaboration.warehouse', 'Warehouse')}
              </label>
              <select
                aria-label={t('collaboration.warehouse', 'Warehouse')}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                {t('collaboration.bom', 'BOM')}
              </label>
              <select
                aria-label={t('collaboration.bom', 'BOM')}
                value={bomId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setBomId(nextId);
                  const found = boms.find((b) => b.id === nextId);
                  setBomVersionId(found?.versions?.[0]?.id ?? '');
                }}
                className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                {t('collaboration.bomVersion', 'BOM Version')}
              </label>
              <select
                aria-label={t('collaboration.bomVersion', 'BOM Version')}
                value={bomVersionId}
                onChange={(e) => setBomVersionId(e.target.value)}
                className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                {bomVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                {t('collaboration.originalMaterial', 'Original Material')}
              </label>
              <select
                aria-label={t('collaboration.originalMaterial', 'Original Material')}
                value={originalItemId}
                onChange={(e) => setOriginalItemId(e.target.value)}
                className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                {inventoryItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} - {it.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                {t('collaboration.substituteMaterial', 'Proposed Substitute')}
              </label>
              <select
                aria-label={t('collaboration.substituteMaterial', 'Proposed Substitute')}
                value={substituteItemId}
                onChange={(e) => setSubstituteItemId(e.target.value)}
                className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                {inventoryItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} - {it.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.requiredQty', 'Required Qty')}
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={requiredQuantity}
                  onChange={(e) => setRequiredQuantity(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('collaboration.uom', 'UOM')}
                </label>
                <select
                  aria-label={t('collaboration.uom', 'UOM')}
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="">{t('common.select', 'Select...')}</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol} ({u.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            {canEvaluate && (
              <Button
                disabled={!canSubmitEval || evaluateMut.isPending}
                onClick={() => evaluateMut.mutate()}
              >
                {evaluateMut.isPending
                  ? t('collaboration.evaluating', 'Evaluating...')
                  : t('collaboration.runCheck', 'Check Compatibility')}
              </Button>
            )}
          </div>

          {/* Evaluation Result */}
          {evaluation && (
            <div className="space-y-4 rounded-xl border border-[#D4DDD1] dark:border-[#2B382E] bg-[#FAFBF8] dark:bg-[#182019] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {evaluation.compatibilityStatus === 'NOT_COMPATIBLE' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : evaluation.compatibilityStatus === 'COMPATIBLE' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="font-semibold text-[#1B2A1E] dark:text-[#EDF2ED]">
                    {t('collaboration.compatibilityResult', 'Compatibility Result')}
                  </span>
                </div>
                <Badge variant={COMPAT_BADGE[evaluation.compatibilityStatus]}>
                  {evaluation.compatibilityStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Reasons */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-[#66756A] dark:text-[#96A69B]">
                    {t('collaboration.evaluationReasons', 'Checks & Warnings')}
                  </p>
                  {evaluation.reasons.length === 0 ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      {t('collaboration.allChecksPassed', 'All category, UOM, allergen, and stock checks passed.')}
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {evaluation.reasons.map((r, idx) => (
                        <li
                          key={`${r.code}-${idx}`}
                          className="rounded border border-[#E1E7DD] dark:border-[#253028] bg-white dark:bg-[#131814] p-2"
                        >
                          <span className="mr-1.5 font-semibold">[{r.severity}]</span>
                          {r.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Stock & Allergen Summary */}
                <div className="space-y-2 text-xs">
                  <p className="font-semibold uppercase text-[#66756A] dark:text-[#96A69B]">
                    {t('collaboration.stockAndAllergens', 'Stock & Allergen Profile')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 rounded border border-[#E1E7DD] dark:border-[#253028] bg-white dark:bg-[#131814] p-2.5">
                    <div>
                      <span className="text-[#66756A] dark:text-[#96A69B]">
                        {t('collaboration.requiredInSubUom', 'Required')}:
                      </span>{' '}
                      <strong>
                        {evaluation.inventorySummary.requiredInSubstituteUom}{' '}
                        {evaluation.inventorySummary.substituteUomSymbol}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#66756A] dark:text-[#96A69B]">
                        {t('collaboration.usableAccepted', 'Usable Accepted')}:
                      </span>{' '}
                      <strong>
                        {evaluation.inventorySummary.availableAcceptedQty}{' '}
                        {evaluation.inventorySummary.substituteUomSymbol}
                      </strong>
                    </div>
                    <div>
                      {t('collaboration.quarantinedQty', 'Quarantined')}:{' '}
                      {evaluation.inventorySummary.quarantinedQty}
                    </div>
                    <div>
                      {t('collaboration.expiredQty', 'Expired')}:{' '}
                      {evaluation.inventorySummary.expiredQty}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded border border-[#E1E7DD] dark:border-[#253028] bg-white dark:bg-[#131814] p-2.5">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p>
                        {t('collaboration.substituteAllergens', 'Substitute Allergens')}:{' '}
                        {evaluation.allergenComparison.substituteAllergens.length > 0
                          ? evaluation.allergenComparison.substituteAllergens.join(', ')
                          : t('collaboration.noneDeclared', 'None declared')}
                      </p>
                      {evaluation.allergenComparison.introducesNewAllergens && (
                        <p className="mt-1 font-semibold text-red-600 dark:text-red-400">
                          {t(
                            'collaboration.newAllergenWarning',
                            'Introduces new allergens not present in original material!',
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Request Box */}
              {canCreateRequest && evaluation.compatibilityStatus !== 'NOT_COMPATIBLE' && (
                <div className="flex flex-col gap-2 border-t border-[#E1E7DD] dark:border-[#253028] pt-3 sm:flex-row">
                  <input
                    type="text"
                    placeholder={t('collaboration.substitutionReasonPlaceholder', 'Justification for substitution request...')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="flex-1 rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  />
                  <Button
                    disabled={createRequestMut.isPending || reason.trim().length < 5}
                    onClick={() => createRequestMut.mutate()}
                  >
                    {t('collaboration.submitRequest', 'Create Substitution Request')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Substitution Requests Queue */}
      <Card>
        <CardHeader>
          <CardTitle>{t('collaboration.substitutionRequests', 'Substitution Requests')}</CardTitle>
        </CardHeader>
        <CardContent>
          {reqLoading ? (
            <p className="py-6 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
              {t('common.loading', 'Loading...')}
            </p>
          ) : requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
              {t('collaboration.noSubstitutionRequests', 'No substitution requests yet.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E1E7DD] dark:border-[#253028] text-xs uppercase text-[#66756A] dark:text-[#96A69B]">
                    <th className="py-2 pr-3">{t('collaboration.requestNumber', 'Request #')}</th>
                    <th className="py-2 pr-3">{t('collaboration.requiredQty', 'Qty')}</th>
                    <th className="py-2 pr-3">{t('collaboration.compatibility', 'Compatibility')}</th>
                    <th className="py-2 pr-3">{t('collaboration.status', 'Status')}</th>
                    <th className="py-2 pr-3">{t('collaboration.reason', 'Reason')}</th>
                    <th className="py-2 pr-3">{t('collaboration.createdAt', 'Created')}</th>
                    <th className="py-2 text-right">{t('common.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3EC] dark:divide-[#202922]">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-3 font-medium text-[#1B2A1E] dark:text-[#EDF2ED]">
                        {r.requestNumber}
                      </td>
                      <td className="py-2.5 pr-3">{r.requiredQuantity}</td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant={
                            COMPAT_BADGE[
                              r.compatibilityStatus as SubstitutionEvaluationData['compatibilityStatus']
                            ] ?? 'neutral'
                          }
                        >
                          {r.compatibilityStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={REQUEST_STATUS_BADGE[r.status]}>{r.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-[#3D4E40] dark:text-[#B9C7BB]">{r.reason}</td>
                      <td className="py-2.5 pr-3 text-[#66756A] dark:text-[#96A69B]">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="py-2.5 text-right space-x-1.5">
                        {canApprove && r.status === 'PENDING_APPROVAL' && (
                          <>
                            <Button
                              size="sm"
                              disabled={approveMut.isPending}
                              onClick={() => approveMut.mutate(r.id)}
                            >
                              {t('collaboration.approve', 'Approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={rejectMut.isPending}
                              onClick={() => rejectMut.mutate(r.id)}
                            >
                              {t('collaboration.reject', 'Reject')}
                            </Button>
                          </>
                        )}
                        {canApprove && r.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            disabled={applyMut.isPending}
                            onClick={() => applyMut.mutate(r.id)}
                          >
                            {t('collaboration.apply', 'Apply')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
