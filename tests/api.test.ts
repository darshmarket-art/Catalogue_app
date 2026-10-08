import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { loadConfig, type Config } from '../server/config';
import { MemoryStore, type Store } from '../server/store';
import { scopeStore } from '../server/tenancy';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { migrateLegacyBuyers } from '../server/migrate';
import { daysAgo } from '../server/stats';
import { loadMerchant, renderIndexHtml, themeCss, THEME_TOKENS } from '../server/merchant';

import { STATIC_CODE, otpBuyer } from './buyerAuth';
const MASTER_KEY = 'test-master-provisioning-key';
const JWT_SECRET = 'x'.repeat(48);

let root: MemoryStore;
let store: Store;
let config: Config;

async function build(overrides: Partial<Config['rateLimit']> = {}, access: 'public' | 'login' = 'login') {
  config = {
    ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET, MASTER_PROVISIONING_KEY: MASTER_KEY }),
    rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000, ...overrides }
  };
  config.merchant = { ...config.merchant, catalogueAccess: access };
  root = new MemoryStore();
  store = scopeStore(root, 'bhakti');
  await seedDemoCatalogue(store, 'bhakti');
  return createApp(config, root);
}

const retailer = (n = 1) => ({
  firmName: `Test Jewellers ${n}`,
  phone: `98200000${String(n).padStart(2, '0')}`
});

async function signupRetailer(app: ReturnType<typeof createApp>, n = 1) {
  const res = await otpBuyer(app, retailer(n));
  return { token: res.body.token as string, res };
}

async function createAdmin(app: ReturnType<typeof createApp>, email = 'boss@bhaktijewels.in') {
  const res = await request(app)
    .post('/api/auth/admin/register')
    .send({ email, password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER_KEY });
  return { token: res.body.sessionToken as string, res };
}

describe('config', () => {
  it('refuses to start in production without strong secrets', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short', MASTER_PROVISIONING_KEY: 'short' })).toThrow(
      /JWT_SECRET/
    );
  });

  it('refuses a non-Firestore store in production', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', JWT_SECRET, MASTER_PROVISIONING_KEY: MASTER_KEY, STORE: 'file' })
    ).toThrow(/firestore/);
  });

  it('accepts a complete production configuration', () => {
    const cfg = loadConfig({ NODE_ENV: 'production', JWT_SECRET, MASTER_PROVISIONING_KEY: MASTER_KEY });
    expect(cfg.storeKind).toBe('firestore');
    expect(cfg.seedDemoCatalogue).toBe(false);
  });
});

describe('authorization', () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    app = await build();
  });

  it('rejects anonymous access to admin and retailer routes', async () => {
    for (const [method, path] of [
      ['get', '/api/admin/audit-logs'],
      ['get', '/api/analytics'],
      ['get', '/api/analytics/export'],
      ['post', '/api/products'],
      ['post', '/api/categories'],
      ['get', '/api/orders'],
      ['post', '/api/orders/confirm']
    ] as const) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('forbids retailers from admin routes', async () => {
    const { token } = await signupRetailer(app);
    for (const path of ['/api/admin/audit-logs', '/api/analytics', '/api/analytics/export']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status, path).toBe(403);
    }
    const create = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send({ title: 'x' });
    expect(create.status).toBe(403);
  });

  it('forbids admins from retailer cart routes', async () => {
    const { token } = await createAdmin(app);
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects tokens signed with a different secret, and unsigned tokens', async () => {
    await createAdmin(app);
    const forged = jwt.sign({ type: 'admin', sub: 'boss@bhaktijewels.in' }, 'another-secret-another-secret-1234', {
      issuer: 'bhakti'
    });
    const unsigned = jwt.sign({ type: 'admin', sub: 'boss@bhaktijewels.in' }, '', { algorithm: 'none', issuer: 'bhakti' });
    for (const token of [forged, unsigned]) {
      const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it('revokes access immediately when the account is deleted', async () => {
    const { token } = await createAdmin(app);
    await store.delete('admins', 'boss@bhaktijewels.in');
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('lets admins read audit logs, analytics and the CSV export', async () => {
    const { token } = await createAdmin(app);
    for (const path of ['/api/admin/audit-logs', '/api/analytics', '/api/analytics/export']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status, path).toBe(200);
    }
  });
});

describe('admin provisioning', () => {
  it('rejects a wrong master key and never logs the submitted key', async () => {
    const app = await build();
    const wrong = 'not-the-real-key-abc';
    const res = await request(app)
      .post('/api/auth/admin/register')
      .send({ email: 'x@bhaktijewels.in', password: 'AdminPass@2026', masterProvisioningKey: wrong });
    expect(res.status).toBe(403);
    const logs = await store.list('auditLogs');
    expect(JSON.stringify(logs)).not.toContain(wrong);
    expect(logs.some((l) => l.event === 'ADMIN_CREATION_FAILED_INVALID_TOKEN')).toBe(true);
  });

  it('is disabled when no master key is configured', async () => {
    await build();
    const disabled = createApp({ ...config, masterProvisioningKey: null }, root);
    const res = await request(disabled)
      .post('/api/auth/admin/register')
      .send({ email: 'x@bhaktijewels.in', password: 'AdminPass@2026', masterProvisioningKey: 'anything' });
    expect(res.status).toBe(403);
  });

  it('allows one administrator per store, and it is the owner', async () => {
    const app = await build();
    const first = await request(app)
      .post('/api/auth/admin/register')
      .send({ email: 'boss@bhaktijewels.in', password: 'AdminPass@2026', masterProvisioningKey: MASTER_KEY });
    expect(first.status).toBe(201);
    expect(first.body.admin.role).toBe('owner');
    const second = await request(app)
      .post('/api/auth/admin/register')
      .send({ email: 'desk@bhaktijewels.in', password: 'AdminPass@2026', role: 'staff', masterProvisioningKey: MASTER_KEY });
    expect(second.status).toBe(409);
  });

  it('stores only a bcrypt hash for the admin; buyers have no password', async () => {
    const app = await build();
    await createAdmin(app);
    await signupRetailer(app);
    const [admin] = await store.list('admins');
    const [merchant] = await store.list('buyers');
    expect(admin.password).toMatch(/^\$2[aby]\$/);
    expect(merchant.password).toBeUndefined();
  });
});

describe('retailer accounts', () => {
  it('has no buyer passwords: the password endpoints are gone', async () => {
    const app = await build();
    expect((await request(app).post('/api/auth/retailer/signup').send({ firmName: 'A', phone: '9820000001', password: 'StrongPass@1' })).status).toBe(404);
    expect((await request(app).post('/api/auth/retailer/login').send({ phone: '9820000001', password: 'StrongPass@1' })).status).toBe(404);
  });

  it('validates the phone number', async () => {
    const app = await build();
    expect((await request(app).post('/api/auth/retailer/request-otp').send({ phone: '12' })).status).toBe(400);
  });
});

describe('orders', () => {
  it('keeps each retailer’s cart private', async () => {
    const app = await build();
    const a = (await signupRetailer(app, 1)).token;
    const b = (await signupRetailer(app, 2)).token;

    const added = await request(app)
      .post('/api/orders/items')
      .set('Authorization', `Bearer ${a}`)
      .send({ sku: 'B2B-KND-9082', batchQty: 2 });
    expect(added.status).toBe(201);

    const listA = await request(app).get('/api/orders').set('Authorization', `Bearer ${a}`);
    const listB = await request(app).get('/api/orders').set('Authorization', `Bearer ${b}`);
    expect(listA.body.count).toBe(1);
    expect(listB.body.count).toBe(0);

    const steal = await request(app).delete(`/api/orders/items/${added.body.data.id}`).set('Authorization', `Bearer ${b}`);
    expect(steal.status).toBe(404);
    const remove = await request(app).delete(`/api/orders/items/${added.body.data.id}`).set('Authorization', `Bearer ${a}`);
    expect(remove.status).toBe(200);
  });

  it('changes a cart line quantity, recomputing weight; not another buyers line, not below 1', async () => {
    const app = await build();
    const a = (await signupRetailer(app, 1)).token;
    const b = (await signupRetailer(app, 2)).token;
    const added = await request(app).post('/api/orders/items').set('Authorization', `Bearer ${a}`).send({ sku: 'B2B-KND-9082', batchQty: 1 });
    const id = added.body.data.id;
    const patch = (t: string, body: object) => request(app).patch(`/api/orders/items/${id}`).set('Authorization', `Bearer ${t}`).send(body);
    const r = await patch(a, { batchQty: 3 });
    expect(r.status).toBe(200);
    expect(r.body.data.batchQty).toBe(3);
    expect(r.body.data.totalNetGold).toBeCloseTo(added.body.data.totalNetGold * 3, 3);
    expect((await patch(b, { batchQty: 2 })).status).toBe(404);
    expect((await patch(a, { batchQty: 0 })).status).toBe(400);
    const list = await request(app).get('/api/orders').set('Authorization', `Bearer ${a}`);
    expect(list.body.data[0].batchQty).toBe(3);
  });

  it('computes weights from the catalogue, not from client-supplied values', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    const res = await request(app)
      .post('/api/orders/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'B2B-KND-9082', batchQty: 2, totalNetGold: 0.001, unitWt: 0.001, purity: '1K' }); // a purity the owner does not offer is ignored
    expect(res.body.data.totalNetGold).toBe(85);
    expect(res.body.data.purity).toBe('22K 916');
  });

  it('rejects unknown SKUs and empty confirmations, and books a PO otherwise', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    const auth = { Authorization: `Bearer ${token}` };

    expect((await request(app).post('/api/orders/items').set(auth).send({ sku: 'NOPE' })).status).toBe(404);
    expect((await request(app).post('/api/orders/confirm').set(auth)).status).toBe(400);

    await request(app).post('/api/orders/items').set(auth).send({ sku: 'B2B-COIN-0010', batchQty: 3 });
    const confirm = await request(app).post('/api/orders/confirm').set(auth);
    expect(confirm.status).toBe(200);
    expect(confirm.body.totalNetGrams).toBe(30);
    expect(await store.list('purchaseOrders')).toHaveLength(1);
  });
});

describe('catalogue', () => {
  it('serves the catalogue to signed-in users with pagination', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    const auth = { Authorization: `Bearer ${token}` };
    const all = await request(app).get('/api/products').set(auth);
    expect(all.status).toBe(200);
    expect(all.body.count).toBeGreaterThanOrEqual(1);
    // First page via offset (backward-compatible) returns page slice.
    const first = await request(app).get('/api/products?limit=2&offset=0').set(auth);
    expect(first.body.data).toHaveLength(2);
    // Second page via cursor-based pagination.
    const second = await request(app).get(`/api/products?limit=2&cursor=${first.body.cursor}&cursorAfter=${first.body.cursorAfter}`).set(auth);
    expect(second.body.data).toHaveLength(2);
    // Products from different pages should not overlap.
    const ids1 = new Set<string>(first.body.data.map((p: any) => p.id));
    const ids2 = new Set<string>(second.body.data.map((p: any) => p.id));
    expect([...ids1].some((id) => ids2.has(id))).toBe(false);
  });

  it('lets admins add products, rejecting non-http photo links', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const base = { title: 'New Haar', category: 'Bridal Chokers & Haar', purity: '22K 916', grossWt: '50', stoneWt: '5', images: ['https://example.com/haar.jpg'] };
    const bad = await request(app).post('/api/products').set(auth).send({ ...base, images: ['javascript:alert(1)'] });
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/products').set(auth).send(base);
    expect(ok.status).toBe(201);
    expect(ok.body.data.netWt).toBe(45);
  });

  it('keeps a Hindi name and finds designs when a buyer searches in Hindi', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const admin = { Authorization: `Bearer ${token}` };
    const made = await request(app).post('/api/products').set(admin).send({ title: 'Sunrise Haar', titleHi: 'सूर्योदय हार', descriptionHi: 'शादी के लिए', category: 'Bridal Chokers & Haar', purity: '22K 916', grossWt: '50', stoneWt: '5', images: ['https://example.com/haar.jpg'] });
    expect(made.status).toBe(201);
    expect(made.body.data.titleHi).toBe('सूर्योदय हार');
    const buyer = { Authorization: `Bearer ${(await signupRetailer(app)).token}` };
    const own = await request(app).get(`/api/products?search=${encodeURIComponent('सूर्योदय')}`).set(buyer);
    expect(own.body.data.map((p: { title: string }) => p.title)).toEqual(['Sunrise Haar']);
    // No Hindi typed by the owner: the automatic Hindi of the name is searchable too.
    const auto = await request(app).get(`/api/products?search=${encodeURIComponent('कुंदन')}`).set(buyer);
    expect(auto.body.data.map((p: { title: string }) => p.title)).toContain('Royal Kundan Choker');
  });
});

describe('analytics', () => {
  const stats = async (app: ReturnType<typeof createApp>, adminToken: string) =>
    (await request(app).get('/api/analytics').set('Authorization', `Bearer ${adminToken}`)).body.data;

  it('starts from zero, with no fabricated baseline numbers', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const data = await stats(app, token);
    expect(data).toMatchObject({
      views: 0,
      inquiries: 0,
      bookedOrders: 0,
      bookedWeightKg: 0,
      liveVisitors: 0,
      todayVisitors: 0,
      verifiedToday: 0,
      viewsTrend: '0%'
    });
  });

  it('counts a product view once per visitor session per day, and ignores admin browsing', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const send = (sessionId: string, skus: string[], bearer?: string) => {
      const req = request(app).post('/api/analytics/product-views');
      if (bearer) req.set('Authorization', `Bearer ${bearer}`);
      return req.send({ sessionId, skus });
    };

    expect((await send('visitor-aaaa1111', ['B2B-KND-9082', 'B2B-TMP-4410'])).body.counted).toBe(2);
    expect((await send('visitor-aaaa1111', ['B2B-KND-9082', 'B2B-COIN-0010'])).body.counted).toBe(1);
    expect((await send('visitor-bbbb2222', ['B2B-KND-9082'])).body.counted).toBe(1);
    expect((await send('admin-session-1', ['B2B-KND-9082'], admin)).body.counted).toBe(0);

    expect((await stats(app, admin)).views).toBe(4);
  });

  it('attributes inquiries to the signed-in firm, not to what the client claims', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);

    await request(app)
      .post('/api/analytics/track-inquiry')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientFirm: 'Someone Else Ltd', itemsCount: 3, totalNetWeight: 120 });
    await request(app).post('/api/analytics/track-inquiry').send({ clientFirm: 'Walk-in Jewellers' });

    const inquiries = await store.list('inquiries');
    expect(inquiries.map((i) => i.firmName).sort()).toEqual(['Test Jewellers 1', 'Walk-in Jewellers']);
    expect((await stats(app, admin)).inquiries).toBe(2);
  });

  it('counts confirmed orders and their weight', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/orders/items').set(auth).send({ sku: 'B2B-COIN-0010', batchQty: 5 });
    await request(app).post('/api/orders/confirm').set(auth);

    const data = await stats(app, admin);
    expect(data.bookedOrders).toBe(1);
    expect(data.bookedWeightKg).toBe(0.05);
  });

  it('tracks live visitors, unique visitors today, and verified vs guest', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token: retailerToken } = await signupRetailer(app);
    const beat = (sessionId: string, bearer?: string) => {
      const req = request(app).post('/api/analytics/heartbeat');
      if (bearer) req.set('Authorization', `Bearer ${bearer}`);
      return req.send({ sessionId });
    };

    await beat('guest-session-1');
    await beat('guest-session-1'); // repeat pings are not new visitors
    await beat('guest-session-2');
    await beat('retailer-session-1', retailerToken);
    await beat('admin-session-1', admin); // admins are not visitors
    await beat('admin-session-2'); // an admin's tab is a guest until they sign in...
    await beat('admin-session-2', admin); // ...and is taken back out once they do

    let data = await stats(app, admin);
    expect(data.liveVisitors).toBe(3);
    expect(data.verifiedMerchants).toBe(1);
    expect(data.guestRetailers).toBe(2);
    expect(data.todayVisitors).toBe(3);
    expect(data.verifiedToday).toBe(1);

    // A guest who signs in mid-session becomes verified, and is counted as verified once.
    await beat('guest-session-2', retailerToken);
    await beat('guest-session-2', retailerToken);
    data = await stats(app, admin);
    expect(data.todayVisitors).toBe(3);
    expect(data.verifiedToday).toBe(2);
    expect(data.verifiedMerchants).toBe(2);
  });

  it('drops visitors from the live count once their heartbeats stop', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    await request(app).post('/api/analytics/heartbeat').send({ sessionId: 'guest-session-1' });
    expect((await stats(app, admin)).liveVisitors).toBe(1);

    await store.update('sessions', 'guest-session-1', { lastPing: Date.now() - 60_000 });
    const data = await stats(app, admin);
    expect(data.liveVisitors).toBe(0);
    expect(data.todayVisitors).toBe(1);
  });

  it('computes the views trend against the previous 7 days, and ignores older days', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    await store.set('dailyStats', daysAgo(8), { day: daysAgo(8), views: 10 });
    await store.set('dailyStats', daysAgo(20), { day: daysAgo(20), views: 999 });
    await request(app).post('/api/analytics/product-views').send({
      sessionId: 'visitor-aaaa1111',
      skus: Array.from({ length: 20 }, (_, i) => `SKU-${i}`)
    });

    const data = await stats(app, admin);
    expect(data.views).toBe(20);
    expect(data.viewsTrend).toBe('+100.0%');
  });

  it('validates tracking payloads and rate limits them', async () => {
    const app = await build({ analytics: 3 });
    const bad = await request(app).post('/api/analytics/heartbeat').send({ sessionId: 'x' });
    expect(bad.status).toBe(400);
    const send = () => request(app).post('/api/analytics/heartbeat').send({ sessionId: 'guest-session-9' });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it('quotes user-supplied text safely in the CSV export', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    await request(app).post('/api/analytics/track-inquiry').send({ clientFirm: '=HYPERLINK("http://evil","x")' });
    const res = await request(app).get('/api/analytics/export').set('Authorization', `Bearer ${token}`);
    expect(res.text).toContain('""http://evil""');
    expect(res.text.split('\n').every((line) => !/^"[=+\-@]/.test(line))).toBe(true);
  });
});

describe('platform', () => {
  it('exposes a health check and security headers, and no longer serves the production guide', async () => {
    const app = await build();
    expect((await request(app).get('/health')).body.status).toBe('ok');
    const cfg = await request(app).get('/api/config');
    expect(cfg.headers['x-content-type-options']).toBe('nosniff');
    expect(cfg.headers['x-powered-by']).toBeUndefined();
    expect((await request(app).get('/api/production-guide')).status).toBe(404);
    expect((await request(app).get('/api/auth/admin/creation-process')).status).toBe(404);
  });

  it('answers unknown API paths with JSON 404 and malformed JSON with 400', async () => {
    const app = await build();
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const bad = await request(app).post('/api/auth/retailer/request-otp').set('Content-Type', 'application/json').send('{bad');
    expect(bad.status).toBe(400);
  });
});

describe('merchant config', () => {
  const bhakti = loadMerchant({ MERCHANT: 'bhakti' });

  const withTempMerchant = (id: string, mutate: (cfg: any) => void) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merchant-'));
    fs.mkdirSync(path.join(root, 'merchants', id), { recursive: true });
    const cfg = JSON.parse(JSON.stringify(bhakti));
    cfg.id = id;
    mutate(cfg);
    fs.writeFileSync(path.join(root, 'merchants', id, 'merchant.json'), JSON.stringify(cfg));
    return root;
  };

  it('loads the shipped Bhakti config and serves it publicly at /api/config', async () => {
    expect(bhakti.brand.name).toBe('Bhakti Jewels');
    const app = await build();
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.data.brand.name).toBe('Bhakti Jewels');
    expect(res.body.data.catalogueAccess).toBe('login');
  });

  it('rejects unknown merchants, bad ids and invalid values with a clear message', () => {
    expect(() => loadMerchant({ MERCHANT: 'does-not-exist' })).toThrow(/not found/);
    expect(() => loadMerchant({ MERCHANT: '../etc' })).toThrow(/Invalid MERCHANT id/);

    const badColour = withTempMerchant('acme', (c) => (c.theme.colors.primary = 'red'));
    expect(() => loadMerchant({ MERCHANT: 'acme' }, badColour)).toThrow(/theme\.colors\.primary/);

    const badWhatsapp = withTempMerchant('acme', (c) => (c.contact.whatsapp = '+91 22 2340'));
    expect(() => loadMerchant({ MERCHANT: 'acme' }, badWhatsapp)).toThrow(/contact\.whatsapp/);

    const unknownToken = withTempMerchant('acme', (c) => (c.theme.colors['not-a-token'] = '#112233'));
    expect(() => loadMerchant({ MERCHANT: 'acme' }, unknownToken)).toThrow(/theme\.colors/);
  });

  it('accepts a valid config for another merchant, with a colour override', () => {
    const root = withTempMerchant('acme', (c) => {
      c.brand.name = 'Acme Gems';
      c.theme.colors.primary = '#123456';
    });
    const acme = loadMerchant({ MERCHANT: 'acme' }, root);
    expect(acme.brand.name).toBe('Acme Gems');
    expect(themeCss(acme)).toBe(':root{--color-primary:#123456}');
  });

  it('only allows theme tokens that really exist in the stylesheet', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf-8');
    const missing = THEME_TOKENS.filter((t) => !css.includes(`--color-${t}:`));
    expect(missing).toEqual([]);
  });

  it('renders index.html per merchant and cannot be broken out of by config text', () => {
    const evil = { ...bhakti, brand: { ...bhakti.brand, name: '</script><script>alert(1)</script>', seoTitle: 'A "quoted" <b>title</b>' } };
    const html = renderIndexHtml(
      '<title>{{SEO_TITLE}}</title>{{THEME_STYLE}}{{MERCHANT_CONFIG}}<meta content="{{THEME_COLOR}}">',
      evil
    );
    expect(html).toContain('<title>A &quot;quoted&quot; &lt;b&gt;title&lt;/b&gt;</title>');
    expect(html).not.toContain('</script><script>');
    const embedded = /<script id="merchant-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(JSON.parse(embedded).brand.name).toBe('</script><script>alert(1)</script>');
    expect(html).not.toContain('{{');
  });

  it('validates promotions and treats them as optional', () => {
    const bad = withTempMerchant('acme', (c) => (c.promotions[0].theme = 'neon'));
    expect(() => loadMerchant({ MERCHANT: 'acme' }, bad)).toThrow(/promotions\.0\.theme/);

    const tooMany = withTempMerchant('acme', (c) => (c.promotions = Array(6).fill(c.promotions[0])));
    expect(() => loadMerchant({ MERCHANT: 'acme' }, tooMany)).toThrow(/promotions/);

    const none = withTempMerchant('acme', (c) => delete c.promotions);
    expect(loadMerchant({ MERCHANT: 'acme' }, none).promotions).toEqual([]);
  });

  it('ships a valid second merchant (example) that differs from Bhakti', () => {
    const example = loadMerchant({ MERCHANT: 'example' });
    expect(example.brand.name).toBe('Acme Gems');
    expect(example.promotions).toEqual([]);
    expect(themeCss(example)).toContain('--color-primary:#1e3a8a');
    expect(JSON.stringify(example)).not.toMatch(/bhakti/i);
  });

  it('uses the merchant for order numbers, WhatsApp text, desk phone and export filename', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/orders/items').set(auth).send({ sku: 'B2B-COIN-0010', batchQty: 1 });
    const confirm = await request(app).post('/api/orders/confirm').set(auth);
    expect(confirm.body.poId).toMatch(/^PO-BHAKTI-\d{6}$/);
    expect(confirm.body.whatsappMessage).toContain('BHAKTI JEWELS');
    expect(confirm.body.escrowGuaranteeRef).toBeUndefined();

    const csv = await request(app).get('/api/analytics/export').set('Authorization', `Bearer ${admin}`);
    expect(csv.headers['content-disposition']).toContain('bhakti_audit_ledger.csv');
  });

  it('issues tokens tied to the merchant, so another merchant’s tokens are refused', async () => {
    const app = await build();
    await createAdmin(app);
    const foreign = jwt.sign({ type: 'admin', sub: 'boss@bhaktijewels.in' }, JWT_SECRET, { issuer: 'someone-else' });
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${foreign}`);
    expect(res.status).toBe(401);
  });
});

describe('catalogue access modes', () => {
  const catalogueUrls = ['/api/products', '/api/categories'];

  it('login mode: the catalogue needs an account, but branding stays public', async () => {
    const app = await build({}, 'login');
    for (const url of catalogueUrls) expect((await request(app).get(url)).status, url).toBe(401);
    expect((await request(app).get('/api/config')).status).toBe(200);

    const { token } = await signupRetailer(app);
    const { token: admin } = await createAdmin(app);
    for (const url of catalogueUrls) {
      expect((await request(app).get(url).set('Authorization', `Bearer ${token}`)).status, url).toBe(200);
      expect((await request(app).get(url).set('Authorization', `Bearer ${admin}`)).status, url).toBe(200);
    }
  });

  it('login mode: forged or expired tokens do not open the catalogue', async () => {
    const app = await build({}, 'login');
    const forged = jwt.sign({ type: 'retailer', sub: '9820000001' }, 'x'.repeat(48), { issuer: 'bhakti' });
    expect((await request(app).get('/api/products').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('public mode: anyone can browse, but ordering still needs an account', async () => {
    const app = await build({}, 'public');
    for (const url of catalogueUrls) expect((await request(app).get(url)).status, url).toBe(200);
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).post('/api/orders/items').send({ sku: 'B2B-KND-9082' })).status).toBe(401);
    expect((await request(app).post('/api/orders/confirm')).status).toBe(401);
  });

  it('never opens admin routes, in either mode', async () => {
    const app = await build({}, 'public');
    for (const url of ['/api/analytics', '/api/admin/audit-logs', '/api/admin/orders']) {
      expect((await request(app).get(url)).status, url).toBe(401);
    }
  });
});

describe('admin orders', () => {
  const placeOrder = async (app: ReturnType<typeof createApp>, token: string, sku = 'B2B-COIN-0010', qty = 2) => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/orders/items').set(auth).send({ sku, batchQty: qty });
    return (await request(app).post('/api/orders/confirm').set(auth)).body.poId as string;
  };

  it('is limited to admins', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    const poId = await placeOrder(app, token);
    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
    expect((await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    const patch = await request(app).patch(`/api/admin/orders/${poId}`).set('Authorization', `Bearer ${token}`).send({ status: 'dispatched' });
    expect(patch.status).toBe(403);
  });

  it('lists orders newest first with the buyer’s contact details', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const first = await signupRetailer(app, 1);
    const second = await signupRetailer(app, 2);
    const po1 = await placeOrder(app, first.token);
    await new Promise((r) => setTimeout(r, 5));
    const po2 = await placeOrder(app, second.token, 'B2B-KND-9082', 1);

    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: any) => o.poId)).toEqual([po2, po1]);
    expect(res.body.data[0]).toMatchObject({
      status: 'new',
      firmName: 'Test Jewellers 2',
      buyer: { phone: retailer(2).phone, firmName: 'Test Jewellers 2' },
      itemCount: 1
    });
    expect(res.body.data[0].buyer.password).toBeUndefined();
  });

  it('changes status, records it in the audit log, and rejects bad input', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);
    const poId = await placeOrder(app, token);
    const auth = { Authorization: `Bearer ${admin}` };

    const ok = await request(app).patch(`/api/admin/orders/${poId}`).set(auth).send({ status: 'dispatched' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('dispatched');
    expect((await store.get('purchaseOrders', poId))!.status).toBe('dispatched');
    expect((await store.list('auditLogs')).some((l) => l.event === 'ORDER_STATUS_CHANGED' && l.details.includes(poId))).toBe(true);

    expect((await request(app).patch(`/api/admin/orders/${poId}`).set(auth).send({ status: 'shipped-ish' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/orders/PO-NOPE-000000').set(auth).send({ status: 'confirmed' })).status).toBe(404);

    const filtered = await request(app).get('/api/admin/orders?status=new').set(auth);
    expect(filtered.body.data).toEqual([]);
  });

  it('counts only new orders in the Admin Hub', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);
    const poId = await placeOrder(app, token);
    const auth = { Authorization: `Bearer ${admin}` };

    expect((await request(app).get('/api/analytics').set(auth)).body.data.newOrders).toBe(1);
    await request(app).patch(`/api/admin/orders/${poId}`).set(auth).send({ status: 'confirmed' });
    expect((await request(app).get('/api/analytics').set(auth)).body.data.newOrders).toBe(0);
  });
});

describe('session restore (/api/auth/me)', () => {
  it('rejects anonymous callers and forged tokens', async () => {
    const app = await build();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = jwt.sign({ type: 'retailer', sub: '9820000001' }, 'x'.repeat(48), { issuer: 'bhakti' });
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('describes a signed-in retailer and admin without leaking secrets', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    const { token: admin } = await createAdmin(app);

    const retailerMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(retailerMe.status).toBe(200);
    expect(retailerMe.body).toMatchObject({ type: 'retailer', user: { storeName: 'Test Jewellers 1', phone: retailer(1).phone } });
    expect(JSON.stringify(retailerMe.body)).not.toMatch(/password|\$2[aby]\$/);
    // the profile menu shows the buyer's own business details
    expect(retailerMe.body.user.ownerName).toBeTruthy();
    expect(retailerMe.body.user.gstin).toBeTruthy();
    expect(retailerMe.body.user.marketHub).toBeTruthy();

    const adminMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admin}`);
    expect(adminMe.body).toMatchObject({ type: 'admin', admin: { email: 'boss@bhaktijewels.in', role: 'owner' } });
    expect(JSON.stringify(adminMe.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  it('stops working as soon as the account is removed', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    await store.delete('buyers', retailer(1).phone);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });
});

describe('jewellery products (nothing invented)', () => {
  const full = {
    title: 'Test Haar',
    category: 'Bridal Chokers & Haar',
    purity: '22K 916',
    grossWt: '50',
    stoneWt: '5',
    images: ['https://example.com/haar.jpg']
  };

  it('stores only what the merchant entered: no random HUID, and never a price', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(full);
    expect(res.status).toBe(201);
    expect(res.body.data.netWt).toBe(45);
    for (const invented of ['huid', 'priceMode', 'fixedPrice', 'makingChargePerGram']) expect(res.body.data[invented]).toBeUndefined();
    expect(res.body.data.sku).toMatch(/^SKU-/);
  });

  it('keeps a HUID when the merchant provides it, and ignores any price fields sent', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...full, huid: 'HM/C-123456', priceMode: 'fixed', fixedPrice: '250000', makingChargePerGram: '300', sku: 'MY-SKU-1' });
    expect(res.body.data).toMatchObject({ huid: 'HM/C-123456', sku: 'MY-SKU-1' });
    for (const price of ['priceMode', 'fixedPrice', 'makingChargePerGram']) expect(res.body.data[price]).toBeUndefined();
  });

  it('requires the details a jeweller must state, and rejects impossible weights', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const post = (body: object) => request(app).post('/api/products').set(auth).send(body);
    expect((await post({ ...full, purity: undefined })).status).toBe(400);
    expect((await post({ ...full, purity: '99K' })).status).toBe(400);
    expect((await post({ ...full, grossWt: undefined })).status).toBe(400);
    expect((await post({ ...full, category: undefined })).status).toBe(400);
    const heavyStone = await post({ ...full, grossWt: '10', stoneWt: '10' });
    expect(heavyStone.status).toBe(400);
    expect(heavyStone.body.message).toMatch(/Stone weight/);
  });

  it('refuses a duplicate SKU', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/products').set(auth).send({ ...full, sku: 'DUP-1' })).status).toBe(201);
    expect((await request(app).post('/api/products').set(auth).send({ ...full, sku: 'DUP-1' })).status).toBe(409);
  });

  it('counts designs per category from the products themselves', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/categories').set(auth).send({ tag: 'Rings', name: 'Brand New Line', image: 'https://example.com/line.jpg' });
    let cats = (await request(app).get('/api/categories').set(auth)).body.data;
    expect(cats.find((c: any) => c.name === 'Brand New Line').designCount).toBe(0);
    expect(cats.find((c: any) => c.name === 'Bridal Chokers & Haar').designCount).toBe(2);

    await request(app).post('/api/products').set(auth).send({ ...full, category: 'Brand New Line' });
    cats = (await request(app).get('/api/categories').set(auth)).body.data;
    expect(cats.find((c: any) => c.name === 'Brand New Line').designCount).toBe(1);
  });

  it('a new category has exactly one photo and no invented purities', async () => {
    const app = await build();
    const { token } = await createAdmin(app);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/categories').set(auth).send({ tag: 'Rings', name: 'Lockets' })).status).toBe(400);
    const res = await request(app).post('/api/categories').set(auth).send({ tag: 'Rings', name: 'Lockets', image: 'https://example.com/l.jpg' });
    expect(res.status).toBe(201);
    expect(res.body.data.image).toBe('https://example.com/l.jpg');
    expect(res.body.data.eligibleKarats).toEqual([]);
  });

  it('order lines carry only a HUID note when the product has one', async () => {
    const app = await build();
    const { token: admin } = await createAdmin(app);
    const { token } = await signupRetailer(app);
    await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({ ...full, sku: 'NOTE-1', huid: 'HM/C-999' });
    await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({ ...full, sku: 'NOTE-2' });
    const auth = { Authorization: `Bearer ${token}` };
    const withHuid = await request(app).post('/api/orders/items').set(auth).send({ sku: 'NOTE-1' });
    const without = await request(app).post('/api/orders/items').set(auth).send({ sku: 'NOTE-2' });
    expect(withHuid.body.data.note).toBe('HUID: HM/C-999');
    expect(without.body.data.note).toBe('');
  });

  it('each merchant seeds its own demo catalogue', async () => {
    const bhakti = new MemoryStore();
    await seedDemoCatalogue(bhakti, 'bhakti');
    const example = new MemoryStore();
    await seedDemoCatalogue(example, 'example');
    const empty = new MemoryStore();
    await seedDemoCatalogue(empty, 'no-such-merchant');

    expect((await bhakti.list('products')).length).toBe(6);
    expect((await example.list('products')).map((p) => p.sku).sort()).toEqual(['AG-BG-001', 'AG-NK-001', 'AG-NK-002']);
    expect(await empty.list('products')).toEqual([]);
  });

  it('no longer serves invented gold rates', async () => {
    const app = await build();
    const { token } = await signupRetailer(app);
    expect((await request(app).get('/api/rates').set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });
});

describe('roles and legacy data', () => {
  it('rejects unknown roles, and the first admin is always the owner', async () => {
    const app = await build();
    const register = (extra: object) =>
      request(app)
        .post('/api/auth/admin/register')
        .send({ email: `r${Math.random().toString(36).slice(2, 7)}@example.com`, password: 'AdminPass@2026', masterProvisioningKey: MASTER_KEY, ...extra });
    expect((await register({ role: 'Managing Director' })).status).toBe(400);
    expect((await register({ role: 'god-mode' })).status).toBe(400);
  });

  it('no longer stores or returns access levels', async () => {
    const app = await build();
    const { res } = await createAdmin(app);
    expect(res.body.admin.accessLevel).toBeUndefined();
    const [admin] = await store.list('admins');
    expect(admin.accessLevel).toBeUndefined();
  });

  it('moves buyer accounts from the old "merchants" collection, once and without overwriting', async () => {
    const legacyRoot = new MemoryStore();
    const legacyStore = scopeStore(legacyRoot, 'bhakti');
    const app = await build();
    void app;
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash('OldAccount@123', 10);
    const account = { id: 'merch-old', firmName: 'Legacy Jewellers', gstin: 'PENDING-VERIFY', ownerName: 'Old Owner', phone: '9820099999', password: hash, marketHub: 'X', verified: true, createdAt: '2026-01-01T00:00:00.000Z' };
    await legacyStore.set('merchants', account.phone, account);

    expect(await migrateLegacyBuyers(legacyStore)).toBe(1);
    expect((await legacyStore.get('buyers', account.phone))!.firmName).toBe('Legacy Jewellers');
    expect(await migrateLegacyBuyers(legacyStore)).toBe(0); // safe to run on every start

    // an account created since the rename is never overwritten
    await legacyStore.set('buyers', '9820088888', { ...account, phone: '9820088888', firmName: 'New Name' });
    await legacyStore.set('merchants', '9820088888', { ...account, phone: '9820088888', firmName: 'Old Name' });
    await migrateLegacyBuyers(legacyStore);
    expect((await legacyStore.get('buyers', '9820088888'))!.firmName).toBe('New Name');

    // and the moved account can sign in
    config = { ...config };
    const liveApp = createApp(config, legacyRoot);
    const login = await otpBuyer(liveApp, { phone: account.phone });
    expect(login.status).toBe(200);
    expect(login.body.user.storeName).toBe('Legacy Jewellers');
  });
});
