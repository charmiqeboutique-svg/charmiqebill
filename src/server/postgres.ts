import { Pool, PoolClient } from 'pg';
import { db } from './db.ts';

type AppState = ReturnType<typeof db.exportState>;
type RecordGroup = {
  table: string;
  rows: Array<{ id: string; position: number; payload: unknown; extra?: string[] }>;
};

const recordGroups = (state: AppState): RecordGroup[] => [
  { table: 'products', rows: state.products.map((row, position) => ({ id: row.id, position, payload: row })) },
  { table: 'customers', rows: state.customers.map((row, position) => ({ id: row.id, position, payload: row })) },
  {
    table: 'invoices',
    rows: state.invoices.map((row, position) => ({
      id: row.id,
      position,
      payload: row,
      extra: [row.invoiceNumber, row.customerId ?? '', row.date],
    })),
  },
  { table: 'held_bills', rows: state.heldBills.map((row, position) => ({ id: row.id, position, payload: row })) },
  { table: 'sales_returns', rows: state.returns.map((row, position) => ({ id: row.id, position, payload: row })) },
  {
    table: 'inventory_movements',
    rows: state.inventoryMovements.map((row, position) => ({
      id: row.id,
      position,
      payload: row,
      extra: [row.productId, row.referenceId ?? ''],
    })),
  },
  { table: 'staff', rows: state.staff.map((row, position) => ({ id: row.id, position, payload: row, extra: [row.email] })) },
];

class PostgreSQLStore {
  private pool: Pool | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();

  async initialize() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required. Set it in .env before starting the CHARMIQE POS server.');
    }

    const sslMode = process.env.PGSSLMODE?.toLowerCase();
    const ssl = sslMode === 'disable'
      ? false
      : sslMode === 'require' || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined;

    this.pool = new Pool({ connectionString, ssl, max: 10 });
    await this.pool.query('SELECT 1');
    await this.createSchema();

    const loaded = await this.loadState();
    if (loaded) {
      db.importState(loaded);
      console.log('[CHARMIQE POS] Loaded application data from PostgreSQL.');
    } else {
      // On the first PostgreSQL run, migrate the existing JSON snapshot/seed state.
      await this.persist(db.exportState());
      console.log('[CHARMIQE POS] Initialized PostgreSQL with the existing application state.');
    }
  }

  private async createSchema() {
    if (!this.pool) throw new Error('PostgreSQL pool is not initialized.');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        invoice_number TEXT NOT NULL UNIQUE,
        customer_id TEXT,
        invoice_date TEXT NOT NULL,
        payload JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices(customer_id);
      CREATE TABLE IF NOT EXISTS held_bills (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sales_returns (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        product_id TEXT NOT NULL,
        reference_id TEXT,
        payload JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS inventory_movements_product_id_idx ON inventory_movements(product_id);
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL DEFAULT 0,
        email TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE held_bills ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS boutique_metadata (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL
      );
    `);
  }

  private async loadState(): Promise<AppState | null> {
    if (!this.pool) throw new Error('PostgreSQL pool is not initialized.');
    const metadataResult = await this.pool.query<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM boutique_metadata WHERE id = 1'
    );
    if (metadataResult.rowCount === 0) return null;

    const groups = await Promise.all([
      this.pool.query<{ payload: AppState['products'][number] }>('SELECT payload FROM products ORDER BY position'),
      this.pool.query<{ payload: AppState['customers'][number] }>('SELECT payload FROM customers ORDER BY position'),
      this.pool.query<{ payload: AppState['invoices'][number] }>('SELECT payload FROM invoices ORDER BY position'),
      this.pool.query<{ payload: AppState['heldBills'][number] }>('SELECT payload FROM held_bills ORDER BY position'),
      this.pool.query<{ payload: AppState['returns'][number] }>('SELECT payload FROM sales_returns ORDER BY position'),
      this.pool.query<{ payload: AppState['inventoryMovements'][number] }>('SELECT payload FROM inventory_movements ORDER BY position'),
      this.pool.query<{ payload: AppState['staff'][number] }>('SELECT payload FROM staff ORDER BY position'),
    ]);
    const metadata = metadataResult.rows[0].payload;

    return {
      products: groups[0].rows.map((row) => row.payload),
      customers: groups[1].rows.map((row) => row.payload),
      invoices: groups[2].rows.map((row) => row.payload),
      heldBills: groups[3].rows.map((row) => row.payload),
      returns: groups[4].rows.map((row) => row.payload),
      inventoryMovements: groups[5].rows.map((row) => row.payload),
      staff: groups[6].rows.map((row) => row.payload),
      businessSettings: metadata.businessSettings as AppState['businessSettings'],
      taxSettings: metadata.taxSettings as AppState['taxSettings'],
      currentStaff: metadata.currentStaff as AppState['currentStaff'],
      invoiceCounter: Number(metadata.invoiceCounter ?? 6353),
    };
  }

  async persist(state: AppState) {
    this.pendingWrite = this.pendingWrite.catch(() => undefined).then(() => this.persistNow(state));
    return this.pendingWrite;
  }

  private async persistNow(state: AppState) {
    if (!this.pool) throw new Error('PostgreSQL pool is not initialized.');
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const group of recordGroups(state)) {
        await client.query(`DELETE FROM ${group.table}`);
        for (const row of group.rows) {
          if (group.table === 'invoices') {
            await client.query(
              'INSERT INTO invoices (id, position, invoice_number, customer_id, invoice_date, payload) VALUES ($1, $2, $3, NULLIF($4, \'\'), $5, $6::jsonb)',
              [row.id, row.position, row.extra?.[0], row.extra?.[1], row.extra?.[2], JSON.stringify(row.payload)]
            );
          } else if (group.table === 'inventory_movements') {
            await client.query(
              'INSERT INTO inventory_movements (id, position, product_id, reference_id, payload) VALUES ($1, $2, $3, NULLIF($4, \'\'), $5::jsonb)',
              [row.id, row.position, row.extra?.[0], row.extra?.[1], JSON.stringify(row.payload)]
            );
          } else if (group.table === 'staff') {
            await client.query(
              'INSERT INTO staff (id, position, email, payload) VALUES ($1, $2, $3, $4::jsonb)',
              [row.id, row.position, row.extra?.[0], JSON.stringify(row.payload)]
            );
          } else {
            await client.query(
              `INSERT INTO ${group.table} (id, position, payload) VALUES ($1, $2, $3::jsonb)`,
              [row.id, row.position, JSON.stringify(row.payload)]
            );
          }
        }
      }
      await client.query(
        `INSERT INTO boutique_metadata (id, payload) VALUES (1, $1::jsonb)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
        [JSON.stringify({
          businessSettings: state.businessSettings,
          taxSettings: state.taxSettings,
          currentStaff: state.currentStaff,
          invoiceCounter: state.invoiceCounter,
        })]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool?.end();
  }
}

export const postgresStore = new PostgreSQLStore();
