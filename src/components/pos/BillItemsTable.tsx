import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { InvoiceItem } from '../../types/pos.ts';

interface BillItemsTableProps {
  items: InvoiceItem[];
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onUpdateDiscount: (itemId: string, newDiscountPercent: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export const BillItemsTable: React.FC<BillItemsTableProps> = ({
  items,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
}) => {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#E8DFD8] shadow-xs text-center flex flex-col items-center justify-center min-h-[220px]">
        <div className="w-12 h-12 rounded-full bg-[#FAF4F0] text-[#6D283E] flex items-center justify-center mb-3">
          <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h4 className="font-display font-semibold text-base text-slate-800">
          No items added to current bill
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Scan a barcode with the WiredPower scanner, enter a product code, or select from the boutique catalog above.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FAF7F4] border-b border-[#E8DFD8] text-[11px] font-bold text-[#5C4D46] uppercase tracking-wider">
              <th className="py-2.5 px-3">Item Description</th>
              <th className="py-2.5 px-2 text-center w-24">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Rate</th>
              <th className="py-2.5 px-2 text-center w-20">Disc %</th>
              <th className="py-2.5 px-2 text-center w-16">GST</th>
              <th className="py-2.5 px-3 text-right">Line Total</th>
              <th className="py-2.5 px-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F4EFEA]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-[#FAF9F7] transition-colors">
                {/* Description & SKU */}
                <td className="py-3 px-3">
                  <p className="font-semibold text-slate-900 text-xs">{item.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    SKU: {item.sku}
                    {item.size && ` · ${item.size}`}
                    {item.color && ` · ${item.color}`}
                  </p>
                </td>

                {/* Quantity Controls */}
                <td className="py-3 px-2 text-center">
                  <div className="inline-flex items-center border border-[#D8CCC0] rounded-lg bg-[#FAF8F5] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="p-1 hover:bg-[#EAE2D8] text-slate-600 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-semibold text-slate-800 tabular-nums text-xs">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:bg-[#EAE2D8] text-slate-600 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>

                {/* Unit Rate */}
                <td className="py-3 px-3 text-right font-medium text-slate-700 tabular-nums">
                  ₹{item.unitPrice.toLocaleString('en-IN')}
                </td>

                {/* Discount % */}
                <td className="py-3 px-2 text-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discountPercent || ''}
                    onChange={(e) => onUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-12 text-center py-1 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] tabular-nums"
                  />
                </td>

                {/* GST */}
                <td className="py-3 px-2 text-center font-medium text-slate-600 tabular-nums">
                  {item.gstRate}%
                </td>

                {/* Line Total */}
                <td className="py-3 px-3 text-right font-bold text-[#4A1525] tabular-nums">
                  ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>

                {/* Remove */}
                <td className="py-3 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
