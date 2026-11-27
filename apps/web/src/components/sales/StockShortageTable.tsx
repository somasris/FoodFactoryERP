import React from 'react';
import { SalesOrderStockAvailability } from '../../types/sales';

interface StockShortageTableProps {
  stock: SalesOrderStockAvailability;
  orderNumber?: string;
  detailed?: boolean;
}

export const StockShortageTable: React.FC<StockShortageTableProps> = ({
  stock,
  orderNumber,
  detailed = false,
}) => {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <span className="font-semibold text-brand-navy">
          {orderNumber
            ? `Stock Shortage Details — ${orderNumber}`
            : detailed
              ? 'Line-Level Stock Availability Summary'
              : 'Stock Availability Breakdown'}
        </span>
        <span>
          Warehouse: {stock.warehouseName} ({stock.warehouseCode})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-2 py-1.5">Product</th>
              {detailed && <th scope="col" className="px-2 py-1.5 text-right">Ordered</th>}
              {detailed && <th scope="col" className="px-2 py-1.5 text-right">Already Fulfilled</th>}
              <th scope="col" className="px-2 py-1.5 text-right">
                {detailed ? 'Remaining' : 'Requested'}
              </th>
              {detailed && <th scope="col" className="px-2 py-1.5 text-right">On Hand</th>}
              {detailed && <th scope="col" className="px-2 py-1.5 text-right">Reserved</th>}
              <th scope="col" className="px-2 py-1.5 text-right">Available</th>
              <th scope="col" className="px-2 py-1.5 text-right">Shortage</th>
              {detailed && <th scope="col" className="px-2 py-1.5">Warehouse</th>}
              {detailed && <th scope="col" className="px-2 py-1.5 text-center">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stock.lines.map(line => (
              <tr
                key={line.salesOrderLineId}
                className={line.isSufficient ? '' : 'bg-[#C74440]/5'}
              >
                <td className="px-2 py-1.5 font-medium text-slate-800">
                  {line.productName}{' '}
                  <span className="font-mono text-[10px] text-slate-400">({line.sku})</span>
                </td>
                {detailed && (
                  <td className="px-2 py-1.5 text-right font-mono">
                    {line.orderedQuantity ?? line.requestedQuantity} {line.uomSymbol}
                  </td>
                )}
                {detailed && (
                  <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                    {line.fulfilledQuantity ?? '0'} {line.uomSymbol}
                  </td>
                )}
                <td className="px-2 py-1.5 text-right font-mono">
                  {line.requestedQuantity} {line.uomSymbol}
                </td>
                {detailed && (
                  <td className="px-2 py-1.5 text-right font-mono">
                    {line.onHandQuantity ?? '-'} {line.onHandQuantity !== undefined ? line.uomSymbol : ''}
                  </td>
                )}
                {detailed && (
                  <td className="px-2 py-1.5 text-right font-mono text-amber-700">
                    {line.reservedByOthersQuantity ?? '0'} {line.uomSymbol}
                  </td>
                )}
                <td className="px-2 py-1.5 text-right font-mono">
                  {line.availableQuantity} {line.uomSymbol}
                </td>
                <td
                  className={`px-2 py-1.5 text-right font-mono font-semibold ${
                    line.isSufficient ? 'text-[#27834A]' : 'text-[#C74440]'
                  }`}
                >
                  {line.shortageQuantity} {line.uomSymbol}
                </td>
                {detailed && (
                  <td className="px-2 py-1.5 font-mono text-slate-600">{stock.warehouseCode}</td>
                )}
                {detailed && (
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        line.isSufficient
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {line.isSufficient ? 'Sufficient' : 'Insufficient'}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
