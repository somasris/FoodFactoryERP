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
import { Customer, PartyAddress } from '../../types/master-data';

const emptyAddress = (): PartyAddress => ({
  addressType: 'SHIPPING',
  addressLine1: '',
  city: '',
  state: 'Tamil Nadu',
  stateCode: '33',
  pincode: '',
  isDefault: true,
});

export const CustomersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('customers.create');
  const canUpdate = hasPermission('customers.update');

  const [typeFilter, setTypeFilter] = useState('');
  const list = useMasterDataList<Customer>(
    'customers',
    masterDataService.customers,
    typeFilter ? { customerType: typeFilter } : {},
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [toggling, setToggling] = useState<Customer | null>(null);

  const [code, setCode] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [customerType, setCustomerType] = useState<Customer['customerType']>('RETAILER');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [creditPeriodDays, setCreditPeriodDays] = useState('15');
  const [creditLimit, setCreditLimit] = useState('0');
  const [address, setAddress] = useState<PartyAddress>(emptyAddress());
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setLegalName('');
    setTradeName('');
    setCustomerType('RETAILER');
    setContactName('');
    setEmail('');
    setPhone('');
    setGstin('');
    setCreditPeriodDays('15');
    setCreditLimit('0');
    setAddress(emptyAddress());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: Customer) => {
    setEditing(row);
    setCode(row.code);
    setLegalName(row.legalName);
    setTradeName(row.tradeName || '');
    setCustomerType(row.customerType);
    setContactName(row.contactName || '');
    setEmail(row.email || '');
    setPhone(row.phone || '');
    setGstin(row.gstin || '');
    setCreditPeriodDays(String(row.creditPeriodDays));
    setCreditLimit(row.creditLimit);
    setAddress(row.addresses?.[0] ? { ...row.addresses[0] } : emptyAddress());
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !legalName.trim()) {
      setFormError('Customer code and legal name are required.');
      return;
    }

    try {
      const addresses =
        address.addressLine1.trim() && address.city.trim()
          ? [{ ...address, isDefault: true }]
          : [];
      const payload = {
        code: code.trim(),
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || null,
        customerType,
        contactName: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        gstin: gstin.trim() || null,
        creditPeriodDays: Number(creditPeriodDays) || 15,
        creditLimit: creditLimit || '0',
        addresses,
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
        title="Customers"
        subtitle="Retailers, distributors, wholesalers, and direct accounts."
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
            aria-label="Filter by customer type"
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              list.setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Types</option>
            <option value="RETAILER">Retailer</option>
            <option value="DISTRIBUTOR">Distributor</option>
            <option value="WHOLESALER">Wholesaler</option>
            <option value="DIRECT">Direct</option>
          </select>
        }
        page={list.page}
        onPageChange={list.setPage}
        onRefresh={() => list.refetch()}
        canCreate={canCreate}
        onCreate={openCreate}
        createLabel="New Customer"
        onView={setViewing}
        canUpdate={canUpdate}
        onEdit={openEdit}
        onToggleStatus={setToggling}
        columns={[
          { header: 'Code', render: r => <span className="font-mono font-medium">{r.code}</span> },
          { header: 'Legal Name', render: r => r.legalName },
          { header: 'Type', render: r => r.customerType },
          { header: 'GSTIN', render: r => <span className="font-mono">{r.gstin || '—'}</span> },
          { header: 'Credit Limit', render: r => `₹${r.creditLimit}` },
          { header: 'Status', render: r => <StatusBadge isActive={r.isActive} /> },
        ]}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Customer' : 'Create Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Customer Code" required>
              <input
                className={inputClassName}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. CUST-001"
              />
            </FormField>
            <FormField label="Legal Name" required>
              <input
                className={inputClassName}
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
              />
            </FormField>
            <FormField label="Customer Type" required>
              <select
                className={inputClassName}
                value={customerType}
                onChange={e => setCustomerType(e.target.value as Customer['customerType'])}
              >
                <option value="RETAILER">Retailer</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="WHOLESALER">Wholesaler</option>
                <option value="DIRECT">Direct</option>
              </select>
            </FormField>
            <FormField label="Trade Name">
              <input
                className={inputClassName}
                value={tradeName}
                onChange={e => setTradeName(e.target.value)}
              />
            </FormField>
            <FormField label="Contact Person">
              <input
                className={inputClassName}
                value={contactName}
                onChange={e => setContactName(e.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className={inputClassName}
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                className={inputClassName}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </FormField>
            <FormField label="GSTIN">
              <input
                className={inputClassName}
                value={gstin}
                onChange={e => setGstin(e.target.value)}
                maxLength={15}
              />
            </FormField>
            <FormField label="Credit Period (Days)">
              <input
                type="number"
                className={inputClassName}
                value={creditPeriodDays}
                onChange={e => setCreditPeriodDays(e.target.value)}
              />
            </FormField>
            <FormField label="Credit Limit (₹)">
              <input
                type="number"
                step="0.01"
                className={inputClassName}
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
              />
            </FormField>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
              Primary Address (Optional)
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Address Line 1">
                  <input
                    className={inputClassName}
                    value={address.addressLine1}
                    onChange={e => setAddress({ ...address, addressLine1: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="City">
                <input
                  className={inputClassName}
                  value={address.city}
                  onChange={e => setAddress({ ...address, city: e.target.value })}
                />
              </FormField>
              <FormField label="State">
                <input
                  className={inputClassName}
                  value={address.state}
                  onChange={e => setAddress({ ...address, state: e.target.value })}
                />
              </FormField>
              <FormField label="State Code (2 digits)">
                <input
                  className={inputClassName}
                  value={address.stateCode}
                  onChange={e => setAddress({ ...address, stateCode: e.target.value })}
                  maxLength={2}
                />
              </FormField>
              <FormField label="Pincode">
                <input
                  className={inputClassName}
                  value={address.pincode}
                  onChange={e => setAddress({ ...address, pincode: e.target.value })}
                  maxLength={10}
                />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={list.createMutation.isPending || list.updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Customer Details">
        {viewing && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Code</dt>
              <dd className="font-mono font-medium">{viewing.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Legal Name</dt>
              <dd>{viewing.legalName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd>{viewing.customerType}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">GSTIN</dt>
              <dd className="font-mono">{viewing.gstin || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Credit Terms</dt>
              <dd>
                {viewing.creditPeriodDays} days / ₹{viewing.creditLimit}
              </dd>
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
        title={toggling?.isActive ? 'Deactivate Customer' : 'Activate Customer'}
        message={`Are you sure you want to ${toggling?.isActive ? 'deactivate' : 'activate'} "${toggling?.legalName}"?`}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
