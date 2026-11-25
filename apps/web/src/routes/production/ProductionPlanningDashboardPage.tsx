import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarRange, Clock, Rocket } from 'lucide-react';
import { productionService } from '../../services/production.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ErrorState, LoadingState } from '../../components/common/StateViews';

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
    return <LoadingState label="Loading production planning dashboard..." />;
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Failed to load planning dashboard"
        message={error instanceof Error ? error.message : 'Failed to load planning dashboard'}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Production Planning" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Plans"
          value={summary.totalPlans}
          sublabel={`${summary.draftPlans} draft · ${summary.cancelledPlans} cancelled`}
          icon={<CalendarRange className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Pending Approval"
          value={summary.submittedPlans}
          sublabel={`${summary.approvedPlans} approved`}
          icon={<Clock className="h-4 w-4" />}
          tone={summary.submittedPlans > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="Released Plans"
          value={summary.releasedPlans}
          sublabel="Ready for work orders"
          icon={<Rocket className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Material Shortages"
          value={summary.plansWithShortages}
          sublabel="Active plans with shortages"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={summary.plansWithShortages > 0 ? 'danger' : 'success'}
        />
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
