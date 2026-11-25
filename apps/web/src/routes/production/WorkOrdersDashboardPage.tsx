import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Eye, Rocket } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  APPROVED: 'teal',
  REJECTED: 'default',
  RELEASED: 'success',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

const PRIORITY_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  LOW: 'outline',
  NORMAL: 'secondary',
  HIGH: 'warning',
  URGENT: 'default',
};

export const WorkOrdersDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'work-orders', 'dashboard'],
    queryFn: () => productionService.workOrders.dashboard(),
  });

  const summary = data?.data;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading work order dashboard...
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Failed to load work order dashboard'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Total Work Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-brand-navy" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-navy">{summary.totalWorkOrders}</div>
            <p className="mt-1 text-xs text-slate-500">
              {summary.draftCount} draft · {summary.cancelledCount} cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{summary.submittedCount}</div>
            <p className="mt-1 text-xs text-slate-500">{summary.approvedCount} approved awaiting release</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Released / Active</CardTitle>
            <Rocket className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{summary.releasedCount}</div>
            <p className="mt-1 text-xs text-slate-500">
              {summary.inProgressCount} in progress · {summary.completedCount} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Urgent Open Orders</CardTitle>
            {summary.urgentCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.urgentCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {summary.urgentCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">Active high-urgency work orders</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-brand-navy">Recent Work Orders</CardTitle>
          <Link to="/production/work-orders" className="text-xs font-medium text-brand-teal hover:underline">
            View All Work Orders →
          </Link>
        </CardHeader>
        <CardContent>
          {summary.recentWorkOrders.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No work orders created yet. Open an Approved or Released Production Plan to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Work Order #</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Warehouse</th>
                    <th className="px-3 py-2 font-medium text-right">Planned Qty</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentWorkOrders.map(wo => (
                    <tr key={wo.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium text-brand-navy">{wo.workOrderNumber}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{wo.productVariant?.sku}</div>
                        <div className="text-[11px] text-slate-500">{wo.productVariant?.name}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{wo.warehouse?.code}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">
                        {Number(wo.plannedQuantity).toFixed(2)} {wo.uom?.symbol}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={PRIORITY_BADGE[wo.priority] || 'outline'}>{wo.priority}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_BADGE[wo.status] || 'outline'}>{wo.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/production/work-orders/${wo.id}`}
                          className="inline-flex items-center gap-1 text-brand-teal hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
