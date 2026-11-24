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
import { UnitConversion } from '../../types/master-data';

export const UnitConversionsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const list = useMasterDataList<UnitConversion>(
    'unit-conversions',
    masterDataService.unitConversions,
  );
  const { data: uoms } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: async () => (await masterDataService.uoms.list({ limit: 100 })).data!.items,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitConversion | null>(null);
  const [viewing, setViewing] = useState<UnitConversion | null>(null);
  const [toggling, setToggling] = useState<UnitConversion | null>(null);

  const [fromUomId, setFromUomId] = useState('');
  const [toUomId, setToUomId] = useState('');
  const [multiplier, setMultiplier] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFromUomId(uoms?.[0]?.id || '');
    setToUomId(uoms?.[1]?.id || '');
    setMultiplier('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: UnitConversion) => {
    setEditing(row);
    setFromUomId(row.fromUomId);
    setToUomId(row.toUomId);
    setMultiplier(row.multiplier);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fromUomId || !toUomId || !multiplier) {
      setFormError('All fields are required.');
      return;
    }

    try {
      if (editing) {
        await list.updateMutation.mutateAsync({ id: editing.id, payload: { multiplier } });
      } else {
        await list.createMutation.mutateAsync({ fromUomId, toUomId, multiplier });
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  return (
    <>
      <DataTablePage
        title="Unit Conversions"
        subtitle="High-precision decimal conversion multipliers between compatible units."
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
        createLabel="New Conversion"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          {
            header: 'From Unit',
            render: r => `${r.fromUom?.name || r.fromUomId} (${r.fromUom?.code || ''})`,
          },
          {
            header: 'To Unit',
            render: r => `${r.toUom?.name || r.toUomId} (${r.toUom?.code || ''})`,
          },
          {
            header: 'Multiplier',
            render: r => <span className="font-mono font-medium">{r.multiplier}</span>,
          },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Unit Conversion' : 'Create Unit Conversion'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <FormField label="From Unit" required>
            <select
              className={inputClassName}
              value={fromUomId}
              disabled={!!editing}
              onChange={e => setFromUomId(e.target.value)}
            >
              <option value="">Select unit</option>
              {uoms?.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code}) [{u.category}]
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="To Unit" required>
            <select
              className={inputClassName}
              value={toUomId}
              disabled={!!editing}
              onChange={e => setToUomId(e.target.value)}
            >
              <option value="">Select unit</option>
              {uoms?.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code}) [{u.category}]
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Multiplier (1 From = Multiplier × To)" required>
            <input
              type="number"
              step="0.000001"
              className={inputClassName}
              value={multiplier}
              onChange={e => setMultiplier(e.target.value)}
              placeholder="e.g. 1000.000000"
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
              {editing ? 'Save Changes' : 'Create Conversion'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Conversion Details"
        maxWidth="max-w-md"
      >
        {viewing && (
          <p className="text-sm text-slate-700">
            1 <span className="font-mono font-semibold">{viewing.fromUom?.code}</span> ={' '}
            <span className="font-mono font-semibold">{viewing.multiplier}</span>{' '}
            <span className="font-mono font-semibold">{viewing.toUom?.code}</span>
          </p>
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
        title={toggling?.isActive ? 'Deactivate Conversion' : 'Activate Conversion'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} this conversion rule?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
