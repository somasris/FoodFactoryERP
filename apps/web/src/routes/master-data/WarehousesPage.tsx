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
import { Warehouse } from '../../types/master-data';

export const WarehousesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('warehouses.create');
  const canUpdate = hasPermission('warehouses.update');

  const [typeFilter, setTypeFilter] = useState('');
  const list = useMasterDataList<Warehouse>(
    'warehouses',
    masterDataService.warehouses,
    typeFilter ? { warehouseType: typeFilter } : {},
  );

  const { data: factories } = useQuery({
    queryKey: ['factories-all'],
    queryFn: async () => (await masterDataService.factories.list()).data!,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [viewing, setViewing] = useState<Warehouse | null>(null);
  const [toggling, setToggling] = useState<Warehouse | null>(null);

  const [factoryId, setFactoryId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [warehouseType, setWarehouseType] = useState<Warehouse['warehouseType']>('GENERAL');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFactoryId(factories?.[0]?.id || '');
    setCode('');
    setName('');
    setWarehouseType('GENERAL');
    setAddress('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: Warehouse) => {
    setEditing(row);
    setFactoryId(row.factoryId);
    setCode(row.code);
    setName(row.name);
    setWarehouseType(row.warehouseType);
    setAddress(row.address || '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!factoryId || !code.trim() || !name.trim()) {
      setFormError('Factory, code, and name are required.');
      return;
    }

    try {
      const payload = {
        factoryId,
        code: code.trim(),
        name: name.trim(),
        warehouseType,
        address: address.trim() || null,
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
        title="Warehouses"
        subtitle="Scoped physical storage facilities for raw materials, packaging, and finished goods."
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
            aria-label="Filter by warehouse type"
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              list.setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="PACKAGING">Packaging</option>
            <option value="FINISHED_GOODS">Finished Goods</option>
            <option value="GENERAL">General</option>
            <option value="SCRAP_DAMAGED">Scrap / Damaged</option>
          </select>
        }
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreate}
        createLabel="New Warehouse"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Name', render: r => r.name },
          { header: 'Type', render: r => r.warehouseType.replace(/_/g, ' ') },
          { header: 'Factory', render: r => r.factory?.name || '—' },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Warehouse' : 'Create Warehouse'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <FormField label="Factory" required>
            <select
              className={inputClassName}
              value={factoryId}
              onChange={e => setFactoryId(e.target.value)}
            >
              <option value="">Select Factory</option>
              {factories?.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Warehouse Code" required>
            <input
              className={inputClassName}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. WH-RM-02"
            />
          </FormField>
          <FormField label="Warehouse Name" required>
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Warehouse Type" required>
            <select
              className={inputClassName}
              value={warehouseType}
              onChange={e => setWarehouseType(e.target.value as Warehouse['warehouseType'])}
            >
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="PACKAGING">Packaging</option>
              <option value="FINISHED_GOODS">Finished Goods</option>
              <option value="GENERAL">General</option>
              <option value="SCRAP_DAMAGED">Scrap / Damaged</option>
            </select>
          </FormField>
          <FormField label="Address / Location">
            <textarea
              className={inputClassName}
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Warehouse Details"
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
              <dt className="text-xs text-slate-500">Type</dt>
              <dd>{viewing.warehouseType}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Factory</dt>
              <dd>{viewing.factory?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Address</dt>
              <dd>{viewing.address || '—'}</dd>
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
        title={toggling?.isActive ? 'Deactivate Warehouse' : 'Activate Warehouse'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
      />
    </>
  );
};
