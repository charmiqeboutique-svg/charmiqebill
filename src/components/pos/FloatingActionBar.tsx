import React from 'react';
import { PauseCircle, Receipt, CheckCircle, Printer } from 'lucide-react';

interface FloatingActionBarProps {
  grandTotal: number;
  itemCount: number;
  onHoldBill: () => void;
  onPrintThermal: () => void;
  onCompleteAndPrintA4: () => void;
  isProcessing: boolean;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  grandTotal,
  itemCount,
  onHoldBill,
  onPrintThermal,
  onCompleteAndPrintA4,
  isProcessing,
}) => {
  return (
    <div className="sticky bottom-3 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-[#D8CCC0] shadow-lg p-3 lg:p-4 mt-4 transition-all">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Payable Total */}
        <div>
          <span className="block text-[10px] font-bold tracking-widest text-[#7D6B65] uppercase">
            PAYABLE GRAND TOTAL
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-2xl lg:text-3xl text-slate-900 tracking-tight tabular-nums">
              ₹{grandTotal.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto justify-end">
          {/* Hold Bill */}
          <button
            type="button"
            onClick={onHoldBill}
            disabled={itemCount === 0 || isProcessing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D8CCC0] bg-[#FAF8F5] hover:bg-[#F2ECE5] text-slate-800 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <PauseCircle className="w-4 h-4 text-[#6D283E]" />
            <span>Hold Bill</span>
          </button>

          {/* POS Receipt (80mm) */}
          <button
            type="button"
            onClick={onPrintThermal}
            disabled={itemCount === 0 || isProcessing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D8CCC0] bg-[#FAF8F5] hover:bg-[#F2ECE5] text-slate-800 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <Receipt className="w-4 h-4 text-[#6D283E]" />
            <span>POS Receipt</span>
          </button>

          {/* Complete & Print A4 */}
          <button
            type="button"
            onClick={onCompleteAndPrintA4}
            disabled={itemCount === 0 || isProcessing}
            className="flex-2 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B0F1E] hover:bg-[#2A0B15] text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-98"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{isProcessing ? 'Finalizing...' : 'Complete & Print A4'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
