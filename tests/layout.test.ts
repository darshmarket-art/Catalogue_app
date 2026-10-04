import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { loadMerchant, parseMerchant, renderIndexHtml, type MerchantConfig, type ProductField } from '../server/merchant';
import { effectiveLayout, newStoreRecord, scopeStore, type StoreRecord } from '../server/tenancy';
import { makeEntitlements, trialEnd } from '../server/entitlements';
import { flagsFor, LIMITS } from '../shared/limits';
import { LAYOUTS, LAYOUT_IDS, layoutPlan } from '../shared/layouts';
import { UPGRADE_TO_PRO } from '../shared/sales';

const KEY = 'test-master-provisioning-key';
const DAY = 86400000;
const past = () => new Date(Date.now() - DAY).toISOString();

afterEach(() => {
  delete process.env.DEV_FORCE_LAYOUT;
  delete process.env.CONSOLE_DEV_OPEN;
  delete process.env.CONSOLE_ADMINS;
});

type Opts = { merchant?: Partial<MerchantConfig>; production?: boolean; seed?: boolean; cacheMs?: number };

/** One store ("bhakti", the default) with the given plan record, an owner session, and the page the server embeds the config into. */
async function build(patch: Partial<StoreRecord> = {}, opts: Opts = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
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
  const put = (layout: unknown) => request(app).put('/api/v1/admin/layout').set(auth).send({ layout });
  const page = async () => {
    const html = (await request(app).get('/')).text;
    return JSON.parse(/<script id="merchant-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]) as MerchantConfig;
  };
  const saved = async () => (await root.get<StoreRecord>('stores', 'bhakti'))!.merchant.layout;
  return { app, root, store, auth, put, page, saved, config };
}

describe('layout default and the plan flag', () => {
  it('a merchant config without layout is Gilded; both shipped merchants are', () => {
    const raw = JSON.parse(JSON.stringify(loadMerchant({ MERCHANT: 'example' })));
    delete raw.layout;
    expect(parseMerchant(raw, 'test').layout).toBe('gilded');
    expect(loadMerchant({ MERCHANT: 'bhakti' }).layout).toBe('gilded');
    expect(loadMerchant({ MERCHANT: 'example' }).layout).toBe('gilded');
    expect(() => parseMerchant({ ...raw, layout: 'neon' }, 'test')).toThrow(/layout/);
  });

  it('a store record saved before layouts existed still shows Gilded, on every plan', async () => {
    const legacy = (patch: Partial<StoreRecord>) => {
      const rec = newStoreRecord(loadMerchant({ MERCHANT: 'example' }), patch);
      delete (rec.merchant as Partial<MerchantConfig>).layout;
      return rec;
    };
    for (const patch of [{ plan: 'basic' as const }, { plan: 'pro' as const }, { plan: 'founder' as const }, { plan: 'basic' as const, trialEndsAt: trialEnd() }]) {
      expect(effectiveLayout(legacy(patch)), JSON.stringify(patch)).toBe('gilded');
    }
    const { page } = await build({ plan: 'founder' }, { merchant: { layout: undefined } as Partial<MerchantConfig> });
    expect((await page()).layout).toBe('gilded');
  });

  it('premiumLayouts is a Pro flag, and the layouts table is consistent', () => {
    expect(flagsFor('basic').premiumLayouts).toBe(false);
    expect(flagsFor('pro').premiumLayouts).toBe(true);
    expect(makeEntitlements({ plan: 'basic' }).flags.premiumLayouts).toBe(false);
    expect(makeEntitlements({ plan: 'pro' }).flags.premiumLayouts).toBe(true);
    expect(makeEntitlements({ plan: 'founder' }).flags.premiumLayouts).toBe(true);
    expect(makeEntitlements({ plan: 'basic', trialEndsAt: trialEnd() }).flags.premiumLayouts).toBe(true);
    expect(makeEntitlements({ plan: 'basic', trialEndsAt: past() }).flags.premiumLayouts).toBe(false);
    expect(LAYOUTS.map((l) => l.id)).toEqual([...LAYOUT_IDS]);
    expect(layoutPlan('gilded')).toBe('basic');
    expect(layoutPlan('emergent')).toBe('pro');
    expect(Object.keys(LIMITS)).toEqual(['basic', 'pro']);
  });

  it('GET /api/entitlements carries the flag for the app', async () => {
    const basic = await build({ plan: 'basic' });
    expect((await request(basic.app).get('/api/entitlements')).body.data.flags.premiumLayouts).toBe(false);
    const pro = await build({ plan: 'pro' });
    expect((await request(pro.app).get('/api/entitlements')).body.data.flags.premiumLayouts).toBe(true);
  });
});

describe('PUT /api/v1/admin/layout', () => {
  it('Basic: Emergent is 402 with the upgrade text and changes nothing; Gilded is 200', async () => {
    const { put, saved, store } = await build({ plan: 'basic' });
    const no = await put('emergent');
    expect(no.status).toBe(402);
    expect(no.body.message).toContain('Emergent layout is a Pro feature');
    expect(no.body.message).toContain(UPGRADE_TO_PRO);
    expect(await saved()).toBe('gilded');
    expect((await store.list('auditLogs')).some((a) => a.event === 'LAYOUT_CHANGED')).toBe(false);
    const ok = await put('gilded');
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ layout: 'gilded' });
  });

  it.each([
    ['Pro', { plan: 'pro' as const }],
    ['founder', {}],
    ['a trial in progress', { plan: 'basic' as const, trialEndsAt: trialEnd() }],
    ['an own-app Basic store', { plan: 'basic' as const, ownApp: true }]
  ])('%s: Emergent is saved on the store record and audited', async (_name, patch) => {
    const { put, saved, store, root } = await build(patch);
    const res = await put('emergent');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ layout: 'emergent' });
    expect(await saved()).toBe('emergent');
    const rec = await root.get<StoreRecord>('stores', 'bhakti');
    expect(rec!.merchant.layout).toBe('emergent');
    expect(rec!.merchant.brand.name).toBeTruthy(); // the rest of the merchant config is kept
    const log = (await store.list('auditLogs')).filter((a) => a.event === 'LAYOUT_CHANGED');
    expect(log).toHaveLength(1);
    expect(log[0].details).toContain('emergent');
    // and back to Gilded
    expect((await put('gilded')).status).toBe(200);
    expect(await saved()).toBe('gilded');
    expect((await store.list('auditLogs')).filter((a) => a.event === 'LAYOUT_CHANGED')).toHaveLength(2);
  });

  it('rejects an unknown layout and a missing one with 400', async () => {
    const { put, saved } = await build({ plan: 'pro' });
    for (const bad of ['neon', '', 'Emergent', 7, null, undefined]) expect((await put(bad)).status, String(bad)).toBe(400);
    expect(await saved()).toBe('gilded');
  });

  it('needs an admin: no token 401, buyer token 403', async () => {
    const { app } = await build({ plan: 'pro' });
    expect((await request(app).put('/api/v1/admin/layout').send({ layout: 'emergent' })).status).toBe(401);
    expect((await request(app).put('/api/v1/admin/layout').set('Authorization', 'Bearer junk').send({ layout: 'emergent' })).status).toBe(401);
    const buyer = await request(app).post('/api/auth/retailer/signup').send({ firmName: 'Shop One', phone: '9820000001', password: 'StrongPass@1' });
    expect((await request(app).put('/api/v1/admin/layout').set('Authorization', `Bearer ${buyer.body.token}`).send({ layout: 'emergent' })).status).toBe(403);
  });

  it('is reachable on the legacy /api path too, and is per store', async () => {
    const { app, auth, root, config } = await build({ plan: 'pro' });
    await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro' }));
    expect((await request(app).put('/api/admin/layout').set(auth).send({ layout: 'emergent' })).status).toBe(200);
    // bhakti's admin token is not valid in the other store
    expect((await request(app).put('/api/admin/layout').set('X-Store', 'example').set(auth).send({ layout: 'emergent' })).status).toBe(401);
    expect((await root.get<StoreRecord>('stores', 'example'))!.merchant.layout).toBe('gilded');
    expect(config.defaultStore).toBe('bhakti');
  });
});

describe('the page embeds the EFFECTIVE layout', () => {
  it('Pro + Emergent shows Emergent; a lapsed trial falls back to Gilded and the saved choice returns on upgrade', async () => {
    const { put, page, root, saved } = await build({ plan: 'basic', trialEndsAt: trialEnd() });
    expect((await page()).layout).toBe('gilded');
    expect((await put('emergent')).status).toBe(200);
    expect((await page()).layout).toBe('emergent');

    // the trial lapses: the saved choice stays, the page shows Gilded
    await root.update('stores', 'bhakti', { trialEndsAt: past() });
    expect((await page()).layout).toBe('gilded');
    expect(await saved()).toBe('emergent');
    // ...and the owner cannot pick it again until they upgrade
    expect((await put('emergent')).status).toBe(402);

    // upgrading brings it back
    await root.update('stores', 'bhakti', { plan: 'pro' });
    expect((await page()).layout).toBe('emergent');
  });

  it('a layout the owner just saved shows on the very next page load, even with the store cache on', async () => {
    const { put, page } = await build({ plan: 'pro' }, { cacheMs: 60_000 });
    expect((await page()).layout).toBe('gilded'); // fills the cache
    expect((await put('emergent')).status).toBe(200);
    expect((await page()).layout).toBe('emergent');
    expect((await put('gilded')).status).toBe(200);
    expect((await page()).layout).toBe('gilded');
  });

  it('the founder and a paid Pro store see their saved layout; Basic with a saved Pro layout (console-set) sees Gilded', async () => {
    expect((await (await build({}, { merchant: { layout: 'emergent' } })).page()).layout).toBe('emergent');
    expect((await (await build({ plan: 'pro' }, { merchant: { layout: 'emergent' } })).page()).layout).toBe('emergent');
    expect((await (await build({ plan: 'basic' }, { merchant: { layout: 'emergent' } })).page()).layout).toBe('gilded');
  });

  it('the page still carries the whole merchant config', async () => {
    const m = await (await build({ plan: 'pro' })).page();
    expect(m).toMatchObject({ id: 'bhakti', sector: 'jewellery', brand: { name: expect.any(String) }, productFields: expect.any(Array) });
  });

  it('DEV_FORCE_LAYOUT forces a layout outside production only', async () => {
    process.env.DEV_FORCE_LAYOUT = 'emergent';
    expect((await (await build({ plan: 'basic' })).page()).layout).toBe('emergent'); // dev preview, whatever the plan
    expect((await (await build({ plan: 'basic' }, { production: true })).page()).layout).toBe('gilded');
    expect((await (await build({ plan: 'pro' }, { production: true })).page()).layout).toBe('gilded'); // the saved choice (gilded), not the env
    const pro = await build({ plan: 'pro' }, { production: true, merchant: { layout: 'emergent' } });
    expect((await pro.page()).layout).toBe('emergent'); // the saved choice, not forced
    process.env.DEV_FORCE_LAYOUT = 'nonsense';
    expect((await (await build({ plan: 'basic' })).page()).layout).toBe('gilded');
  });
});

describe('console layout write', () => {
  it('accepts Emergent for a Basic store, audits it, and the store still shows Gilded until Pro', async () => {
    process.env.CONSOLE_DEV_OPEN = 'true';
    const { app, root, page, saved } = await build({ plan: 'basic' });
    const res = await request(app).post('/api/v1/console/stores/bhakti/layout').send({ layout: 'emergent' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'bhakti', layout: 'emergent', effectiveLayout: 'gilded', effectivePlan: 'basic' });
    expect(await saved()).toBe('emergent');
    expect((await page()).layout).toBe('gilded');
    const audit = (await root.list('consoleAudit')).filter((a) => a.action === 'layout');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ storeId: 'bhakti', what: 'layout gilded -> emergent', who: 'dev' });
    await root.update('stores', 'bhakti', { plan: 'pro' });
    expect((await page()).layout).toBe('emergent');
    expect((await request(app).post('/api/v1/console/stores/bhakti/layout').send({ layout: 'neon' })).status).toBe(400);
  });
});

describe('order note', () => {
  async function buyerWithItem(opts: Parameters<typeof build>[1] = { seed: true }) {
    const b = await build({}, opts);
    const t = await request(b.app).post('/api/auth/retailer/signup').send({ firmName: 'Test Jewellers', phone: '9820000001', password: 'StrongPass@1' });
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
    await request(b.app).post('/api/auth/retailer/signup').send({ firmName: 'Test Jewellers', phone: '9820000001', password: 'StrongPass@1' });
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

  it('staff cannot (403) and the buyer stays', async () => {
    const { del, store } = await withBuyer('staff');
    expect((await del('9820000001')).status).toBe(403);
    expect(await store.get('buyers', '9820000001')).not.toBeNull();
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
    for (const layout of ['gilded', 'emergent'] as const) {
      const { page, app } = await build({ plan: 'pro' }, { merchant: { layout, productFields: fields } });
      expect((await page()).productFields).toEqual(fields.map((f) => expect.objectContaining({ key: f.key, label: f.label, type: f.type })));
      expect((await request(app).get('/api/config')).body.data.productFields).toHaveLength(2);
    }
  });

  it('a design with those fields round-trips through create, list and edit', async () => {
    const { app, auth } = await build({ plan: 'pro' }, { seed: true, merchant: { layout: 'emergent', productFields: fields } });
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
