export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  active: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  size: string; // e.g., 'Free Size', 'S', 'M', 'L', 'XL'
  color: string; // e.g., 'Maroon', 'Green', 'Emerald'
  stock: number;
  additionalPrice?: number;
}

export interface Product {
  id: string;
  productId: string; // e.g. PRD-001
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  discountPercent: number;
  gstRate: number; // e.g., 5, 12, 18, 28
  stock: number;
  lowStockThreshold: number;
  fabric: string;
  color: string;
  size: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK';
  adminOnly?: boolean;
  variants?: ProductVariant[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  gstin?: string;
  totalSpent: number;
  totalPurchases: number;
  loyaltyPoints: number;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  barcode: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'SPLIT';
export type PaymentStatus = 'PAID' | 'PENDING' | 'REFUNDED' | 'PARTIAL';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  referenceNumber?: string;
  paidAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-6353
  date: string;
  dueDate: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  cashierId: string;
  cashierName: string;
  cashierRole: Role;
  items: InvoiceItem[];
  subtotal: number; // Sum of unitPrice * qty
  totalDiscount: number;
  taxableBase: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountReceived: number;
  changeDue: number;
  notes?: string;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  businessSettingsSnapshot?: BusinessSettings;
}

export interface HeldBill {
  id: string;
  holdNumber: string;
  heldAt: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: InvoiceItem[];
  subtotal: number;
  grandTotal: number;
  notes?: string;
}

export interface SalesReturn {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  returnDate: string;
  reason: string;
  items: {
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    refundAmount: number;
  }[];
  totalRefund: number;
  refundMethod: PaymentMethod;
  processedBy: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'SALE' | 'RETURN' | 'RESTOCK' | 'ADJUSTMENT_DAMAGE' | 'ADJUSTMENT_CORRECTION';
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  referenceId?: string; // e.g., invoice number
  note?: string;
  createdAt: string;
}

export interface BusinessSettings {
  boutiqueName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  currencySymbol: string;
  invoicePrefix: string;
  termsAndConditions: string[];
  upiVpa: string;
  upiMerchantName: string;
}

export interface TaxSettings {
  defaultGstRate: number;
  enableCompositionScheme: boolean;
  isInterstate: boolean;
  availableSlabs: number[]; // [0, 5, 12, 18, 28]
}

export interface BarcodeScanEvent {
  barcode: string;
  timestamp: number;
  source: 'HARDWARE_KEYBOARD_WEDGE' | 'INPUT_FIELD' | 'MANUAL_LOOKUP';
}
