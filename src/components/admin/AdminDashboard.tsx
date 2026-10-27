import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ScanBarcode,
  Boxes,
  Receipt,
  Users,
  RotateCcw,
  UserCheck,
  Percent,
  Settings,
  BarChart3,
  Search,
  Printer,
  Download,
  Trash2,
  Edit,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import {
  Product,
  Customer,
  Invoice,
  BusinessSettings,
  TaxSettings,
  StaffUser,
  InventoryMovement,
  SalesReturn,
} from '../../types/pos.ts';
import { generateBarcodeSvg } from '../../lib/barcodeGenerator.ts';
import { BarcodePrintModal } from './BarcodePrintModal.tsx';

interface AdminDashboardProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  businessSettings: BusinessSettings;
  taxSettings: TaxSettings;
  staff: StaffUser[];
  currentStaff: StaffUser;
  onRefreshData: () => Promise<void>;
  onCloseAdmin: () => void;
  onSwitchStaff: (userId: string) => Promise<void>;
}

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'add-product'
  | 'barcodes'
  | 'inventory'
  | 'invoices'
  | 'customers'
  | 'returns'
  | 'staff'
  | 'tax-settings'
  | 'business-settings'
  | 'reports';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  customers,
  invoices,
  businessSettings,
  taxSettings,
  staff,
  currentStaff,
  onRefreshData,
  onCloseAdmin,
  onSwitchStaff,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedProductForPrint, setSelectedProductForPrint] = useState<Product | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Add Product Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    productId: '',
    sku: '',
    barcode: '',
    category: 'Fancy Sarees',
    brand: 'Charmiqe Atelier',
    description: '',
    costPrice: 5000,
    sellingPrice: 8999,
    discountPercent: 0,
    gstRate: 12,
    stock: 10,
    lowStockThreshold: 3,
    fabric: 'Pure Silk',
    color: 'Maroon',
    size: 'Free Size',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Inventory Adjustment Modal / State
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQtyDelta, setAdjustQtyDelta] = useState(1);
  const [adjustReason, setAdjustReason] = useState('New Shipment Received');
  const [adjustSuccess, setAdjustSuccess] = useState('');

  // Return Processing State
  const [returnInvoiceId, setReturnInvoiceId] = useState('');
  const [returnReason, setReturnReason] = useState('Size / fit exchange');
  const [returnSuccess, setReturnSuccess] = useState('');

  // Dashboard Stats calculation
  const totalSales = invoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalInvoices = invoices.length;
  const avgTicket = totalInvoices > 0 ? Math.round(totalSales / totalInvoices) : 0;
  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;

  const categories = ['ALL', 'Fancy Sarees', 'Party Wear Sarees', 'Designer Fancy Sarees', 'Cotton Sarees', 'Linen Sarees', 'Handloom Sarees', 'Khadi Sarees'];

  // Auto-generate unique barcode
  const handleAutoGenerateBarcode = async () => {
    try {
      const res = await fetch('/api/barcodes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'CHQ' }),
      });
      const data = await res.json();
      if (data.barcode) {
        setFormData((prev) => ({
          ...prev,
          barcode: data.barcode,
          sku: prev.sku || `SKU-${data.barcode.slice(-5)}`,
          productId: prev.productId || `PRD-${data.barcode.slice(-3)}`,
        }));
      }
    } catch {
      // Fallback local generation
      const ts = Date.now().toString().slice(-6);
      setFormData((prev) => ({
        ...prev,
        barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        sku: prev.sku || `SKU-${ts}`,
        productId: prev.productId || `PRD-${ts.slice(-3)}`,
      }));
    }
  };

  // Submit Product Form
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    try {
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save product');
      }

      setFormSuccess(editingId ? 'Product updated successfully!' : 'New product created successfully!');
      await onRefreshData();

      if (!editingId) {
        setFormData({
          name: '',
          productId: '',
          sku: '',
          barcode: '',
          category: 'Fancy Sarees',
          brand: 'Charmiqe Atelier',
          description: '',
          costPrice: 5000,
          sellingPrice: 8999,
          discountPercent: 0,
          gstRate: 12,
          stock: 10,
          lowStockThreshold: 3,
          fabric: 'Pure Silk',
          color: 'Maroon',
          size: 'Free Size',
        });
      }
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  // Edit existing product
  const startEditProduct = (prod: Product) => {
    setEditingId(prod.id);
    setFormData(prod);
    setActiveTab('add-product');
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle inventory adjustment
  const handleInventoryAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId) return;

    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustProductId,
          quantityDelta: adjustQtyDelta,
          reason: adjustReason,
        }),
      });
      if (res.ok) {
        setAdjustSuccess('Stock updated successfully!');
        await onRefreshData();
        setTimeout(() => setAdjustSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle invoice return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnInvoiceId) return;

    const targetInvoice = invoices.find(
      (i) => i.invoiceNumber === returnInvoiceId || i.id === returnInvoiceId
    );
    if (!targetInvoice) {
      alert('Invoice not found');
      return;
    }

    try {
      const itemsToReturn = targetInvoice.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }));

      const res = await fetch(`/api/invoices/${targetInvoice.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToReturn,
          reason: returnReason,
        }),
      });

      if (res.ok) {
        setReturnSuccess(`Return processed successfully for ${targetInvoice.invoiceNumber}`);
        await onRefreshData();
        setTimeout(() => setReturnSuccess(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter === 'ALL' || p.category.toLowerCase() === categoryFilter.toLowerCase();
    const q = productSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      p.productId.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F7F3EE] flex flex-col">
      {/* Top Bar inside Admin */}
      <div className="bg-white border-b border-[#E8DFD8] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#4A1525] text-white flex items-center justify-center font-display font-bold text-sm">
            V
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-[#3B0F1E] leading-tight">
              CHARMIQE Boutique Admin Console
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Enterprise POS & Inventory Management · Authoritative PostgreSQL Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Cashier selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Logged as:</span>
            <select
              value={currentStaff.id}
              onChange={(e) => onSwitchStaff(e.target.value)}
              className="text-xs bg-[#FAF7F4] border border-[#DDD3C9] rounded-lg px-2 py-1 font-semibold text-slate-800"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onCloseAdmin}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#4A1525] text-white text-xs font-semibold hover:bg-[#3B0F1E] transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Return to POS Billing</span>
          </button>
        </div>
      </div>

      {/* Main Admin Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden max-w-[1720px] w-full mx-auto">
        {/* Sidebar Navigation */}
        <aside className="w-60 bg-white border-r border-[#E8DFD8] p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <nav className="space-y-1">
            <span className="text-[10px] font-bold text-[#7D6B65] uppercase tracking-wider px-3 mb-2 block">
              MANAGEMENT
            </span>

            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
              { id: 'add-product', label: editingId ? 'Edit Product' : 'Add Product', icon: <PlusCircle className="w-4 h-4" /> },
              { id: 'barcodes', label: 'Barcode Management', icon: <ScanBarcode className="w-4 h-4" /> },
              { id: 'inventory', label: 'Inventory / Stock', icon: <Boxes className="w-4 h-4" /> },
              { id: 'invoices', label: 'Sales & Invoices', icon: <Receipt className="w-4 h-4" /> },
              { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
              { id: 'returns', label: 'Returns & Refunds', icon: <RotateCcw className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as AdminTab);
                  if (tab.id === 'add-product' && !editingId) {
                    setFormData({
                      name: '',
                      productId: '',
                      sku: '',
                      barcode: '',
                      category: 'Fancy Sarees',
                      brand: 'Charmiqe Atelier',
                      description: '',
                      costPrice: 5000,
                      sellingPrice: 8999,
                      discountPercent: 0,
                      gstRate: 12,
                      stock: 10,
                      lowStockThreshold: 3,
                      fabric: 'Pure Silk',
                      color: 'Maroon',
                      size: 'Free Size',
                    });
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                  activeTab === tab.id
                    ? 'bg-[#4A1525] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-[#FAF7F4] hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}

            <span className="text-[10px] font-bold text-[#7D6B65] uppercase tracking-wider px-3 pt-4 mb-2 block">
              SETTINGS & SYSTEM
            </span>

            {[
              { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'staff', label: 'Staff & Cashiers', icon: <UserCheck className="w-4 h-4" /> },
              { id: 'tax-settings', label: 'Tax Settings', icon: <Percent className="w-4 h-4" /> },
              { id: 'business-settings', label: 'Business Settings', icon: <Settings className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                  activeTab === tab.id
                    ? 'bg-[#4A1525] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-[#FAF7F4] hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-4 border-t border-[#E8DFD8] text-[10px] text-slate-400">
            <p className="font-semibold text-slate-600">Charmiqe POS v2.6</p>
            <p>Windows USB Scanner Mode</p>
          </div>
        </aside>

        {/* Admin Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <span className="text-[11px] font-bold text-[#7D6B65] uppercase tracking-wider">
                    Today's Total Sales
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <p className="font-display font-extrabold text-2xl text-slate-900 tabular-nums">
                      ₹{totalSales.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> +14%
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <span className="text-[11px] font-bold text-[#7D6B65] uppercase tracking-wider">
                    Total Invoices Generated
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <p className="font-display font-extrabold text-2xl text-slate-900 tabular-nums">
                      {totalInvoices}
                    </p>
                    <span className="text-[11px] text-slate-500">Live POS count</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <span className="text-[11px] font-bold text-[#7D6B65] uppercase tracking-wider">
                    Average Invoice Value
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <p className="font-display font-extrabold text-2xl text-slate-900 tabular-nums">
                      ₹{avgTicket.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[11px] text-slate-500">Per ticket</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <span className="text-[11px] font-bold text-[#7D6B65] uppercase tracking-wider">
                    Low Stock Alerts
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <p className="font-display font-extrabold text-2xl text-amber-600 tabular-nums">
                      {lowStockCount} pieces
                    </p>
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Reorder
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Invoices */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Invoices Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Recent Boutique Sales
                    </h3>
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className="text-xs font-semibold text-[#6D283E] hover:underline cursor-pointer"
                    >
                      View all &rarr;
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                          <th className="pb-2">Invoice #</th>
                          <th className="pb-2">Customer</th>
                          <th className="pb-2">Method</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.slice(0, 5).map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#FAF7F4]">
                            <td className="py-2.5 font-mono font-semibold text-slate-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2.5 text-slate-700">{inv.customerName}</td>
                            <td className="py-2.5 text-slate-600">{inv.paymentMethod}</td>
                            <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                              ₹{inv.grandTotal.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800">
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                  <h3 className="font-display font-bold text-base text-slate-900 mb-4">
                    Featured Boutique Pieces
                  </h3>
                  <div className="space-y-3">
                    {products.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                        <div>
                          <p className="font-semibold text-slate-900 truncate max-w-[150px]">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Stock: {p.stock}</p>
                        </div>
                        <span className="font-bold text-[#4A1525] tabular-nums font-display">
                          ₹{p.sellingPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS LIST */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-[#E8DFD8]">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search by name, SKU, barcode..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl px-3 py-1.5 font-medium text-slate-700"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    setEditingId(null);
                    setActiveTab('add-product');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#4A1525] hover:bg-[#3B0F1E] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add New Product</span>
                </button>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF7F4] border-b border-[#E8DFD8] text-[11px] font-bold text-[#5C4D46] uppercase">
                        <th className="py-3 px-4">Product Details</th>
                        <th className="py-3 px-3">SKU / Barcode</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Cost</th>
                        <th className="py-3 px-3 text-right">Selling Price</th>
                        <th className="py-3 px-3 text-center">GST</th>
                        <th className="py-3 px-3 text-center">Stock</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F4EFEA]">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF9F7]">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{p.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              ID: {p.productId} · {p.fabric || 'Pure Silk'}
                            </p>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-700">
                            <p className="font-semibold">{p.sku}</p>
                            <p className="text-[10px] text-slate-500">{p.barcode}</p>
                          </td>

                          <td className="py-3 px-3 text-slate-600">{p.category}</td>

                          <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                            ₹{p.costPrice.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-right tabular-nums font-bold text-[#4A1525]">
                            ₹{p.sellingPrice.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-center font-mono">{p.gstRate}%</td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.stock <= p.lowStockThreshold
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {p.stock}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedProductForPrint(p);
                                  setIsPrintModalOpen(true);
                                }}
                                className="p-1 text-slate-600 hover:text-[#4A1525] cursor-pointer"
                                title="Print Barcode Tag"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startEditProduct(p)}
                                className="p-1 text-slate-600 hover:text-blue-600 cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADD / EDIT PRODUCT FORM */}
          {activeTab === 'add-product' && (
            <div className="max-w-3xl bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs">
              <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
                {editingId ? 'Edit Boutique Piece' : 'Add New Boutique Piece'}
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Register inventory details, barcode values, and GST rates for retail point-of-sale.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Royal Crimson Kanjivaram Saree"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white focus:ring-1 focus:ring-[#4A1525]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category || 'Fancy Sarees'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    >
                      {categories.filter((c) => c !== 'ALL').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SKU and Barcode Auto Generation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product ID
                    </label>
                    <input
                      type="text"
                      value={formData.productId || ''}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      placeholder="e.g. PRD-881"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unique SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. KAN-881"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Barcode (Code 128) *
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoGenerateBarcode}
                        className="text-[10px] font-semibold text-[#6D283E] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        Auto-Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="e.g. 8901234567893"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Pricing and Taxes */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cost Price (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.costPrice || 0}
                      onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.sellingPrice || 0}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white font-bold text-slate-900 tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GST Rate (%)
                    </label>
                    <select
                      value={formData.gstRate || 12}
                      onChange={(e) => setFormData({ ...formData, gstRate: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5% (Apparel &lt; 1000)</option>
                      <option value={12}>12% (Luxury Silks & Sarees)</option>
                      <option value={18}>18% (Accessories)</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Stock *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.stock ?? 0}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white tabular-nums font-semibold"
                    />
                  </div>
                </div>

                {/* Fabric, Color, Size */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fabric / Material
                    </label>
                    <input
                      type="text"
                      value={formData.fabric || ''}
                      onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
                      placeholder="e.g. Pure Mulberry Silk"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.color || ''}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="e.g. Royal Crimson"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Size
                    </label>
                    <input
                      type="text"
                      value={formData.size || ''}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="e.g. Free Size / M / L"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setActiveTab('products');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold bg-[#4A1525] hover:bg-[#3B0F1E] text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingId ? 'Save Changes' : 'Create Product & Save to Database'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: BARCODE MANAGEMENT */}
          {activeTab === 'barcodes' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs">
                <h3 className="font-display font-bold text-base text-slate-900 mb-2">
                  Barcode Label Catalog (Code 128)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Print individual or batch barcode price labels formatted for retail tagging and fast USB scanning.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {products.map((p) => {
                    const svg = generateBarcodeSvg(p.barcode, { height: 40, moduleWidth: 1.2 });
                    return (
                      <div
                        key={p.id}
                        className="p-4 border border-[#E8DFD8] rounded-xl bg-[#FAF8F5] flex flex-col justify-between"
                      >
                        <div>
                          <p className="font-semibold text-xs text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            SKU: {p.sku} · ₹{p.sellingPrice.toLocaleString('en-IN')}
                          </p>
                        </div>

                        <div
                          className="my-3 flex justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: svg }}
                        />

                        <button
                          onClick={() => {
                            setSelectedProductForPrint(p);
                            setIsPrintModalOpen(true);
                          }}
                          className="w-full py-1.5 text-center text-[11px] font-semibold bg-white border border-[#DDD3C9] hover:border-[#4A1525] text-slate-800 rounded-lg cursor-pointer"
                        >
                          Print Labels
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INVENTORY / STOCK */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Stock adjustment box */}
              <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs">
                <h3 className="font-display font-bold text-base text-slate-900 mb-1">
                  Adjust Inventory Stock
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Record inward shipments, damages, or manual inventory counts with automatic ledger logging.
                </p>

                {adjustSuccess && (
                  <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                    {adjustSuccess}
                  </div>
                )}

                <form onSubmit={handleInventoryAdjustSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Select Piece
                    </label>
                    <select
                      value={adjustProductId}
                      onChange={(e) => setAdjustProductId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                    >
                      <option value="">-- Choose Piece --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Cur Stock: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Delta (+ for Inward, - for Loss)
                    </label>
                    <input
                      type="number"
                      value={adjustQtyDelta}
                      onChange={(e) => setAdjustQtyDelta(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl tabular-nums font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Adjustment Reason
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. New consignment intake"
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={!adjustProductId}
                      className="w-full py-2 bg-[#4A1525] hover:bg-[#3B0F1E] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Apply Adjustment
                    </button>
                  </div>
                </form>
              </div>

              {/* Stock Table */}
              <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F4] border-b border-[#E8DFD8] text-[10px] font-bold text-[#5C4D46] uppercase">
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Current Stock</th>
                      <th className="py-2.5 px-3 text-center">Threshold</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4EFEA]">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.sku}</td>
                        <td className="py-2.5 px-3 text-center font-bold tabular-nums text-slate-900">
                          {p.stock}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">
                          {p.lowStockThreshold}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.stock <= p.lowStockThreshold
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: SALES & INVOICES */}
          {activeTab === 'invoices' && (
            <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E8DFD8] flex justify-between items-center bg-[#FAF7F4]">
                <h3 className="font-display font-bold text-base text-slate-900">
                  Authoritative Sales Invoices ({invoices.length})
                </h3>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F4] border-b border-[#E8DFD8] text-[10px] font-bold text-[#5C4D46] uppercase">
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Patron Name</th>
                    <th className="py-2.5 px-3">Cashier</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Tax Base</th>
                    <th className="py-2.5 px-3 text-right">Total GST</th>
                    <th className="py-2.5 px-4 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EFEA]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#FAF9F7]">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                        <a
                          href={`/api/invoices/${encodeURIComponent(inv.invoiceNumber)}/pdf`}
                          download={`${inv.invoiceNumber}.pdf`}
                          className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 bg-[#4A1525] text-white hover:bg-[#3B0F1E] font-sans text-[10px]"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">{inv.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{inv.customerName}</td>
                      <td className="py-3 px-3 text-slate-600">{inv.cashierName}</td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">{inv.paymentMethod}</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                        ₹{inv.taxableBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                        ₹{inv.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#4A1525] tabular-nums font-display text-sm">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E8DFD8] bg-[#FAF7F4]">
                <h3 className="font-display font-bold text-base text-slate-900">
                  Registered Patrons & Loyalty
                </h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8DFD8] text-[10px] font-bold text-[#5C4D46] uppercase bg-[#FAF8F5]">
                    <th className="py-2.5 px-4">Customer Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">City</th>
                    <th className="py-2.5 px-3 text-center">Visits</th>
                    <th className="py-2.5 px-3 text-center">Loyalty Pts</th>
                    <th className="py-2.5 px-4 text-right">Lifetime Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EFEA]">
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="py-3 px-3 text-slate-600">{c.city || '—'}</td>
                      <td className="py-3 px-3 text-center font-semibold">{c.totalPurchases}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                          {c.loyaltyPoints}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#4A1525] tabular-nums">
                        ₹{c.totalSpent.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 8: RETURNS & REFUNDS */}
          {activeTab === 'returns' && (
            <div className="max-w-2xl bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs">
              <h3 className="font-display font-bold text-base text-slate-900 mb-1">
                Process Garment Return / Refund
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Restores piece stock to inventory and generates a formal refund audit trail.
              </p>

              {returnSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                  {returnSuccess}
                </div>
              )}

              <form onSubmit={handleReturnSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Invoice Number *
                  </label>
                  <select
                    value={returnInvoiceId}
                    onChange={(e) => setReturnInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl font-mono"
                  >
                    <option value="">-- Choose an Invoice --</option>
                    {invoices.map((i) => (
                      <option key={i.id} value={i.invoiceNumber}>
                        {i.invoiceNumber} - {i.customerName} (₹{i.grandTotal.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. Size exchange / Customer changed preference"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!returnInvoiceId}
                  className="px-6 py-2.5 text-xs font-bold bg-[#4A1525] hover:bg-[#3B0F1E] text-white rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Process Return & Restock Pieces
                </button>
              </form>
            </div>
          )}

          {/* TAB 9: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs">
                <h3 className="font-display font-bold text-base text-slate-900 mb-4">
                  Financial & GST Tax Reports
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Cumulative Taxable Turnover
                    </span>
                    <p className="font-display font-extrabold text-xl text-slate-900 mt-1 tabular-nums">
                      ₹
                      {invoices
                        .reduce((a, b) => a + b.taxableBase, 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="p-4 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Total CGST Collected
                    </span>
                    <p className="font-display font-extrabold text-xl text-slate-900 mt-1 tabular-nums">
                      ₹
                      {invoices
                        .reduce((a, b) => a + b.cgstTotal, 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="p-4 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Total SGST Collected
                    </span>
                    <p className="font-display font-extrabold text-xl text-slate-900 mt-1 tabular-nums">
                      ₹
                      {invoices
                        .reduce((a, b) => a + b.sgstTotal, 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  GSTIN Filing summary is calculated according to Central & State Goods and Services Tax Slabs (CGST 6% + SGST 6% for 12% category).
                </p>
              </div>
            </div>
          )}

          {/* TAB 10: STAFF */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden max-w-2xl">
              <div className="p-4 border-b border-[#E8DFD8] bg-[#FAF7F4]">
                <h3 className="font-display font-bold text-base text-slate-900">
                  Authorized Boutique Cashiers & Roles
                </h3>
              </div>
              <div className="divide-y divide-[#F4EFEA]">
                {staff.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-slate-500">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EADECE] text-[#4A1525] font-bold text-[10px]">
                        {s.role}
                      </span>
                      {currentStaff.id === s.id ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => onSwitchStaff(s.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-[#FAF7F4] hover:bg-[#EAE2D8] text-slate-800 rounded-lg border border-[#DDD3C9] cursor-pointer"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: TAX SETTINGS */}
          {activeTab === 'tax-settings' && (
            <div className="max-w-xl bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900">
                GST Tax Slabs & Configuration
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Default Boutique GST Slab
                  </label>
                  <select
                    defaultValue={taxSettings.defaultGstRate}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                  >
                    <option value={5}>5%</option>
                    <option value={12}>12% (Standard Boutique Silk)</option>
                    <option value={18}>18%</option>
                  </select>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8DFD8] text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Boutique Tax Scheme:</p>
                  <p>• Intrastate transactions split evenly between CGST (50%) and SGST (50%).</p>
                  <p>• Authoritative prices and GST percentages are calculated server-side.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: BUSINESS SETTINGS */}
          {activeTab === 'business-settings' && (
            <div className="max-w-2xl bg-white rounded-2xl p-6 border border-[#E8DFD8] shadow-xs space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900">
                Boutique Stationery & Invoice Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Boutique Name</label>
                  <input
                    type="text"
                    defaultValue={businessSettings.boutiqueName}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    defaultValue={businessSettings.tagline}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    defaultValue={businessSettings.address}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    defaultValue={businessSettings.gstin}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">UPI VPA</label>
                  <input
                    type="text"
                    defaultValue={businessSettings.upiVpa}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD3C9] rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Barcode Print Modal */}
      <BarcodePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedProductForPrint(null);
        }}
        product={selectedProductForPrint}
        boutiqueName={businessSettings.boutiqueName}
      />
    </div>
  );
};
