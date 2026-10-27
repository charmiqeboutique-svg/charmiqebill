import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/api.ts';
import { postgresStore } from './src/server/postgres.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await postgresStore.initialize();
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Parse JSON bodies
  app.use(express.json());

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Vite integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CHARMIQE POS] Server ready at http://0.0.0.0:${PORT}`);
  });

  const closeDatabase = async () => {
    await postgresStore.close();
    process.exit(0);
  };
  process.once('SIGINT', closeDatabase);
  process.once('SIGTERM', closeDatabase);
}

startServer().catch((err) => {
  console.error('[CHARMIQE POS] Fatal server startup error:', err);
  process.exit(1);
});
