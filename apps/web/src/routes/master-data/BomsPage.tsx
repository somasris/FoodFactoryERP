import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { DataTablePage, StatusBadge } from '../../components/master-data/DataTablePage';
import {
  ConfirmDialog,
  FormField,
  Modal,
  inputClassName,
} from '../../components/master-data/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useMasterDataList } from '../../hooks/useMasterDataList';
import { masterDataService } from '../../services/master-data.service';
import { BOM, BOMVersion } from '../../types/master-data';

interface DraftItemRow {
  inventoryItemId: string;
  standardQuantity: string;
  uomId: string;
  scrapTolerancePercent: string;
}

interface DraftOverheadRow {
  costType: 'LABOUR' | 'UTILITY' | 'MACHINE_DEPRECIATION' | 'DIRECT_OVERHEAD';
  description: string;
  standardAmount: string;
}

export const BomsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('bom.create');
  const canUpdate = hasPermission('bom.update');
  const canApprove = hasPermission('bom.approve');

  const list = useMasterDataList<BOM>('boms', masterDataService.boms);

  const { data: variants } = useQuery({
    queryKey: ['variants-all'],
    queryFn: async () => (await masterDataService.productVariants.list({ limit: 100 })).data!.items,
  });
  const { data: uoms } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: async () => (await masterDataService.uoms.list({ limit: 100 })).data!.items,
  });
  const { data: invItems } = useQuery({
    queryKey: ['inv-items-all'],
    queryFn: async () => (await masterDataService.inventoryItems.list({ limit: 100 })).data!.items,
  });

  // BOM Detail Modal
  const [detailBomId, setDetailBomId] = useState<string | null>(null);
  const { data: detailBom, refetch: refetchDetail } = useQuery({
    queryKey: ['bom-detail', detailBomId],
    enabled: !!detailBomId,
    queryFn: async () => (await masterDataService.boms.getById(detailBomId!)).data!,
  });

  // Create BOM Header + v1 Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [bomCode, setBomCode] = useState('');
  const [bomName, setBomName] = useState('');
  const [productVariantId, setProductVariantId] = useState('');
  const [baseOutputQty, setBaseOutputQty] = useState('100');
  const [outputUomId, setOutputUomId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Version Form Modal (Create New Version or Edit Draft Version)
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<BOMVersion | null>(null);
  const [expectedGoodOutput, setExpectedGoodOutput] = useState('100');
  const [verOutputUomId, setVerOutputUomId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<DraftItemRow[]>([]);
  const [overheads, setOverheads] = useState<DraftOverheadRow[]>([]);
  const [verError, setVerError] = useState<string | null>(null);

  const [toggling, setToggling] = useState<BOM | null>(null);
  const [activatingVer, setActivatingVer] = useState<BOMVersion | null>(null);

  const openCreateBom = () => {
    setBomCode('');
    setBomName('');
    setProductVariantId(variants?.find(v => v.isActive)?.id || '');
    setBaseOutputQty('100');
    const defaultUom = uoms?.find(u => u.isActive)?.id || '';
    setOutputUomId(defaultUom);
    setItems([
      {
        inventoryItemId: invItems?.find(i => i.isActive)?.id || '',
        standardQuantity: '1',
        uomId: defaultUom,
        scrapTolerancePercent: '0',
      },
    ]);
    setOverheads([]);
    setFormError(null);
    setCreateOpen(true);
  };

  const handleCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await list.createMutation.mutateAsync({
        productVariantId,
        code: bomCode.trim(),
        name: bomName.trim(),
        baseOutputQuantity: baseOutputQty,
        outputUomId,
        initialVersion: {
          expectedGoodOutput: baseOutputQty,
          outputUomId,
          items,
          overheads,
        },
      });
      setCreateOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create BOM');
    }
  };

  const openNewVersion = (bom: BOM) => {
    setEditingVersion(null);
    setExpectedGoodOutput(bom.baseOutputQuantity);
    setVerOutputUomId(bom.outputUomId);
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setRemarks('');
    setItems([
      {
        inventoryItemId: invItems?.find(i => i.isActive)?.id || '',
        standardQuantity: '1',
        uomId: uoms?.find(u => u.isActive)?.id || '',
        scrapTolerancePercent: '0',
      },
    ]);
    setOverheads([]);
    setVerError(null);
    setVersionModalOpen(true);
  };

  const openEditDraftVersion = (ver: BOMVersion) => {
    setEditingVersion(ver);
    setExpectedGoodOutput(ver.expectedGoodOutput);
    setVerOutputUomId(ver.outputUomId);
    setEffectiveFrom(ver.effectiveFrom.slice(0, 10));
    setRemarks(ver.remarks || '');
    setItems(
      (ver.items || []).map(i => ({
        inventoryItemId: i.inventoryItemId,
        standardQuantity: i.standardQuantity,
        uomId: i.uomId,
        scrapTolerancePercent: i.scrapTolerancePercent,
      })),
    );
    setOverheads(
      (ver.overheads || []).map(o => ({
        costType: o.costType,
        description: o.description,
        standardAmount: o.standardAmount,
      })),
    );
    setVerError(null);
    setVersionModalOpen(true);
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailBomId) return;
    setVerError(null);
    try {
      const payload = {
        expectedGoodOutput,
        outputUomId: verOutputUomId,
        effectiveFrom,
        remarks: remarks.trim() || null,
        items,
        overheads,
      };
      if (editingVersion) {
        await masterDataService.boms.updateVersion(detailBomId, editingVersion.id, payload);
      } else {
        await masterDataService.boms.createVersion(detailBomId, payload);
      }
      setVersionModalOpen(false);
      await refetchDetail();
      await queryClient.invalidateQueries({ queryKey: ['boms'] });
    } catch (err) {
      setVerError(err instanceof Error ? err.message : 'Failed to save BOM version');
    }
  };

  const handleActivateVersion = async () => {
    if (!detailBomId || !activatingVer) return;
    await masterDataService.boms.activateVersion(detailBomId, activatingVer.id);
    setActivatingVer(null);
    await refetchDetail();
    await queryClient.invalidateQueries({ queryKey: ['boms'] });
  };

  const renderItemsEditor = () => (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-slate-500">Components</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setItems([
              ...items,
              {
                inventoryItemId: invItems?.[0]?.id || '',
                standardQuantity: '1',
                uomId: uoms?.[0]?.id || '',
                scrapTolerancePercent: '0',
              },
            ])
          }
        >
          <Plus className="mr-1 h-3 w-3" /> Add Item
        </Button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <FormField label="Material / Component">
              <select
                className={inputClassName}
                value={item.inventoryItemId}
                onChange={e => {
                  const next = [...items];
                  next[idx].inventoryItemId = e.target.value;
                  setItems(next);
                }}
              >
                <option value="">Select item</option>
                {invItems?.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.code})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Qty">
              <input
                type="number"
                step="0.0001"
                className={inputClassName}
                value={item.standardQuantity}
                onChange={e => {
                  const next = [...items];
                  next[idx].standardQuantity = e.target.value;
                  setItems(next);
                }}
              />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="UoM">
              <select
                className={inputClassName}
                value={item.uomId}
                onChange={e => {
                  const next = [...items];
                  next[idx].uomId = e.target.value;
                  setItems(next);
                }}
              >
                {uoms?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Scrap %">
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={item.scrapTolerancePercent}
                onChange={e => {
                  const next = [...items];
                  next[idx].scrapTolerancePercent = e.target.value;
                  setItems(next);
                }}
              />
            </FormField>
          </div>
          <div className="col-span-1">
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Production Overheads
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setOverheads([
              ...overheads,
              { costType: 'LABOUR', description: '', standardAmount: '0' },
            ])
          }
        >
          <Plus className="mr-1 h-3 w-3" /> Add Overhead
        </Button>
      </div>
      {overheads.map((oh, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <FormField label="Cost Type">
              <select
                className={inputClassName}
                value={oh.costType}
                onChange={e => {
                  const next = [...overheads];
                  next[idx].costType = e.target.value as DraftOverheadRow['costType'];
                  setOverheads(next);
                }}
              >
                <option value="LABOUR">Labour</option>
                <option value="UTILITY">Utility</option>
                <option value="MACHINE_DEPRECIATION">Machine Depreciation</option>
                <option value="DIRECT_OVERHEAD">Direct Overhead</option>
              </select>
            </FormField>
          </div>
          <div className="col-span-5">
            <FormField label="Description">
              <input
                className={inputClassName}
                value={oh.description}
                onChange={e => {
                  const next = [...overheads];
                  next[idx].description = e.target.value;
                  setOverheads(next);
                }}
              />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Amount (₹)">
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={oh.standardAmount}
                onChange={e => {
                  const next = [...overheads];
                  next[idx].standardAmount = e.target.value;
                  setOverheads(next);
                }}
              />
            </FormField>
          </div>
          <div className="col-span-1">
            <button
              type="button"
              onClick={() => setOverheads(overheads.filter((_, i) => i !== idx))}
              className="p-2 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <DataTablePage
        title="Bills of Materials (BOM)"
        subtitle="Versioned recipes, component quantities, and standard production overheads."
        items={list.items}
        pagination={list.pagination}
        isLoading={list.isLoading}
        error={list.error}
        search={list.search}
        onSearchChange={list.setSearch}
        statusFilter={list.statusFilter}
        onStatusFilterChange={list.setStatusFilter}
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreateBom}
        createLabel="New BOM"
        onView={row => setDetailBomId(row.id)}
        canUpdate={canUpdate}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Recipe Name', render: r => r.name },
          { header: 'Product Variant', render: r => r.productVariant?.sku || '—' },
          {
            header: 'Base Output',
            render: r => `${r.baseOutputQuantity} ${r.outputUom?.code || ''}`,
          },
          {
            header: 'Versions',
            render: r => {
              const active = r.versions?.find(v => v.status === 'ACTIVE');
              return active ? (
                <Badge variant="teal">v{active.versionNumber} Active</Badge>
              ) : (
                <Badge variant="outline">{r.versions?.length || 0} Draft/Obs</Badge>
              );
            },
          },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      {/* Create BOM Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Bill of Materials"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateBom} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="BOM Code" required>
              <input
                className={inputClassName}
                value={bomCode}
                onChange={e => setBomCode(e.target.value)}
                placeholder="e.g. BOM-MUR-200G"
              />
            </FormField>
            <FormField label="Recipe Name" required>
              <input
                className={inputClassName}
                value={bomName}
                onChange={e => setBomName(e.target.value)}
              />
            </FormField>
            <FormField label="Product Variant" required>
              <select
                className={inputClassName}
                value={productVariantId}
                onChange={e => setProductVariantId(e.target.value)}
              >
                <option value="">Select Variant</option>
                {variants
                  ?.filter(v => v.isActive)
                  .map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.sku})
                    </option>
                  ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Base Output Qty" required>
                <input
                  type="number"
                  step="0.0001"
                  className={inputClassName}
                  value={baseOutputQty}
                  onChange={e => setBaseOutputQty(e.target.value)}
                />
              </FormField>
              <FormField label="Output UoM" required>
                <select
                  className={inputClassName}
                  value={outputUomId}
                  onChange={e => setOutputUomId(e.target.value)}
                >
                  {uoms?.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.code}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
          {renderItemsEditor()}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create BOM (v1 Draft)</Button>
          </div>
        </form>
      </Modal>

      {/* BOM Detail & Version History Modal */}
      <Modal
        isOpen={!!detailBomId}
        onClose={() => setDetailBomId(null)}
        title={detailBom ? `BOM: ${detailBom.name} (${detailBom.code})` : 'BOM Details'}
        maxWidth="max-w-4xl"
      >
        {detailBom && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-3 text-sm">
              <div>
                <span className="text-slate-500">Target Variant:</span>{' '}
                <span className="font-medium">{detailBom.productVariant?.name}</span> (
                <span className="font-mono">{detailBom.productVariant?.sku}</span>)
              </div>
              {canCreate && (
                <Button type="button" size="sm" onClick={() => openNewVersion(detailBom)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> New Version
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {detailBom.versions?.map(ver => (
                <div key={ver.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-navy">
                        Version v{ver.versionNumber}
                      </span>
                      <Badge
                        variant={
                          ver.status === 'ACTIVE'
                            ? 'teal'
                            : ver.status === 'DRAFT'
                              ? 'warning'
                              : 'outline'
                        }
                      >
                        {ver.status}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Effective: {ver.effectiveFrom.slice(0, 10)}
                        {ver.effectiveTo ? ` to ${ver.effectiveTo.slice(0, 10)}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {ver.status === 'DRAFT' && canUpdate && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDraftVersion(ver)}
                        >
                          Edit Draft
                        </Button>
                      )}
                      {ver.status === 'DRAFT' && canApprove && (
                        <Button
                          type="button"
                          size="sm"
                          variant="teal"
                          onClick={() => setActivatingVer(ver)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activate
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    Expected Good Output: <strong>{ver.expectedGoodOutput}</strong>{' '}
                    {ver.outputUom?.code}
                    {ver.remarks && <span className="ml-3 text-slate-500">({ver.remarks})</span>}
                  </div>

                  {ver.items && ver.items.length > 0 && (
                    <table className="mt-2 w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-2 py-1">Component</th>
                          <th className="px-2 py-1">Type</th>
                          <th className="px-2 py-1">Qty</th>
                          <th className="px-2 py-1">Scrap Tolerance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ver.items.map(it => (
                          <tr key={it.id}>
                            <td className="px-2 py-1">{it.inventoryItem?.name}</td>
                            <td className="px-2 py-1">{it.itemType}</td>
                            <td className="px-2 py-1 font-mono">
                              {it.standardQuantity} {it.uom?.code}
                            </td>
                            <td className="px-2 py-1">{it.scrapTolerancePercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {ver.overheads && ver.overheads.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                      <span className="font-semibold">Overheads:</span>{' '}
                      {ver.overheads
                        .map(o => `${o.costType}: ${o.description} (₹${o.standardAmount})`)
                        .join(' | ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* New / Edit Draft Version Modal */}
      <Modal
        isOpen={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        title={
          editingVersion
            ? `Edit Draft Version v${editingVersion.versionNumber}`
            : 'Create New BOM Version'
        }
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleVersionSubmit} className="space-y-4">
          {verError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{verError}</div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Expected Good Output" required>
              <input
                type="number"
                step="0.0001"
                className={inputClassName}
                value={expectedGoodOutput}
                onChange={e => setExpectedGoodOutput(e.target.value)}
              />
            </FormField>
            <FormField label="Output UoM" required>
              <select
                className={inputClassName}
                value={verOutputUomId}
                onChange={e => setVerOutputUomId(e.target.value)}
              >
                {uoms?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Effective From" required>
              <input
                type="date"
                className={inputClassName}
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Remarks">
            <input
              className={inputClassName}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </FormField>
          {renderItemsEditor()}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setVersionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Version</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!activatingVer}
        onClose={() => setActivatingVer(null)}
        onConfirm={handleActivateVersion}
        title="Activate BOM Version"
        message={`Activating v${activatingVer?.versionNumber} will mark any currently active version as OBSOLETE while preserving historical records. Continue?`}
        confirmLabel="Activate Version"
      />

      <ConfirmDialog
        isOpen={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          await list.statusMutation.mutateAsync({ id: toggling.id, isActive: !toggling.isActive });
          setToggling(null);
        }}
        title={toggling?.isActive ? 'Deactivate BOM' : 'Activate BOM'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
      />
    </>
  );
};
