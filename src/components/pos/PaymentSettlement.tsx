import React from 'react';
import { CreditCard, QrCode, Banknote, Smartphone, Landmark, Layers } from 'lucide-react';
import { PaymentMethod } from '../../types/pos.ts';

interface PaymentSettlementProps {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  grandTotal: number;
  amountReceived: number;
  onAmountReceivedChange: (amount: number) => void;
  onOpenUpiModal: () => void;
}

export const PaymentSettlement: React.FC<PaymentSettlementProps> = ({
  paymentMethod,
  onPaymentMethodChange,
  grandTotal,
  amountReceived,
  onAmountReceivedChange,
  onOpenUpiModal,
}) => {
  const changeDue = Math.max(0, amountReceived - grandTotal);
  const balanceRemaining = Math.max(0, grandTotal - amountReceived);

  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'UPI', label: 'UPI', icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: 'CASH', label: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
    { id: 'CARD', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: 'SPLIT', label: 'Split', icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-5 border border-[#E8DFD8] shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F4EFEA]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#FAF4F0] flex items-center justify-center text-[#4A1525]">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-wider text-[#3B0F1E] uppercase">
            PAYMENT SETTLEMENT
          </span>
        </div>

        <button
          onClick={onOpenUpiModal}
          type="button"
          className="text-xs font-medium text-[#6D283E] hover:text-[#3B0F1E] flex items-center gap-1.5 cursor-pointer bg-[#FAF4F0] hover:bg-[#F2ECE5] px-2.5 py-1 rounded-full transition-colors"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Show UPI QR Code</span>
        </button>
      </div>

      {/* Methods Segmented Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {methods.map((m) => {
          const isSelected = paymentMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onPaymentMethodChange(m.id);
                // When selecting UPI or Card, default amount received to exact total
                if (m.id !== 'CASH') {
                  onAmountReceivedChange(grandTotal);
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#4A1525] border-[#4A1525] text-white shadow-xs'
                  : 'bg-[#FAF8F5] border-[#DDD3C9] text-slate-700 hover:bg-[#F4EFEA]'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Cash Received & Change Calculator */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Amount Received (₹)
          </label>
          <input
            type="number"
            min="0"
            value={amountReceived || ''}
            onChange={(e) => onAmountReceivedChange(parseFloat(e.target.value) || 0)}
            placeholder={grandTotal.toString()}
            className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] font-semibold text-slate-900 tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Balance / Due (₹)
          </label>
          <div className="px-3 py-2 text-xs bg-[#F4EFEA] border border-[#DDD3C9] rounded-xl text-slate-700 font-mono tabular-nums font-semibold">
            ₹{balanceRemaining.toLocaleString('en-IN')}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Change Due (₹)
          </label>
          <div className="px-3 py-2 text-xs bg-[#EAF7EE] border border-emerald-200 rounded-xl text-emerald-800 font-mono tabular-nums font-bold">
            ₹{changeDue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
};
