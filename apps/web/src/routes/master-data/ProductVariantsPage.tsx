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
import { ProductVariant } from '../../types/master-data';

export const ProductVariantsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const [productFilter, setProductFilter] = useState('');
  const list = useMasterDataList<ProductVariant>(
    'product-variants',
    masterDataService.productVariants,
    productFilter ? { productId: productFilter } : {},
  );

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => (await masterDataService.products.list({ limit: 100 })).data!.items,
  });
  const { data: uoms } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: async () => (await masterDataService.uoms.list({ limit: 100 })).data!.items,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [viewing, setViewing] = useState<ProductVariant | null>(null);
  const [toggling, setToggling] = useState<ProductVariant | null>(null);

  const [productId, setProductId] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [netWeightGrams, setNetWeightGrams] = useState('');
  const [uomId, setUomId] = useState('');
  const [defaultSellingPrice, setDefaultSellingPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setProductId(products?.find(p => p.isActive)?.id || '');
    setSku('');
    setName('');
    setNetWeightGrams('');
    setUomId(uoms?.find(u => u.isActive)?.id || '');
    setDefaultSellingPrice('');
    setBarcode('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: ProductVariant) => {
    setEditing(row);
    setProductId(row.productId);
    setSku(row.sku);
    setName(row.name);
    setNetWeightGrams(row.netWeightGrams);
    setUomId(row.uomId);
    setDefaultSellingPrice(row.defaultSellingPrice);
    setBarcode(row.barcode || '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!productId || !sku.trim() || !name.trim() || !netWeightGrams || !uomId || !defaultSellingPrice) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        productId,
        sku: sku.trim(),
        name: name.trim(),
        netWeightGrams,
        uomId,
        defaultSellingPrice,
        barcode: barcode.trim() || null,
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
        title="Product Variants (SKUs)"
        subtitle="Sellable pack sizes, net weights, barcodes, and default selling prices."
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
            aria-label="Filter by product"
            value={productFilter}
            onChange={e => {
              setProductFilter(e.target.value);
              list.setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Products</option>
            {products?.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreate}
        createLabel="New Variant"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'SKU', render: r => <span className="font-mono font-medium">{r.sku}</span> },
          { header: 'Variant Name', render: r => r.name },
          { header: 'Product', render: r => r.product?.name || '—' },
          { header: 'Net Weight (g)', render: r => r.netWeightGrams },
          { header: 'Selling Price', render: r => `₹${r.defaultSellingPrice}` },
          { header: 'UoM', render: r => r.uom?.code || '—' },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Product Variant' : 'Create Product Variant'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Parent Product" required>
              <select
                className={inputClassName}
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="">Select Product</option>
                {products
                  ?.filter(p => p.isActive || p.id === productId)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="SKU" required>
              <input
                className={inputClassName}
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="e.g. SKU-MUR-200G"
              />
            </FormField>
            <FormField label="Variant Name" required>
              <input
                className={inputClassName}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Butter Murukku 200g Pouch"
              />
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
            <FormField label="Net Weight (grams)" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={netWeightGrams}
                onChange={e => setNetWeightGrams(e.target.value)}
              />
            </FormField>
            <FormField label="Default Selling Price (₹)" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={defaultSellingPrice}
                onChange={e => setDefaultSellingPrice(e.target.value)}
              />
            </FormField>
            <FormField label="Barcode">
              <input
                className={inputClassName}
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="Optional EAN/UPC"
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={list.createMutation.isPending || list.updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Variant'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Variant Details">
        {viewing && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">SKU</dt>
              <dd className="font-mono font-medium">{viewing.sku}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd>{viewing.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Product</dt>
              <dd>{viewing.product?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Net Weight (g)</dt>
              <dd>{viewing.netWeightGrams} g</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Default Selling Price</dt>
              <dd>₹{viewing.defaultSellingPrice}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Barcode</dt>
              <dd className="font-mono">{viewing.barcode || '—'}</dd>
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
        title={toggling?.isActive ? 'Deactivate Variant' : 'Activate Variant'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
