import React from 'react';
import { X, QrCode, Smartphone, Check } from 'lucide-react';
import { BusinessSettings } from '../../types/pos.ts';

interface UpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  invoiceNumber: string;
  businessSettings: BusinessSettings;
  onConfirmPayment: () => void;
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  invoiceNumber,
  businessSettings,
  onConfirmPayment,
}) => {
  if (!isOpen) return null;

  // Real UPI URI specification for Indian Payment Gateway
  const upiUri = `upi://pay?pa=${encodeURIComponent(businessSettings.upiVpa)}&pn=${encodeURIComponent(
    businessSettings.upiMerchantName
  )}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent(invoiceNumber)}`;

  // Quick reliable SVG-based QR code display
  // We can use the open QR code service or dynamic SVG matrix
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    upiUri
  )}&color=3B0F1E&bgcolor=FFFFFF`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E8DFD8] overflow-hidden text-center">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#E8DFD8] flex items-center justify-between bg-[#FAF7F4]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#4A1525]" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              UPI Instant Payment
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs text-slate-500 mb-1">Scan with any UPI App</p>
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-[#5A4B44] mb-4">
            <span className="bg-[#FAF4F0] px-2 py-0.5 rounded border border-[#E8DFD8]">GPay</span>
            <span className="bg-[#FAF4F0] px-2 py-0.5 rounded border border-[#E8DFD8]">PhonePe</span>
            <span className="bg-[#FAF4F0] px-2 py-0.5 rounded border border-[#E8DFD8]">Paytm</span>
            <span className="bg-[#FAF4F0] px-2 py-0.5 rounded border border-[#E8DFD8]">BHIM</span>
          </div>

          {/* QR Container */}
          <div className="mx-auto w-52 h-52 p-3 bg-white border-2 border-[#E8DFD8] rounded-2xl shadow-sm flex items-center justify-center mb-4">
            <img
              src={qrImageUrl}
              alt="UPI QR Code"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback styled visual representation if external image blocked
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E8DFD8] mb-5 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Payable Amount:</span>
              <span className="font-bold text-slate-900 font-display text-sm tabular-nums">
                ₹{grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Merchant VPA:</span>
              <span className="font-mono text-slate-700">{businessSettings.upiVpa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reference:</span>
              <span className="font-mono text-slate-700">{invoiceNumber}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirmPayment();
                onClose();
              }}
              type="button"
              className="flex-1 py-2 text-xs font-bold bg-[#4A1525] hover:bg-[#3B0F1E] text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Confirm Received</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
