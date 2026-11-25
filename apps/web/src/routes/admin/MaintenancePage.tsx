import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Power } from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const MaintenancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('operations.maintenance.manage');

  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const maintQuery = useQuery({
    queryKey: ['operations', 'maintenance-mode'],
    queryFn: () => operationsService.getMaintenanceMode(),
  });

  const dbQuery = useQuery({
    queryKey: ['operations', 'database'],
    queryFn: () => operationsService.getDatabaseInfo(),
  });

  useEffect(() => {
    if (maintQuery.data) {
      setMessage(maintQuery.data.message);
    }
  }, [maintQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => operationsService.setMaintenanceMode(enabled, message),
    onSuccess: res => {
      setFeedback(`Maintenance mode is now ${res.enabled ? 'ENABLED' : 'DISABLED'}.`);
      queryClient.invalidateQueries({ queryKey: ['operations', 'maintenance-mode'] });
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Controlled Maintenance Mode</h2>
            <p className="text-xs text-slate-500">
              Regular users receive HTTP 503 during maintenance while OWNER and ADMIN retain full bypass access.
            </p>
          </div>
          <Badge variant={maintQuery.data?.enabled ? 'warning' : 'success'}>
            {maintQuery.data?.enabled ? 'MAINTENANCE ACTIVE' : 'NORMAL OPERATION'}
          </Badge>
        </div>

        {feedback && (
          <div className="mt-3 rounded border bg-slate-50 px-3 py-2 text-xs text-slate-800">
            {feedback}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            disabled={!canManage}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="flex-1 min-w-[260px] rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
          />
          {canManage && maintQuery.data && (
            <button
              onClick={() => toggleMutation.mutate(!maintQuery.data.enabled)}
              disabled={toggleMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium text-white ${
                maintQuery.data.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              {maintQuery.data.enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
            </button>
          )}
        </div>
      </div>

      {dbQuery.data && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-brand-navy" />
              <h3 className="text-sm font-semibold text-slate-900">
                Database &amp; Migration Visibility
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              DB Size: {dbQuery.data.databaseSizeMb ?? '-'} MB &bull; Applied Migrations:{' '}
              {dbQuery.data.migrationsCount}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div>
              <h4 className="mb-2 font-semibold text-slate-700">Largest Tables</h4>
              <div className="divide-y divide-slate-100">
                {dbQuery.data.largestTables.slice(0, 8).map(t => (
                  <div key={t.tableName} className="flex justify-between py-1.5">
                    <span className="font-mono">{t.tableName}</span>
                    <span>{t.sizeMb} MB</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-slate-700">Safe Maintenance Recommendations</h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                {dbQuery.data.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
