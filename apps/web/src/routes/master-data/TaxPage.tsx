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
import { TaxConfiguration, TaxRate } from '../../types/master-data';

export const TaxPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');

  const [tab, setTab] = useState<'rates' | 'configs'>('rates');

  const ratesList = useMasterDataList<TaxRate>('tax-rates', masterDataService.taxRates);
  const configsList = useMasterDataList<TaxConfiguration>(
    'tax-configurations',
    masterDataService.taxConfigurations,
  );
  const { data: allTaxRates } = useQuery({
    queryKey: ['tax-rates-all'],
    queryFn: async () => (await masterDataService.taxRates.list({ limit: 100 })).data!.items,
  });

  // Tax Rate Form State
  const [rateModal, setRateModal] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [togglingRate, setTogglingRate] = useState<TaxRate | null>(null);
  const [rateCode, setRateCode] = useState('');
  const [rateName, setRateName] = useState('');
  const [ratePct, setRatePct] = useState('');
  const [cgstPct, setCgstPct] = useState('');
  const [sgstPct, setSgstPct] = useState('');
  const [igstPct, setIgstPct] = useState('');
  const [rateError, setRateError] = useState<string | null>(null);

  // Tax Config Form State
  const [cfgModal, setCfgModal] = useState(false);
  const [editingCfg, setEditingCfg] = useState<TaxConfiguration | null>(null);
  const [togglingCfg, setTogglingCfg] = useState<TaxConfiguration | null>(null);
  const [hsnCode, setHsnCode] = useState('');
  const [cfgDesc, setCfgDesc] = useState('');
  const [cfgTaxRateId, setCfgTaxRateId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [cfgError, setCfgError] = useState<string | null>(null);

  const openCreateRate = () => {
    setEditingRate(null);
    setRateCode('');
    setRateName('');
    setRatePct('5.00');
    setCgstPct('2.50');
    setSgstPct('2.50');
    setIgstPct('5.00');
    setRateError(null);
    setRateModal(true);
  };

  const openEditRate = (r: TaxRate) => {
    setEditingRate(r);
    setRateCode(r.code);
    setRateName(r.name);
    setRatePct(r.ratePercentage);
    setCgstPct(r.cgstPercentage);
    setSgstPct(r.sgstPercentage);
    setIgstPct(r.igstPercentage);
    setRateError(null);
    setRateModal(true);
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError(null);
    try {
      const payload = {
        code: rateCode.trim(),
        name: rateName.trim(),
        ratePercentage: ratePct,
        cgstPercentage: cgstPct,
        sgstPercentage: sgstPct,
        igstPercentage: igstPct,
      };
      if (editingRate) {
        await ratesList.updateMutation.mutateAsync({ id: editingRate.id, payload });
      } else {
        await ratesList.createMutation.mutateAsync(payload);
      }
      setRateModal(false);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const openCreateCfg = () => {
    setEditingCfg(null);
    setHsnCode('');
    setCfgDesc('');
    setCfgTaxRateId(allTaxRates?.find(t => t.isActive)?.id || '');
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setEffectiveTo('');
    setCfgError(null);
    setCfgModal(true);
  };

  const openEditCfg = (c: TaxConfiguration) => {
    setEditingCfg(c);
    setHsnCode(c.hsnCode);
    setCfgDesc(c.description || '');
    setCfgTaxRateId(c.taxRateId);
    setEffectiveFrom(c.effectiveFrom.slice(0, 10));
    setEffectiveTo(c.effectiveTo ? c.effectiveTo.slice(0, 10) : '');
    setCfgError(null);
    setCfgModal(true);
  };

  const handleCfgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgError(null);
    try {
      const payload = {
        hsnCode: hsnCode.trim(),
        description: cfgDesc.trim() || null,
        taxRateId: cfgTaxRateId,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || null,
      };
      if (editingCfg) {
        await configsList.updateMutation.mutateAsync({ id: editingCfg.id, payload });
      } else {
        await configsList.createMutation.mutateAsync(payload);
      }
      setCfgModal(false);
    } catch (err) {
      setCfgError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === 'rates' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('rates')}
        >
          Tax Rates
        </Button>
        <Button
          type="button"
          variant={tab === 'configs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('configs')}
        >
          HSN Tax Configurations
        </Button>
      </div>

      {tab === 'rates' ? (
        <DataTablePage
          title="GST Tax Rates"
          subtitle="Standardized GST slabs with CGST, SGST, and IGST splits."
          items={ratesList.items}
          pagination={ratesList.pagination}
          isLoading={ratesList.isLoading}
          error={ratesList.error}
          search={ratesList.search}
          onSearchChange={ratesList.setSearch}
          statusFilter={ratesList.statusFilter}
          onStatusFilterChange={ratesList.setStatusFilter}
          page={ratesList.page}
          onPageChange={ratesList.setPage}
          onRefresh={() => ratesList.refetch()}
          canCreate={canCreate}
          onCreate={openCreateRate}
          createLabel="New Tax Rate"
          canUpdate={canUpdate}
          onEdit={openEditRate}
          onToggleStatus={setTogglingRate}
          columns={[
            { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
            { header: 'Name', render: r => r.name },
            { header: 'Total %', render: r => `${r.ratePercentage}%` },
            { header: 'CGST %', render: r => `${r.cgstPercentage}%` },
            { header: 'SGST %', render: r => `${r.sgstPercentage}%` },
            { header: 'IGST %', render: r => `${r.igstPercentage}%` },
            { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
          ]}
        />
      ) : (
        <DataTablePage
          title="HSN Tax Configurations"
          subtitle="Map HSN codes to tax rates with non-overlapping effective periods."
          items={configsList.items}
          pagination={configsList.pagination}
          isLoading={configsList.isLoading}
          error={configsList.error}
          search={configsList.search}
          onSearchChange={configsList.setSearch}
          statusFilter={configsList.statusFilter}
          onStatusFilterChange={configsList.setStatusFilter}
          page={configsList.page}
          onPageChange={configsList.setPage}
          onRefresh={() => configsList.refetch()}
          canCreate={canCreate}
          onCreate={openCreateCfg}
          createLabel="New HSN Config"
          canUpdate={canUpdate}
          onEdit={openEditCfg}
          onToggleStatus={setTogglingCfg}
          columns={[
            {
              header: 'HSN Code',
              render: r => <span className="font-mono font-medium">{r.hsnCode}</span>,
            },
            { header: 'Tax Rate', render: r => r.taxRate?.name || '—' },
            { header: 'Effective From', render: r => r.effectiveFrom.slice(0, 10) },
            {
              header: 'Effective To',
              render: r => (r.effectiveTo ? r.effectiveTo.slice(0, 10) : 'Ongoing'),
            },
            { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
          ]}
        />
      )}

      <Modal
        isOpen={rateModal}
        onClose={() => setRateModal(false)}
        title={editingRate ? 'Edit Tax Rate' : 'Create Tax Rate'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRateSubmit} className="space-y-3">
          {rateError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{rateError}</div>
          )}
          <FormField label="Tax Code" required>
            <input
              className={inputClassName}
              value={rateCode}
              onChange={e => setRateCode(e.target.value)}
              placeholder="e.g. GST_28"
            />
          </FormField>
          <FormField label="Name" required>
            <input
              className={inputClassName}
              value={rateName}
              onChange={e => setRateName(e.target.value)}
              placeholder="e.g. GST 28%"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Total Rate %" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={ratePct}
                onChange={e => setRatePct(e.target.value)}
              />
            </FormField>
            <FormField label="IGST %" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={igstPct}
                onChange={e => setIgstPct(e.target.value)}
              />
            </FormField>
            <FormField label="CGST %" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={cgstPct}
                onChange={e => setCgstPct(e.target.value)}
              />
            </FormField>
            <FormField label="SGST %" required>
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={sgstPct}
                onChange={e => setSgstPct(e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRateModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={cfgModal}
        onClose={() => setCfgModal(false)}
        title={editingCfg ? 'Edit HSN Tax Config' : 'Create HSN Tax Config'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCfgSubmit} className="space-y-3">
          {cfgError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{cfgError}</div>
          )}
          <FormField label="HSN Code" required>
            <input
              className={inputClassName}
              value={hsnCode}
              onChange={e => setHsnCode(e.target.value)}
              placeholder="e.g. 21069099"
            />
          </FormField>
          <FormField label="Tax Rate" required>
            <select
              className={inputClassName}
              value={cfgTaxRateId}
              onChange={e => setCfgTaxRateId(e.target.value)}
            >
              <option value="">Select Tax Rate</option>
              {allTaxRates
                ?.filter(t => t.isActive || t.id === cfgTaxRateId)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.ratePercentage}%)
                  </option>
                ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective From" required>
              <input
                type="date"
                className={inputClassName}
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
              />
            </FormField>
            <FormField label="Effective To">
              <input
                type="date"
                className={inputClassName}
                value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Description">
            <input
              className={inputClassName}
              value={cfgDesc}
              onChange={e => setCfgDesc(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCfgModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!togglingRate}
        onClose={() => setTogglingRate(null)}
        onConfirm={async () => {
          if (!togglingRate) return;
          await ratesList.statusMutation.mutateAsync({
            id: togglingRate.id,
            isActive: !togglingRate.isActive,
          });
          setTogglingRate(null);
        }}
        title={togglingRate?.isActive ? 'Deactivate Tax Rate' : 'Activate Tax Rate'}
        message={`Are you sure you want to ${togglingRate?.isActive ? 'deactivate' : 'activate'} "${togglingRate?.name}"?`}
      />

      <ConfirmDialog
        isOpen={!!togglingCfg}
        onClose={() => setTogglingCfg(null)}
        onConfirm={async () => {
          if (!togglingCfg) return;
          await configsList.statusMutation.mutateAsync({
            id: togglingCfg.id,
            isActive: !togglingCfg.isActive,
          });
          setTogglingCfg(null);
        }}
        title={togglingCfg?.isActive ? 'Deactivate HSN Config' : 'Activate HSN Config'}
        message={`Are you sure you want to ${togglingCfg?.isActive ? 'deactivate' : 'activate'} HSN "${togglingCfg?.hsnCode}"?`}
      />
    </div>
  );
};
