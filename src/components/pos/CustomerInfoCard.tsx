import React from 'react';
import { User, Calendar, PlusCircle } from 'lucide-react';

interface CustomerInfoCardProps {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  invoiceNumber: string;
  billingDate: string;
  onCustomerNameChange: (val: string) => void;
  onCustomerPhoneChange: (val: string) => void;
  onCustomerEmailChange: (val: string) => void;
  onBillingDateChange: (val: string) => void;
  onOpenCustomerModal: () => void;
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customerName,
  customerPhone,
  customerEmail,
  invoiceNumber,
  billingDate,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onBillingDateChange,
  onOpenCustomerModal,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 lg:p-5 border border-[#E8DFD8] shadow-xs transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F4EFEA]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#FAF4F0] flex items-center justify-center text-[#4A1525]">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-wider text-[#3B0F1E] uppercase">
            CUSTOMER INFORMATION
          </span>
        </div>
        <button
          onClick={onOpenCustomerModal}
          type="button"
          className="text-xs font-medium text-[#6D283E] hover:text-[#3B0F1E] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>+ Select / Add Customer</span>
        </button>
      </div>

      {/* Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Customer Name */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Customer Name
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="e.g. Ananya Sharma"
            className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="e.g. 9876543210"
            className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 placeholder:text-slate-400 tabular-nums"
          />
        </div>

        {/* Invoice Number (Auto) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Invoice Number
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={invoiceNumber}
              className="w-full px-3 py-2 text-xs bg-[#F4EFEA] border border-[#DDD3C9] rounded-xl text-slate-700 font-mono tabular-nums font-semibold pr-14 cursor-not-allowed"
            />
            <span className="absolute right-2 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#E5DCD3] text-[#5A4B44]">
              AUTO
            </span>
          </div>
        </div>

        {/* Billing Date */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Billing Date
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={billingDate}
              onChange={(e) => onBillingDateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 tabular-nums pr-8"
            />
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Email / City (Optional) */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Email / City (Optional)
          </label>
          <input
            type="text"
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
            placeholder="e.g. patron@boutique.in"
            className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>
    </div>
  );
};
