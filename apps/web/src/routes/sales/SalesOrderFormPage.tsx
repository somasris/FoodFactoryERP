import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { masterDataService } from '../../services/master-data.service';
import { Button } from '../../components/common/Button';

interface OrderLineForm {
  productVariantId: string;
  uomId: string;
  orderedQuantity: string;
  discountPercent: string;
}

export const SalesOrderFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [lines, setLines] = useState<OrderLineForm[]>([
    { productVariantId: '', uomId: '', orderedQuantity: '1', discountPercent: '0' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: existingData } = useQuery({
    queryKey: ['sales', 'order', id],
    queryFn: () => salesService.orders.getById(id!),
    enabled: isEdit,
  });

  const { data: customersData } = useQuery({
    queryKey: ['master-data', 'customers', 'active'],
    queryFn: () => masterDataService.customers.list({ limit: 100, isActive: true }),
  });

  const { data: customerDetail } = useQuery({
    queryKey: ['master-data', 'customer', customerId],
    queryFn: () => masterDataService.customers.getById(customerId),
    enabled: Boolean(customerId),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['master-data', 'warehouses', 'active'],
    queryFn: () => masterDataService.warehouses.list({ limit: 100, isActive: true }),
  });

  const { data: variantsData } = useQuery({
    queryKey: ['master-data', 'product-variants', 'active'],
    queryFn: () => masterDataService.productVariants.list({ limit: 200, isActive: true }),
  });

  const { data: uomsData } = useQuery({
    queryKey: ['master-data', 'uoms', 'active'],
    queryFn: () => masterDataService.uoms.list({ limit: 100, isActive: true }),
  });

  useEffect(() => {
    const order = existingData?.data;
    if (!order) return;
    setCustomerId(order.customerId);
    setShippingAddressId(order.shippingAddressId || '');
    setWarehouseId(order.warehouseId);
    setExpectedDeliveryDate(
      order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : '',
    );
    setNotes(order.notes || '');
    setDeliveryInstructions(order.deliveryInstructions || '');
    if (order.lines && order.lines.length > 0) {
      setLines(
        order.lines.map(l => ({
          productVariantId: l.productVariantId,
          uomId: l.uomId,
          orderedQuantity: String(Number(l.orderedQuantity)),
          discountPercent: String(Number(l.discountPercent)),
        })),
      );
    }
  }, [existingData]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit ? salesService.orders.update(id!, payload) : salesService.orders.create(payload),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      const isOfflineQueued = Boolean(
        (res.data as { isOfflineQueued?: boolean } | undefined)?.isOfflineQueued,
      );
      navigate(`/sales/orders/${res.data!.id}`, {
        state: isOfflineQueued
          ? { offlineQueuedMessage: 'Order saved offline – waiting for sync' }
          : undefined,
      });
    },
    onError: err => {
      setFormError(err instanceof Error ? err.message : 'Failed to save sales order');
    },
  });

  const variants = variantsData?.data?.items || [];
  const variantMap = new Map(variants.map(v => [v.id, v]));

  // Live UI estimate (backend remains authoritative)
  const estimatedSubtotal = lines.reduce((sum, l) => {
    const v = variantMap.get(l.productVariantId);
    const qty = Number(l.orderedQuantity) || 0;
    const price = v ? Number(v.defaultSellingPrice) : 0;
    const disc = Number(l.discountPercent) || 0;
    const gross = qty * price;
    return sum + gross * (1 - disc / 100);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!customerId) return setFormError('Please select a customer.');
    if (!warehouseId) return setFormError('Please select a fulfillment warehouse.');
    if (lines.some(l => !l.productVariantId || !l.uomId || Number(l.orderedQuantity) <= 0)) {
      return setFormError('All order lines require a product variant, UOM, and positive quantity.');
    }

    mutation.mutate({
      customerId,
      ...(shippingAddressId ? { shippingAddressId } : {}),
      warehouseId,
      ...(expectedDeliveryDate ? { expectedDeliveryDate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(deliveryInstructions.trim() ? { deliveryInstructions: deliveryInstructions.trim() } : {}),
      lines: lines.map(l => ({
        productVariantId: l.productVariantId,
        uomId: l.uomId,
        orderedQuantity: l.orderedQuantity,
        discountPercent: l.discountPercent || '0',
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">
            {isEdit ? `Edit Sales Order ${existingData?.data?.orderNumber || ''}` : 'Create Sales Order'}
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative pricing and GST tax amounts are computed and snapshotted by the backend.
          </p>
        </div>
      </div>

      {formError && <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{formError}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Customer *</label>
          <select
            required
            value={customerId}
            onChange={e => {
              setCustomerId(e.target.value);
              setShippingAddressId('');
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          >
            <option value="">Select customer...</option>
            {customersData?.data?.items.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.legalName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Shipping Address</label>
          <select
            value={shippingAddressId}
            onChange={e => setShippingAddressId(e.target.value)}
            disabled={!customerId}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:bg-slate-100"
          >
            <option value="">Default / Not specified</option>
            {customerDetail?.data?.addresses?.map(addr => (
              <option key={addr.id} value={addr.id}>
                {addr.addressLine1}, {addr.city} ({addr.pincode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Fulfillment Warehouse *
          </label>
          <select
            required
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          >
            <option value="">Select warehouse...</option>
            {warehousesData?.data?.items.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Expected Delivery Date
          </label>
          <input
            type="date"
            value={expectedDeliveryDate}
            onChange={e => setExpectedDeliveryDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Order Lines</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setLines(prev => [
                ...prev,
                { productVariantId: '', uomId: '', orderedQuantity: '1', discountPercent: '0' },
              ])
            }
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product Line
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const selectedVariant = variantMap.get(line.productVariantId);
            return (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-6"
              >
                <select
                  required
                  value={line.productVariantId}
                  onChange={e => {
                    const val = e.target.value;
                    const found = variantMap.get(val);
                    setLines(prev =>
                      prev.map((l, i) =>
                        i === idx
                          ? { ...l, productVariantId: val, uomId: found?.uomId || l.uomId }
                          : l,
                      ),
                    );
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                >
                  <option value="">Select Product Variant...</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.sku} — {v.name} (₹{Number(v.defaultSellingPrice).toFixed(2)})
                    </option>
                  ))}
                </select>

                <select
                  required
                  value={line.uomId}
                  onChange={e =>
                    setLines(prev =>
                      prev.map((l, i) => (i === idx ? { ...l, uomId: e.target.value } : l)),
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">UOM...</option>
                  {uomsData?.data?.items.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.code} ({u.symbol})
                    </option>
                  ))}
                </select>

                <input
                  required
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="Qty"
                  value={line.orderedQuantity}
                  onChange={e =>
                    setLines(prev =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, orderedQuantity: e.target.value } : l,
                      ),
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Disc %"
                  value={line.discountPercent}
                  onChange={e =>
                    setLines(prev =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, discountPercent: e.target.value } : l,
                      ),
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-600">
                    {selectedVariant
                      ? `₹${(
                          (Number(line.orderedQuantity) || 0) *
                          Number(selectedVariant.defaultSellingPrice) *
                          (1 - (Number(line.discountPercent) || 0) / 100)
                        ).toFixed(2)}`
                      : '—'}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Order Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Delivery Instructions
          </label>
          <textarea
            rows={2}
            value={deliveryInstructions}
            onChange={e => setDeliveryInstructions(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
        <div className="text-xs text-slate-600">
          Estimated Taxable Subtotal:{' '}
          <span className="font-mono font-semibold text-brand-navy">
            ₹{estimatedSubtotal.toFixed(2)}
          </span>{' '}
          <span className="text-[11px] text-slate-400">(+ applicable GST calculated on save)</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/sales/orders')}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Order' : 'Save Draft Order'}
          </Button>
        </div>
      </div>
    </form>
  );
};
