import React, { useState } from 'react';
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
import { CategoryEntity } from '../../types/master-data';

interface CategoryMasterPageProps {
  kind: 'product' | 'rawMaterial';
}

export const CategoryMasterPage: React.FC<CategoryMasterPageProps> = ({ kind }) => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const api =
    kind === 'product'
      ? masterDataService.productCategories
      : masterDataService.rawMaterialCategories;
  const title = kind === 'product' ? 'Product Categories' : 'Raw Material Categories';
  const list = useMasterDataList<CategoryEntity>(`categories-${kind}`, api);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryEntity | null>(null);
  const [viewing, setViewing] = useState<CategoryEntity | null>(null);
  const [toggling, setToggling] = useState<CategoryEntity | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: CategoryEntity) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description || '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !name.trim()) {
      setFormError('Code and Name are required.');
      return;
    }

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
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

  const handleConfirmToggle = async () => {
    if (!toggling) return;
    await list.statusMutation.mutateAsync({ id: toggling.id, isActive: !toggling.isActive });
    setToggling(null);
  };

  return (
    <>
      <DataTablePage
        title={title}
        subtitle="Organize items into standardized classification groups."
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
        onCreate={openCreate}
        createLabel="New Category"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Name', render: r => r.name },
          {
            header: 'Description',
            render: r => <span className="text-slate-500">{r.description || '—'}</span>,
          },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${title.slice(0, -1)}` : `Create ${title.slice(0, -1)}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <FormField label="Category Code" required>
            <input
              className={inputClassName}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. SNACKS"
              maxLength={20}
            />
          </FormField>
          <FormField label="Category Name" required>
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Traditional Snacks"
              maxLength={100}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              className={inputClassName}
              rows={3}
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
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Category Details"
        maxWidth="max-w-md"
      >
        {viewing && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Code</dt>
              <dd className="font-mono font-medium">{viewing.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd>{viewing.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Description</dt>
              <dd>{viewing.description || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>
                <StatusBadge isActive={viewing.isActive} />
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={handleConfirmToggle}
        isLoading={list.statusMutation.isPending}
        title={toggling?.isActive ? 'Deactivate Category' : 'Activate Category'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
