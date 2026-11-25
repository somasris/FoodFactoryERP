import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckSquare, Download, FileClock, History, Search } from 'lucide-react';
import { AuditLogEntry, governanceService } from '../../services/governance.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

type GovTab = 'audit' | 'approvals' | 'activity' | 'transactions';

export const AuditGovernancePage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canAudit = hasPermission('governance.audit.read');
  const canExport = hasPermission('governance.audit.export');
  const canApprovals = hasPermission('governance.approvals.read');
  const canActivity = hasPermission('governance.activity.read');

  const [tab, setTab] = useState<GovTab>(canAudit ? 'audit' : 'approvals');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const auditQuery = useQuery({
    queryKey: ['governance', 'audit', search, page],
    queryFn: () => governanceService.listAuditLogs({ search: search || undefined, page }),
    enabled: canAudit && tab === 'audit',
  });

  const approvalsQuery = useQuery({
    queryKey: ['governance', 'approvals'],
    queryFn: () => governanceService.getApprovals(),
    enabled: canApprovals && tab === 'approvals',
  });

  const activityQuery = useQuery({
    queryKey: ['governance', 'activity'],
    queryFn: () => governanceService.getUserActivity(1),
    enabled: canActivity && tab === 'activity',
  });

  const txQuery = useQuery({
    queryKey: ['governance', 'transactions'],
    queryFn: () => governanceService.getTransactionHistory(),
    enabled: canAudit && tab === 'transactions',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {canAudit && (
            <button
              onClick={() => setTab('audit')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'audit' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileClock className="h-3.5 w-3.5" />
              Audit Trail
            </button>
          )}
          {canApprovals && (
            <button
              onClick={() => setTab('approvals')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'approvals'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Approval Governance
            </button>
          )}
          {canActivity && (
            <button
              onClick={() => setTab('activity')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'activity'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              User Activity
            </button>
          )}
          {canAudit && (
            <button
              onClick={() => setTab('transactions')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'transactions'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Transaction History
            </button>
          )}
        </div>

        {canExport && tab === 'audit' && (
          <button
            onClick={() => governanceService.exportAuditCsv()}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export Audit CSV
          </button>
        )}
      </div>

      {tab === 'audit' && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search entity, ID, or remarks..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-slate-300 pl-9 pr-3 py-1 text-xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Remarks</th>
                  <th className="px-4 py-2.5 text-right">Diffs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditQuery.data?.items.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={log.action === 'LOGIN_FAILED' ? 'warning' : 'teal'}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {log.entityType} ({log.entityId.slice(0, 8)})
                    </td>
                    <td className="px-4 py-2.5">{log.user?.username || 'system'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{log.remarks || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="rounded border px-2 py-0.5 text-[11px] hover:bg-slate-100"
                      >
                        Inspect ({log.fieldDiffs.length})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'approvals' && approvalsQuery.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Pending Approvals</div>
              <div className="text-xl font-bold text-amber-700">
                {approvalsQuery.data.counts.pending}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Approved</div>
              <div className="text-xl font-bold text-emerald-700">
                {approvalsQuery.data.counts.approved}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Rejected</div>
              <div className="text-xl font-bold text-red-700">
                {approvalsQuery.data.counts.rejected}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Module</th>
                  <th className="px-4 py-2.5">Document #</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Decision</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvalsQuery.data.items.map((item, idx) => (
                  <tr key={`${String(item.entityId)}-${idx}`}>
                    <td className="px-4 py-2.5">{String(item.module)}</td>
                    <td className="px-4 py-2.5 font-mono">{String(item.documentNumber)}</td>
                    <td className="px-4 py-2.5">{String(item.status)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={item.decisionStatus === 'APPROVED' ? 'success' : 'warning'}>
                        {String(item.decisionStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{String(item.reason || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'activity' && activityQuery.data && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activityQuery.data.items.map(item => (
                <tr key={String(item.id)}>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(String(item.createdAt)).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">{String(item.action)}</Badge>
                  </td>
                  <td className="px-4 py-2.5">{String(item.entityType)}</td>
                  <td className="px-4 py-2.5">
                    {(item.user as { username?: string } | null)?.username || 'unknown'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{String(item.remarks || '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transactions' && txQuery.data && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Entity Type</th>
                <th className="px-4 py-2.5">Document #</th>
                <th className="px-4 py-2.5">Sub-Type / Status</th>
                <th className="px-4 py-2.5">Amount / Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txQuery.data.items.map((tx, idx) => (
                <tr key={`${String(tx.entityId)}-${idx}`}>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(String(tx.timestamp)).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2.5">{String(tx.entityType)}</td>
                  <td className="px-4 py-2.5 font-mono">{String(tx.documentNumber)}</td>
                  <td className="px-4 py-2.5">{String(tx.subType)}</td>
                  <td className="px-4 py-2.5 font-medium">{String(tx.amountOrQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Audit Event Diff ({selectedLog.entityType})
            </h3>
            <p className="mt-1 text-xs text-slate-500">{selectedLog.remarks}</p>
            <div className="mt-4 max-h-72 overflow-y-auto space-y-2 text-xs">
              {selectedLog.fieldDiffs.length === 0 ? (
                <p className="text-slate-500">
                  No field-level before/after snapshot recorded for this event.
                </p>
              ) : (
                selectedLog.fieldDiffs.map(d => (
                  <div key={d.field} className="rounded border p-2">
                    <div className="font-mono font-semibold text-slate-800">{d.field}</div>
                    <div className="text-red-700">- {JSON.stringify(d.previousValue)}</div>
                    <div className="text-emerald-700">+ {JSON.stringify(d.newValue)}</div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded border px-3 py-1.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
