import React from 'react';
import { X, Clock, Play, Trash2, ShoppingBag } from 'lucide-react';
import { HeldBill } from '../../types/pos.ts';

interface HeldBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldBills: HeldBill[];
  onResumeBill: (billId: string) => void;
  onDeleteHeldBill: (billId: string) => void;
}

export const HeldBillsModal: React.FC<HeldBillsModalProps> = ({
  isOpen,
  onClose,
  heldBills,
  onResumeBill,
  onDeleteHeldBill,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#E8DFD8] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#E8DFD8] flex items-center justify-between bg-[#FAF7F4]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#4A1525]" />
            <h3 className="font-display font-bold text-base text-slate-900">
              Held Bills ({heldBills.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Held Bills */}
        <div className="p-4 max-h-[420px] overflow-y-auto divide-y divide-[#F4EFEA]">
          {heldBills.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#4A1525]" />
              No currently held bills. Park a bill anytime from the billing workspace.
            </div>
          ) : (
            heldBills.map((b) => (
              <div
                key={b.id}
                className="py-3 px-1 flex items-center justify-between hover:bg-[#FAF8F5] rounded-xl transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 font-mono">
                      {b.holdNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">· {b.heldAt}</span>
                  </div>
                  <p className="font-semibold text-xs text-[#3B0F1E] mt-0.5">
                    {b.customerName} {b.customerPhone ? `(${b.customerPhone})` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {b.items.length} {b.items.length === 1 ? 'piece' : 'pieces'} · Total:{' '}
                    <span className="font-bold text-slate-800">
                      ₹{b.grandTotal.toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onResumeBill(b.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#4A1525] hover:bg-[#3B0F1E] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume</span>
                  </button>

                  <button
                    onClick={() => onDeleteHeldBill(b.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Discard held bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
