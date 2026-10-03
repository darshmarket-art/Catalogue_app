import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { loadConfig, type Config } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord, scopeBlobs, scopeStore, storeIdOf } from '../server/tenancy';
import { isAvailableStoreName, isValidStoreName } from '../shared/storeName';

const KEY = 'test-master-provisioning-key';
const SECRET = 'x'.repeat(48);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

let root: MemoryStore;
let blobs: MemoryBlobs;
let config: Config;
let app: ReturnType<typeof createApp>;

// Store A = bhakti (default, founder). Store B = example, on Pro so every feature is reachable.
const A = { 'X-Store': 'bhakti' };
const B = { 'X-Store': 'example' };

async function build(extra: Partial<Config> = {}) {
  config = {
    ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: SECRET, MASTER_PROVISIONING_KEY: KEY }),
    rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 },
    ...extra
  };
  root = new MemoryStore();
  blobs = new MemoryBlobs();
  await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  app = createApp(config, root, blobs);
}
beforeEach(() => build());

const admin = async (h: Record<string, string>, email = 'boss@example.com') =>
  (await request(app).post('/api/auth/admin/register').set(h).send({ email, password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY })).body.sessionToken as string;
const buyer = async (h: Record<string, string>, phone = '9820000001') =>
  (await request(app).post('/api/auth/retailer/signup').set(h).send({ firmName: 'Test Jewellers', ownerName: 'Owner', phone, password: 'StrongPass@1', gstin: '27ABCDE1234F1Z5', marketHub: 'X' })).body.token as string;
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('store resolution', () => {
  it('serves the default store with no hint, and the named store by header or ?store', async () => {
    expect((await request(app).get('/api/config')).body.data.id).toBe('bhakti');
    expect((await request(app).get('/api/config').set(B)).body.data.id).toBe('example');
    expect((await request(app).get('/api/config?store=example')).body.data.id).toBe('example');
  });

  it('picks the store from the subdomain, and a header cannot override it', async () => {
    const r = await request(app).get('/api/config').set('Host', 'example.antarixs.com').set(A);
    expect(r.body.data.id).toBe('example');
  });

  it('unknown, invalid, reserved and suspended stores are refused', async () => {
    expect((await request(app).get('/api/config').set({ 'X-Store': 'nobody' })).status).toBe(404);
    expect((await request(app).get('/api/config').set({ 'X-Store': 'a' })).status).toBe(404);
    expect((await request(app).get('/api/config').set('Host', 'nobody.antarixs.com')).status).toBe(404);
    expect((await request(app).get('/api/config').set('Host', 'console.antarixs.com')).status).toBe(404);
    expect((await request(app).get('/media/' + 'a'.repeat(32) + '.jpg').set(B).set('Host', 'www.antarixs.com')).status).toBe(404);
    await root.update('stores', 'example', { status: 'suspended' });
    expect((await request(app).get('/api/config').set(B)).status).toBe(403);
    expect((await request(app).get('/api/config').set(A)).status).toBe(200);
  });

  it('health needs no store; DEFAULT_STORE decides the fallback', async () => {
    expect((await request(app).get('/health').set({ 'X-Store': 'nobody' })).status).toBe(200);
    const cfg = loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: SECRET, DEFAULT_STORE: 'example' });
    expect(cfg.defaultStore).toBe('example');
    expect(storeIdOf({ hostname: 'x.run.app', header: () => undefined, query: {} } as any, cfg)).toBe('example');
  });

  it('names: 3 to 30 characters and not reserved', () => {
    expect(isValidStoreName('ab')).toBe(false);
    expect(isValidStoreName('abc')).toBe(true);
    expect(isValidStoreName('a'.repeat(31))).toBe(false);
    expect(isValidStoreName('-abc')).toBe(false);
    expect(isValidStoreName('Abc')).toBe(false);
    for (const n of ['www', 'console', 'api', 'app', 'admin']) expect(isAvailableStoreName(n)).toBe(false);
    expect(isAvailableStoreName('bhakti')).toBe(true);
  });
});

describe('per-store config and entitlements come from the store record', () => {
  it('each store has its own plan', async () => {
    expect((await request(app).get('/api/entitlements').set(A)).body.data.plan).toBe('founder');
    expect((await request(app).get('/api/entitlements').set(B)).body.data.plan).toBe('pro');
    await root.update('stores', 'example', { plan: 'basic' });
    expect((await request(app).get('/api/entitlements').set(B)).body.data.effectivePlan).toBe('basic');
    expect((await request(app).get('/api/entitlements').set(A)).body.data.effectivePlan).toBe('pro');
  });

  it('a changed record config is served without a restart', async () => {
    const rec = (await root.get('stores', 'example'))!;
    await root.update('stores', 'example', { merchant: { ...rec.merchant, brand: { ...rec.merchant.brand, name: 'Renamed' } } });
    expect((await request(app).get('/api/config').set(B)).body.data.brand.name).toBe('Renamed');
  });
});

describe('isolation between stores', () => {
  it('a token from one store is refused on the other, in both directions', async () => {
    const adminA = await admin(A);
    const buyerA = await buyer(A);
    expect(jwt.decode(adminA)).toMatchObject({ storeId: 'bhakti', iss: 'bhakti' });
    for (const t of [adminA, buyerA]) expect((await request(app).get('/api/auth/me').set(B).set(bearer(t))).status).toBe(401);
    const adminB = await admin(B);
    expect((await request(app).get('/api/auth/me').set(A).set(bearer(adminB))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(B).set(bearer(adminB))).status).toBe(200);
  });

  it('a forged token with the other store claim and the root secret still fails', async () => {
    await admin(B);
    const forged = jwt.sign({ type: 'admin', sub: 'boss@example.com', storeId: 'example' }, SECRET, { issuer: 'example' });
    expect((await request(app).get('/api/auth/me').set(B).set(bearer(forged))).status).toBe(401);
  });

  it('buyers and admins of one store do not exist in the other', async () => {
    await buyer(A, '9820000001');
    await admin(A);
    const login = (h: Record<string, string>) => request(app).post('/api/auth/retailer/login').set(h).send({ phone: '9820000001', password: 'StrongPass@1' });
    expect((await login(A)).status).toBe(200);
    expect((await login(B)).status).toBe(401);
    const adminLogin = (h: Record<string, string>) => request(app).post('/api/auth/admin/login').set(h).send({ adminId: 'boss@example.com', password: 'AdminPass@2026' });
    expect((await adminLogin(A)).status).toBe(200);
    expect((await adminLogin(B)).status).toBe(401);
  });

  it('designs, orders and buyer lists never cross stores', async () => {
    const adminA = await admin(A);
    const adminB = await admin(B);
    const buyerA = await buyer(A);
    await request(app).post('/api/orders/items').set(A).set(bearer(buyerA)).send({ sku: 'B2B-COIN-0010', batchQty: 2 });
    const po = (await request(app).post('/api/orders/confirm').set(A).set(bearer(buyerA))).body.poId as string;
    expect(po).toBeTruthy();
    expect((await request(app).get('/api/admin/orders').set(A).set(bearer(adminA))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/admin/orders').set(B).set(bearer(adminB))).body.data).toHaveLength(0);
    expect((await request(app).patch(`/api/admin/orders/${po}`).set(B).set(bearer(adminB)).send({ status: 'dispatched' })).status).toBe(404);
    const productsB = (await request(app).get('/api/products?limit=100').set(B).set(bearer(adminB))).body;
    expect(JSON.stringify(productsB)).not.toContain('B2B-COIN-0010');
    // every document lives under its own namespace
    expect(await root.list('buyers')).toEqual([]);
    expect((await root.list('stores/bhakti/buyers')).length).toBe(1);
    expect(await root.list('stores/example/buyers')).toEqual([]);
  });

  it('a photo from one store cannot be opened through the other', async () => {
    const adminA = await admin(A);
    const up = await request(app).post('/api/admin/photos').set(A).set(bearer(adminA)).set('Content-Type', 'image/jpeg').send(JPEG);
    const link: string = up.body.data.url;
    expect((await request(app).get(link).set(A)).status).toBe(200);
    expect((await request(app).get(link).set(B)).status).toBe(403); // signature is per store
    const file = up.body.data.ref.slice(6);
    expect(await blobs.exists(`stores/bhakti/photos/${file}`)).toBe(true);
    expect(await blobs.exists(`stores/example/photos/${file}`)).toBe(false);
    expect(await blobs.exists(`photos/${file}`)).toBe(false);
    expect(await scopeBlobs(blobs, 'example').get(`photos/${file}`)).toBeNull();
    // a photo uploaded in A cannot be attached to a design in B
    const adminB = await admin(B);
    const make = await request(app)
      .post('/api/products')
      .set(B)
      .set(bearer(adminB))
      .send({ title: 'Ring', sku: 'R-1', category: 'x', images: [up.body.data.ref] });
    expect(make.status).toBe(400);
  });

  it('a scoped store only reaches its own namespace', async () => {
    const a = scopeStore(root, 'bhakti');
    await a.set('buyers', '1', { phone: '1' });
    expect(await scopeStore(root, 'example').get('buyers', '1')).toBeNull();
    expect(() => a.get('stores/example/buyers', '1')).toThrow();
    expect(() => scopeStore(root, '../example')).toThrow();
  });

  it('rate limits are per store', async () => {
    await build({ rateLimit: { auth: 1000, adminRegister: 1000, api: 3, analytics: 100000 } });
    for (let i = 0; i < 3; i++) expect((await request(app).get('/api/config').set(A)).status).toBe(200);
    expect((await request(app).get('/api/config').set(A)).status).toBe(429);
    expect((await request(app).get('/api/config').set(B)).status).toBe(200);
  });
});

describe('native app of a non-default store', () => {
  const origin = { Origin: 'https://localhost' };
  it('preflights X-Store/X-App-Version, loads config and photos by ?store= with no header', async () => {
    const pre = await request(app).options('/api/config').set(origin);
    expect(pre.headers['access-control-allow-headers']).toMatch(/X-Store.*|.*X-App-Version/);
    expect(pre.headers['access-control-allow-headers']).toContain('X-App-Version');
    const cfg = await request(app).get('/api/config').set(origin).set(B).set('X-App-Version', '1.0.0');
    expect(cfg.body.data.id).toBe('example');
    expect(cfg.headers['access-control-allow-origin']).toBe('https://localhost');
    const t = await admin(B);
    const up = await request(app).post('/api/admin/photos').set(B).set(bearer(t)).set('Content-Type', 'image/jpeg').send(JPEG);
    // what src/api.ts withBase does: /media link + ?store=<id>; an <img> sends no X-Store
    const img = await request(app).get(`${up.body.data.url}&store=example`);
    expect(img.status).toBe(200);
    expect(img.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
