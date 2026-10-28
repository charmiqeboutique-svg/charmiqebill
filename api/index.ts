import express from 'express';
import { apiRouter } from '../src/server/api.ts';
import { postgresStore } from '../src/server/postgres.ts';

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS & Preflight handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;
let lastSync = 0;
const SYNC_INTERVAL = 5000; // 5 seconds cache between serverless syncs

async function ensureDb() {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      dbInitPromise = postgresStore.initialize().then(() => {
        dbInitialized = true;
        lastSync = Date.now();
      }).catch((err) => {
        dbInitPromise = null;
        throw err;
      });
    }
    await dbInitPromise;
    return;
  }

  if (Date.now() - lastSync > SYNC_INTERVAL) {
    lastSync = Date.now();
    await postgresStore.refreshState().catch((err) => {
      console.error('[CHARMIQE POS] Serverless state refresh failed:', err);
    });
  }
}

// Ensure database connection before any API request
app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('[CHARMIQE POS] DB connection error in Serverless Function:', err);
    next(err);
  }
});

// Mount on both /api and root to handle any Vercel URL rewrite format
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
