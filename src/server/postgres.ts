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

async function insertBatch(
  client: PoolClient,
  table: string,
  rows: Array<{ id: string; position: number; payload: unknown; extra?: string[] }>
) {
  if (rows.length === 0) return;

  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);

    if (table === 'invoices') {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      chunk.forEach((row, idx) => {
        const offset = idx * 6;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, NULLIF($${offset + 4}, ''), $${offset + 5}, $${offset + 6}::jsonb)`);
        values.push(row.id, row.position, row.extra?.[0], row.extra?.[1], row.extra?.[2], JSON.stringify(row.payload));
      });
      await client.query(
        `INSERT INTO invoices (id, position, invoice_number, customer_id, invoice_date, payload) VALUES ${placeholders.join(', ')}`,
        values
      );
    } else if (table === 'inventory_movements') {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      chunk.forEach((row, idx) => {
        const offset = idx * 5;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, NULLIF($${offset + 4}, ''), $${offset + 5}::jsonb)`);
        values.push(row.id, row.position, row.extra?.[0], row.extra?.[1], JSON.stringify(row.payload));
      });
      await client.query(
        `INSERT INTO inventory_movements (id, position, product_id, reference_id, payload) VALUES ${placeholders.join(', ')}`,
        values
      );
    } else if (table === 'staff') {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      chunk.forEach((row, idx) => {
        const offset = idx * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::jsonb)`);
        values.push(row.id, row.position, row.extra?.[0], JSON.stringify(row.payload));
      });
      await client.query(
        `INSERT INTO staff (id, position, email, payload) VALUES ${placeholders.join(', ')}`,
        values
      );
    } else {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      chunk.forEach((row, idx) => {
        const offset = idx * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}::jsonb)`);
        values.push(row.id, row.position, JSON.stringify(row.payload));
      });
      await client.query(
        `INSERT INTO ${table} (id, position, payload) VALUES ${placeholders.join(', ')}`,
        values
      );
    }
  }
}

class PostgreSQLStore {
  private pool: Pool | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();

  async initialize() {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.STORAGE_URL;
    if (!connectionString) {
      throw new Error(
        'Database connection URL is not set in .env.\n' +
        'Please add your PostgreSQL or Neon DB connection string to .env:\n' +
        'DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"'
      );
    }

    const isNeon = connectionString.includes('neon.tech') || connectionString.includes('sslmode=require');
    const sslMode = process.env.PGSSLMODE?.toLowerCase();
    const ssl = sslMode === 'disable'
      ? false
      : (sslMode === 'require' || isNeon || process.env.NODE_ENV === 'production')
        ? { rejectUnauthorized: false }
        : false;

    this.pool = new Pool({
      connectionString,
      ssl,
      max: 10,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
    });

    const isNeonHost = connectionString.includes('neon.tech');
    console.log(`[CHARMIQE POS] Connecting to ${isNeonHost ? 'Neon Serverless PostgreSQL' : 'PostgreSQL'} database...`);
    await this.pool.query('SELECT 1');
    console.log('[CHARMIQE POS] Database connection verified successfully.');

    await this.createSchema();

    const loaded = await this.loadState();
    if (loaded) {
      db.importState(loaded);
      console.log('[CHARMIQE POS] Loaded application data from PostgreSQL.');
    } else {
      // On the first PostgreSQL run, seed PostgreSQL with the initial boutique state.
      await this.persist(db.exportState());
      console.log('[CHARMIQE POS] Initialized PostgreSQL with initial boutique data.');
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
    const metadataResult = await this.pool.query<{ payload: unknown }>(
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

    const metadataRaw = metadataResult.rows[0].payload;
    const metadata = (typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw) as Record<string, unknown>;

    const parsePayload = <T>(row: { payload: T }): T =>
      (typeof row.payload === 'string' ? JSON.parse(row.payload as string) : row.payload);

    return {
      products: groups[0].rows.map(parsePayload),
      customers: groups[1].rows.map(parsePayload),
      invoices: groups[2].rows.map(parsePayload),
      heldBills: groups[3].rows.map(parsePayload),
      returns: groups[4].rows.map(parsePayload),
      inventoryMovements: groups[5].rows.map(parsePayload),
      staff: groups[6].rows.map(parsePayload),
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
      // Truncate existing tables in one fast command
      await client.query('TRUNCATE products, customers, invoices, held_bills, sales_returns, inventory_movements, staff');

      // Bulk-insert each group in single multi-row queries
      for (const group of recordGroups(state)) {
        await insertBatch(client, group.table, group.rows);
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

  async refreshState() {
    if (!this.pool) return;
    const loaded = await this.loadState();
    if (loaded) {
      db.importState(loaded);
    }
  }

  async close() {
    await this.pool?.end();
  }
}

export const postgresStore = new PostgreSQLStore();
