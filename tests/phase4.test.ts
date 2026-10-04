import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { MAX_ALERT_NUMBERS, type Notifiers, type PushSub, type StoreFullAlert } from '../server/notify';
import { ALERT_WORDING } from '../server/routes/adminAlerts';
import { STATIC_CODE } from './buyerAuth';

const KEY = 'test-master-provisioning-key';
const sub = (n: number): PushSub => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

function fakeNotifiers(opts: { storeFull?: boolean; failWa?: boolean } = {}) {
  const wa: { phone: string; event: string }[] = [];
  const full: { phone: string; a: StoreFullAlert }[] = [];
  const pushed: object[] = [];
  const notifiers: Notifiers = {
    whatsapp: {
      sendOrderAlert: async (phone, a) => {
        if (opts.failWa) throw new Error('meta down');
        wa.push({ phone, event: a.event });
      },
      ...(opts.storeFull === false ? {} : { sendStoreFullAlert: async (phone: string, a: StoreFullAlert) => void full.push({ phone, a }) })
    },
    push: {
      publicKey: 'PUB',
      send: async (_s, payload) => {
        pushed.push(payload);
        return 'ok';
      }
    }
  };
  return { notifiers, wa, full, pushed };
}

async function build(plan: 'basic' | 'pro', opts: Parameters<typeof fakeNotifiers>[0] & { whatsapp?: boolean; cap?: number } = {}) {
  const env: Record<string, string> = { NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY };
  if (opts.whatsapp) Object.assign(env, { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_OTP_TEMPLATE: 'otp', WHATSAPP_ORDER_TEMPLATE: 'order_alert', OTP_PROVIDER: 'static' });
  const config = { ...loadConfig(env), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 }, alertDailyCap: opts.cap ?? 200 };
  const root = new MemoryStore();
  const store = scopeStore(root, 'bhakti');
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant, { plan }));
  const fakes = fakeNotifiers(opts);
  const app = createApp(config, root, new MemoryBlobs(), undefined, fakes.notifiers);
  const r = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const auth = { Authorization: `Bearer ${r.body.sessionToken}` };
  return { app, auth, store, config, ...fakes };
}

const fill = async (store: ReturnType<typeof scopeStore>) => {
  for (let i = 0; i < 50; i++) await store.set('buyers', `98200000${String(i).padStart(2, '0')}`, { id: `b${i}`, phone: `98200000${String(i).padStart(2, '0')}`, firmName: `F${i}`, createdAt: '2026-01-01' });
};
const ask = (app: any, phone: string) => request(app).post('/api/auth/retailer/request-otp').send({ phone });

describe('catalogue full: turned-away buyers and the daily owner nudge', () => {
  it('counts each phone once per day, exposes the count on entitlements, and nudges the owner once', async () => {
    const { app, auth, store, full, pushed, config } = await build('basic');
    await fill(store);
    await request(app).post('/api/admin/push/subscribe').set(auth).send(sub(1)).catch(() => {}); // Basic: push route is Pro, subscription may be refused
    await store.set('pushSubs', 'dev1', sub(1));

    const r1 = await ask(app, '9999999901');
    expect(r1.status).toBe(403);
    expect(r1.body.code).toBe('CATALOGUE_FULL');
    expect((await ask(app, '9999999901')).status).toBe(403); // same phone again: not counted twice
    expect((await ask(app, '9999999902')).status).toBe(403);

    const ent = (await request(app).get('/api/entitlements')).body.data;
    expect(ent.turnedAway).toEqual({ today: 2, total: 2 });
    expect(ent.usage.users).toBe(50);
    expect(await store.get('otps', '9999999901')).toBeNull(); // nothing was sent or stored

    await vi.waitFor(() => expect(full).toHaveLength(1));
    expect(full[0].phone).toBe(config.merchant.contact.whatsapp);
    expect(full[0].a).toMatchObject({ brand: config.merchant.brand.name, count: 1 });
    expect(full[0].a.planUrl).toContain(config.merchant.id);
    await vi.waitFor(() => expect(pushed.length).toBeGreaterThanOrEqual(1));
    expect(pushed[0]).toMatchObject({ title: `${config.merchant.brand.name}: catalogue full` });
    await new Promise((r) => setTimeout(r, 30));
    expect(full).toHaveLength(1); // once a day, however many buyers are turned away

    const logs = await store.list('auditLogs');
    expect(logs.some((l: any) => l.event === 'BUYER_TURNED_AWAY')).toBe(true);
  });

  it('existing buyers still sign in, and a Pro store is never full', async () => {
    const { app, store, full } = await build('basic');
    await fill(store);
    expect((await ask(app, '9820000001')).status).toBe(200);
    const pro = await build('pro');
    await fill(pro.store);
    expect((await ask(pro.app, '9999999903')).status).toBe(200);
    expect(full).toHaveLength(0);
    expect((await request(pro.app).get('/api/entitlements')).body.data.turnedAway).toEqual({ today: 0, total: 0 });
  });

  it('a sender without the store-full template still pushes, and the daily alert cap is respected', async () => {
    const { app, store, pushed } = await build('basic', { storeFull: false, cap: 0 });
    await fill(store);
    await store.set('pushSubs', 'dev1', sub(1));
    expect((await ask(app, '9999999904')).status).toBe(403);
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
  });
});

describe('owner alert settings', () => {
  it('shows defaults and wording to any admin; saving is Pro and validates numbers', async () => {
    const basic = await build('basic');
    const g = await request(basic.app).get('/api/admin/alerts').set(basic.auth);
    expect(g.status).toBe(200);
    expect(g.body.data).toMatchObject({ numbers: [basic.config.merchant.contact.whatsapp], maxNumbers: MAX_ALERT_NUMBERS, whatsappConfigured: false, receiptsConnected: false, wording: ALERT_WORDING });
    expect((await request(basic.app).put('/api/admin/alerts').set(basic.auth).send({ numbers: ['919800000001'] })).status).toBe(402);

    const { app, auth, store, config } = await build('pro');
    expect((await request(app).put('/api/admin/alerts').set(auth).send({ numbers: [] })).status).toBe(400);
    expect((await request(app).put('/api/admin/alerts').set(auth).send({ numbers: ['12'] })).status).toBe(400);
    expect((await request(app).put('/api/admin/alerts').set(auth).send({ numbers: ['919800000001', '919800000002', '919800000003', '919800000004'] })).status).toBe(400);
    const ok = await request(app).put('/api/admin/alerts').set(auth).send({ numbers: ['+91 98000 00001', '919800000002', '919800000002'] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.numbers).toEqual(['919800000001', '919800000002']); // normalised, de-duplicated
    expect((await request(app).get('/api/admin/alerts').set(auth)).body.data.numbers).toEqual(['919800000001', '919800000002']);
    expect((await request(app).get('/api/admin/alerts')).status).toBe(401);
    expect((await store.list('auditLogs')).some((l: any) => l.event === 'ALERT_NUMBERS_UPDATED')).toBe(true);
    expect(config.merchant.contact.whatsapp).not.toBe('919800000001');
  });

  it('order alerts go to the saved numbers', async () => {
    const { app, auth, store, wa } = await build('pro');
    await request(app).put('/api/admin/alerts').set(auth).send({ numbers: ['919800000001', '919800000002'] });
    await store.set('products', 'p1', { id: 'p1', sku: 'B2B-TEST-0001', name: 'Test', netWeight: 10, grossWeight: 11, category: 'c', purity: '22K', images: ['https://x/y.jpg'], stockStatus: 'in-stock', priceMode: 'by-weight' });
    await ask(app, '9820000009');
    const v = await request(app).post('/api/auth/retailer/verify-otp').send({ phone: '9820000009', code: STATIC_CODE, firmName: 'Shiv Jewels' });
    const b = { Authorization: `Bearer ${v.body.token}` };
    const add = await request(app).post('/api/orders/items').set(b).send({ sku: 'B2B-TEST-0001', batchQty: 1 });
    expect(add.status).toBeLessThan(300);
    const res = await request(app).post('/api/orders/confirm').set(b);
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(wa.map((w) => w.phone).sort()).toEqual(['919800000001', '919800000002']));
  });

  it('test alert: reports per number, pushes to devices, says when WhatsApp is not connected, and has a cooldown', async () => {
    const off = await build('pro');
    await off.store.set('pushSubs', 'dev1', sub(1));
    const r = await request(off.app).post('/api/admin/alerts/test').set(off.auth);
    expect(r.status).toBe(200);
    expect(r.body.data.whatsappConfigured).toBe(false);
    expect(r.body.data.results).toEqual([{ to: expect.stringMatching(/^\*+\d{4}$/), ok: false, error: expect.stringMatching(/not connected/) }]);
    expect(r.body.data.pushed).toBe(1);
    expect(off.wa).toHaveLength(0);
    expect((await request(off.app).post('/api/admin/alerts/test').set(off.auth)).status).toBe(429);

    const on = await build('pro', { whatsapp: true });
    await request(on.app).put('/api/admin/alerts').set(on.auth).send({ numbers: ['919800000001', '919800000002'] });
    const t = await request(on.app).post('/api/admin/alerts/test').set(on.auth);
    expect(t.status).toBe(200);
    expect(t.body.data.results).toMatchObject([{ to: '********0001', ok: true }, { to: '********0002', ok: true }]);
    expect(t.body.data.results.every((r: any) => typeof r.messageId === 'string')).toBe(true);
    expect(on.wa.map((w) => w.event)).toEqual(['test', 'test']);

    const failing = await build('pro', { whatsapp: true, failWa: true });
    const f = await request(failing.app).post('/api/admin/alerts/test').set(failing.auth);
    expect(f.body.data.results[0]).toMatchObject({ ok: false, error: 'meta down' });

    const basic = await build('basic');
    expect((await request(basic.app).post('/api/admin/alerts/test').set(basic.auth)).status).toBe(402);
  });
});
