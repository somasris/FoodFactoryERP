import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarRange, Clock, Rocket } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'teal' | 'warning' | 'outline' | 'success'> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  APPROVED: 'teal',
  REJECTED: 'default',
  RELEASED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export const ProductionPlanningDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['production', 'planning', 'dashboard'],
    queryFn: () => productionService.dashboard(),
  });

  const summary = data?.data;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading production planning dashboard...
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error instanceof Error ? error.message : 'Failed to load planning dashboard'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Total Plans</CardTitle>
            <CalendarRange className="h-4 w-4 text-brand-navy" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-navy">{summary.totalPlans}</div>
            <p className="mt-1 text-xs text-slate-500">
              {summary.draftPlans} draft · {summary.cancelledPlans} cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{summary.submittedPlans}</div>
            <p className="mt-1 text-xs text-slate-500">{summary.approvedPlans} approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Released Plans</CardTitle>
            <Rocket className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{summary.releasedPlans}</div>
            <p className="mt-1 text-xs text-slate-500">Ready for work orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Material Shortages</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{summary.plansWithShortages}</div>
            <p className="mt-1 text-xs text-slate-500">Active plans with shortages</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-brand-navy">Recent Production Plans</CardTitle>
          <div className="flex gap-3 text-xs">
            <Link to="/production/demand" className="text-brand-blue hover:underline">
              View Demand &amp; MRP
            </Link>
            <Link to="/production/plans" className="text-brand-blue hover:underline">
              View All Plans
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {summary.recentPlans.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No production plans created yet. Generate one from Demand &amp; MRP.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Plan #</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Warehouse</th>
                    <th className="py-2 pr-3">Lines</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentPlans.map(plan => (
                    <tr key={plan.id}>
                      <td className="py-2 pr-3 font-mono font-medium">
                        <Link
                          to={`/production/plans/${plan.id}`}
                          className="text-brand-blue hover:underline"
                        >
                          {plan.planNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{plan.name || '—'}</td>
                      <td className="py-2 pr-3">{plan.warehouse.code}</td>
                      <td className="py-2 pr-3">{plan._count?.items ?? 0}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={STATUS_BADGE[plan.status] || 'outline'}>
                          {plan.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-500">
                        {new Date(plan.planDate).toLocaleDateString('en-IN')}
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
