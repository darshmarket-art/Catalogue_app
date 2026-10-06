import express from 'express';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './server/config';
import { createStore } from './server/store';
import { createApp } from './server/app';
import { seedDemoCatalogue } from './server/seed';
import { migrateLegacyBuyers } from './server/migrate';
import { renderIndexHtml } from './server/merchant';
import { isAppPath, notFoundPage } from './server/legal';
import { scopeStore } from './server/tenancy';
import { createBlobs } from './server/blobs';
import { logger } from './server/logger';

async function startServer() {
  const config = loadConfig();
  const store = createStore(config);
  const blobs = createBlobs(config);

  // Per-store config lives in the stores record (seeded from merchants/<id>/merchant.json for the default store).
  const defaultData = scopeStore(store, config.defaultStore);
  const migrated = await migrateLegacyBuyers(defaultData);
  if (migrated > 0) logger.info(`Moved ${migrated} buyer account(s) to the buyers collection`);
  if (config.seedDemoCatalogue) await seedDemoCatalogue(defaultData, config.merchant.id);

  const app = createApp(config, store, blobs);

  // index.html is rendered per merchant (title, link preview, colours, embedded config) before it is sent.
  if (!config.isProduction) {
    // Imported lazily so the production bundle never needs the (dev-only) vite package.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    // Antarixs console page (dev); production serves dist/console.html from consoleMount.
    app.get('/console', async (req, res, next) => {
      try {
        res.type('html').send(await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.resolve(process.cwd(), 'console.html'), 'utf-8')));
      } catch (err) {
        next(err);
      }
    });
    app.get('*', async (req, res, next) => {
      try {
        if (!isAppPath(req.path) && !/^\/(@|src\/|node_modules\/)/.test(req.path)) return void res.status(404).type('html').send(notFoundPage(res.locals.merchant));
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = renderIndexHtml(await vite.transformIndexHtml(req.originalUrl, template), res.locals.merchant);
        res.status(200).type('html').send(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexFile = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexFile)) throw new Error(`Client build not found at ${distPath}. Run "npm run build" first.`);
    const template = fs.readFileSync(indexFile, 'utf-8');
    // The service worker must always be re-checked, or an old copy could outlive a deploy.
    app.get('/sw.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache').type('js').sendFile(path.join(distPath, 'sw.js'));
    });
    // Built files have a hash in their name, so they can be kept for a year; everything else is re-checked.
    app.use('/assets', express.static(path.join(distPath, 'assets'), { index: false, maxAge: '1y', immutable: true, fallthrough: false }));
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => {
      // Only the app's own addresses open the app; anything else is a real "page not found".
      if (!isAppPath(req.path)) return void res.status(404).set('Cache-Control', 'no-store').type('html').send(notFoundPage(res.locals.merchant));
      res.set('Cache-Control', 'no-cache').type('html').send(renderIndexHtml(template, res.locals.merchant));
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
