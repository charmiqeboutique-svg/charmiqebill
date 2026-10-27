import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { CustomerInfoCard } from './components/pos/CustomerInfoCard.tsx';
import { BarcodeScannerSection } from './components/pos/BarcodeScannerSection.tsx';
import { QuickAddPieces } from './components/pos/QuickAddPieces.tsx';
import { BillItemsTable } from './components/pos/BillItemsTable.tsx';
import { PaymentSettlement } from './components/pos/PaymentSettlement.tsx';
import { FloatingActionBar } from './components/pos/FloatingActionBar.tsx';
import { LiveInvoicePreview } from './components/pos/LiveInvoicePreview.tsx';
import { CustomerModal } from './components/pos/CustomerModal.tsx';
import { HeldBillsModal } from './components/pos/HeldBillsModal.tsx';
import { UpiQrModal } from './components/pos/UpiQrModal.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { useBarcodeScanner } from './hooks/useBarcodeScanner.ts';
import { playCashierSuccessChime } from './lib/audioFeedback.ts';
import {
  Product,
  ProductVariant,
  Customer,
  Invoice,
  InvoiceItem,
  PaymentMethod,
  BusinessSettings,
  TaxSettings,
  StaffUser,
  HeldBill,
} from './types/pos.ts';

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'pos' | 'admin'>(() =>
    window.location.pathname === '/admin' ? 'admin' : 'pos'
  );

  // Backend Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffUser>({
    id: 'usr_01',
    name: 'Aishwarya Roy',
    email: 'charmiqe@gmail.com',
    role: 'SUPER_ADMIN',
    active: true,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('charmiqe@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffUser[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    boutiqueName: 'CHARMIQE',
    tagline: 'Haute Couture & Heritage Silks',
    address: '14 Lavelle Promenade, Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    phone: '+91 98450 12890',
    email: 'concierge@velvetandvine.in',
    gstin: '29AABCU9603R1ZM',
    currencySymbol: '₹',
    invoicePrefix: 'INV-2026-',
    termsAndConditions: [
      'Exchange within 7 days with original invoice & security tag attached.',
      'Dry clean only for pure silks and handloom garments.',
      'No cash refunds; store credit note valid for 6 months.',
    ],
    upiVpa: 'charmiqe@okhdfcbank',
    upiMerchantName: 'Charmiqe Haute Couture',
  });
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    defaultGstRate: 12,
    enableCompositionScheme: false,
    isInterstate: false,
    availableSlabs: [0, 5, 12, 18, 28],
  });

  // Active Billing State starts empty so a browser refresh opens a clean bill.
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [billResetKey, setBillResetKey] = useState(0);
  const [barcodeHistory, setBarcodeHistory] = useState<{ code: string; name: string; sku: string }[]>([]);
  const [previewMode, setPreviewMode] = useState<'a4' | 'thermal'>('a4');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedInvoiceKey, setSavedInvoiceKey] = useState('');

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isHeldBillsModalOpen, setIsHeldBillsModalOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);

  const navigateToView = useCallback((view: 'pos' | 'admin') => {
    const targetPath = view === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setActiveView(view);
  }, []);

  useEffect(() => {
    const handleBrowserNavigation = () => {
      setActiveView(window.location.pathname === '/admin' ? 'admin' : 'pos');
    };
    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, []);

  // Restore the authenticated staff session after a browser refresh.
  useEffect(() => {
    const token = window.localStorage.getItem('charmiqe_auth_token');
    if (!token) return;

    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired');
        return response.json();
      })
      .then((data) => {
        if (!cancelled && data.user) {
          setCurrentStaff(data.user);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        window.localStorage.removeItem('charmiqe_auth_token');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Products are added here only after a catalog selection or barcode scan.
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Recalculate bill financial amounts with full mathematical precision
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableBase = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let totalGst = 0;

    for (const it of items) {
      const lineSubtotal = it.unitPrice * it.quantity;
      const lineDiscount = Number(((lineSubtotal * (it.discountPercent || 0)) / 100).toFixed(2));
      const lineTaxable = Number((lineSubtotal - lineDiscount).toFixed(2));
      const lineGst = Number(((lineTaxable * it.gstRate) / 100).toFixed(2));
      const lineCgst = Number((lineGst / 2).toFixed(2));
      const lineSgst = Number((lineGst / 2).toFixed(2));

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      taxableBase += lineTaxable;
      cgstTotal += lineCgst;
      sgstTotal += lineSgst;
      totalGst += lineGst;
    }

    const grandTotal = Math.round(taxableBase + totalGst);
    return {
      subtotal,
      totalDiscount,
      taxableBase,
      cgstTotal,
      sgstTotal,
      totalGst,
      grandTotal,
    };
  }, [items]);

  const currentInvoiceKey = useMemo(
    () => JSON.stringify({
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      items: items.map(({ productId, variantId, quantity, discountPercent }) => ({
        productId,
        variantId,
        quantity,
        discountPercent,
      })),
      amountReceived,
    }),
    [customerName, customerPhone, customerEmail, paymentMethod, items, amountReceived]
  );

  const posCatalogProducts = useMemo(() => products.filter((product) => !product.adminOnly), [products]);

  // Fetch initial data from server API
  const refreshData = useCallback(async () => {
    try {
      const [prodRes, custRes, invRes, heldRes, staffRes] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/customers').then((r) => r.json()),
        fetch('/api/invoices').then((r) => r.json()),
        fetch('/api/held-bills').then((r) => r.json()),
        fetch('/api/staff').then((r) => r.json()),
      ]);

      if (Array.isArray(prodRes)) setProducts(prodRes);
      if (Array.isArray(custRes)) setCustomers(custRes);
      if (Array.isArray(invRes)) setInvoices(invRes);
      if (Array.isArray(heldRes)) setHeldBills(heldRes);
      if (Array.isArray(staffRes)) setAllStaff(staffRes);
    } catch (err) {
      console.error('Error fetching POS data from backend API:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle adding product to current bill
  const handleAddProduct = useCallback(
    (product: Product, variantId?: string) => {
      let variant: ProductVariant | undefined;
      if (variantId && product.variants) {
        variant = product.variants.find((v) => v.id === variantId);
      }

      const unitPrice = product.sellingPrice + (variant?.additionalPrice || 0);
      const gstRate = product.gstRate || taxSettings.defaultGstRate || 12;

      setItems((prev) => {
        // Check if item or variant is already in cart
        const existingIdx = prev.findIndex(
          (it) => it.productId === product.id && it.variantId === variant?.id
        );

        if (existingIdx !== -1) {
          // Increment quantity
          const updated = [...prev];
          const curr = updated[existingIdx];
          const newQty = curr.quantity + 1;
          const lineSub = unitPrice * newQty;
          const lineDisc = Number(((lineSub * curr.discountPercent) / 100).toFixed(2));
          const lineTaxable = Number((lineSub - lineDisc).toFixed(2));
          const lineGst = Number(((lineTaxable * gstRate) / 100).toFixed(2));
          const lineTotal = Number((lineTaxable + lineGst).toFixed(2));

          updated[existingIdx] = {
            ...curr,
            quantity: newQty,
            discountAmount: lineDisc,
            taxableAmount: lineTaxable,
            gstAmount: lineGst,
            cgstAmount: Number((lineGst / 2).toFixed(2)),
            sgstAmount: Number((lineGst / 2).toFixed(2)),
            totalAmount: lineTotal,
          };
          // Keep the most recently scanned/selected product at the top.
          const [currentItem] = updated.splice(existingIdx, 1);
          return [currentItem, ...updated];
        }

        // Add fresh item
        const lineSub = unitPrice * 1;
        const lineGst = Number(((lineSub * gstRate) / 100).toFixed(2));
        const lineTotal = Number((lineSub + lineGst).toFixed(2));

        const newItem: InvoiceItem = {
          id: `item_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
          productId: product.id,
          variantId: variant?.id,
          name: product.name,
          sku: variant ? variant.sku : product.sku,
          barcode: variant ? variant.barcode : product.barcode,
          size: variant ? variant.size : product.size,
          color: variant ? variant.color : product.color,
          quantity: 1,
          unitPrice,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: lineSub,
          gstRate,
          gstAmount: lineGst,
          cgstAmount: Number((lineGst / 2).toFixed(2)),
          sgstAmount: Number((lineGst / 2).toFixed(2)),
          totalAmount: lineTotal,
        };

        return [newItem, ...prev];
      });
    },
    [taxSettings.defaultGstRate]
  );

  // Barcode scan handler (called by hardware scanner or manual entry)
  const handleBarcodeScan = useCallback(
    async (scannedCode: string) => {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(scannedCode)}`);
      if (!res.ok) {
        throw new Error(`Barcode "${scannedCode}" not found in boutique inventory`);
      }
      const data = await res.json();
      if (!data.product) throw new Error(`Barcode "${scannedCode}" returned no product`);

      // Use the product returned by the barcode endpoint. This keeps the bill
      // accurate even when the barcode belongs to a size/color variant.
      const availableStock = data.variant?.stock ?? data.product.stock;
      if (availableStock <= 0) {
        throw new Error(`"${data.product.name}" is currently out of stock`);
      }
      handleAddProduct(data.product, data.variant?.id);
      setBarcodeHistory((history) => [
        {
          code: scannedCode,
          name: data.product.name,
          sku: data.variant?.sku || data.product.sku,
        },
        ...history,
      ].slice(0, 20));
    },
    [handleAddProduct]
  );

  // Hook for hardware WiredPower WPXD100 2D scanner
  const { scanStatus, processBarcode } = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: activeView === 'pos',
  });

  // Update item quantity
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const lineSub = it.unitPrice * newQty;
        const lineDisc = Number(((lineSub * it.discountPercent) / 100).toFixed(2));
        const lineTaxable = Number((lineSub - lineDisc).toFixed(2));
        const lineGst = Number(((lineTaxable * it.gstRate) / 100).toFixed(2));
        const lineTotal = Number((lineTaxable + lineGst).toFixed(2));

        return {
          ...it,
          quantity: newQty,
          discountAmount: lineDisc,
          taxableAmount: lineTaxable,
          gstAmount: lineGst,
          cgstAmount: Number((lineGst / 2).toFixed(2)),
          sgstAmount: Number((lineGst / 2).toFixed(2)),
          totalAmount: lineTotal,
        };
      })
    );
  };

  // Update item discount %
  const handleUpdateDiscount = (itemId: string, newDiscountPercent: number) => {
    const safeDisc = Math.min(100, Math.max(0, newDiscountPercent));
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const lineSub = it.unitPrice * it.quantity;
        const lineDisc = Number(((lineSub * safeDisc) / 100).toFixed(2));
        const lineTaxable = Number((lineSub - lineDisc).toFixed(2));
        const lineGst = Number(((lineTaxable * it.gstRate) / 100).toFixed(2));
        const lineTotal = Number((lineTaxable + lineGst).toFixed(2));

        return {
          ...it,
          discountPercent: safeDisc,
          discountAmount: lineDisc,
          taxableAmount: lineTaxable,
          gstAmount: lineGst,
          cgstAmount: Number((lineGst / 2).toFixed(2)),
          sgstAmount: Number((lineGst / 2).toFixed(2)),
          totalAmount: lineTotal,
        };
      })
    );
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Start a fresh bill
  const handleNewBill = () => {
    setItems([]);
    setBillResetKey((key) => key + 1);
    setBarcodeHistory([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setInvoiceNumber('');
    setBillingDate('');
    setPaymentMethod('CASH');
    setAmountReceived(0);
    setSavedInvoiceKey('');
  };

  // Hold active bill
  const handleHoldBill = async () => {
    if (items.length === 0) return;
    try {
      const holdNumber = invoiceNumber || `draft-${Date.now()}`;
      const res = await fetch(`/api/invoices/${encodeURIComponent(holdNumber)}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          items,
          subtotal: totals.subtotal,
          grandTotal: totals.grandTotal,
        }),
      });
      if (res.ok) {
        await refreshData();
        handleNewBill();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resume a held bill
  const handleResumeBill = async (billId: string) => {
    try {
      const res = await fetch(`/api/held-bills/${billId}/resume`, { method: 'POST' });
      const resumed = await res.json();
      if (resumed) {
        setItems(resumed.items);
        setCustomerName(resumed.customerName);
        setCustomerPhone(resumed.customerPhone || '');
        setCustomerEmail(resumed.customerEmail || '');
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Discard a held bill
  const handleDeleteHeldBill = async (billId: string) => {
    try {
      await fetch(`/api/held-bills/${billId}`, { method: 'DELETE' });
      await refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Complete sale, commit transaction to PostgreSQL/backend, and print A4 invoice
  const handleSaveInvoice = async () => {
    if (items.length === 0 || savedInvoiceKey) return;
    setIsProcessing(true);
    try {
      const payload = {
        customerName: customerName || 'Walk-in Guest',
        customerPhone,
        customerEmail,
        paymentMethod,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          discountPercent: it.discountPercent,
        })),
        amountReceived: amountReceived || totals.grandTotal,
      };
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const invoiceRecord = await response.json();
      if (!response.ok) throw new Error(invoiceRecord.error || 'Could not save invoice');

      setInvoiceNumber(invoiceRecord.invoiceNumber);
      setBillingDate(invoiceRecord.date);
      setSavedInvoiceKey(currentInvoiceKey);
      await refreshData();
    } catch (error: any) {
      alert(`Save failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteAndPrintA4 = async () => {
    if (items.length === 0) return;
    if (savedInvoiceKey) {
      setPreviewMode('a4');
      setTimeout(() => {
        window.print();
        handleNewBill();
      }, 300);
      return;
    }
    setIsProcessing(true);

    try {
      const payload = {
        customerName: customerName || 'Walk-in Guest',
        customerPhone,
        customerEmail,
        paymentMethod,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          discountPercent: it.discountPercent,
        })),
        amountReceived: amountReceived || totals.grandTotal,
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const invoiceRecord = await res.json();
      if (!res.ok) {
        throw new Error(invoiceRecord.error || 'Checkout failed');
      }

      playCashierSuccessChime();
      setPreviewMode('a4');
      await refreshData();

      // Trigger browser print
      setTimeout(() => {
        window.print();
        // Clear for next customer
        handleNewBill();
      }, 300);
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Thermal POS Receipt print
  const handlePrintThermal = () => {
    setPreviewMode('thermal');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Switch cashier staff
  const handleSwitchStaff = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.user) {
        setCurrentStaff(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.user) {
        setLoginError(data.error || 'Login failed. Check your email and password.');
        return;
      }
      setCurrentStaff(data.user);
      window.localStorage.setItem('charmiqe_auth_token', data.token);
      setIsAuthenticated(true);
      await refreshData();
    } catch {
      setLoginError('Unable to connect. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Add customer from modal
  const handleAddCustomer = async (custData: Partial<Customer>) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custData),
      });
      const newCust = await res.json();
      if (res.ok) {
        setCustomerName(newCust.name);
        setCustomerPhone(newCust.phone);
        if (newCust.email) setCustomerEmail(newCust.email);
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#FAF7F4] flex items-center justify-center px-4 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-[#E8DFD8] bg-white p-8 shadow-xl shadow-[#3B0F1E]/5">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold tracking-[0.28em] text-[#7D2840]">CHARMIQE</p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[#3B0F1E]">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to continue to your boutique workspace.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#E8DFD8] px-4 py-3 font-normal outline-none transition focus:border-[#7D2840] focus:ring-2 focus:ring-[#7D2840]/10"
                placeholder="name@example.com"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#E8DFD8] px-4 py-3 font-normal outline-none transition focus:border-[#7D2840] focus:ring-2 focus:ring-[#7D2840]/10"
                placeholder="Enter your password"
              />
            </label>
            {loginError && <p role="alert" className="text-sm font-medium text-red-600">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl bg-[#3B0F1E] px-4 py-3 font-semibold text-white transition hover:bg-[#5A1830] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col text-slate-900">
      {/* Top Navigation */}
      <Navbar
        currentStaff={currentStaff}
        heldBillsCount={heldBills.length}
        onOpenHeldBills={() => setIsHeldBillsModalOpen(true)}
        onNewBill={handleNewBill}
        activeView={activeView}
        onToggleView={navigateToView}
      />

      {/* Main Body */}
      {activeView === 'pos' ? (
        <div className="flex-1 max-w-[1720px] w-full mx-auto px-4 lg:px-6 py-4">
          {/* Two-Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ================= LEFT PANEL: BILLING WORKSPACE (7 cols) ================= */}
            <div className="lg:col-span-7 space-y-4">
              {/* Header Title & Tag */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-widest text-[#7D2840] uppercase">
                    POINT OF SALE
                  </span>
                  <h1 className="font-display font-bold text-2xl lg:text-3xl text-[#3B0F1E] tracking-tight">
                    Create an invoice
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add a customer and the pieces they love.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider bg-white border border-[#E8DFD8] text-[#5A4B44] uppercase shadow-2xs">
                  NEW SALE
                </span>
              </div>

              {/* Customer Information Section */}
              <CustomerInfoCard
                customerName={customerName}
                customerPhone={customerPhone}
                customerEmail={customerEmail}
                invoiceNumber={invoiceNumber}
                billingDate={billingDate}
                onCustomerNameChange={setCustomerName}
                onCustomerPhoneChange={setCustomerPhone}
                onCustomerEmailChange={setCustomerEmail}
                onBillingDateChange={setBillingDate}
                onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
              />

              {/* Barcode Scanner & Catalog Search */}
              <BarcodeScannerSection
                onScanBarcode={processBarcode}
                onSelectProduct={(p, vId) => handleAddProduct(p, vId)}
                products={posCatalogProducts}
                resetKey={billResetKey}
                barcodeHistory={barcodeHistory}
                scanStatus={scanStatus}
              />

              {/* Quick Add Popular Pieces */}
              {posCatalogProducts.length > 0 && (
                <QuickAddPieces
                  products={posCatalogProducts}
                  onAddProduct={(p) => handleAddProduct(p)}
                />
              )}

              {/* Bill Items Table */}
              <BillItemsTable
                items={items}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateDiscount={handleUpdateDiscount}
                onRemoveItem={handleRemoveItem}
              />

              {/* Payment Settlement */}
              <PaymentSettlement
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                grandTotal={totals.grandTotal}
                amountReceived={amountReceived}
                onAmountReceivedChange={setAmountReceived}
                onOpenUpiModal={() => setIsUpiModalOpen(true)}
              />

              {/* Fixed Bottom Action Bar */}
              <FloatingActionBar
                grandTotal={totals.grandTotal}
                itemCount={items.reduce((acc, it) => acc + it.quantity, 0)}
                onHoldBill={handleHoldBill}
                onPrintThermal={handlePrintThermal}
                onCompleteAndPrintA4={handleCompleteAndPrintA4}
                isProcessing={isProcessing}
              />
            </div>

            {/* ================= RIGHT PANEL: LIVE INVOICE PREVIEW (5 cols) ================= */}
            <div className="lg:col-span-5 sticky top-20 bg-white rounded-2xl border border-[#E8DFD8] shadow-xs overflow-hidden h-[calc(100vh-6.5rem)] flex flex-col">
              <LiveInvoicePreview
                businessSettings={businessSettings}
                invoiceNumber={invoiceNumber}
                billingDate={billingDate}
                customerName={customerName}
                customerPhone={customerPhone}
                customerEmail={customerEmail}
                cashierName={currentStaff.name}
                items={items}
                subtotal={totals.subtotal}
                totalDiscount={totals.totalDiscount}
                taxableBase={totals.taxableBase}
                cgstTotal={totals.cgstTotal}
                sgstTotal={totals.sgstTotal}
                totalGst={totals.totalGst}
                grandTotal={totals.grandTotal}
                paymentMethod={paymentMethod}
                paymentStatus="PAID"
                previewMode={previewMode}
                onTogglePreviewMode={setPreviewMode}
                onOpenAdmin={() => navigateToView('admin')}
                onSaveInvoice={handleSaveInvoice}
                isProcessing={isProcessing}
                isInvoiceSaved={Boolean(savedInvoiceKey)}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ================= ADMIN DASHBOARD VIEW ================= */
        <AdminDashboard
          products={products}
          customers={customers}
          invoices={invoices}
          businessSettings={businessSettings}
          taxSettings={taxSettings}
          staff={allStaff}
          currentStaff={currentStaff}
          onRefreshData={refreshData}
          onCloseAdmin={() => navigateToView('pos')}
          onSwitchStaff={handleSwitchStaff}
        />
      )}

      {/* Customer Selection / Add Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        onSelectCustomer={(c) => {
          setCustomerName(c.name);
          setCustomerPhone(c.phone);
          if (c.email) setCustomerEmail(c.email);
        }}
        onAddCustomer={handleAddCustomer}
      />

      {/* Held Bills Modal */}
      <HeldBillsModal
        isOpen={isHeldBillsModalOpen}
        onClose={() => setIsHeldBillsModalOpen(false)}
        heldBills={heldBills}
        onResumeBill={handleResumeBill}
        onDeleteHeldBill={handleDeleteHeldBill}
      />

      {/* UPI QR Payment Modal */}
      <UpiQrModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        grandTotal={totals.grandTotal}
        invoiceNumber={invoiceNumber}
        businessSettings={businessSettings}
        onConfirmPayment={() => {
          setPaymentMethod('UPI');
          setAmountReceived(totals.grandTotal);
        }}
      />
    </div>
  );
}
