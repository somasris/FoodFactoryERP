import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, Cpu, Database } from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { Badge } from '../../components/common/Badge';

export const SystemHealthPage: React.FC = () => {
  const healthQuery = useQuery({
    queryKey: ['operations', 'health'],
    queryFn: () => operationsService.getHealth(),
  });

  const monitoringQuery = useQuery({
    queryKey: ['operations', 'monitoring'],
    queryFn: () => operationsService.getMonitoring(),
  });

  if (healthQuery.isLoading) {
    return <div className="rounded-lg bg-white p-6 text-sm text-slate-500">Checking system health...</div>;
  }

  const h = healthQuery.data;
  const mon = monitoringQuery.data;

  return (
    <div className="space-y-6">
      {h && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>API Status</span>
              <Cpu className="h-4 w-4 text-brand-navy" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={h.status === 'healthy' ? 'success' : 'warning'}>{h.status}</Badge>
              <span className="text-xs text-slate-500">Uptime: {h.api.uptimeSeconds}s</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Node {h.api.nodeVersion} &bull; RSS {h.api.memoryMb.rss} MB
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>PostgreSQL</span>
              <Database className="h-4 w-4 text-brand-navy" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={h.database.status === 'connected' ? 'success' : 'warning'}>
                {h.database.status}
              </Badge>
              <span className="text-xs text-slate-500">{h.database.latencyMs} ms</span>
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-400">
              Migration: {h.database.latestMigration || '-'}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Performance (p95)</span>
              <Activity className="h-4 w-4 text-brand-navy" />
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {mon?.performance.p95DurationMs ?? 0} ms
            </div>
            <div className="text-[11px] text-slate-400">
              Avg: {mon?.performance.avgDurationMs ?? 0} ms &bull; Error rate:{' '}
              {mon?.performance.errorRatePercent ?? 0}%
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Active Sessions</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{h.activeSessions}</div>
            <div className="text-[11px] text-slate-400">
              Maintenance Mode: {h.maintenanceMode ? 'ENABLED' : 'OFF'}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-900">Recent Operational Errors (Redacted)</h3>
        </div>
        {!mon?.recentErrors?.length ? (
          <p className="text-xs text-slate-500">No recent operational errors recorded in memory.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {mon.recentErrors.slice(0, 15).map((err, idx) => (
              <div key={`${String(err.requestId)}-${idx}`} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <Badge variant="outline">{String(err.category)}</Badge>
                  <span className="ml-2 font-mono text-slate-700">
                    {String(err.method)} {String(err.route)} ({String(err.statusCode)})
                  </span>
                  <span className="ml-2 text-slate-600">{String(err.message)}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(String(err.timestamp)).toLocaleTimeString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
