import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { Button } from '../../components/common/Button';

interface LineDraft {
  salesOrderLineId: string;
  sku: string;
  name: string;
  uomSymbol: string;
  maxQty: number;
  quantity: string;
  unitPrice: string;
  taxPercentage: string;
}

export const SalesInvoiceFormPage: React.FC = () => {
  const { orderId, id } = useParams<{ orderId?: string; id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formError, setFormError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Goods once sold will not be taken back. Subject to Trichy jurisdiction.',
  );
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);

  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['sales', 'order', orderId],
    queryFn: () => salesService.orders.getById(orderId!),
    enabled: !isEdit && Boolean(orderId),
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['sales', 'invoice', id],
    queryFn: () => salesService.invoices.getById(id!),
    enabled: isEdit && Boolean(id),
  });

  const targetOrderId = isEdit ? invoiceData?.data?.salesOrderId : orderId;

  const { data: editOrderData } = useQuery({
    queryKey: ['sales', 'order', targetOrderId],
    queryFn: () => salesService.orders.getById(targetOrderId!),
    enabled: isEdit && Boolean(targetOrderId),
  });

  useEffect(() => {
    if (!isEdit && orderData?.data?.lines) {
      const eligible = orderData.data.lines
        .map(l => {
          const fulfilled = Number(l.fulfilledBaseQuantity || 0);
          const invoiced = Number(l.invoicedBaseQuantity || 0);
          const remainingBase = Math.max(0, fulfilled - invoiced);
          const ratio = Number(l.orderedQuantity) / Math.max(1e-6, Number(l.baseQuantity));
          const remainingQty = Number((remainingBase * ratio).toFixed(4));
          return {
            salesOrderLineId: l.id,
            sku: l.productVariant?.sku || '',
            name: l.productVariant?.product?.name || l.productVariant?.name || 'Item',
            uomSymbol: l.uom?.symbol || '',
            maxQty: remainingQty,
            quantity: remainingQty > 0 ? String(remainingQty) : '0',
            unitPrice: l.unitPrice,
            taxPercentage: l.taxPercentage,
          };
        })
        .filter(l => l.maxQty > 0);
      setLines(eligible);
    }
  }, [isEdit, orderData]);

  useEffect(() => {
    if (isEdit && invoiceData?.data) {
      const inv = invoiceData.data;
      setNotes(inv.notes || '');
      setTermsAndConditions(inv.termsAndConditions || '');
      setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '');
      const orderLineMap = new Map(
        (editOrderData?.data?.lines || []).map(ol => [ol.id, ol]),
      );
      setLines(
        (inv.lines || []).map(l => {
          const ol = orderLineMap.get(l.salesOrderLineId);
          const currentQty = Number(l.quantity);
          const remainingOrderQty = ol
            ? Math.max(
                0,
                (Number(ol.fulfilledBaseQuantity) - Number(ol.invoicedBaseQuantity || 0)) *
                  (Number(ol.orderedQuantity) / Math.max(1e-6, Number(ol.baseQuantity))),
              )
            : 0;
          return {
            salesOrderLineId: l.salesOrderLineId,
            sku: l.itemCode,
            name: l.itemName,
            uomSymbol: l.uomSymbol,
            maxQty: Number((currentQty + remainingOrderQty).toFixed(4)),
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxPercentage: l.gstRate,
          };
        }),
      );
    }
  }, [isEdit, invoiceData, editOrderData]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const selectedLines = lines
        .filter(l => Number(l.quantity) > 0)
        .map(l => ({
          salesOrderLineId: l.salesOrderLineId,
          quantity: l.quantity,
        }));
      if (selectedLines.length === 0) {
        throw new Error('At least one line with quantity > 0 is required.');
      }

      if (isEdit && id) {
        return salesService.invoices.update(id, {
          dueDate: dueDate || null,
          notes: notes.trim() || null,
          termsAndConditions: termsAndConditions.trim() || null,
          lines: selectedLines,
        });
      }

      return salesService.invoices.createFromOrder(orderId!, {
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        lines: selectedLines,
      });
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      if (res.data?.id) {
        navigate(`/sales/invoices/${res.data.id}`);
      } else {
        navigate('/sales/invoices');
      }
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Failed to save invoice'),
  });

  if (orderLoading || invoiceLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading invoice details...
      </div>
    );
  }

  const orderSummary = isEdit ? invoiceData?.data?.salesOrder : orderData?.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to={isEdit && id ? `/sales/invoices/${id}` : `/sales/orders/${orderId}`}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-brand-navy">
              {isEdit ? `Edit Draft Invoice ${invoiceData?.data?.invoiceNumber}` : 'Create GST Sales Invoice'}
            </h2>
            {orderSummary && (
              <p className="text-xs text-slate-500">
                Sales Order: <span className="font-mono font-medium">{orderSummary.orderNumber}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {formError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional invoice notes..."
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Declaration / Terms &amp; Conditions
          </label>
          <textarea
            rows={2}
            value={termsAndConditions}
            onChange={e => setTermsAndConditions(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-brand-navy mb-2">
            Fulfilled Lines Eligible for Invoicing
          </h3>
          {lines.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No fulfilled, uninvoiced quantities remain on this order.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Max Eligible</th>
                    <th className="px-3 py-2">Invoice Qty</th>
                    <th className="px-3 py-2">Unit Price</th>
                    <th className="px-3 py-2">GST %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.salesOrderLineId}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{line.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{line.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {line.maxQty} {line.uomSymbol}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          max={line.maxQty}
                          value={line.quantity}
                          onChange={e => {
                            const val = e.target.value;
                            setLines(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item)),
                            );
                          }}
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">₹{Number(line.unitPrice).toFixed(2)}</td>
                      <td className="px-3 py-2">{line.taxPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="default"
            disabled={saveMut.isPending || lines.length === 0}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMut.isPending ? 'Saving...' : isEdit ? 'Update Draft Invoice' : 'Create Draft Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
};
