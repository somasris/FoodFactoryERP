import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, IndianRupee, Layers, ShieldCheck } from 'lucide-react';
import { complianceService } from '../../services/compliance.service';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { ExportButtons } from '../../components/common/ExportButtons';

type SubTab = 'gst' | 'valuation' | 'costing' | 'traceability' | 'documents';

export const FinancialCompliancePage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canTax = hasPermission('compliance.tax.read');
  const canInv = hasPermission('compliance.inventory.read');
  const canCosting = hasPermission('production.costing.read') && canInv;
  const canDocs = hasPermission('compliance.documents.read');
  const canExport = hasPermission('compliance.export');

  const [tab, setTab] = useState<SubTab>(canTax ? 'gst' : canInv ? 'valuation' : 'documents');
  const [fy, setFy] = useState('');
  const [traceSearch, setTraceSearch] = useState('');

  const gstQuery = useQuery({
    queryKey: ['compliance', 'gst-sales', fy],
    queryFn: () => complianceService.getGstSalesSummary({ financialYear: fy || undefined }),
    enabled: canTax && tab === 'gst',
  });

  const purchaseQuery = useQuery({
    queryKey: ['compliance', 'gst-purchase'],
    queryFn: () => complianceService.getPurchaseTaxSummary(),
    enabled: canTax && tab === 'gst',
  });

  const valQuery = useQuery({
    queryKey: ['compliance', 'valuation'],
    queryFn: () => complianceService.getInventoryValuation(),
    enabled: canInv && tab === 'valuation',
  });

  const costQuery = useQuery({
    queryKey: ['compliance', 'costing'],
    queryFn: () => complianceService.getProductionCostCompliance(),
    enabled: canCosting && tab === 'costing',
  });

  const traceQuery = useQuery({
    queryKey: ['compliance', 'traceability', traceSearch],
    queryFn: () => complianceService.getTraceability(traceSearch || undefined),
    enabled: canInv && tab === 'traceability',
  });

  const docsQuery = useQuery({
    queryKey: ['compliance', 'documents'],
    queryFn: () => complianceService.listDocuments(),
    enabled: canDocs && tab === 'documents',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {canTax && (
            <button
              onClick={() => setTab('gst')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'gst' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <IndianRupee className="h-3.5 w-3.5" />
              GST &amp; Tax Summary
            </button>
          )}
          {canInv && (
            <button
              onClick={() => setTab('valuation')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'valuation'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Inventory Valuation
            </button>
          )}
          {canCosting && (
            <button
              onClick={() => setTab('costing')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'costing'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Production Cost Compliance
            </button>
          )}
          {canInv && (
            <button
              onClick={() => setTab('traceability')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'traceability'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Batch Traceability
            </button>
          )}
          {canDocs && (
            <button
              onClick={() => setTab('documents')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === 'documents'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Compliance Documents
            </button>
          )}
        </div>

        {canExport && tab !== 'documents' && (
          <ExportButtons
            onExport={fmt =>
              complianceService.downloadExport(
                tab === 'gst'
                  ? 'gst-sales'
                  : tab === 'valuation'
                    ? 'inventory-valuation'
                    : tab === 'costing'
                      ? 'production-costing'
                      : 'traceability',
                fmt,
                { financialYear: fy || undefined },
              )
            }
          />
        )}
      </div>

      {tab === 'gst' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-600">{gstQuery.data?.disclaimer}</div>
            <input
              type="text"
              placeholder="Filter FY (e.g. 2026-27)"
              value={fy}
              onChange={e => setFy(e.target.value)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs"
            />
          </div>

          {gstQuery.data && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500">Taxable Sales (Issued)</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ₹{gstQuery.data.totals.taxableSalesValue}
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500">CGST</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ₹{gstQuery.data.totals.cgstAmount}
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500">SGST</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ₹{gstQuery.data.totals.sgstAmount}
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500">IGST</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ₹{gstQuery.data.totals.igstAmount}
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500">Invoices (Iss / Canc / Draft)</div>
                  <div className="mt-1 text-lg font-bold text-brand-navy">
                    {gstQuery.data.counts.issued} / {gstQuery.data.counts.cancelled} /{' '}
                    {gstQuery.data.counts.draft}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">HSN-Wise Sales Summary</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">HSN</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Taxable</th>
                        <th className="px-3 py-2">CGST</th>
                        <th className="px-3 py-2">SGST</th>
                        <th className="px-3 py-2">IGST</th>
                        <th className="px-3 py-2">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {gstQuery.data.hsnSummary.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                            No issued invoices in selected period.
                          </td>
                        </tr>
                      ) : (
                        gstQuery.data.hsnSummary.map(h => (
                          <tr key={h.hsnCode}>
                            <td className="px-3 py-2 font-mono">{h.hsnCode}</td>
                            <td className="px-3 py-2">{h.totalQuantity}</td>
                            <td className="px-3 py-2">₹{h.taxableAmount}</td>
                            <td className="px-3 py-2">₹{h.cgstAmount}</td>
                            <td className="px-3 py-2">₹{h.sgstAmount}</td>
                            <td className="px-3 py-2">₹{h.igstAmount}</td>
                            <td className="px-3 py-2 font-semibold">₹{h.totalValue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {purchaseQuery.data && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <strong>Purchase &amp; ITC Status:</strong> {purchaseQuery.data.statusNotice}
            </div>
          )}
        </div>
      )}

      {tab === 'valuation' && valQuery.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Total Stock Valuation</div>
              <div className="mt-1 text-lg font-bold text-brand-navy">
                ₹{valQuery.data.summary.totalValuation}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Raw Materials</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                ₹{valQuery.data.summary.rawMaterialValuation}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Packaging</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                ₹{valQuery.data.summary.packagingValuation}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Finished Goods</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                ₹{valQuery.data.summary.finishedGoodsValuation}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">On Hand</th>
                  <th className="px-3 py-2">Unit Cost</th>
                  <th className="px-3 py-2">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valQuery.data.items.map(row => (
                  <tr key={row.balanceId}>
                    <td className="px-3 py-2 font-mono">{row.warehouseCode}</td>
                    <td className="px-3 py-2">
                      {row.itemCode} — {row.itemName}
                    </td>
                    <td className="px-3 py-2">{row.itemType}</td>
                    <td className="px-3 py-2">{row.valuationMethod}</td>
                    <td className="px-3 py-2 font-mono">{row.batchNumber || '-'}</td>
                    <td className="px-3 py-2">{row.quantityOnHand}</td>
                    <td className="px-3 py-2">₹{row.unitCost}</td>
                    <td className="px-3 py-2 font-semibold">₹{row.totalValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'costing' && costQuery.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Finalized Batches</div>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {costQuery.data.summary.finalizedCount}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Finalized Cost Total</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                ₹{costQuery.data.summary.finalizedTotalCost}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Provisional Batches</div>
              <div className="mt-1 text-lg font-bold text-amber-700">
                {costQuery.data.summary.provisionalCount}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">Provisional Cost Total</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                ₹{costQuery.data.summary.provisionalTotalCost}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'traceability' && (
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Batch Genealogy &amp; Recall Lookup</h3>
            <input
              type="text"
              placeholder="Search batch number or item..."
              value={traceSearch}
              onChange={e => setTraceSearch(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1 text-xs"
            />
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {traceQuery.data?.items.map((b: Record<string, unknown>) => (
              <div key={String(b.batchId)} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-slate-900">
                    {String(b.batchNumber)}
                  </span>
                  <span className="ml-2 text-slate-600">
                    {String(b.itemCode)} — {String(b.itemName)}
                  </span>
                </div>
                <Badge variant={b.qualityStatus === 'ACCEPTED' ? 'success' : 'warning'}>
                  {String(b.qualityStatus)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-navy" />
            <h3 className="text-sm font-semibold text-slate-900">
              Compliance Document Metadata Registry
            </h3>
          </div>
          {!docsQuery.data?.length ? (
            <p className="text-xs text-slate-500">No compliance documents registered yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Reference #</th>
                  <th className="px-3 py-2">File Name</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docsQuery.data.map(doc => (
                  <tr key={doc.id}>
                    <td className="px-3 py-2">{doc.category}</td>
                    <td className="px-3 py-2 font-mono">{doc.referenceNumber}</td>
                    <td className="px-3 py-2">{doc.fileName}</td>
                    <td className="px-3 py-2">
                      <Badge variant={doc.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                        {doc.verificationStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
