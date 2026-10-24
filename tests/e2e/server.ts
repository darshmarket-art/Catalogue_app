// Starts the real app (createApp, the same wiring as server.ts in development: Vite serves the client) on an empty file store in a temp folder.
// Run by Playwright's webServer. Everything the tests rely on (code, keys, demo data) is fixed here.
//
// Why not just run server.ts: its rate limits are fixed numbers (1000 API calls and 30 sign-in calls per 15 minutes per address), and a full matrix
// run makes thousands of calls from one address, so sessions would start failing half way. Like tests/layout.test.ts, this lifts the limits and nothing else.
// ponytail: copy of server.ts's dev branch; if server.ts ever exports its setup (with a config override) call that instead.
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = path.join(os.tmpdir(), `antarixs-e2e-${process.env.PW_PORT}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: process.env.PW_PORT,
  STORE: 'file',
  DATA_FILE: path.join(dir, 'db.json'),
  UPLOADS_DIR: path.join(dir, 'uploads'),
  SEED_DEMO_CATALOGUE: 'true',
  OTP_STATIC_CODE: '123456',
  JWT_SECRET: 'e2e-secret-'.padEnd(48, 'x'),
  MASTER_PROVISIONING_KEY: 'e2e-master-provisioning-key',
  // No store named: the bare address is the Antarixs platform site, a store opens with ?store=bhakti.
  PLATFORM_MODE: 'true',
  // The Console runs without Google sign-in (allowed outside production only).
  CONSOLE_DEV_OPEN: 'true'
});

const { loadConfig } = await import('../../server/config');
const { createStore } = await import('../../server/store');
const { createBlobs } = await import('../../server/blobs');
const { createApp } = await import('../../server/app');
const { seedDemoCatalogue } = await import('../../server/seed');
const { renderIndexHtml } = await import('../../server/merchant');
const { isAppPath, notFoundPage, platformNotFoundPage } = await import('../../server/legal');
const { scopeStore } = await import('../../server/tenancy');
const { createServer } = await import('vite');

const config = { ...loadConfig(), rateLimit: { auth: 1e6, adminRegister: 1e6, api: 1e9, analytics: 1e9 } };
const store = createStore(config);
await seedDemoCatalogue(scopeStore(store, config.defaultStore), config.merchant.id);
const app = createApp(config, store, createBlobs(config));

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
app.use(vite.middlewares);
app.get('/console', async (req, res, next) => {
  try {
    res.type('html').send(await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.resolve(process.cwd(), 'console.html'), 'utf-8')));
  } catch (err) {
    next(err);
  }
});
app.get('*', async (req, res, next) => {
  try {
    if (req.path.startsWith('/media/')) return void next();
    if (!isAppPath(req.path) && !/^\/(@|src\/|node_modules\/)/.test(req.path)) return void res.status(404).type('html').send(res.locals.platform ? platformNotFoundPage(config) : notFoundPage(res.locals.merchant));
    const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    res.status(200).type('html').send(renderIndexHtml(await vite.transformIndexHtml(req.originalUrl, template), res.locals.merchant));
  } catch (err) {
    next(err);
  }
});

app.listen(config.port, '0.0.0.0', () => console.log(`e2e server on ${config.port}`));
