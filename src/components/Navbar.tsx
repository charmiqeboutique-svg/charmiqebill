import React from 'react';
import { Clock, RotateCcw, LayoutDashboard } from 'lucide-react';
import { StaffUser } from '../types/pos.ts';

interface NavbarProps {
  currentStaff: StaffUser;
  heldBillsCount: number;
  onOpenHeldBills: () => void;
  onNewBill: () => void;
  activeView: 'pos' | 'admin';
  onToggleView: (view: 'pos' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStaff,
  heldBillsCount,
  onOpenHeldBills,
  onNewBill,
  activeView,
  onToggleView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8DFD8] px-4 lg:px-8 py-3">
      <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#4A1525] text-[#FAF7F2] flex items-center justify-center font-display font-bold text-base shadow-sm">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-lg lg:text-xl tracking-wider text-[#3B0F1E] leading-none">
                CHARMIQE
              </span>
            </div>
            <p className="text-[10px] font-semibold tracking-widest text-[#7D6B65] uppercase mt-0.5">
              BOUTIQUE POS & BILLING
            </p>
          </div>
        </div>

        {/* Action Controls & Cashier info */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* Held Bills Button */}
          <button
            onClick={onOpenHeldBills}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D8CCC0] bg-[#FAF7F4] hover:bg-[#F2ECE5] text-[#4A1525] text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="View paused or held bills"
          >
            <Clock className="w-3.5 h-3.5 text-[#6D283E]" />
            <span>Held Bills</span>
            {heldBillsCount > 0 && (
              <span className="bg-[#4A1525] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums">
                {heldBillsCount}
              </span>
            )}
          </button>

          {/* New Bill Button */}
          <button
            onClick={onNewBill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D8CCC0] bg-[#FAF7F4] hover:bg-[#F2ECE5] text-[#3B0F1E] text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="Start a fresh invoice"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#6D283E]" />
            <span>New Bill</span>
          </button>

          {/* Cashier Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF7F4] border border-[#E8DFD8]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="text-xs font-semibold text-slate-800 tracking-tight">
              {currentStaff.name}
            </span>
            <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#EADECE] text-[#4A1525]">
              {currentStaff.role}
            </span>
          </div>

          {/* Keep the POS-to-admin entry here; the admin page has its own return button. */}
          {activeView === 'pos' && (
            <button
              onClick={() => onToggleView('admin')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm cursor-pointer bg-white border border-[#4A1525] text-[#4A1525] hover:bg-[#FAF7F4]"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Open Admin Dashboard</span>
              <span className="md:hidden">Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
