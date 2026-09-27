import express from 'express';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './server/config';
import { createStore } from './server/store';
import { createApp } from './server/app';
import { seedDemoCatalogue } from './server/seed';
import { migrateLegacyBuyers } from './server/migrate';
import { parseMerchant, renderIndexHtml } from './server/merchant';
import { createBlobs } from './server/blobs';
import { logger } from './server/logger';

async function startServer() {
  const config = loadConfig();
  const store = createStore(config);
  const blobs = createBlobs(config);

  // A merchant.json in the merchant's bucket overrides the copy shipped in the image, so branding can change
  // without a rebuild. An invalid file stops the server rather than silently serving the wrong config.
  const stored = await blobs.get('merchant.json');
  if (stored) {
    config.merchant = parseMerchant(JSON.parse(stored.data.toString('utf-8')), 'merchant.json in storage', config.merchant.id);
    logger.info('Loaded merchant config from storage');
  }
  const migrated = await migrateLegacyBuyers(store);
  if (migrated > 0) logger.info(`Moved ${migrated} buyer account(s) to the buyers collection`);
  if (config.seedDemoCatalogue) await seedDemoCatalogue(store, config.merchant.id);

  const app = createApp(config, store, blobs);

  // index.html is rendered per merchant (title, link preview, colours, embedded config) before it is sent.
  if (!config.isProduction) {
    // Imported lazily so the production bundle never needs the (dev-only) vite package.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = renderIndexHtml(await vite.transformIndexHtml(req.originalUrl, template), config.merchant);
        res.status(200).type('html').send(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexFile = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexFile)) throw new Error(`Client build not found at ${distPath}. Run "npm run build" first.`);
    const html = renderIndexHtml(fs.readFileSync(indexFile, 'utf-8'), config.merchant);
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      res.type('html').send(html);
    });
  }

  if (!process.env.JWT_SECRET && !config.isProduction) {
    logger.warn('JWT_SECRET not set: using a temporary secret, sessions reset on every restart');
  }
  if (config.isProduction && !config.storageBucket) {
    logger.warn('STORAGE_BUCKET not set: photo upload is disabled');
  }
  if (!config.masterProvisioningKey) {
    logger.warn('MASTER_PROVISIONING_KEY not set: admin account creation is disabled');
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`${config.merchant.brand.name} server listening on port ${config.port}`, { store: config.storeKind, merchant: config.merchant.id });
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
