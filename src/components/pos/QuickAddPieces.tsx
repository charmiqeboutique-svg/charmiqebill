import React from 'react';
import { Sparkles } from 'lucide-react';
import { Product } from '../../types/pos.ts';

interface QuickAddPiecesProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
}

export const QuickAddPieces: React.FC<QuickAddPiecesProps> = ({
  products,
  onAddProduct,
}) => {
  // Show popular or first 6 pieces
  const displayPieces = products.slice(0, 6);

  return (
    <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-[#E8DFD8] shadow-xs">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-[#6D283E]" />
        <span className="text-[11px] font-bold tracking-wider text-[#3B0F1E] uppercase">
          QUICK ADD POPULAR PIECES
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {displayPieces.map((p) => (
          <button
            key={p.id}
            onClick={() => onAddProduct(p)}
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#D8CCC0] bg-[#FAF8F5] hover:bg-[#F2ECE5] hover:border-[#4A1525] text-slate-800 text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer active:scale-97"
            title={`Add ${p.name} - SKU: ${p.sku}`}
          >
            <span className="font-semibold text-slate-900 max-w-[140px] truncate">
              {p.name}
            </span>
            <span className="text-[#4A1525] font-bold tabular-nums">
              ₹{p.sellingPrice.toLocaleString('en-IN')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
