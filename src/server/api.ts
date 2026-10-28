import { Router, Request, Response } from 'express';
import { db } from './db.ts';
import { generateRandomBarcode } from '../lib/barcodeGenerator.ts';
import { createInvoicePdf } from './invoicePdf.ts';
import { postgresStore } from './postgres.ts';

export const apiRouter = Router();
let activeAuthToken: string | null = null;

// Persist successful state-changing API requests before sending their response.
apiRouter.use((req: Request, res: Response, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Skip persisting read-only / session-only endpoints to prevent unnecessary latency
  if (['/auth/login', '/auth/logout', '/barcodes/generate'].includes(req.path)) {
    return next();
  }

  const sendJson = res.json.bind(res);
  (res as any).json = (body: unknown) => {
    if (res.statusCode >= 400) {
      sendJson(body);
      return res;
    }

    postgresStore.persist(db.exportState())
      .then(() => sendJson(body))
      .catch((error) => {
        console.error('[CHARMIQE POS] PostgreSQL write failed:', error);
        if (!res.headersSent) {
          res.status(500);
          sendJson({ error: 'Could not save changes to PostgreSQL.' });
        }
      });
    return res;
  };
  next();
});

// --- Auth Routes ---
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const inputEmail = String(email || '').trim().toLowerCase();
  const inputPass = String(password || '').trim();

  const validPasswords = ['charmiqe@123', 'admin@123', 'admin', 'charmiqe'];
  const isSuperAdminEmail =
    inputEmail === 'charmiqe@gmail.com' ||
    inputEmail === 'admin@velvetvine.com' ||
    inputEmail === 'admin@charmiqe.in' ||
    inputEmail === 'admin';

  let user = db.staff.find((s) => s.email.toLowerCase() === inputEmail && s.active);
  if (!user && isSuperAdminEmail) {
    user = db.staff.find((s) => s.role === 'SUPER_ADMIN' && s.active) ?? db.staff[0];
  }

  if (!user || (!validPasswords.includes(inputPass) && inputPass !== 'charmiqe@123')) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  db.currentStaff = user;
  activeAuthToken = `token_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  res.json({ user, token: activeAuthToken });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  activeAuthToken = null;
  res.json({ message: 'Logged out successfully' });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || token !== activeAuthToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  res.json({ user: db.currentStaff });
});

// Switch active staff user
apiRouter.post('/auth/switch-user', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = db.staff.find((s) => s.id === userId);
  if (user) {
    db.currentStaff = user;
    return res.json({ user });
  }
  res.status(404).json({ error: 'User not found' });
});

// --- Product Routes ---
apiRouter.get('/products', (req: Request, res: Response) => {
  const { search, category } = req.query;
  const products = db.getProducts(search as string, category as string);
  res.json(products);
});

apiRouter.get('/products/search', (req: Request, res: Response) => {
  const { q } = req.query;
  const products = db.getProducts(q as string);
  res.json(products);
});

apiRouter.get('/products/barcode/:barcode', (req: Request, res: Response) => {
  const barcode = req.params.barcode;
  const match = db.findProductByBarcode(barcode);
  if (!match) {
    return res.status(404).json({ error: `No boutique item found for barcode "${barcode}"` });
  }
  res.json(match);
});

apiRouter.get('/products/:id', (req: Request, res: Response) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

apiRouter.post('/products', (req: Request, res: Response) => {
  try {
    const created = db.createProduct(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

apiRouter.put('/products/:id', (req: Request, res: Response) => {
  try {
    const updated = db.updateProduct(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

apiRouter.delete('/products/:id', (req: Request, res: Response) => {
  try {
    const deleted = db.deleteProduct(req.params.id);
    res.json(deleted);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete product' });
  }
});

// --- Barcodes ---
apiRouter.post('/barcodes/generate', (req: Request, res: Response) => {
  const prefix = (req.body.prefix as string) || 'CHQ';
  let barcode = generateRandomBarcode(prefix);
  while (db.findProductByBarcode(barcode)) {
    barcode = generateRandomBarcode(prefix);
  }
  res.json({ barcode });
});

apiRouter.get('/barcodes/:barcode', (req: Request, res: Response) => {
  const barcode = req.params.barcode;
  const match = db.findProductByBarcode(barcode);
  if (!match) {
    return res.status(404).json({ error: 'Barcode not found', barcode });
  }
  res.json(match);
});

// --- Invoices & Billing ---
apiRouter.get('/invoices', (_req: Request, res: Response) => {
  res.json(db.invoices);
});

apiRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const inv = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  res.json(inv);
});

apiRouter.get('/invoices/:id/pdf', (req: Request, res: Response) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const pdf = createInvoicePdf(invoice, invoice.businessSettingsSnapshot ?? db.businessSettings);
  const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  res.send(pdf);
});

apiRouter.post('/invoices', (req: Request, res: Response) => {
  try {
    const invoice = db.createInvoice(req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to generate invoice' });
  }
});

// Hold Bill
apiRouter.post('/invoices/:id/hold', (req: Request, res: Response) => {
  try {
    const held = db.holdBill(req.body);
    res.status(201).json(held);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to hold bill' });
  }
});

apiRouter.get('/held-bills', (_req: Request, res: Response) => {
  res.json(db.heldBills);
});

apiRouter.post('/held-bills/:id/resume', (req: Request, res: Response) => {
  const resumed = db.resumeHeldBill(req.params.id);
  if (!resumed) {
    return res.status(404).json({ error: 'Held bill not found' });
  }
  res.json(resumed);
});

apiRouter.delete('/held-bills/:id', (req: Request, res: Response) => {
  const deleted = db.deleteHeldBill(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Held bill not found' });
  }
  res.json({ success: true });
});

// Return & Refund
apiRouter.post('/invoices/:id/return', (req: Request, res: Response) => {
  try {
    const { items, reason } = req.body;
    const returnRecord = db.processReturn(req.params.id, items, reason);
    res.status(201).json(returnRecord);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Return processing failed' });
  }
});

// --- Customers ---
apiRouter.get('/customers', (_req: Request, res: Response) => {
  res.json(db.customers);
});

apiRouter.post('/customers', (req: Request, res: Response) => {
  const { name, phone, email, city, address, gstin } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }
  const existing = db.customers.find((c) => c.phone === phone);
  if (existing) {
    return res.json(existing);
  }
  const newCust = {
    id: `cust_${Date.now()}`,
    name,
    phone,
    email,
    city,
    address,
    gstin,
    totalSpent: 0,
    totalPurchases: 0,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString(),
  };
  db.customers.unshift(newCust);
  res.status(201).json(newCust);
});

apiRouter.put('/customers/:id', (req: Request, res: Response) => {
  const idx = db.customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  db.customers[idx] = { ...db.customers[idx], ...req.body };
  res.json(db.customers[idx]);
});

// --- Inventory ---
apiRouter.get('/inventory', (_req: Request, res: Response) => {
  res.json(
    db.products.map((p) => ({
      id: p.id,
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      status: p.status,
      category: p.category,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
    }))
  );
});

apiRouter.get('/inventory/movements', (_req: Request, res: Response) => {
  res.json(db.inventoryMovements);
});

apiRouter.post('/inventory/adjustments', (req: Request, res: Response) => {
  try {
    const { productId, quantityDelta, reason, variantId } = req.body;
    const result = db.adjustStock(productId, Number(quantityDelta), reason, variantId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to adjust stock' });
  }
});

// --- Reports & Dashboard ---
apiRouter.get('/reports/dashboard', (_req: Request, res: Response) => {
  res.json(db.getDashboardStats());
});

apiRouter.get('/reports/daily-sales', (_req: Request, res: Response) => {
  const stats = db.getDashboardStats();
  res.json({
    date: new Date().toLocaleDateString('en-GB'),
    sales: stats.todaySales,
    invoicesCount: stats.todayInvoicesCount,
    avgTicket: stats.avgInvoiceValue,
    breakdown: stats.paymentBreakdown,
  });
});

apiRouter.get('/reports/inventory', (_req: Request, res: Response) => {
  const totalValue = db.products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const retailValue = db.products.reduce((acc, p) => acc + p.stock * p.sellingPrice, 0);
  res.json({
    totalItems: db.products.reduce((acc, p) => acc + p.stock, 0),
    totalCostValue: totalValue,
    totalRetailValue: retailValue,
    lowStockCount: db.products.filter((p) => p.stock <= p.lowStockThreshold).length,
    movements: db.inventoryMovements.slice(0, 20),
  });
});

apiRouter.get('/reports/tax', (_req: Request, res: Response) => {
  let totalCgst = 0;
  let totalSgst = 0;
  let totalTaxable = 0;
  for (const inv of db.invoices) {
    if (inv.status === 'COMPLETED') {
      totalCgst += inv.cgstTotal;
      totalSgst += inv.sgstTotal;
      totalTaxable += inv.taxableBase;
    }
  }
  res.json({
    totalTaxableBase: totalTaxable,
    totalCgst,
    totalSgst,
    totalTaxCollected: totalCgst + totalSgst,
    gstin: db.businessSettings.gstin,
    boutiqueName: db.businessSettings.boutiqueName,
  });
});

// --- Settings ---
apiRouter.get('/settings/business', (_req: Request, res: Response) => {
  res.json(db.businessSettings);
});

apiRouter.put('/settings/business', (req: Request, res: Response) => {
  db.businessSettings = { ...db.businessSettings, ...req.body };
  res.json(db.businessSettings);
});

apiRouter.get('/settings/tax', (_req: Request, res: Response) => {
  res.json(db.taxSettings);
});

apiRouter.put('/settings/tax', (req: Request, res: Response) => {
  db.taxSettings = { ...db.taxSettings, ...req.body };
  res.json(db.taxSettings);
});

// Staff
apiRouter.get('/staff', (_req: Request, res: Response) => {
  res.json(db.staff);
});

// Reset database
apiRouter.post('/database/reset', (_req: Request, res: Response) => {
  db.resetToDefaults();
  res.json({ message: 'Database reset to initial seed data successfully' });
});
