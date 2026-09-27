import express from 'express';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './server/config';
import { createStore } from './server/store';
import { createApp } from './server/app';
import { seedDemoCatalogue } from './server/seed';
import { logger } from './server/logger';

async function startServer() {
  const config = loadConfig();
  const store = createStore(config);
  if (config.seedDemoCatalogue) await seedDemoCatalogue(store);

  const app = createApp(config, store);

  if (!config.isProduction) {
    // Imported lazily so the production bundle never needs the (dev-only) vite package.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) throw new Error(`Client build not found at ${distPath}. Run "npm run build" first.`);
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.JWT_SECRET && !config.isProduction) {
    logger.warn('JWT_SECRET not set: using a temporary secret, sessions reset on every restart');
  }
  if (!config.masterProvisioningKey) {
    logger.warn('MASTER_PROVISIONING_KEY not set: admin account creation is disabled');
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Bhakti Jewels server listening on port ${config.port}`, { store: config.storeKind });
  });

  // Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
