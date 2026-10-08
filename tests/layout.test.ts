import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { loadMerchant, parseMerchant, renderIndexHtml, type MerchantConfig, type ProductField } from '../server/merchant';
import { newStoreRecord, scopeStore, type StoreRecord } from '../server/tenancy';
import { makeEntitlements, trialEnd } from '../server/entitlements';
import { flagsFor, LIMITS } from '../shared/limits';
import { DEFAULT_LAYOUT, LAYOUTS, LAYOUT_IDS } from '../shared/layouts';

import { STATIC_CODE, otpBuyer } from './buyerAuth';
const KEY = 'test-master-provisioning-key';
const DAY = 86400000;
const past = () => new Date(Date.now() - DAY).toISOString();

afterEach(() => {
  delete process.env.CONSOLE_DEV_OPEN;
  delete process.env.CONSOLE_ADMINS;
});

type Opts = { merchant?: Partial<MerchantConfig>; production?: boolean; seed?: boolean; cacheMs?: number };

/** One store ("bhakti", the default) with the given plan record, an owner session, and the page the server embeds the config into. */
async function build(patch: Partial<StoreRecord> = {}, opts: Opts = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  if (opts.production) config.isProduction = true;
  if (opts.cacheMs) config.storeCacheMs = opts.cacheMs;
  const root = new MemoryStore();
  const rec = newStoreRecord({ ...config.merchant, ...opts.merchant } as MerchantConfig, patch);
  await root.set('stores', 'bhakti', rec);
  if (opts.seed) await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  const app = createApp(config, root, new MemoryBlobs());
  // The same thing server.ts does for every non-API path.
  app.get('*', (_req, res) => void res.type('html').send(renderIndexHtml('{{MERCHANT_CONFIG}}', res.locals.merchant)));
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const auth = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const store = scopeStore(root, 'bhakti');
  const page = async () => {
    const html = (await request(app).get('/')).text;
    return JSON.parse(/<script id="merchant-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]) as MerchantConfig;
  };
  return { app, root, store, auth, page, config };
}

describe('Emergent is the only layout, for every plan', () => {
  it('shared registry: one live layout, available to every plan', () => {
    expect([...LAYOUT_IDS]).toEqual(['emergent']);
    expect(DEFAULT_LAYOUT).toBe('emergent');
    expect(LAYOUTS).toEqual([expect.objectContaining({ id: 'emergent', plan: 'basic' })]);
  });

  it('a legacy layout (gilded, unknown, or none) in a config parses and is dropped', () => {
    const raw = JSON.parse(JSON.stringify(loadMerchant({ MERCHANT: 'example' })));
    for (const layout of ['gilded', 'neon', undefined]) {
      expect(parseMerchant({ ...raw, layout }, 'test')).not.toHaveProperty('layout');
    }
    expect(loadMerchant({ MERCHANT: 'bhakti' })).not.toHaveProperty('layout');
  });

  it('the layout route and the console layout action are gone', async () => {
    process.env.CONSOLE_DEV_OPEN = 'true';
    const { app, auth } = await build({ plan: 'pro' });
    expect((await request(app).put('/api/v1/admin/layout').set(auth).send({ layout: 'emergent' })).status).toBe(404);
    expect((await request(app).post('/api/v1/console/stores/bhakti/layout').send({ layout: 'emergent' })).status).toBe(404);
  });

  it('the page never forces or carries a layout choice, on any plan, even for a stored legacy gilded record', async () => {
    for (const patch of [{ plan: 'basic' as const }, { plan: 'pro' as const }, {}, { plan: 'basic' as const, trialEndsAt: trialEnd() }, { plan: 'basic' as const, trialEndsAt: past() }]) {
      for (const stored of [undefined, 'gilded', 'emergent']) {
        const { page } = await build(patch, { merchant: { layout: stored } as unknown as Partial<MerchantConfig> });
        const m = await page();
        expect(m).toMatchObject({ id: 'bhakti', sector: 'jewellery', brand: { name: expect.any(String) }, productFields: expect.any(Array) });
      }
    }
  });

  it('premiumLayouts no longer exists as a plan flag', async () => {
    expect(flagsFor('basic')).not.toHaveProperty('premiumLayouts');
    expect(makeEntitlements({ plan: 'basic' }).flags).not.toHaveProperty('premiumLayouts');
    expect(Object.keys(LIMITS)).toEqual(['basic', 'pro']);
    const basic = await build({ plan: 'basic' });
    expect((await request(basic.app).get('/api/entitlements')).body.data.flags).not.toHaveProperty('premiumLayouts');
  });
});

describe('order note', () => {
  async function buyerWithItem(opts: Parameters<typeof build>[1] = { seed: true }) {
    const b = await build({}, opts);
    const t = await otpBuyer(b.app, { firmName: 'Test Jewellers', phone: '9820000001' });
    const buyer = { Authorization: `Bearer ${t.body.token}` };
    const add = (sku = 'B2B-COIN-0010') => request(b.app).post('/api/orders/items').set(buyer).send({ sku, batchQty: 1 });
    await add();
    const confirm = (body?: object) => request(b.app).post('/api/orders/confirm').set(buyer).send(body);
    return { ...b, buyer, add, confirm };
  }

  it('is stored on the PO, appended to the WhatsApp text, and shown to the owner and the buyer', async () => {
    const { confirm, store, app, auth, buyer } = await buyerWithItem();
    const res = await confirm({ note: '  Need it before Diwali, call me first  ' });
    expect(res.status).toBe(200);
    expect(res.body.whatsappMessage).toMatch(/\n\n\*Note:\* Need it before Diwali, call me first$/);
    const po = await store.get('purchaseOrders', res.body.poId);
    expect(po!.note).toBe('Need it before Diwali, call me first');

    const desk = await request(app).get('/api/admin/orders').set(auth);
    expect(desk.body.data.find((o: any) => o.poId === res.body.poId).note).toBe('Need it before Diwali, call me first');
    const history = await request(app).get('/api/orders/history').set(buyer);
    expect(history.body.data[0]).toMatchObject({ poId: res.body.poId, note: 'Need it before Diwali, call me first' });
  });

  it('is accepted at exactly 300 characters and refused at 301 (400, and the cart is kept)', async () => {
    const { confirm, store } = await buyerWithItem();
    const tooLong = await confirm({ note: 'n'.repeat(301) });
    expect(tooLong.status).toBe(400);
    expect(await store.list('purchaseOrders')).toHaveLength(0);
    expect(await store.list('cartItems')).toHaveLength(1);
    const edge = await confirm({ note: 'n'.repeat(300) });
    expect(edge.status).toBe(200);
    expect((await store.get('purchaseOrders', edge.body.poId))!.note).toHaveLength(300);
  });

  it('absent stores nothing and leaves the WhatsApp text alone', async () => {
    const { confirm, store, app, buyer } = await buyerWithItem();
    for (const body of [undefined, {}]) {
      const res = await confirm(body);
      expect(res.status).toBe(200);
      expect(res.body.whatsappMessage).not.toContain('Note:');
      expect(Object.keys((await store.get('purchaseOrders', res.body.poId))!)).not.toContain('note');
      await request(app).post('/api/orders/items').set(buyer).send({ sku: 'B2B-COIN-0010', batchQty: 1 });
    }
    const history = await request(app).get('/api/orders/history').set(buyer);
    expect(history.body.data.every((o: any) => !('note' in o))).toBe(true);
  });

  it('an empty or whitespace note is a 400 (the app never sends one: api.confirmOrder drops it)', async () => {
    const { confirm } = await buyerWithItem();
    expect((await confirm({ note: '   ' })).status).toBe(400);
    expect((await confirm({ note: 5 })).status).toBe(400);
  });
});

describe('remove buyer', () => {
  async function withBuyer(role: 'owner' | 'staff') {
    const b = await build({ plan: 'pro' });
    await otpBuyer(b.app, { firmName: 'Test Jewellers', phone: '9820000001' });
    const as = role === 'owner' ? b.auth : { Authorization: `Bearer ${(await request(b.app).post('/api/auth/admin/register').send({ email: 's@example.com', password: 'AdminPass@2026', role: 'staff', masterProvisioningKey: KEY })).body.sessionToken}` };
    return { ...b, as, del: (phone: string) => request(b.app).delete(`/api/admin/buyers/${phone}`).set(as) };
  }

  it('the owner can (200, gone, audited); a second try is 404', async () => {
    const { del, store, app, auth } = await withBuyer('owner');
    expect((await del('9820000001')).status).toBe(200);
    expect(await store.get('buyers', '9820000001')).toBeNull();
    expect((await request(app).get('/api/admin/buyers').set(auth)).body.count).toBe(0);
    expect((await store.list('auditLogs')).some((a) => a.event === 'BUYER_REMOVED')).toBe(true);
    expect((await del('9820000001')).status).toBe(404);
  });

  it('needs a session (401) and the v1 path works', async () => {
    const { app, auth } = await withBuyer('owner');
    expect((await request(app).delete('/api/admin/buyers/9820000001')).status).toBe(401);
    expect((await request(app).delete('/api/v1/admin/buyers/9820000001').set(auth)).status).toBe(200);
  });
});

describe('product fields stay dynamic', () => {
  const fields: ProductField[] = [
    { key: 'finish', label: 'Finish', type: 'select', options: ['Matte', 'Polished'], required: true },
    { key: 'lengthCm', label: 'Length', type: 'number', required: false, unit: 'cm' }
  ];
  const body = (extra: object, sku: string) => ({ title: 'Temple Haar', category: 'Bridal Chokers & Haar', purity: '22K 916', grossWt: '50', stoneWt: '5', images: ['https://example.com/x.jpg'], sku, extra });

  it('the page and /api/config carry the store\'s own fields, whatever the layout', async () => {
    for (const stored of ['gilded', 'emergent']) {
      const { page, app } = await build({ plan: 'pro' }, { merchant: { layout: stored, productFields: fields } as Partial<MerchantConfig> });
      expect((await page()).productFields).toEqual(fields.map((f) => expect.objectContaining({ key: f.key, label: f.label, type: f.type })));
      expect((await request(app).get('/api/config')).body.data.productFields).toHaveLength(2);
    }
  });

  it('a design with those fields round-trips through create, list and edit', async () => {
    const { app, auth } = await build({ plan: 'pro' }, { seed: true, merchant: { productFields: fields } });
    const created = await request(app).post('/api/products').set(auth).send(body({ finish: 'Matte', lengthCm: '42.5' }, 'DYN-1'));
    expect(created.status).toBe(201);
    expect(created.body.data.extra).toEqual({ finish: 'Matte', lengthCm: 42.5 });
    const listed = (await request(app).get('/api/products').set(auth)).body.data.find((p: any) => p.sku === 'DYN-1');
    expect(listed.extra).toEqual({ finish: 'Matte', lengthCm: 42.5 });
    const edited = await request(app).put(`/api/products/${created.body.data.id}`).set(auth).send(body({ finish: 'Polished' }, 'DYN-1'));
    expect(edited.status).toBe(200);
    expect(edited.body.data.extra).toEqual({ finish: 'Polished' });
    expect((await request(app).post('/api/products').set(auth).send(body({ finish: 'Glossy' }, 'DYN-2'))).status).toBe(400);
    expect((await request(app).post('/api/products').set(auth).send(body({}, 'DYN-3'))).body.message).toMatch(/Finish is required/);
  });

  it('a store with no fields stores none', async () => {
    const { app, auth } = await build({ plan: 'pro' }, { seed: true });
    const res = await request(app).post('/api/products').set(auth).send(body({ finish: 'Matte' }, 'NONE-1'));
    expect(res.status).toBe(201);
    expect(res.body.data.extra).toBeUndefined();
  });
});
