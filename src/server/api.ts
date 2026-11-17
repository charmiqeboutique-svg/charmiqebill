import { Router, Request, Response } from 'express';
import { readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
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
  if (['/auth/login', '/auth/logout', '/barcodes/generate', '/barcodes/print-prn'].includes(req.path)) {
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

// Default thermal label printer (TVSE LP45 on USB). Override with LABEL_PRINTER_NAME env var.
const LABEL_PRINTER_NAME = process.env.LABEL_PRINTER_NAME || 'TVSE LP45 BPLE';
const RAW_PRINT_SCRIPT = path.resolve(process.cwd(), 'src', 'server', 'printRaw.ps1');

async function sendRawToWindowsPrinter(printerName: string, data: Buffer): Promise<void> {
  const tempPath = path.join(os.tmpdir(), `charmiqe-label-${Date.now()}-${Math.random().toString(36).slice(2)}.prn`);
  await writeFile(tempPath, data);
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        RAW_PRINT_SCRIPT,
        '-PrinterName',
        printerName,
        '-FilePath',
        tempPath,
      ]);
      let out = '';
      let err = '';
      child.stdout.on('data', (chunk) => {
        out += chunk;
      });
      child.stderr.on('data', (chunk) => {
        err += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(out);
        } else {
          reject(new Error(err.trim() || `The printer process exited with code ${code}.`));
        }
      });
    });
    if (!stdout.includes('PRINTED')) {
      throw new Error(`The printer "${printerName}" did not confirm the print job.`);
    }
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

apiRouter.post('/barcodes/print-prn', async (req: Request, res: Response) => {
  const { barcode, productName, quantity, mode } = (req.body ?? {}) as {
    barcode?: unknown;
    productName?: unknown;
    quantity?: unknown;
    mode?: unknown;
  };
  const labelQuantity = Number(quantity);
  const wantsDirectPrint = mode === 'print';

  if (
    typeof barcode !== 'string' ||
    !barcode.trim() ||
    !Number.isInteger(labelQuantity) ||
    labelQuantity < 1 ||
    labelQuantity > 24
  ) {
    return res.status(400).json({ error: 'Barcode and a quantity from 1 to 24 are required.' });
  }

  const cleanField = (value: string) =>
    value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/"/g, "'").trim();
  const productBarcode = cleanField(barcode);
  const productLabel = typeof productName === 'string' ? cleanField(productName) : '';
  const boutiqueName = cleanField(db.businessSettings.boutiqueName) || 'CHARMIQE';

  if (!productBarcode) {
    return res.status(400).json({ error: 'Barcode must contain printable characters.' });
  }
  if (!productLabel) {
    return res.status(400).json({ error: 'Product name must contain printable characters.' });
  }

  try {
    let prn = await readFile(path.resolve(process.cwd(), 'NEWPRN.prn'), 'utf8');
    const replaceField = (pattern: RegExp, value: string, field: string) => {
      if (!pattern.test(prn)) {
        throw new Error(`The NEWPRN.prn template is missing its ${field} field.`);
      }
      prn = prn.replace(pattern, (_match, prefix: string, suffix: string) => `${prefix}${value}${suffix}`);
    };

    // NEWPRN.prn is a two-up layout: barcode, barcode text, product name and brand appear
    // twice per roll (left + right column). Fill every occurrence.
    replaceField(/^(B\d+,\d+,2,3,1,3,64,N,")[^"]*(")$/gm, productBarcode, 'barcode');
    replaceField(/^(A\d+,43,2,[0-9a-z],1,1,N,")[^"]*(")$/gm, productBarcode, 'barcode text');
    replaceField(/^(A\d+,148,2,[0-9a-z],1,1,N,")[^"]*(")$/gm, productLabel, 'product name');
    replaceField(/^(A\d+,198,2,[0-9a-z],1,1,N,")[^"]*(")$/gm, boutiqueName, 'boutique name');

    if (!/^P\d+$/m.test(prn)) {
      throw new Error('The NEWPRN.prn template is missing its print quantity field.');
    }
    prn = prn.replace(/^P\d+$/m, `P${labelQuantity}`);

    const prnData = Buffer.from(prn, 'utf8');

    if (wantsDirectPrint) {
      await sendRawToWindowsPrinter(LABEL_PRINTER_NAME, prnData);
      return res.json({
        success: true,
        printer: LABEL_PRINTER_NAME,
        copies: labelQuantity,
        labels: labelQuantity * 2,
      });
    }

    const safeBarcode = productBarcode.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="barcode-${safeBarcode}.prn"`);
    res.send(prnData);
  } catch (error) {
    console.error('[CHARMIQE POS] Could not print the barcode label:', error);
    const message = error instanceof Error ? error.message : 'Unknown printer error';
    res.status(500).json({ error: message });
  }
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
