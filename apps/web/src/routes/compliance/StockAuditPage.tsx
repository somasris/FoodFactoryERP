import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Send } from 'lucide-react';
import { complianceService } from '../../services/compliance.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';

export const StockAuditPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('compliance.stock_audit.create');
  const canReview = hasPermission('compliance.stock_audit.review');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const auditsQuery = useQuery({
    queryKey: ['compliance', 'stock-audits'],
    queryFn: () => complianceService.listStockAudits(),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => complianceService.submitStockAudit(id),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Stock audit submitted for review.' });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'stock-audits'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      complianceService.reviewStockAudit(id, decision, decision === 'APPROVED' ? 'Approved' : 'Recount required'),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Stock audit review recorded.' });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'stock-audits'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => complianceService.postStockAudit(id),
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Approved stock audit posted via InventoryAdjustment ledger.',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'stock-audits'] });
    },
    onError: (err: Error) => setFeedback({ type: 'error', message: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-brand-navy" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Physical Stock Audit Sessions</h2>
            <p className="text-xs text-slate-500">
              Counts are reviewed and posted exclusively through the authorized InventoryAdjustment ledger.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Audit #</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Lines</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditsQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading stock audit sessions...
                </td>
              </tr>
            ) : !auditsQuery.data?.items?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No physical stock audit sessions found.
                </td>
              </tr>
            ) : (
              auditsQuery.data.items.map(audit => (
                <tr key={audit.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    {audit.auditNumber}
                  </td>
                  <td className="px-4 py-3">
                    {audit.warehouse.code} — {audit.warehouse.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(audit.auditDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">{audit.lines.length}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        audit.status === 'POSTED' || audit.status === 'APPROVED'
                          ? 'success'
                          : audit.status === 'REJECTED'
                            ? 'warning'
                            : 'teal'
                      }
                    >
                      {audit.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {canCreate && audit.status === 'DRAFT' && (
                        <button
                          onClick={() => submitMutation.mutate(audit.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                        >
                          <Send className="h-3 w-3" />
                          Submit
                        </button>
                      )}
                      {canReview && audit.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() =>
                              reviewMutation.mutate({ id: audit.id, decision: 'APPROVED' })
                            }
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              reviewMutation.mutate({ id: audit.id, decision: 'REJECTED' })
                            }
                            className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canReview && audit.status === 'APPROVED' && (
                        <button
                          onClick={() => postMutation.mutate(audit.id)}
                          className="rounded bg-brand-navy px-2.5 py-1 text-white hover:bg-slate-800"
                        >
                          Post Adjustment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
