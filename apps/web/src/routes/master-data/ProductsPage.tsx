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
import { Product } from '../../types/master-data';

export const ProductsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const [categoryFilter, setCategoryFilter] = useState('');
  const list = useMasterDataList<Product>(
    'products',
    masterDataService.products,
    categoryFilter ? { categoryId: categoryFilter } : {},
  );

  const { data: categories } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: async () => (await masterDataService.productCategories.list({ limit: 100 })).data!.items,
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
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [toggling, setToggling] = useState<Product | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUomId, setBaseUomId] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [taxRateId, setTaxRateId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setCategoryId(categories?.find(c => c.isActive)?.id || '');
    setBaseUomId(uoms?.find(u => u.isActive)?.id || '');
    setHsnCode('');
    setTaxRateId(taxRates?.find(t => t.isActive)?.id || '');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: Product) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description || '');
    setCategoryId(row.categoryId);
    setBaseUomId(row.baseUomId);
    setHsnCode(row.hsnCode);
    setTaxRateId(row.taxRateId);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !name.trim() || !categoryId || !baseUomId || !hsnCode.trim() || !taxRateId) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        categoryId,
        baseUomId,
        hsnCode: hsnCode.trim(),
        taxRateId,
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
        title="Products"
        subtitle="Finished food products with HSN codes, tax slabs, and base units."
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
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              list.setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Categories</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreate}
        createLabel="New Product"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Name', render: r => r.name },
          { header: 'Category', render: r => r.category?.name || '—' },
          { header: 'HSN', render: r => <span className="font-mono">{r.hsnCode}</span> },
          { header: 'Tax', render: r => r.taxRate?.name || '—' },
          { header: 'Base UoM', render: r => r.baseUom?.code || '—' },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Product' : 'Create Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Product Code" required>
              <input
                className={inputClassName}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. PRD-MURUKKU"
              />
            </FormField>
            <FormField label="Product Name" required>
              <input
                className={inputClassName}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Butter Murukku"
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
            <FormField label="Base Unit of Measure" required>
              <select
                className={inputClassName}
                value={baseUomId}
                onChange={e => setBaseUomId(e.target.value)}
              >
                <option value="">Select UoM</option>
                {uoms
                  ?.filter(u => u.isActive || u.id === baseUomId)
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
                placeholder="e.g. 21069099"
                maxLength={10}
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
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Product Details">
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
              <dt className="text-xs text-slate-500">Category</dt>
              <dd>{viewing.category?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Base UoM</dt>
              <dd>{viewing.baseUom?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">HSN Code</dt>
              <dd className="font-mono">{viewing.hsnCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Tax Rate</dt>
              <dd>{viewing.taxRate?.name}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Description</dt>
              <dd>{viewing.description || '—'}</dd>
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
        title={toggling?.isActive ? 'Deactivate Product' : 'Activate Product'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
