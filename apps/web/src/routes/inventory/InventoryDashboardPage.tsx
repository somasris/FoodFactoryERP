import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Boxes, IndianRupee, AlertTriangle, Clock } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { InventoryStatusBadge } from '../../components/inventory/InventoryStatusBadge';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ErrorState, LoadingState } from '../../components/common/StateViews';

export const InventoryDashboardPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory', 'dashboard'],
    queryFn: () => inventoryService.dashboard(),
  });

  const summary = data?.data;

  if (isLoading) {
    return <LoadingState label="Loading inventory dashboard..." />;
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Failed to load inventory dashboard"
        message={error instanceof Error ? error.message : 'Failed to load inventory dashboard'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory Overview"
        description="Real-time warehouse stock valuation, expiry monitoring, and pending document queue."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Stock Value"
          value={`₹${Number(summary.totalStockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          sublabel={`Across ${summary.activeWarehouseCount} warehouse(s)`}
          icon={<IndianRupee className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Active SKUs in Stock"
          value={summary.activeSkuCount}
          sublabel={`${summary.balanceRowCount} warehouse/batch balance rows`}
          icon={<Boxes className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Expiring Within 30 Days"
          value={summary.expiringSoonCount}
          sublabel="Requires FEFO priority"
          icon={<Clock className="h-4 w-4" />}
          tone={summary.expiringSoonCount > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Expired Batches with Stock"
          value={summary.expiredStockCount}
          sublabel="Blocked from FEFO/FIFO issue"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={summary.expiredStockCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-brand-navy">Pending Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <Link to="/inventory/receipts" className="font-medium text-slate-700 hover:text-brand-navy">
                Pending Receipts
              </Link>
              <span className="font-bold text-brand-navy">{summary.pendingDocuments.receipts}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <Link to="/inventory/issues" className="font-medium text-slate-700 hover:text-brand-navy">
                Pending Issues
              </Link>
              <span className="font-bold text-brand-navy">{summary.pendingDocuments.issues}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <Link to="/inventory/transfers" className="font-medium text-slate-700 hover:text-brand-navy">
                In-Transit Transfers
              </Link>
              <span className="font-bold text-amber-700">
                {summary.pendingDocuments.inTransitTransfers}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <Link to="/inventory/adjustments" className="font-medium text-slate-700 hover:text-brand-navy">
                Pending Adjustments
              </Link>
              <span className="font-bold text-brand-navy">{summary.pendingDocuments.adjustments}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-brand-navy">Recent Ledger Activity</CardTitle>
            <Link to="/inventory/transactions" className="text-xs text-brand-blue hover:underline">
              View all transactions
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentTransactions.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No posted inventory transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Txn #</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Ref</th>
                      <th className="py-2 pr-3">Warehouse</th>
                      <th className="py-2 pr-3">Lines</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recentTransactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-3 font-mono font-medium text-brand-navy">
                          {tx.transactionNumber}
                        </td>
                        <td className="py-2 pr-3">
                          <InventoryStatusBadge status={tx.transactionType} />
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-600">{tx.referenceNumber}</td>
                        <td className="py-2 pr-3">{tx.warehouse.code}</td>
                        <td className="py-2 pr-3">{tx._count?.lines ?? 0}</td>
                        <td className="py-2 text-slate-500">
                          {new Date(tx.transactionDate).toLocaleDateString()}
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
    </div>
  );
};
