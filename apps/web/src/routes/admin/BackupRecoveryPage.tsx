import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, HardDriveDownload, ShieldAlert } from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const BackupRecoveryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreateBackup = hasPermission('operations.backup.create');
  const canRequestRestore = hasPermission('operations.restore.request');
  const canApproveRestore = hasPermission('operations.restore.approve');

  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['operations', 'backups'],
    queryFn: () => operationsService.listBackups(),
  });

  const backupMutation = useMutation({
    mutationFn: () => operationsService.triggerBackup(),
    onSuccess: res => {
      setFeedback(`Backup recorded with status: ${String(res.status)}`);
      queryClient.invalidateQueries({ queryKey: ['operations', 'backups'] });
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const requestRestoreMutation = useMutation({
    mutationFn: (backupId: string) => operationsService.requestRestore(backupId),
    onSuccess: () => {
      setFeedback('Controlled restore request submitted for administrator approval.');
      queryClient.invalidateQueries({ queryKey: ['operations', 'backups'] });
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const reviewRestoreMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      operationsService.reviewRestore(id, decision),
    onSuccess: () => {
      setFeedback('Restore request decision recorded.');
      queryClient.invalidateQueries({ queryKey: ['operations', 'backups'] });
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <HardDriveDownload className="h-5 w-5 text-brand-navy" />
          <div>
            <h2 className="text-base font-semibold text-[#24352A]">Backup &amp; Recovery</h2>
            <p className="text-xs text-[#66756A]">
              Manual backup triggers and approval-gated restore requests.
            </p>
          </div>
        </div>
        {canCreateBackup && (
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="rounded-md bg-brand-navy px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {backupMutation.isPending ? 'Running...' : 'Trigger Manual Backup'}
          </button>
        )}
      </div>

      {feedback && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
          {feedback}
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Restore execution requires administrator approval and manual execution in an isolated recovery environment.
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-2.5">Backup Name</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Verification</th>
              <th className="px-4 py-2.5">Details / Failure Reason</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading backup records...
                </td>
              </tr>
            ) : !data?.backups?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No backup records yet.
                </td>
              </tr>
            ) : (
              data.backups.map(b => (
                <tr key={String(b.id)}>
                  <td className="px-4 py-2.5 font-mono">{String(b.backupName)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={b.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {String(b.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{String(b.verificationStatus)}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {String(b.failureReason || (b.checksumSha256 ? `SHA256: ${String(b.checksumSha256).slice(0, 12)}...` : '-'))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canRequestRestore && b.status === 'COMPLETED' && (
                      <button
                        onClick={() => requestRestoreMutation.mutate(String(b.id))}
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                      >
                        Request Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.restoreRequests && data.restoreRequests.length > 0 && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Restore Approval Queue</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {data.restoreRequests.map(r => (
              <div key={String(r.id)} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-mono font-medium">
                    {(r.backupRecord as { backupName?: string } | null)?.backupName || String(r.backupRecordId)}
                  </span>
                  <Badge variant={r.status === 'APPROVED' ? 'success' : 'warning'} className="ml-2">
                    {String(r.status)}
                  </Badge>
                </div>
                {canApproveRestore && r.status === 'REQUESTED' && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        reviewRestoreMutation.mutate({ id: String(r.id), decision: 'APPROVED' })
                      }
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        reviewRestoreMutation.mutate({ id: String(r.id), decision: 'REJECTED' })
                      }
                      className="rounded border border-red-300 px-2 py-1 text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
