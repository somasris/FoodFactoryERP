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
import { UnitOfMeasure } from '../../types/master-data';

export const UomsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const list = useMasterDataList<UnitOfMeasure>('uoms', masterDataService.uoms);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null);
  const [viewing, setViewing] = useState<UnitOfMeasure | null>(null);
  const [toggling, setToggling] = useState<UnitOfMeasure | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [category, setCategory] = useState('WEIGHT');
  const [isBaseUnit, setIsBaseUnit] = useState(false);
  const [decimalPlaces, setDecimalPlaces] = useState('2');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setSymbol('');
    setCategory('WEIGHT');
    setIsBaseUnit(false);
    setDecimalPlaces('2');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: UnitOfMeasure) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setSymbol(row.symbol);
    setCategory(row.category);
    setIsBaseUnit(row.isBaseUnit);
    setDecimalPlaces(String(row.decimalPlaces));
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !name.trim() || !symbol.trim()) {
      setFormError('Code, name, and symbol are required.');
      return;
    }

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        symbol: symbol.trim(),
        category: category.trim(),
        isBaseUnit,
        decimalPlaces: Number(decimalPlaces) || 0,
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
        title="Units of Measurement"
        subtitle="Standardized weight, volume, and count units."
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
        createLabel="New Unit"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Name', render: r => r.name },
          { header: 'Symbol', render: r => r.symbol },
          { header: 'Dimension', render: r => r.category },
          { header: 'Base Unit', render: r => (r.isBaseUnit ? 'Yes' : 'No') },
          { header: 'Decimals', render: r => r.decimalPlaces },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Unit of Measure' : 'Create Unit of Measure'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <FormField label="Code" required>
            <input
              className={inputClassName}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. KG"
              maxLength={10}
            />
          </FormField>
          <FormField label="Name" required>
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Kilogram"
            />
          </FormField>
          <FormField label="Symbol" required>
            <input
              className={inputClassName}
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="e.g. kg"
              maxLength={10}
            />
          </FormField>
          <FormField label="Category / Dimension" required>
            <select
              className={inputClassName}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="WEIGHT">WEIGHT</option>
              <option value="VOLUME">VOLUME</option>
              <option value="COUNT">COUNT</option>
              <option value="LENGTH">LENGTH</option>
              <option value="GENERAL">GENERAL</option>
            </select>
          </FormField>
          <FormField label="Decimal Places">
            <input
              type="number"
              min={0}
              max={6}
              className={inputClassName}
              value={decimalPlaces}
              onChange={e => setDecimalPlaces(e.target.value)}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isBaseUnit}
              onChange={e => setIsBaseUnit(e.target.checked)}
            />
            Base unit for this dimension
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={list.createMutation.isPending || list.updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Unit Details"
        maxWidth="max-w-md"
      >
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
              <dt className="text-xs text-slate-500">Symbol</dt>
              <dd>{viewing.symbol}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dimension</dt>
              <dd>{viewing.category}</dd>
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
        title={toggling?.isActive ? 'Deactivate Unit' : 'Activate Unit'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.name}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
