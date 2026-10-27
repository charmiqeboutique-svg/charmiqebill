import React, { useState } from 'react';
import { X, Printer, Tag } from 'lucide-react';
import { Product } from '../../types/pos.ts';
import { generateBarcodeSvg } from '../../lib/barcodeGenerator.ts';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  boutiqueName: string;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  product,
  boutiqueName,
}) => {
  const [labelCount, setLabelCount] = useState<number>(4);

  if (!isOpen || !product) return null;

  const barcodeSvg = generateBarcodeSvg(product.barcode, {
    height: 44,
    moduleWidth: 1.5,
    showText: true,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#E8DFD8] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#E8DFD8] flex items-center justify-between bg-[#FAF7F4] no-print">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#4A1525]" />
            <h3 className="font-display font-bold text-base text-slate-900">
              Print Garment Barcode Labels
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Quantity:</span>
              <input
                type="number"
                min="1"
                max="24"
                value={labelCount}
                onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 text-xs border border-[#DDD3C9] rounded-md text-center tabular-nums font-semibold"
              />
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A1525] hover:bg-[#3B0F1E] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Labels</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Labels Sheet Preview */}
        <div className="p-6 bg-[#F5EFEB] max-h-[500px] overflow-y-auto">
          <div
            id="printable-document"
            className="grid grid-cols-2 gap-4 max-w-xl mx-auto"
          >
            {Array.from({ length: labelCount }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white border-2 border-dashed border-[#D8CCC0] rounded-xl p-3.5 text-center shadow-xs flex flex-col justify-between"
              >
                <div>
                  <p className="font-display font-extrabold text-xs tracking-wider text-[#3B0F1E]">
                    {boutiqueName}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-800 truncate mt-0.5">
                    {product.name}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    SKU: {product.sku} {product.size ? `· ${product.size}` : ''}
                  </p>
                </div>

                {/* Barcode SVG */}
                <div
                  className="my-2 flex justify-center overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                />

                <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">{product.fabric || 'Pure Silk'}</span>
                  <span className="font-bold text-xs text-[#3B0F1E] font-display tabular-nums">
                    ₹{product.sellingPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
