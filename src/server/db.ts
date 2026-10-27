import {
  Product,
  ProductVariant,
  Customer,
  Invoice,
  HeldBill,
  InventoryMovement,
  BusinessSettings,
  TaxSettings,
  StaffUser,
  SalesReturn,
} from '../types/pos.ts';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Initial Seed Data matching the user's boutique POS specifications and screenshot
export const initialBusinessSettings: BusinessSettings = {
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
};

export const initialTaxSettings: TaxSettings = {
  defaultGstRate: 12,
  enableCompositionScheme: false,
  isInterstate: false,
  availableSlabs: [0, 5, 12, 18, 28],
};

export const initialStaff: StaffUser[] = [
  {
    id: 'usr_01',
    name: 'Aishwarya Roy',
    email: 'charmiqe@gmail.com',
    role: 'SUPER_ADMIN',
    active: true,
  },
  {
    id: 'usr_02',
    name: 'Priyanka Sen',
    email: 'priyanka@charmiqe.in',
    role: 'MANAGER',
    active: true,
  },
  {
    id: 'usr_03',
    name: 'Rohan Deshmukh',
    email: 'rohan@charmiqe.in',
    role: 'CASHIER',
    active: true,
  },
];

export const initialCustomers: Customer[] = [
  {
    id: 'cust_01',
    name: 'Ananya Sharma',
    phone: '9876543210',
    email: 'ananya.sharma@gmail.com',
    city: 'Bengaluru',
    address: '42, Defence Colony, Indiranagar',
    totalSpent: 84900,
    totalPurchases: 4,
    loyaltyPoints: 850,
    createdAt: '2026-08-14T10:00:00.000Z',
  },
  {
    id: 'cust_02',
    name: 'Meera Krishnamurthy',
    phone: '9845211982',
    email: 'meera.k@heritage.in',
    city: 'Bengaluru',
    address: '108, Sadashivanagar',
    totalSpent: 142500,
    totalPurchases: 7,
    loyaltyPoints: 1425,
    createdAt: '2026-07-22T11:30:00.000Z',
  },
  {
    id: 'cust_03',
    name: 'Pooja Singhania',
    phone: '9980134567',
    email: 'pooja.singhania@outlook.com',
    city: 'Mumbai',
    address: 'Bandra West, Mumbai',
    totalSpent: 62000,
    totalPurchases: 3,
    loyaltyPoints: 620,
    createdAt: '2026-09-05T14:15:00.000Z',
  },
  {
    id: 'cust_04',
    name: 'Walk-in Guest',
    phone: '9999999999',
    city: 'Bengaluru',
    totalSpent: 0,
    totalPurchases: 0,
    loyaltyPoints: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const sareePriceGroups = [
  { category: 'Fancy Sarees', prices: [599, 699, 799] },
  { category: 'Party Wear Sarees', prices: [899, 999, 1099] },
  { category: 'Designer Fancy Sarees', prices: [1199, 1299, 1499] },
  { category: 'Cotton Sarees', prices: [1599, 1699, 1799] },
  { category: 'Linen Sarees', prices: [1899, 1999, 2099] },
  { category: 'Handloom Sarees', prices: [2199, 2299, 2399] },
  { category: 'Khadi Sarees', prices: [2499, 2599, 2699, 2799, 2899, 2999] },
] as const;

export const initialProducts: Product[] = sareePriceGroups.flatMap(({ category, prices }, groupIndex) =>
  prices.map((price, priceIndex) => {
    const sequence = groupIndex * 10 + priceIndex + 1;
    const id = `saree_${sequence.toString().padStart(3, '0')}`;
    const barcode = `890000000${sequence.toString().padStart(4, '0')}`;
    return {
      id,
      productId: `SAR-${sequence.toString().padStart(3, '0')}`,
      name: `${category} - ₹${price.toLocaleString('en-IN')}`,
      sku: `SAR-${sequence.toString().padStart(3, '0')}`,
      barcode,
      category,
      brand: 'Charmiqe Atelier',
      description: `${category} saree priced at ₹${price.toLocaleString('en-IN')}.`,
      costPrice: 0,
      sellingPrice: price,
      discountPercent: 0,
      gstRate: 12,
      stock: 10,
      lowStockThreshold: 2,
      fabric: category.replace(' Sarees', ''),
      color: 'Assorted',
      size: 'Free Size',
      status: 'ACTIVE' as const,
      adminOnly: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  })
);

// Application domain state hydrated from PostgreSQL at server startup.
class BoutiqueDatabase {
  products: Product[] = [];
  customers: Customer[] = [];
  invoices: Invoice[] = [];
  heldBills: HeldBill[] = [];
  returns: SalesReturn[] = [];
  inventoryMovements: InventoryMovement[] = [];
  businessSettings: BusinessSettings = { ...initialBusinessSettings };
  taxSettings: TaxSettings = { ...initialTaxSettings };
  staff: StaffUser[] = [...initialStaff];
  currentStaff: StaffUser = initialStaff[0]; // Aishwarya Roy (SUPER_ADMIN)
  invoiceCounter: number = 6353;

  constructor() {
    this.resetToDefaults();
    this.loadInvoiceState();
  }

  private get invoiceStatePath() {
    return path.resolve(process.cwd(), 'data', 'invoice-state.json');
  }

  private loadInvoiceState() {
    if (!existsSync(this.invoiceStatePath)) return;
    try {
      const saved = JSON.parse(readFileSync(this.invoiceStatePath, 'utf8'));
      const asArray = (value: unknown) => {
        if (!Array.isArray(value)) return undefined;
        // PowerShell's REST serializer may wrap JSON arrays as { value, Count }.
        if (value.length === 1 && Array.isArray((value[0] as any)?.value)) return (value[0] as any).value;
        return value;
      };
      const invoices = asArray(saved.invoices);
      const customers = asArray(saved.customers);
      const products = asArray(saved.products);
      const inventoryMovements = asArray(saved.inventoryMovements);
      const returns = asArray(saved.returns);
      if (invoices) this.invoices = invoices;
      if (customers) this.customers = customers;
      if (products) this.products = products;
      if (inventoryMovements) this.inventoryMovements = inventoryMovements;
      if (returns) this.returns = returns;
      if (Number.isFinite(saved.invoiceCounter)) this.invoiceCounter = saved.invoiceCounter;
    } catch (error) {
      console.error('Could not load persisted invoice data:', error);
    }
  }

  exportState() {
    return {
      products: this.products,
      customers: this.customers,
      invoices: this.invoices,
      heldBills: this.heldBills,
      returns: this.returns,
      inventoryMovements: this.inventoryMovements,
      businessSettings: this.businessSettings,
      taxSettings: this.taxSettings,
      staff: this.staff,
      currentStaff: this.currentStaff,
      invoiceCounter: this.invoiceCounter,
    };
  }

  importState(state: Partial<ReturnType<BoutiqueDatabase['exportState']>>) {
    if (Array.isArray(state.products)) this.products = state.products;
    if (Array.isArray(state.customers)) this.customers = state.customers;
    if (Array.isArray(state.invoices)) this.invoices = state.invoices;
    if (Array.isArray(state.heldBills)) this.heldBills = state.heldBills;
    if (Array.isArray(state.returns)) this.returns = state.returns;
    if (Array.isArray(state.inventoryMovements)) this.inventoryMovements = state.inventoryMovements;
    if (state.businessSettings) this.businessSettings = state.businessSettings;
    if (state.taxSettings) this.taxSettings = state.taxSettings;
    if (Array.isArray(state.staff)) this.staff = state.staff;
    if (state.currentStaff) this.currentStaff = state.currentStaff;
    if (Number.isFinite(state.invoiceCounter)) this.invoiceCounter = state.invoiceCounter as number;
  }

  resetToDefaults() {
    this.products = JSON.parse(JSON.stringify(initialProducts));
    this.customers = JSON.parse(JSON.stringify(initialCustomers));
    this.businessSettings = JSON.parse(JSON.stringify(initialBusinessSettings));
    this.taxSettings = JSON.parse(JSON.stringify(initialTaxSettings));
    this.staff = JSON.parse(JSON.stringify(initialStaff));
    this.currentStaff = this.staff[0];
    this.invoices = [];
    this.heldBills = [];
    this.returns = [];
    this.inventoryMovements = [];
    this.invoiceCounter = 6353;

  }

  generateNextInvoiceNumber(): string {
    this.invoiceCounter++;
    return `INV-2026-${this.invoiceCounter}`;
  }

  // --- Products ---
  getProducts(query?: string, category?: string) {
    let list = [...this.products];
    if (category && category !== 'ALL') {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.productId.toLowerCase().includes(q) ||
          (p.variants && p.variants.some((v) => v.barcode.includes(q) || v.sku.toLowerCase().includes(q)))
      );
    }
    return list;
  }

  getProductById(id: string) {
    return this.products.find((p) => p.id === id || p.productId === id);
  }

  findProductByBarcode(barcode: string): { product: Product; variant?: ProductVariant } | null {
    const clean = barcode.trim();
    for (const p of this.products) {
      if (p.barcode === clean) {
        return { product: p };
      }
      if (p.variants) {
        const v = p.variants.find((vr) => vr.barcode === clean);
        if (v) {
          return { product: p, variant: v };
        }
      }
    }
    return null;
  }

  createProduct(data: Partial<Product>) {
    // Uniqueness validation
    if (data.barcode && this.products.some((p) => p.barcode === data.barcode)) {
      throw new Error(`Barcode ${data.barcode} is already assigned to another product.`);
    }
    if (data.sku && this.products.some((p) => p.sku === data.sku)) {
      throw new Error(`SKU ${data.sku} is already assigned to another product.`);
    }

    const newProd: Product = {
      id: `prod_${Date.now()}`,
      productId: data.productId || `PRD-${Math.floor(100 + Math.random() * 900)}`,
      name: data.name || 'Untitled Piece',
      sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: data.barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: data.category || 'Silk Sarees',
      brand: data.brand || 'Charmiqe Atelier',
      description: data.description || '',
      costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      discountPercent: Number(data.discountPercent) || 0,
      gstRate: Number(data.gstRate) || 12,
      stock: Number(data.stock) || 0,
      lowStockThreshold: Number(data.lowStockThreshold) || 5,
      fabric: data.fabric || 'Silk',
      color: data.color || 'Multi',
      size: data.size || 'Free Size',
      status: (data.stock ?? 0) <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
      adminOnly: data.adminOnly ?? true,
      variants: data.variants || [],
      imageUrl: data.imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.products.unshift(newProd);

    // Record inventory initial movement
    this.inventoryMovements.unshift({
      id: `mov_${Date.now()}`,
      productId: newProd.id,
      productName: newProd.name,
      sku: newProd.sku,
      type: 'RESTOCK',
      quantityDelta: newProd.stock,
      previousStock: 0,
      newStock: newProd.stock,
      note: 'Initial stock intake upon creation',
      createdAt: new Date().toISOString(),
    });

    return newProd;
  }

  updateProduct(id: string, updates: Partial<Product>) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');

    const current = this.products[idx];

    // Check barcode clash if changed
    if (updates.barcode && updates.barcode !== current.barcode) {
      if (this.products.some((p) => p.id !== id && p.barcode === updates.barcode)) {
        throw new Error(`Barcode ${updates.barcode} already in use.`);
      }
    }

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updated.stock <= 0) {
      updated.status = 'OUT_OF_STOCK';
    } else if (updated.status === 'OUT_OF_STOCK' && updated.stock > 0) {
      updated.status = 'ACTIVE';
    }

    this.products[idx] = updated;
    return updated;
  }

  deleteProduct(id: string) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const removed = this.products.splice(idx, 1)[0];
    return removed;
  }

  // --- Inventory Adjustments ---
  adjustStock(productId: string, quantityDelta: number, reason: string, variantId?: string) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found');

    const previousStock = product.stock;
    const newStock = Math.max(0, previousStock + quantityDelta);
    product.stock = newStock;
    if (product.stock <= 0) product.status = 'OUT_OF_STOCK';
    else product.status = 'ACTIVE';

    if (variantId && product.variants) {
      const v = product.variants.find((vr) => vr.id === variantId);
      if (v) v.stock = Math.max(0, v.stock + quantityDelta);
    }

    const movement: InventoryMovement = {
      id: `mov_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: quantityDelta >= 0 ? 'RESTOCK' : 'ADJUSTMENT_DAMAGE',
      quantityDelta,
      previousStock,
      newStock,
      note: reason,
      createdAt: new Date().toISOString(),
    };

    this.inventoryMovements.unshift(movement);
    return { product, movement };
  }

  // --- Invoices & Authoritative Financial Calculations ---
  createInvoice(input: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCity?: string;
    paymentMethod: Invoice['paymentMethod'];
    items: {
      productId: string;
      variantId?: string;
      quantity: number;
      discountPercent?: number;
    }[];
    amountReceived?: number;
    notes?: string;
  }): Invoice {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must contain at least one item');
    }

    // 1. Transactional stock check & item building
    const invoiceItems: Invoice['items'] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableBase = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let totalGst = 0;

    for (const itemInput of input.items) {
      const product = this.products.find((p) => p.id === itemInput.productId);
      if (!product) {
        throw new Error(`Product ID ${itemInput.productId} not found`);
      }

      if (product.stock < itemInput.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${itemInput.quantity}`);
      }

      let variant;
      if (itemInput.variantId && product.variants) {
        variant = product.variants.find((v) => v.id === itemInput.variantId);
      }

      const unitPrice = product.sellingPrice + (variant?.additionalPrice || 0);
      const discountPct = Math.min(100, Math.max(0, itemInput.discountPercent ?? product.discountPercent ?? 0));
      const lineSubtotal = unitPrice * itemInput.quantity;
      const lineDiscount = Number(((lineSubtotal * discountPct) / 100).toFixed(2));
      const lineTaxable = Number((lineSubtotal - lineDiscount).toFixed(2));

      // Calculate GST
      const gstRate = product.gstRate || this.taxSettings.defaultGstRate || 12;
      const lineGst = Number(((lineTaxable * gstRate) / 100).toFixed(2));
      const lineCgst = Number((lineGst / 2).toFixed(2));
      const lineSgst = Number((lineGst / 2).toFixed(2));
      const lineTotal = Number((lineTaxable + lineGst).toFixed(2));

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      taxableBase += lineTaxable;
      cgstTotal += lineCgst;
      sgstTotal += lineSgst;
      totalGst += lineGst;

      invoiceItems.push({
        id: `item_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
        productId: product.id,
        variantId: variant?.id,
        name: product.name,
        sku: variant ? variant.sku : product.sku,
        barcode: variant ? variant.barcode : product.barcode,
        size: variant ? variant.size : product.size,
        color: variant ? variant.color : product.color,
        quantity: itemInput.quantity,
        unitPrice,
        discountPercent: discountPct,
        discountAmount: lineDiscount,
        taxableAmount: lineTaxable,
        gstRate,
        gstAmount: lineGst,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        totalAmount: lineTotal,
      });
    }

    const grandTotal = Math.round(taxableBase + totalGst);
    const amountReceived = input.amountReceived ?? grandTotal;
    const changeDue = Math.max(0, amountReceived - grandTotal);
    const invoiceNumber = this.generateNextInvoiceNumber();
    const nowIso = new Date().toISOString();

    // 2. Commit stock reductions atomically
    for (const it of invoiceItems) {
      const prod = this.products.find((p) => p.id === it.productId)!;
      const prev = prod.stock;
      prod.stock -= it.quantity;
      if (prod.stock <= 0) prod.status = 'OUT_OF_STOCK';

      if (it.variantId && prod.variants) {
        const v = prod.variants.find((vr) => vr.id === it.variantId);
        if (v) v.stock = Math.max(0, v.stock - it.quantity);
      }

      this.inventoryMovements.unshift({
        id: `mov_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        sku: it.sku,
        type: 'SALE',
        quantityDelta: -it.quantity,
        previousStock: prev,
        newStock: prod.stock,
        referenceId: invoiceNumber,
        note: `POS Sale: ${invoiceNumber}`,
        createdAt: nowIso,
      });
    }

    // 3. Update or create customer profile
    let cust = this.customers.find((c) => c.phone === input.customerPhone);
    if (!cust && input.customerName && input.customerName !== 'Walk-in Guest') {
      cust = {
        id: `cust_${Date.now()}`,
        name: input.customerName,
        phone: input.customerPhone || '',
        email: input.customerEmail,
        city: input.customerCity,
        totalSpent: grandTotal,
        totalPurchases: 1,
        loyaltyPoints: Math.floor(grandTotal / 100),
        createdAt: nowIso,
      };
      this.customers.unshift(cust);
    } else if (cust) {
      cust.totalSpent += grandTotal;
      cust.totalPurchases += 1;
      cust.loyaltyPoints += Math.floor(grandTotal / 100);
      if (input.customerEmail && !cust.email) cust.email = input.customerEmail;
    }

    const newInvoice: Invoice = {
      id: `inv_${Date.now()}`,
      invoiceNumber,
      date: new Date().toLocaleDateString('en-GB'), // 27/10/2026 format
      dueDate: new Date().toLocaleDateString('en-GB'),
      customerId: cust?.id,
      customerName: input.customerName || 'Walk-in Guest',
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerCity: input.customerCity,
      cashierId: this.currentStaff.id,
      cashierName: this.currentStaff.name,
      cashierRole: this.currentStaff.role,
      items: invoiceItems,
      subtotal,
      totalDiscount,
      taxableBase,
      cgstTotal,
      sgstTotal,
      igstTotal: 0,
      totalGst,
      grandTotal,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'PAID',
      amountReceived,
      changeDue,
      notes: input.notes,
      status: 'COMPLETED',
      createdAt: nowIso,
      businessSettingsSnapshot: JSON.parse(JSON.stringify(this.businessSettings)),
    };

    this.invoices.unshift(newInvoice);
    return newInvoice;
  }

  // --- Held Bills ---
  holdBill(data: {
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    items: Invoice['items'];
    subtotal: number;
    grandTotal: number;
    notes?: string;
  }): HeldBill {
    const held: HeldBill = {
      id: `held_${Date.now()}`,
      holdNumber: `HOLD-${this.heldBills.length + 1}`,
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: data.customerName || 'Walk-in Guest',
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      items: data.items,
      subtotal: data.subtotal,
      grandTotal: data.grandTotal,
      notes: data.notes,
    };
    this.heldBills.unshift(held);
    return held;
  }

  resumeHeldBill(id: string): HeldBill | null {
    const idx = this.heldBills.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    const [bill] = this.heldBills.splice(idx, 1);
    return bill;
  }

  deleteHeldBill(id: string): boolean {
    const idx = this.heldBills.findIndex((h) => h.id === id);
    if (idx === -1) return false;
    this.heldBills.splice(idx, 1);
    return true;
  }

  // --- Returns & Refunds ---
  processReturn(invoiceId: string, itemsToReturn: { productId: string; quantity: number }[], reason: string): SalesReturn {
    const inv = this.invoices.find((i) => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) throw new Error('Invoice not found');

    let totalRefund = 0;
    const returnItemRecords: SalesReturn['items'] = [];

    for (const ret of itemsToReturn) {
      const invItem = inv.items.find((i) => i.productId === ret.productId);
      if (!invItem) throw new Error(`Product not found in original invoice`);

      const refundPerUnit = invItem.totalAmount / invItem.quantity;
      const refundLine = refundPerUnit * ret.quantity;
      totalRefund += refundLine;

      returnItemRecords.push({
        productId: ret.productId,
        name: invItem.name,
        quantity: ret.quantity,
        refundAmount: Number(refundLine.toFixed(2)),
      });

      // Restore stock
      this.adjustStock(ret.productId, ret.quantity, `Return against ${inv.invoiceNumber}: ${reason}`);
    }

    const returnRecord: SalesReturn = {
      id: `ret_${Date.now()}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      returnDate: new Date().toISOString(),
      reason,
      items: returnItemRecords,
      totalRefund: Number(totalRefund.toFixed(2)),
      refundMethod: inv.paymentMethod,
      processedBy: this.currentStaff.name,
    };

    this.returns.unshift(returnRecord);
    return returnRecord;
  }

  // --- Reports & Dashboard Metrics ---
  getDashboardStats() {
    const today = new Date().toLocaleDateString('en-GB');
    const todayInvoices = this.invoices.filter((i) => i.date === today && i.status === 'COMPLETED');
    const todaySales = todayInvoices.reduce((acc, i) => acc + i.grandTotal, 0);
    const avgInvoiceValue = todayInvoices.length > 0 ? Math.round(todaySales / todayInvoices.length) : 0;
    const lowStockProducts = this.products.filter((p) => p.stock <= p.lowStockThreshold);

    // Calculate top-selling products
    const productSalesMap = new Map<string, { product: Product; count: number; revenue: number }>();
    for (const inv of this.invoices) {
      for (const item of inv.items) {
        const existing = productSalesMap.get(item.productId);
        if (existing) {
          existing.count += item.quantity;
          existing.revenue += item.totalAmount;
        } else {
          const prod = this.products.find((p) => p.id === item.productId);
          if (prod) {
            productSalesMap.set(item.productId, { product: prod, count: item.quantity, revenue: item.totalAmount });
          }
        }
      }
    }

    const topSelling = Array.from(productSalesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Payment methods summary
    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
    };

    for (const inv of this.invoices) {
      if (inv.status === 'COMPLETED') {
        paymentBreakdown[inv.paymentMethod] = (paymentBreakdown[inv.paymentMethod] || 0) + inv.grandTotal;
      }
    }

    return {
      todaySales,
      todayInvoicesCount: todayInvoices.length,
      avgInvoiceValue,
      totalProductsCount: this.products.length,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      topSelling,
      paymentBreakdown,
      recentInvoices: this.invoices.slice(0, 8),
      heldBillsCount: this.heldBills.length,
    };
  }
}

export const db = new BoutiqueDatabase();
