import React, { useState } from 'react';
import { X, Search, UserPlus, Check, User } from 'lucide-react';
import { Customer } from '../../types/pos.ts';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer: (customerData: Partial<Customer>) => Promise<void>;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  onSelectCustomer,
  onAddCustomer,
}) => {
  const [tab, setTab] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    try {
      await onAddCustomer({ name, phone, email, city });
      setName('');
      setPhone('');
      setEmail('');
      setCity('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#E8DFD8] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-5 border-b border-[#E8DFD8] flex items-center justify-between bg-[#FAF7F4]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#4A1525]" />
            <h3 className="font-display font-bold text-base text-slate-900">
              Select or Register Customer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E8DFD8] bg-white">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 cursor-pointer transition-colors ${
              tab === 'search'
                ? 'border-[#4A1525] text-[#4A1525] bg-[#FAF8F5]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Existing Customers ({customers.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 cursor-pointer transition-colors ${
              tab === 'create'
                ? 'border-[#4A1525] text-[#4A1525] bg-[#FAF8F5]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            + Register New Patron
          </button>
        </div>

        {/* Tab 1: Search */}
        {tab === 'search' && (
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patron name, phone, or city..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4A1525]"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-[#F4EFEA] border border-[#E8DFD8] rounded-xl">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectCustomer(c);
                    onClose();
                  }}
                  className="p-3 hover:bg-[#FAF7F4] cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {c.phone} {c.city ? `· ${c.city}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {c.loyaltyPoints} pts
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Total: ₹{c.totalSpent.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No customers found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Create */}
        {tab === 'create' && (
          <form onSubmit={handleCreateSubmit} className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gayatri Devi"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:ring-1 focus:ring-[#4A1525]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9845012345"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:ring-1 focus:ring-[#4A1525]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patron@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:ring-1 focus:ring-[#4A1525]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:ring-1 focus:ring-[#4A1525]"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name || !phone}
                className="px-4 py-2 text-xs font-bold bg-[#4A1525] hover:bg-[#3B0F1E] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save & Select'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
