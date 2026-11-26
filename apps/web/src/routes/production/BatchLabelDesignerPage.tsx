import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  Copy,
  FileDown,
  History,
  Layers,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Tag,
} from 'lucide-react';
import {
  AuthoritativeLabelSnapshot,
  BatchLabelTemplate,
  LabelLayoutConfig,
  labelsService,
} from '../../services/labels.service';
import { productionService } from '../../services/production.service';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

const DEFAULT_LAYOUT: LabelLayoutConfig = {
  showCompanyName: true,
  showCompanyAddress: true,
  showFactoryName: true,
  showFssaiLicense: true,
  showProductName: true,
  showSku: true,
  showBatchNumber: true,
  showManufacturingDate: true,
  showExpiryDate: true,
  showNetQuantity: true,
  showQualityStatus: true,
  showAllergenDeclaration: true,
  showStorageInstructions: true,
  optionalFields: [],
};

export const BatchLabelDesignerPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'generate' | 'templates' | 'history'>('generate');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [labelMode, setLabelMode] = useState<'RELEASED' | 'INTERNAL_STATUS'>('RELEASED');
  const [copies, setCopies] = useState(1);
  const [storageOverride, setStorageOverride] = useState('');
  const [previewSnapshot, setPreviewSnapshot] = useState<AuthoritativeLabelSnapshot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Template designer form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tplForm, setTplForm] = useState<{
    code: string;
    name: string;
    sizePreset: BatchLabelTemplate['sizePreset'];
    widthMm: number;
    heightMm: number;
    includeQr: boolean;
    includeBarcode: boolean;
    defaultStorageInstructions: string;
    layoutConfig: LabelLayoutConfig;
  }>({
    code: '',
    name: '',
    sizePreset: 'STANDARD_BATCH',
    widthMm: 100,
    heightMm: 70,
    includeQr: true,
    includeBarcode: true,
    defaultStorageInstructions: 'Store in a cool, dry place.',
    layoutConfig: DEFAULT_LAYOUT,
  });

  const canManageTemplates = hasPermission('production.batches.create');
  const canGenerate = hasPermission('production.batches.create');

  const { data: templates = [] } = useQuery({
    queryKey: ['labels', 'templates'],
    queryFn: () => labelsService.listTemplates(true),
  });

  const activeTemplates = useMemo(() => templates.filter((tpl) => tpl.isActive), [templates]);

  useEffect(() => {
    if (!selectedTemplateId && activeTemplates.length > 0) {
      const def = activeTemplates.find((x) => x.isDefault) ?? activeTemplates[0];
      setSelectedTemplateId(def.id);
    }
  }, [activeTemplates, selectedTemplateId]);

  const { data: batchesRes } = useQuery({
    queryKey: ['production', 'batches', 'labels'],
    queryFn: () => productionService.batches.list({ limit: 100 }),
  });
  const batches = useMemo(() => batchesRes?.data?.items ?? [], [batchesRes]);

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['labels', 'history'],
    queryFn: () => labelsService.listHistory(),
  });

  const selectedTemplate = useMemo(
    () => templates.find((x) => x.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  useEffect(() => {
    let active = true;
    if (previewSnapshot?.tracePath) {
      QRCode.toDataURL(`${window.location.origin}${previewSnapshot.tracePath}`, {
        width: 140,
        margin: 1,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
        .then((url) => {
          if (active) setQrDataUrl(url);
        })
        .catch(() => {
          if (active) setQrDataUrl('');
        });
    } else {
      setQrDataUrl('');
    }
    return () => {
      active = false;
    };
  }, [previewSnapshot?.tracePath]);

  const previewMut = useMutation({
    mutationFn: () =>
      labelsService.previewLabel({
        productionBatchId: selectedBatchId,
        templateId: selectedTemplateId,
        labelMode,
        storageInstructionsOverride: storageOverride.trim() || undefined,
      }),
    onSuccess: (snap) => {
      setErrorMsg(null);
      setPreviewSnapshot(snap);
    },
    onError: (err: Error) => {
      setPreviewSnapshot(null);
      setErrorMsg(err.message);
    },
  });

  const generateMut = useMutation({
    mutationFn: () =>
      labelsService.generateLabel({
        productionBatchId: selectedBatchId,
        templateId: selectedTemplateId,
        copies,
        labelMode,
        storageInstructionsOverride: storageOverride.trim() || undefined,
      }),
    onSuccess: async (rec) => {
      setErrorMsg(null);
      setSuccessMsg(`${t('labels.generatedSuccess', 'Generated label')} ${rec.labelNumber}`);
      setPreviewSnapshot(rec.labelSnapshot);
      queryClient.invalidateQueries({ queryKey: ['labels', 'history'] });
      try {
        await labelsService.downloadPdf(rec.id, rec.labelNumber);
      } catch {
        // Download optional if popup blocked
      }
    },
    onError: (err: Error) => {
      setSuccessMsg(null);
      setErrorMsg(err.message);
    },
  });

  const reprintMut = useMutation({
    mutationFn: (id: string) => labelsService.reprintLabel(id, 1),
    onSuccess: (rec) => {
      setErrorMsg(null);
      setSuccessMsg(`${t('labels.reprintSuccess', 'Reprinted label')} ${rec.labelNumber}`);
      queryClient.invalidateQueries({ queryKey: ['labels', 'history'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const createTplMut = useMutation({
    mutationFn: () =>
      labelsService.createTemplate({
        ...tplForm,
        code: tplForm.code.trim().toUpperCase(),
        name: tplForm.name.trim(),
      }),
    onSuccess: (created) => {
      setErrorMsg(null);
      setShowTemplateForm(false);
      setSelectedTemplateId(created.id);
      queryClient.invalidateQueries({ queryKey: ['labels', 'templates'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const dupTplMut = useMutation({
    mutationFn: (id: string) => labelsService.duplicateTemplate(id),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['labels', 'templates'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const toggleTplMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      labelsService.setTemplateActive(id, isActive),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['labels', 'templates'] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A1E] dark:text-[#EDF2ED]">
            {t('labels.pageTitle', 'Smart Batch Label Designer')}
          </h1>
          <p className="text-sm text-[#66756A] dark:text-[#96A69B]">
            {t(
              'labels.pageSubtitle',
              'Design templates, preview authoritative ERP batch data, and print traceable QR PDF labels.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === 'generate' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('generate')}
          >
            <Tag className="mr-1.5 h-4 w-4" />
            {t('labels.tabGenerate', 'Generate & Preview')}
          </Button>
          <Button
            variant={activeTab === 'templates' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('templates')}
          >
            <Layers className="mr-1.5 h-4 w-4" />
            {t('labels.tabTemplates', 'Templates')}
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            <History className="mr-1.5 h-4 w-4" />
            {t('labels.tabHistory', 'Label History')}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200 print:hidden"
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 print:hidden"
        >
          {successMsg}
        </div>
      )}

      {/* TAB 1: GENERATE & LIVE PREVIEW */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>{t('labels.configurationTitle', 'Label Configuration')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('labels.productionBatch', 'Production Batch')}
                </label>
                <select
                  aria-label={t('labels.productionBatch', 'Production Batch')}
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  <option value="">{t('common.select', 'Select...')}</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} ({b.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('labels.template', 'Label Template')}
                </label>
                <select
                  aria-label={t('labels.template', 'Label Template')}
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                >
                  {activeTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} (v{tpl.versionNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                    {t('labels.labelMode', 'Label Mode')}
                  </label>
                  <select
                    aria-label={t('labels.labelMode', 'Label Mode')}
                    value={labelMode}
                    onChange={(e) =>
                      setLabelMode(e.target.value as 'RELEASED' | 'INTERNAL_STATUS')
                    }
                    className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  >
                    <option value="RELEASED">
                      {t('labels.modeReleased', 'Released / Accepted')}
                    </option>
                    <option value="INTERNAL_STATUS">
                      {t('labels.modeInternal', 'Internal QC Status')}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                    {t('labels.copies', 'Copies')}
                  </label>
                  <input
                    aria-label={t('labels.copies', 'Copies')}
                    type="number"
                    min={1}
                    max={200}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D4E40] dark:text-[#B9C7BB]">
                  {t('labels.storageOverride', 'Storage Instructions (Optional)')}
                </label>
                <input
                  type="text"
                  value={storageOverride}
                  onChange={(e) => setStorageOverride(e.target.value)}
                  placeholder={selectedTemplate?.defaultStorageInstructions ?? 'Store in a cool, dry place'}
                  className="w-full rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  disabled={!selectedBatchId || !selectedTemplateId || previewMut.isPending}
                  onClick={() => previewMut.mutate()}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  {t('labels.loadPreview', 'Preview Label')}
                </Button>
                {canGenerate && (
                  <Button
                    disabled={!selectedBatchId || !selectedTemplateId || generateMut.isPending}
                    onClick={() => generateMut.mutate()}
                  >
                    <FileDown className="mr-1.5 h-4 w-4" />
                    {t('labels.generateAndDownload', 'Generate & Download PDF')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Print-Ready Preview */}
          <Card className="print:border-none print:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between print:hidden">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#2E7D32]" />
                {t('labels.livePreview', 'Authoritative Label Preview')}
              </CardTitle>
              {previewSnapshot && (
                <Button size="sm" variant="secondary" onClick={() => window.print()}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  {t('labels.browserPrint', 'Print')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!previewSnapshot ? (
                <p className="py-12 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                  {t(
                    'labels.selectBatchPrompt',
                    'Select a production batch and template, then click Preview Label.',
                  )}
                </p>
              ) : (
                <div className="mx-auto max-w-md rounded-lg border-2 border-[#1B2A1E] bg-white p-4 text-[#111111] print:border print:p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#17452C]">
                        {previewSnapshot.companyName}
                      </p>
                      {previewSnapshot.companyAddress && (
                        <p className="text-[10px] text-[#4B5563]">
                          {previewSnapshot.companyAddress}
                        </p>
                      )}
                      <h2 className="text-base font-bold text-black">
                        {previewSnapshot.productName}
                      </h2>
                      <p className="text-xs font-medium text-[#374151]">
                        SKU: {previewSnapshot.sku}
                      </p>
                    </div>
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="Batch Traceability QR"
                        className="h-20 w-20 shrink-0 border border-[#E5E7EB]"
                      />
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-[#E5E7EB] pt-2 text-xs">
                    <div>
                      <span className="font-semibold">BATCH:</span> {previewSnapshot.batchNumber}
                    </div>
                    <div>
                      <span className="font-semibold">NET QTY:</span> {previewSnapshot.netQuantity}{' '}
                      {previewSnapshot.uomSymbol}
                    </div>
                    <div>
                      <span className="font-semibold">MFG:</span>{' '}
                      {previewSnapshot.manufacturingDate}
                    </div>
                    <div>
                      <span className="font-semibold">EXP:</span> {previewSnapshot.expiryDate}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-[#E5E7EB] pt-2 text-[11px]">
                    <span className="font-bold text-[#17452C]">
                      QC: {previewSnapshot.qualityDecision}
                    </span>
                    {previewSnapshot.barcodeValue && (
                      <span className="font-mono text-[#374151]">
                        {previewSnapshot.barcodeValue}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 rounded bg-[#FEF2F2] p-2 text-[11px] font-medium text-[#7F1D1D]">
                    {previewSnapshot.allergenSummary.declarationText}
                  </div>

                  {previewSnapshot.storageInstructions && (
                    <p className="mt-1.5 text-[10px] text-[#4B5563]">
                      Storage: {previewSnapshot.storageInstructions}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: TEMPLATE DESIGNER */}
      {activeTab === 'templates' && (
        <div className="space-y-4 print:hidden">
          {canManageTemplates && (
            <div className="flex justify-end">
              <Button onClick={() => setShowTemplateForm((v) => !v)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('labels.newTemplate', 'New Template')}
              </Button>
            </div>
          )}

          {showTemplateForm && (
            <Card>
              <CardHeader>
                <CardTitle>{t('labels.createTemplateTitle', 'Create Label Template')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Code (e.g. LBL-EXPORT-01)"
                    value={tplForm.code}
                    onChange={(e) => setTplForm((p) => ({ ...p, code: e.target.value }))}
                    className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  />
                  <input
                    type="text"
                    placeholder="Template Name"
                    value={tplForm.name}
                    onChange={(e) => setTplForm((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  />
                  <select
                    value={tplForm.sizePreset}
                    onChange={(e) => {
                      const preset = e.target.value as BatchLabelTemplate['sizePreset'];
                      const dims =
                        preset === 'SMALL_PRODUCT'
                          ? { widthMm: 50, heightMm: 30 }
                          : preset === 'LARGE_CARTON'
                            ? { widthMm: 148, heightMm: 105 }
                            : { widthMm: 100, heightMm: 70 };
                      setTplForm((p) => ({ ...p, sizePreset: preset, ...dims }));
                    }}
                    className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                  >
                    <option value="SMALL_PRODUCT">SMALL_PRODUCT (50x30mm)</option>
                    <option value="STANDARD_BATCH">STANDARD_BATCH (100x70mm)</option>
                    <option value="LARGE_CARTON">LARGE_CARTON (148x105mm)</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={25}
                      max={300}
                      value={tplForm.widthMm}
                      onChange={(e) =>
                        setTplForm((p) => ({ ...p, widthMm: Number(e.target.value) || 100 }))
                      }
                      className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                    />
                    <input
                      type="number"
                      min={20}
                      max={300}
                      value={tplForm.heightMm}
                      onChange={(e) =>
                        setTplForm((p) => ({ ...p, heightMm: Number(e.target.value) || 70 }))
                      }
                      className="rounded-lg border border-[#D4DDD1] dark:border-[#2B382E] bg-white dark:bg-[#131814] px-3 py-2 text-sm text-[#1B2A1E] dark:text-[#EDF2ED]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowTemplateForm(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    disabled={!tplForm.code.trim() || !tplForm.name.trim() || createTplMut.isPending}
                    onClick={() => createTplMut.mutate()}
                  >
                    {t('common.save', 'Save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('labels.savedTemplates', 'Saved Label Templates')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E1E7DD] dark:border-[#253028] text-xs uppercase text-[#66756A] dark:text-[#96A69B]">
                      <th className="py-2 pr-3">{t('labels.code', 'Code')}</th>
                      <th className="py-2 pr-3">{t('labels.name', 'Name')}</th>
                      <th className="py-2 pr-3">{t('labels.dimensions', 'Size (mm)')}</th>
                      <th className="py-2 pr-3">{t('labels.version', 'Version')}</th>
                      <th className="py-2 pr-3">{t('labels.status', 'Status')}</th>
                      <th className="py-2 text-right">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3EC] dark:divide-[#202922]">
                    {templates.map((tpl) => (
                      <tr key={tpl.id}>
                        <td className="py-2.5 pr-3 font-medium text-[#1B2A1E] dark:text-[#EDF2ED]">
                          {tpl.code}
                        </td>
                        <td className="py-2.5 pr-3">
                          {tpl.name}
                          {tpl.isDefault && (
                            <span className="ml-2 text-xs font-semibold text-[#2E7D32]">
                              (Default)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {tpl.widthMm} × {tpl.heightMm}
                        </td>
                        <td className="py-2.5 pr-3">v{tpl.versionNumber}</td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={tpl.isActive ? 'success' : 'neutral'}>
                            {tpl.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5">
                          {canManageTemplates && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => dupTplMut.mutate(tpl.id)}
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" />
                                {t('labels.duplicate', 'Duplicate')}
                              </Button>
                              {!tpl.isDefault && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    toggleTplMut.mutate({ id: tpl.id, isActive: !tpl.isActive })
                                  }
                                >
                                  {tpl.isActive
                                    ? t('labels.deactivate', 'Deactivate')
                                    : t('labels.activate', 'Activate')}
                                </Button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: LABEL HISTORY */}
      {activeTab === 'history' && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>{t('labels.historyTitle', 'Label Generation & Reprint History')}</CardTitle>
          </CardHeader>
          <CardContent>
            {histLoading ? (
              <p className="py-8 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                {t('common.loading', 'Loading...')}
              </p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#66756A] dark:text-[#96A69B]">
                {t('labels.noHistory', 'No batch labels generated yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E1E7DD] dark:border-[#253028] text-xs uppercase text-[#66756A] dark:text-[#96A69B]">
                      <th className="py-2 pr-3">{t('labels.labelNumber', 'Label #')}</th>
                      <th className="py-2 pr-3">{t('labels.batchAndProduct', 'Batch / Product')}</th>
                      <th className="py-2 pr-3">{t('labels.template', 'Template')}</th>
                      <th className="py-2 pr-3">{t('labels.type', 'Type')}</th>
                      <th className="py-2 pr-3">{t('labels.copies', 'Copies')}</th>
                      <th className="py-2 pr-3">{t('labels.generatedAt', 'Generated At')}</th>
                      <th className="py-2 text-right">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3EC] dark:divide-[#202922]">
                    {history.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-2.5 pr-3 font-medium text-[#1B2A1E] dark:text-[#EDF2ED]">
                          {rec.labelNumber}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{rec.labelSnapshot.batchNumber}</div>
                          <div className="text-xs text-[#66756A] dark:text-[#96A69B]">
                            {rec.labelSnapshot.productName}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {rec.template?.name ?? rec.templateId} (v{rec.templateVersionNumber})
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge
                            variant={rec.generationType === 'ORIGINAL' ? 'success' : 'info'}
                          >
                            {rec.generationType}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3">{rec.copies}</td>
                        <td className="py-2.5 pr-3 text-[#66756A] dark:text-[#96A69B]">
                          {formatDate(rec.generatedAt)}
                        </td>
                        <td className="py-2.5 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => labelsService.downloadPdf(rec.id, rec.labelNumber)}
                          >
                            <FileDown className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                          {canGenerate && (
                            <Button
                              size="sm"
                              disabled={reprintMut.isPending}
                              onClick={() => reprintMut.mutate(rec.id)}
                            >
                              {t('labels.reprint', 'Reprint')}
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
      )}
    </div>
  );
};
