import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTablePage, StatusBadge } from '../../components/master-data/DataTablePage';
import {
  ConfirmDialog,
  FormField,
  Modal,
  inputClassName,
} from '../../components/master-data/Modal';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useMasterDataList } from '../../hooks/useMasterDataList';
import { masterDataService } from '../../services/master-data.service';
import { RawMaterial } from '../../types/master-data';

export const RawMaterialsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const [materialTypeFilter, setMaterialTypeFilter] = useState('');
  const list = useMasterDataList<RawMaterial>(
    'raw-materials',
    masterDataService.rawMaterials,
    materialTypeFilter ? { materialType: materialTypeFilter } : {},
  );

  const { data: categories } = useQuery({
    queryKey: ['rm-categories-all'],
    queryFn: async () =>
      (await masterDataService.rawMaterialCategories.list({ limit: 100 })).data!.items,
  });
  const { data: uoms } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: async () => (await masterDataService.uoms.list({ limit: 100 })).data!.items,
  });
  const { data: taxRates } = useQuery({
    queryKey: ['tax-rates-all'],
    queryFn: async () => (await masterDataService.taxRates.list({ limit: 100 })).data!.items,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [viewing, setViewing] = useState<RawMaterial | null>(null);
  const [toggling, setToggling] = useState<RawMaterial | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [materialType, setMaterialType] =
    useState<RawMaterial['materialType']>('RAW_INGREDIENT');
  const [uomId, setUomId] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [taxRateId, setTaxRateId] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('0');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setCategoryId(categories?.find(c => c.isActive)?.id || '');
    setMaterialType('RAW_INGREDIENT');
    setUomId(uoms?.find(u => u.isActive)?.id || '');
    setHsnCode('');
    setTaxRateId(taxRates?.find(t => t.isActive)?.id || '');
    setMinStockAlert('0');
    setReorderQuantity('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: RawMaterial) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description || '');
    setCategoryId(row.categoryId);
    setMaterialType(row.materialType);
    setUomId(row.uomId);
    setHsnCode(row.hsnCode);
    setTaxRateId(row.taxRateId);
    setMinStockAlert(row.minStockAlert);
    setReorderQuantity(row.reorderQuantity || '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !name.trim() || !categoryId || !uomId || !hsnCode.trim() || !taxRateId) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        categoryId,
        materialType,
        uomId,
        hsnCode: hsnCode.trim(),
        taxRateId,
        minStockAlert: minStockAlert || '0',
        reorderQuantity: reorderQuantity ? reorderQuantity : null,
      };
      if (editing) {
        await list.updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        await list.createMutation.mutateAsync(payload);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  return (
    <>
      <DataTablePage
        title="Raw Materials & Packaging"
        subtitle="Ingredients, primary films, and secondary cartons used in production."
        items={list.items}
        pagination={list.pagination}
        isLoading={list.isLoading}
        error={list.error}
        search={list.search}
        onSearchChange={list.setSearch}
        statusFilter={list.statusFilter}
        onStatusFilterChange={list.setStatusFilter}
        extraFilters={
          <select
            aria-label="Filter by material type"
            value={materialTypeFilter}
            onChange={e => {
              setMaterialTypeFilter(e.target.value);
              list.setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Types</option>
            <option value="RAW_INGREDIENT">Raw Ingredient</option>
            <option value="PACKAGING_PRIMARY">Primary Packaging</option>
            <option value="PACKAGING_SECONDARY">Secondary Packaging</option>
          </select>
        }
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreate}
        createLabel="New Material"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Name', render: r => r.name },
          { header: 'Type', render: r => r.materialType.replace(/_/g, ' ') },
          { header: 'Category', render: r => r.category?.name || '—' },
          { header: 'UoM', render: r => r.uom?.code || '—' },
          { header: 'Tax', render: r => r.taxRate?.name || '—' },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Raw Material' : 'Create Raw Material'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Material Code" required>
              <input
                className={inputClassName}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. RM-RICEFLOUR"
              />
            </FormField>
            <FormField label="Material Name" required>
              <input
                className={inputClassName}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Fine Rice Flour"
              />
            </FormField>
            <FormField label="Category" required>
              <select
                className={inputClassName}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">Select category</option>
                {categories
                  ?.filter(c => c.isActive || c.id === categoryId)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Material Type" required>
              <select
                className={inputClassName}
                value={materialType}
                onChange={e => setMaterialType(e.target.value as RawMaterial['materialType'])}
              >
                <option value="RAW_INGREDIENT">Raw Ingredient</option>
                <option value="PACKAGING_PRIMARY">Primary Packaging</option>
                <option value="PACKAGING_SECONDARY">Secondary Packaging</option>
              </select>
            </FormField>
            <FormField label="Unit of Measure" required>
              <select
                className={inputClassName}
                value={uomId}
                onChange={e => setUomId(e.target.value)}
              >
                <option value="">Select UoM</option>
                {uoms
                  ?.filter(u => u.isActive || u.id === uomId)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="HSN Code" required>
              <input
                className={inputClassName}
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                placeholder="e.g. 110290"
              />
            </FormField>
            <FormField label="Tax Rate" required>
              <select
                className={inputClassName}
                value={taxRateId}
                onChange={e => setTaxRateId(e.target.value)}
              >
                <option value="">Select Tax Rate</option>
                {taxRates
                  ?.filter(t => t.isActive || t.id === taxRateId)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.ratePercentage}%)
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Min Stock Alert">
              <input
                type="number"
                step="0.0001"
                className={inputClassName}
                value={minStockAlert}
                onChange={e => setMinStockAlert(e.target.value)}
              />
            </FormField>
            <FormField label="Reorder Quantity">
              <input
                type="number"
                step="0.0001"
                className={inputClassName}
                value={reorderQuantity}
                onChange={e => setReorderQuantity(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              className={inputClassName}
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={list.createMutation.isPending || list.updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Material'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Raw Material Details">
        {viewing && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Code</dt>
              <dd className="font-mono font-medium">{viewing.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd>{viewing.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd>{viewing.materialType}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Category</dt>
              <dd>{viewing.category?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">UoM</dt>
              <dd>{viewing.uom?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">HSN / Tax</dt>
              <dd>
                {viewing.hsnCode} ({viewing.taxRate?.name})
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Min Stock Alert</dt>
              <dd>{viewing.minStockAlert}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reorder Qty</dt>
              <dd>{viewing.reorderQuantity || '—'}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          await list.statusMutation.mutateAsync({ id: toggling.id, isActive: !toggling.isActive });
          setToggling(null);
        }}
        isLoading={list.statusMutation.isPending}
        title={toggling?.isActive ? 'Deactivate Raw Material' : 'Activate Raw Material'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
