import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { salesService } from '../../services/sales.service';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import { Button } from '../../components/common/Button';

export const PendingApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', 'orders', 'SUBMITTED'],
    queryFn: () => salesService.orders.list({ status: 'SUBMITTED', limit: 50 }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => salesService.orders.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
  });

  const orders = data?.data?.items || [];

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-brand-navy">Pending Approvals</h2>
        <p className="text-xs text-slate-500">Submitted sales orders awaiting management approval.</p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading approval queue...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error instanceof Error ? error.message : 'Failed to load pending approvals'}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No sales orders pending approval.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Actions</th>
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
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    ₹{Number(o.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMut.mutate(o.id)}
                        disabled={approveMut.isPending}
                      >
                        Approve
                      </Button>
                      <Link
                        to={`/sales/orders/${o.id}`}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
                      >
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
