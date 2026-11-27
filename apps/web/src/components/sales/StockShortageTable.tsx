import React from 'react';
import { SalesOrderStockAvailability } from '../../types/sales';

interface StockShortageTableProps {
  stock: SalesOrderStockAvailability;
  orderNumber?: string;
}

export const StockShortageTable: React.FC<StockShortageTableProps> = ({ stock, orderNumber }) => {
  return (
    <div className="rounded-md border border-[#C74440]/25 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <span className="font-semibold text-brand-navy">
          {orderNumber ? `Stock Shortage Details — ${orderNumber}` : 'Stock Availability Breakdown'}
        </span>
        <span>
          Warehouse: {stock.warehouseName} ({stock.warehouseCode})
        </span>
      </div>
      <table className="w-full text-left text-[11px]">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-2 py-1.5">Product</th>
            <th scope="col" className="px-2 py-1.5 text-right">Requested</th>
            <th scope="col" className="px-2 py-1.5 text-right">Available</th>
            <th scope="col" className="px-2 py-1.5 text-right">Shortage</th>
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
              <td className="px-2 py-1.5 text-right font-mono">
                {line.requestedQuantity} {line.uomSymbol}
              </td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
