import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord } from '../server/tenancy';
import { makeEntitlements, trialEnd } from '../server/entitlements';
import { LIVE_RATE_LIMITS } from '../shared/limits';
import { hasProduct, productsOf } from '../shared/products';

const KEY = 'test-master-provisioning-key';
const CODE = '123456';
const DAY = 86400000;

describe('productsOf', () => {
  it('a record without products is Catalogue only, so every existing store is unchanged', () => {
    expect(productsOf({})).toEqual(['catalogue']);
    expect(productsOf({ products: [] })).toEqual(['catalogue']);
    expect(hasProduct({}, 'catalogue')).toBe(true);
    expect(hasProduct({}, 'liveRate')).toBe(false);
  });
  it('keeps a fixed order and drops unknown names', () => {
    expect(productsOf({ products: ['liveRate', 'catalogue'] })).toEqual(['catalogue', 'liveRate']);
    expect(productsOf({ products: ['liveRate'] })).toEqual(['liveRate']);
    expect(productsOf({ products: ['nonsense'] })).toEqual(['catalogue']);
  });
});

describe('makeEntitlements per product', () => {
  it('a Catalogue-only store has no Live Rate entitlements and its Catalogue plan is untouched', () => {
    const e = makeEntitlements({ plan: 'basic' });
    expect(e.products).toEqual(['catalogue']);
    expect(e.liveRate).toBeNull();
    expect(e.limits).toMatchObject({ categories: 5, photos: 200, photosPerDesign: 1, users: 50 });
  });

  it('each product carries its own plan: Catalogue Basic with Live Rate Pro, and the reverse', () => {
    const a = makeEntitlements({ plan: 'basic', products: ['catalogue', 'liveRate'], liveRate: { plan: 'pro' } });
    expect(a.effectivePlan).toBe('basic');
    expect(a.liveRate).toMatchObject({ plan: 'pro', effectivePlan: 'pro', trialEndsAt: null });
    expect(a.liveRate?.limits).toEqual(LIVE_RATE_LIMITS.pro);
    expect(a.liveRate?.flags).toMatchObject({ rateBoard: true, rateAlerts: true, bullionTrade: true });

    const b = makeEntitlements({ plan: 'pro', products: ['catalogue', 'liveRate'], liveRate: { plan: 'basic' } });
    expect(b.effectivePlan).toBe('pro');
    expect(b.liveRate).toMatchObject({ plan: 'basic', effectivePlan: 'basic' });
    expect(b.liveRate?.flags).toMatchObject({ rateBoard: true, rateAlerts: false, bullionTrade: false });
  });

  it('Live Rate has its own trial, independent of the Catalogue trial', () => {
    const now = Date.now();
    const d = { plan: 'basic' as const, products: ['catalogue' as const, 'liveRate' as const], liveRate: { plan: 'basic' as const, trialEndsAt: trialEnd(new Date(now)) } };
    expect(makeEntitlements(d, now).liveRate?.effectivePlan).toBe('pro');
    expect(makeEntitlements(d, now + 15 * DAY).liveRate?.effectivePlan).toBe('basic');
    expect(makeEntitlements(d, now + 15 * DAY).effectivePlan).toBe('basic');
  });

  it('a Live Rate store with no Live Rate plan on file starts on Basic', () => {
    const e = makeEntitlements({ plan: 'basic', products: ['liveRate'] });
    expect(e.products).toEqual(['liveRate']);
    expect(e.liveRate).toMatchObject({ plan: 'basic', effectivePlan: 'basic' });
  });
});

describe('three store types over the API', () => {
  let app: ReturnType<typeof createApp>;
  const example = loadMerchant({ MERCHANT: 'example' });
  const as = (id: string) => ({ 'X-Store': id });

  beforeEach(async () => {
    const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY, OTP_STATIC_CODE: CODE }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    const root = new MemoryStore();
    // 'example' has no products field at all, exactly like a store created before Live Rate.
    await root.set('stores', 'example', newStoreRecord(example, { plan: 'pro' }));
    await root.set('stores', 'ratesonly', newStoreRecord({ ...example, id: 'ratesonly' }, { plan: 'basic', products: ['liveRate'], liveRate: { plan: 'pro' } }));
    await root.set('stores', 'both', newStoreRecord({ ...example, id: 'both' }, { plan: 'pro', products: ['catalogue', 'liveRate'], liveRate: { plan: 'basic' } }));
    app = createApp(config, root, new MemoryBlobs());
  });

  const owner = async (id: string) =>
    (await request(app).post('/api/auth/admin/register').set(as(id)).send({ email: 'boss@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY })).body.sessionToken as string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('entitlements say which products each store has', async () => {
    const get = async (id: string) => (await request(app).get('/api/entitlements').set(as(id))).body.data;
    expect(await get('example')).toMatchObject({ products: ['catalogue'], liveRate: null });
    expect(await get('ratesonly')).toMatchObject({ products: ['liveRate'], liveRate: { plan: 'pro', effectivePlan: 'pro' } });
    expect(await get('both')).toMatchObject({ products: ['catalogue', 'liveRate'], liveRate: { plan: 'basic', effectivePlan: 'basic' } });
  });

  it.each([
    ['example', true],
    ['both', true],
    ['ratesonly', false]
  ])('%s: Catalogue routes answer %s', async (id, has) => {
    const token = await owner(id);
    for (const path of ['/api/products', '/api/categories', '/api/banners', '/api/tags', '/api/purities', '/api/shortlist', '/api/orders', '/api/admin/orders', '/api/analytics']) {
      const status = (await request(app).get(path).set(as(id)).set(bearer(token))).status;
      if (has) expect(status, `${id} ${path}`).not.toBe(404);
      else expect(status, `${id} ${path}`).toBe(404);
    }
  });

  it.each(['example', 'ratesonly', 'both'])('%s: shared routes work whatever the product', async (id) => {
    const token = await owner(id); // admin sign-up is shared
    expect((await request(app).get('/api/config').set(as(id))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(as(id)).set(bearer(token))).body.type).toBe('admin');
    expect((await request(app).get('/api/about').set(as(id)).set(bearer(token))).status).toBe(200);
    expect((await request(app).get('/api/admin/buyers').set(as(id)).set(bearer(token))).status).toBe(200);
  });

  it('a product-less store does not leak into another store', async () => {
    await owner('ratesonly');
    const token = await owner('example');
    expect((await request(app).get('/api/products').set(as('example')).set(bearer(token))).status).toBe(200);
    expect((await request(app).get('/api/products').set(as('ratesonly')).set(bearer(token))).status).not.toBe(200);
  });
});

describe('console products action', () => {
  const AUD = '/projects/1/global/backendServices/2';
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = keys.publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const assertion = jwt.sign({ email: 'boss@antarixs.com' }, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'ES256', keyid: 'k1', audience: AUD, issuer: 'https://cloud.google.com/iap', expiresIn: 300 });
  const staff = { 'x-goog-iap-jwt-assertion': assertion };
  const api = '/api/v1/console';
  let app: ReturnType<typeof createApp>;
  let root: MemoryStore;

  beforeEach(async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pem }) }));
    process.env.CONSOLE_ADMINS = 'boss@antarixs.com';
    process.env.IAP_AUDIENCE = AUD;
    const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    root = new MemoryStore();
    await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'basic' }));
    app = createApp(config, root, new MemoryBlobs());
    await request(app).get('/api/config');
  });
  afterEach(() => vi.unstubAllGlobals());

  const post = (body: unknown) => request(app).post(`${api}/stores/example/products`).set(staff).send(body as object);

  it('lists existing stores as Catalogue only', async () => {
    const list = (await request(app).get(`${api}/stores`).set(staff)).body.data;
    expect(list.find((s: any) => s.id === 'example')).toMatchObject({ products: ['catalogue'], liveRate: null });
  });

  it('adds Live Rate on a trial without touching the Catalogue plan, and audits it', async () => {
    const before = (await root.get('stores', 'example')) as any;
    const r = await post({ products: ['catalogue', 'liveRate'] });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ products: ['catalogue', 'liveRate'], plan: 'basic' });
    expect(r.body.data.liveRate).toMatchObject({ plan: 'basic' });
    const days = (Date.parse(r.body.data.liveRate.trialEndsAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.9);
    const after = (await root.get('stores', 'example')) as any;
    expect({ plan: after.plan, trialEndsAt: after.trialEndsAt, ownApp: after.ownApp }).toEqual({ plan: before.plan, trialEndsAt: before.trialEndsAt, ownApp: before.ownApp });
    const audit = (await root.list('consoleAudit')).find((a: any) => a.storeId === 'example' && a.action === 'products') as any;
    expect(audit.what).toContain('catalogue -> catalogue+liveRate');
    expect((await request(app).get('/api/entitlements').set('X-Store', 'example')).body.data.liveRate).toMatchObject({ plan: 'basic' });
  });

  it('sets the Live Rate plan, keeps it when Live Rate is removed, and restores it when added back', async () => {
    await post({ products: ['catalogue', 'liveRate'], liveRatePlan: 'pro' });
    const removed = await post({ products: ['catalogue'] });
    expect(removed.body.data).toMatchObject({ products: ['catalogue'], liveRate: { plan: 'pro' } });
    expect((await request(app).get('/api/entitlements').set('X-Store', 'example')).body.data.liveRate).toBeNull();
    const back = await post({ products: ['catalogue', 'liveRate'] });
    expect(back.body.data.liveRate).toEqual({ plan: 'pro' });
  });

  it('refuses an empty or unknown product list, and non-JSON bodies', async () => {
    expect((await post({ products: [] })).status).toBe(400);
    expect((await post({ products: ['gold'] })).status).toBe(400);
    expect((await request(app).post(`${api}/stores/example/products`).set(staff).type('form').send('products=liveRate')).status).toBe(415);
  });
});

describe('sign-up product choice', () => {
  let app: ReturnType<typeof createApp>;
  let root: MemoryStore;
  const signup = async (id: string, phone: string, extra: Record<string, unknown> = {}) => {
    await request(app).post('/api/v1/signup/request-otp').send({ phone });
    return request(app).post('/api/v1/signup').send({ storeName: id, brandName: 'Brand', phone, email: `${id}@x.com`, password: 'OwnerPass@2026', code: CODE, ...extra });
  };

  beforeEach(() => {
    const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'k'.repeat(20), OTP_STATIC_CODE: CODE }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    root = new MemoryStore();
    app = createApp(config, root);
  });

  it('with no choice the record is exactly what it was before Live Rate', async () => {
    expect((await signup('plain-one', '9811111101')).status).toBe(201);
    const rec = (await root.get('stores', 'plain-one')) as any;
    expect(rec.products).toBeUndefined();
    expect(rec.liveRate).toBeUndefined();
  });

  it('Live Rate only, and both, each get a Live Rate trial', async () => {
    expect((await signup('rate-one', '9811111102', { products: ['liveRate'] })).status).toBe(201);
    const a = (await root.get('stores', 'rate-one')) as any;
    expect(a.products).toEqual(['liveRate']);
    expect(a.liveRate).toMatchObject({ plan: 'basic' });
    expect(Date.parse(a.liveRate.trialEndsAt)).toBeGreaterThan(Date.now() + 13 * DAY);
    expect((await request(app).get('/api/products').set('X-Store', 'rate-one')).status).toBe(404);

    expect((await signup('both-one', '9811111103', { products: ['liveRate', 'catalogue'] })).status).toBe(201);
    expect(((await root.get('stores', 'both-one')) as any).products).toEqual(['catalogue', 'liveRate']);
  });

  it('refuses an empty or unknown choice', async () => {
    expect((await signup('bad-one', '9811111104', { products: [] })).status).toBe(400);
    expect((await signup('bad-two', '9811111105', { products: ['gold'] })).status).toBe(400);
  });
});
