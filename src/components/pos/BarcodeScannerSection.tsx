import React, { useState, useRef, useEffect } from 'react';
import { ScanBarcode, Search, CheckCircle2, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { Product } from '../../types/pos.ts';

interface BarcodeScannerSectionProps {
  onScanBarcode: (code: string) => Promise<void> | void;
  onSelectProduct: (product: Product, variantId?: string) => void;
  products: Product[];
  resetKey?: number;
  barcodeHistory?: { code: string; name: string; sku: string }[];
  scanStatus: {
    type: 'idle' | 'success' | 'error' | 'scanning';
    message: string;
  };
}

export const BarcodeScannerSection: React.FC<BarcodeScannerSectionProps> = ({
  onScanBarcode,
  onSelectProduct,
  products,
  resetKey = 0,
  barcodeHistory = [],
  scanStatus,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus barcode input for instant scanning readiness
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Clear transient search fields when the cashier starts a new bill.
  useEffect(() => {
    setBarcodeInput('');
    setCatalogQuery('');
    setShowDropdown(false);
    setShowScanHistory(false);
    barcodeInputRef.current?.focus();
  }, [resetKey]);

  // Handle manual or scanner lookup
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;
    onScanBarcode(barcodeInput.trim());
    setBarcodeInput('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Live catalog search
  useEffect(() => {
    if (!catalogQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const q = catalogQuery.toLowerCase().trim();
    const results = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q)
    );
    setSearchResults(results.slice(0, 8));
    setShowDropdown(true);
  }, [catalogQuery, products]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-5 border border-[#E8DFD8] shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Barcode Scanner */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#3B0F1E] uppercase">
              <ScanBarcode className="w-3.5 h-3.5 text-[#6D283E]" />
              <span>SCAN BARCODE (USB / KEYBOARD)</span>
            </label>
          </div>

          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <input
              ref={barcodeInputRef}
              data-barcode-input="true"
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan with connected USB barcode reader or enter code..."
              className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 placeholder:text-slate-400 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#4A1525] hover:bg-[#3B0F1E] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              Lookup
            </button>
          </form>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowScanHistory((visible) => !visible)}
              aria-expanded={showScanHistory}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-[#6D283E] hover:bg-[#FAF7F4]"
            >
              <span>Scanned products ({barcodeHistory.length})</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showScanHistory ? 'rotate-180' : ''}`} />
            </button>
            {showScanHistory && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-[#E8DFD8] bg-white divide-y divide-[#F4EFEA]">
                {barcodeHistory.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-500">Scanned products will appear here.</p>
                ) : (
                  barcodeHistory.map((entry, index) => (
                    <div key={`${entry.code}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{entry.name}</p>
                        <p className="truncate font-mono text-slate-500">{entry.sku} · {entry.code}</p>
                      </div>
                      {index === 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Latest</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Scanner connection & scan status indicator */}
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            {scanStatus.type === 'scanning' && (
              <span className="flex items-center gap-1 text-[#6D283E] font-medium animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{scanStatus.message}</span>
              </span>
            )}
            {scanStatus.type === 'error' && (
              <span className="flex items-center gap-1 text-rose-600 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{scanStatus.message}</span>
              </span>
            )}
            {(scanStatus.type === 'idle' || scanStatus.type === 'success') && (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{scanStatus.message}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Catalog Search */}
        <div ref={searchContainerRef} className="relative">
          <label className="block text-xs font-bold tracking-wider text-[#3B0F1E] uppercase mb-1.5">
            SEARCH BOUTIQUE CATALOG
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              onFocus={() => catalogQuery && setShowDropdown(true)}
              placeholder="Search by name, SKU, saree, kurti..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525] focus:border-[#4A1525] text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E8DFD8] rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto divide-y divide-[#F4EFEA]">
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p);
                    setCatalogQuery('');
                    setShowDropdown(false);
                    barcodeInputRef.current?.focus();
                  }}
                  className="p-2.5 hover:bg-[#FAF7F4] cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      SKU: {p.sku} · Barcode: {p.barcode} · {p.fabric || p.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#4A1525] tabular-nums">
                      ₹{p.sellingPrice.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Stock: <span className="font-semibold">{p.stock}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showDropdown && catalogQuery.trim() && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E8DFD8] rounded-xl shadow-lg z-30 p-3 text-center text-xs text-slate-500">
              No boutique pieces matching "{catalogQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
