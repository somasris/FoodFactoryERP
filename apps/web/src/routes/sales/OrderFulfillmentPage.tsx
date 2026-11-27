import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { salesService } from '../../services/sales.service';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { StockAvailabilityBadge } from '../../components/sales/StockAvailabilityBadge';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/master-data/Modal';

export const OrderFulfillmentPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [fulfillTargetId, setFulfillTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: confirmedData, isLoading: l1 } = useQuery({
    queryKey: ['sales', 'orders', 'CONFIRMED'],
    queryFn: () => salesService.orders.list({ status: 'CONFIRMED', limit: 50 }),
  });

  const { data: partialData, isLoading: l2 } = useQuery({
    queryKey: ['sales', 'orders', 'PARTIALLY_FULFILLED'],
    queryFn: () => salesService.orders.list({ status: 'PARTIALLY_FULFILLED', limit: 50 }),
  });

  const fulfillMut = useMutation({
    mutationFn: (id: string) => salesService.orders.fulfill(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setFulfillTargetId(null);
      setActionError(null);
    },
    onError: err => {
      setFulfillTargetId(null);
      setActionError(err instanceof Error ? err.message : 'Fulfillment failed');
    },
  });

  const orders = [...(confirmedData?.data?.items || []), ...(partialData?.data?.items || [])];

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-brand-navy">Order Fulfillment Queue</h2>
        <p className="text-xs text-slate-500">
          Confirmed and partially fulfilled orders ready for warehouse dispatch via Inventory Issue.
        </p>
      </div>

      {actionError && <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{actionError}</div>}

      {l1 || l2 ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading fulfillment queue...</div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No confirmed orders awaiting fulfillment.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Stock Availability</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link to={`/sales/orders/${o.id}`} className="text-brand-blue hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.customer.legalName}</td>
                  <td className="px-3 py-2">{o.warehouse.code}</td>
                  <td className="px-3 py-2">
                    <SalesStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2">
                    <StockAvailabilityBadge status={o.stockAvailability?.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    ₹{Number(o.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={() => setFulfillTargetId(o.id)}>
                      Fulfill Remaining
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(fulfillTargetId)}
        onClose={() => setFulfillTargetId(null)}
        onConfirm={() => fulfillTargetId && fulfillMut.mutate(fulfillTargetId)}
        title="Fulfill Sales Order"
        message="This will release reserved stock and post an Inventory Issue ledger transaction. Continue?"
        confirmLabel="Confirm Fulfillment"
        isLoading={fulfillMut.isPending}
      />
    </div>
  );
};
