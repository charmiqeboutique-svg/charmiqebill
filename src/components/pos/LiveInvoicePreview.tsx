import React, { useState } from 'react';
import { Printer, LayoutDashboard, Save, Check, Download } from 'lucide-react';
import { InvoiceItem, PaymentMethod, BusinessSettings } from '../../types/pos.ts';
import { generateBarcodeSvg } from '../../lib/barcodeGenerator.ts';

interface LiveInvoicePreviewProps {
  businessSettings: BusinessSettings;
  invoiceNumber: string;
  billingDate: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  cashierName: string;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxableBase: number;
  cgstTotal: number;
  sgstTotal: number;
  totalGst: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PAID' | 'PENDING';
  onOpenAdmin: () => void;
  previewMode?: 'a4' | 'thermal';
  onTogglePreviewMode?: (mode: 'a4' | 'thermal') => void;
  onSaveInvoice: () => void;
  isProcessing: boolean;
  isInvoiceSaved: boolean;
}

export const LiveInvoicePreview: React.FC<LiveInvoicePreviewProps> = ({
  businessSettings,
  invoiceNumber,
  billingDate,
  customerName,
  customerPhone,
  customerEmail,
  cashierName,
  items,
  subtotal,
  taxableBase,
  cgstTotal,
  sgstTotal,
  totalGst,
  grandTotal,
  paymentMethod,
  paymentStatus,
  onOpenAdmin,
  previewMode: controlledMode,
  onTogglePreviewMode,
  onSaveInvoice,
  isProcessing,
  isInvoiceSaved,
}) => {
  const [internalMode, setInternalMode] = useState<'a4' | 'thermal'>('a4');
  const mode = controlledMode || internalMode;
  const setMode = onTogglePreviewMode || setInternalMode;

  const handlePrint = () => {
    window.print();
  };

  const invoiceBarcodeSvg = generateBarcodeSvg(invoiceNumber || 'INV-2026-6353', {
    height: 48,
    moduleWidth: 1.5,
    showText: true,
  });

  return (
    <div className="flex flex-col h-full bg-[#FAF7F4] relative">
      {/* Preview Header & Controls */}
      <div className="bg-white border-b border-[#E8DFD8] p-3.5 px-4 lg:px-5 flex items-center justify-between gap-3 shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#4A1525] text-white flex items-center justify-center font-display font-bold text-xs">
            V
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 leading-tight">
              Live Invoice Preview
            </h3>
            <p className="text-[10px] text-slate-500">
              Real-time stationery & POS receipt render
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* A4 vs Thermal Toggle */}
          <div className="flex items-center p-0.5 bg-[#FAF7F4] border border-[#DDD3C9] rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setMode('a4')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                mode === 'a4'
                  ? 'bg-white text-[#3B0F1E] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A4 Invoice
            </button>
            <button
              type="button"
              onClick={() => setMode('thermal')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                mode === 'thermal'
                  ? 'bg-white text-[#3B0F1E] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              80mm Thermal
            </button>
          </div>

          <button
            type="button"
            onClick={onSaveInvoice}
            disabled={items.length === 0 || isProcessing || isInvoiceSaved}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50 ${
              isInvoiceSaved
                ? 'bg-emerald-700 text-white'
                : 'bg-[#7D2840] hover:bg-[#652035] text-white'
            }`}
          >
            {isInvoiceSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isProcessing ? 'Saving…' : isInvoiceSaved ? 'Saved' : 'Save Invoice'}</span>
          </button>

          {isInvoiceSaved && invoiceNumber && (
            <a
              href={`/api/invoices/${encodeURIComponent(invoiceNumber)}/pdf`}
              download={`${invoiceNumber}.pdf`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          )}

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A0B15] hover:bg-black text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Canvas Container */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex justify-center bg-[#F3EDE6]">
        {/* Printable Document ID for @media print styles */}
        <div id="printable-document" className="w-full flex justify-center">
          {mode === 'a4' ? (
            /* ==================== A4 TAX INVOICE ==================== */
            <div className="w-full max-w-[760px] bg-white rounded-xl shadow-md border border-[#E8DFD8] p-6 lg:p-8 text-slate-800 text-xs flex flex-col justify-between min-h-[820px]">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start pb-5 border-b border-[#EAE3DA]">
                  <div>
                    <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-wider text-[#3B0F1E]">
                      {businessSettings.boutiqueName}
                    </h1>
                    <p className="text-xs italic text-[#7D6B65] mt-0.5 font-serif">
                      {businessSettings.tagline}
                    </p>
                    <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                      <p>{businessSettings.address}</p>
                      <p>
                        Phone: {businessSettings.phone} · Email: {businessSettings.email}
                      </p>
                      <p className="font-semibold text-slate-700">
                        GSTIN: {businessSettings.gstin}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block text-[10px] font-bold tracking-widest px-2.5 py-0.5 rounded-md bg-[#FAF4F0] text-[#6D283E] uppercase border border-[#EADBDF] mb-2">
                      TAX INVOICE
                    </span>
                    <p className="font-mono font-bold text-base text-slate-900 tracking-tight">
                      {invoiceNumber || 'INV-2026-6353'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Date: {billingDate || '27/10/2026'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Due: {billingDate || '27/10/2026'}
                    </p>
                    <p className="text-[11px] text-slate-600 font-medium mt-1">
                      Cashier: {cashierName}
                    </p>
                  </div>
                </div>

                {/* Client & Status Strip */}
                <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#EAE3DA]">
                  <div>
                    <span className="text-[10px] font-bold text-[#7D6B65] uppercase tracking-wider block mb-0.5">
                      BILLED TO (CLIENT)
                    </span>
                    <p className="font-bold text-sm text-slate-900">
                      {customerName || 'Walk-in Guest'}
                    </p>
                    {customerPhone && (
                      <p className="text-[11px] text-slate-600 font-mono">
                        {customerPhone}
                      </p>
                    )}
                    {customerEmail && (
                      <p className="text-[11px] text-slate-500">{customerEmail}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-[#7D6B65] uppercase tracking-wider block mb-1">
                      PAYMENT STATUS
                    </span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      <span>{paymentStatus}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 font-medium">
                      Method: {paymentMethod}
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="mt-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-2 px-1">Item Description</th>
                        <th className="py-2 px-1 text-center w-12">Qty</th>
                        <th className="py-2 px-2 text-right w-20">Rate</th>
                        <th className="py-2 px-1 text-center w-14">Disc</th>
                        <th className="py-2 px-1 text-center w-14">GST</th>
                        <th className="py-2 px-2 text-right w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                            No items added yet
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => (
                          <tr key={it.id} className="text-slate-800">
                            <td className="py-2.5 px-1">
                              <p className="font-semibold text-slate-900">{it.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                SKU: {it.sku}
                                {it.size && ` · ${it.size}`}
                                {it.color && ` · ${it.color}`}
                              </p>
                            </td>
                            <td className="py-2.5 px-1 text-center tabular-nums font-medium">
                              {it.quantity}
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                              ₹{it.unitPrice.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-1 text-center text-slate-500">
                              {it.discountPercent > 0 ? `${it.discountPercent}%` : '—'}
                            </td>
                            <td className="py-2.5 px-1 text-center text-slate-600 font-mono">
                              {it.gstRate}%
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-900 tabular-nums">
                              ₹{it.totalAmount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Summary & Terms */}
              <div className="pt-6 border-t border-[#EAE3DA] mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  {/* Left: Terms & Conditions */}
                  <div>
                    <span className="text-[10px] font-bold text-[#7D6B65] uppercase tracking-wider block mb-1">
                      TERMS & CONDITIONS:
                    </span>
                    <ul className="text-[10px] text-slate-500 space-y-0.5 list-decimal pl-3.5">
                      {businessSettings.termsAndConditions.map((term, i) => (
                        <li key={i}>{term}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: Calculations Summary */}
                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="tabular-nums font-semibold">
                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Taxable Base</span>
                      <span className="tabular-nums">
                        ₹{taxableBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">CGST</span>
                      <span className="tabular-nums">
                        ₹{cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">SGST</span>
                      <span className="tabular-nums">
                        ₹{sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-[#3B0F1E]">
                      <span>Grand Total</span>
                      <span className="tabular-nums font-display text-base">
                        ₹{grandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <p>Computer generated invoice · No signature required</p>
                  <p className="font-serif italic text-slate-500">Thank you for visiting CHARMIQE</p>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== 80mm THERMAL RECEIPT ==================== */
            <div className="w-[320px] bg-white rounded-lg shadow-md border border-[#E8DFD8] p-4 text-slate-900 font-mono text-[11px] leading-tight">
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="font-display font-extrabold text-base tracking-widest text-[#3B0F1E]">
                  {businessSettings.boutiqueName}
                </h2>
                <p className="text-[10px] italic font-serif text-slate-600 mt-0.5">
                  {businessSettings.tagline}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {businessSettings.address}
                </p>
                <p className="text-[9px] text-slate-500">Tel: {businessSettings.phone}</p>
                <p className="text-[9px] font-bold text-slate-700 mt-0.5">
                  GSTIN: {businessSettings.gstin}
                </p>
              </div>

              {/* Receipt Meta */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="font-bold">{invoiceNumber || 'INV-2026-6353'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{billingDate || '27/10/2026'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{customerName || 'Walk-in Guest'}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-2.5 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-slate-200">
                  <span>Item</span>
                  <span className="text-right">Qty × Rate = Amt</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <div key={it.id} className="py-1 text-[10px]">
                      <div className="font-bold truncate">{it.name}</div>
                      <div className="flex justify-between text-slate-600">
                        <span>{it.sku}</span>
                        <span>
                          {it.quantity} × ₹{it.unitPrice} = ₹{it.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total GST:</span>
                  <span>₹{totalGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-[#3B0F1E] pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Paid via:</span>
                  <span className="font-bold">{paymentMethod}</span>
                </div>
              </div>

              {/* Barcode & Footer */}
              <div className="pt-3 text-center">
                <div
                  className="flex justify-center mb-1 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: invoiceBarcodeSvg }}
                />
                <p className="text-[10px] italic font-serif text-slate-600 mt-1">
                  Thank you for visiting Charmiqe!
                </p>
                <p className="text-[8px] text-slate-400 mt-0.5">
                  Exchange within 7 days with original tag
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Right Button: Open Admin Dashboard */}
      <div className="absolute bottom-5 right-5 z-20 no-print">
        <button
          type="button"
          onClick={onOpenAdmin}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2A0B15] hover:bg-black text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-97"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Open Admin Dashboard</span>
        </button>
      </div>
    </div>
  );
};
