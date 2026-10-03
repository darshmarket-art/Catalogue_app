import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { createNotify, type Notifiers, type PushSub } from '../server/notify';

const KEY = 'test-master-provisioning-key';
const A = { 'X-Store': 'bhakti' };
const B = { 'X-Store': 'example' };
const sub = (n: number): PushSub => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

let app: ReturnType<typeof createApp>;
let root: MemoryStore;
let wa: { phone: string; poId: string; event: string }[];
let pushed: string[];
let failWa = false;
let dead = new Set<string>();
const notifiers: Notifiers = {
  whatsapp: {
    sendOrderAlert: async (phone, a) => {
      if (failWa) throw new Error('meta down');
      wa.push({ phone, poId: a.poId, event: a.event });
    }
  },
  push: {
    publicKey: 'PUB',
    send: async (s) => {
      if (dead.has(s.endpoint)) return 'gone';
      pushed.push(s.endpoint);
      return 'ok';
    }
  }
};

async function build(cap = 200) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }),
    rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 },
    alertDailyCap: cap
  };
  root = new MemoryStore();
  const ex = loadMerchant({ MERCHANT: 'example' });
  await root.set('stores', 'example', newStoreRecord({ ...ex, contact: { ...ex.contact, whatsapp: '919800000002' } }, { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  for (const p of await scopeStore(root, 'bhakti').list('products')) await scopeStore(root, 'example').set('products', p.id, p);
  app = createApp(config, root, new MemoryBlobs(), undefined, notifiers);
  wa = [];
  pushed = [];
  failWa = false;
  dead = new Set();
}
beforeEach(() => build());

const admin = async (h: Record<string, string>) => ({
  Authorization: `Bearer ${(await request(app).post('/api/auth/admin/register').set(h).send({ email: 'boss@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY })).body.sessionToken}`
});
const buyer = async (h: Record<string, string>) => ({
  Authorization: `Bearer ${(await request(app).post('/api/auth/retailer/signup').set(h).send({ firmName: 'Test Jewellers', ownerName: 'O', phone: '9820000001', password: 'StrongPass@1', gstin: '27ABCDE1234F1Z5', marketHub: 'X' })).body.token}`
});
const order = async (h: Record<string, string>, auth: Record<string, string>) => {
  await request(app).post('/api/orders/items').set(h).set(auth).send({ sku: 'B2B-COIN-0010', batchQty: 1 });
  return request(app).post('/api/orders/confirm').set(h).set(auth);
};
const subscribe = (h: Record<string, string>, ad: Record<string, string>, n: number) =>
  request(app).post('/api/admin/push/subscribe').set(h).set(ad).send(sub(n));

describe('owner order alerts', () => {
  it('order placed and cancelled alert the store owner by WhatsApp and push; isolated per store', async () => {
    await subscribe(B, await admin(B), 1);
    await subscribe(A, await admin(A), 9);
    const b = await buyer(B);
    const res = await order(B, b);
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(wa).toEqual([{ phone: '919800000002', poId: res.body.poId, event: 'placed' }]));
    await vi.waitFor(() => expect(pushed).toEqual(['https://push.example/1']));
    await request(app).post(`/api/orders/${res.body.poId}/cancel`).set(B).set(b);
    await vi.waitFor(() => expect(wa.map((w) => w.event)).toEqual(['placed', 'cancelled']));
  });

  it('a failing sender never breaks the order, is retried once, and dead subscriptions are pruned', async () => {
    const ad = await admin(B);
    await subscribe(B, ad, 1);
    await subscribe(B, ad, 2);
    dead.add(sub(2).endpoint);
    failWa = true;
    const spy = vi.spyOn(notifiers.whatsapp, 'sendOrderAlert');
    const res = await order(B, await buyer(B));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect(await scopeStore(root, 'example').list('pushSubs')).toHaveLength(1));
    spy.mockRestore();
  });

  it('daily cap stops WhatsApp alerts but the order still books', async () => {
    await build(1);
    const b = await buyer(B);
    await order(B, b);
    const res = await order(B, b);
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(wa).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(wa).toHaveLength(1);
  });

  it('a Basic store gets no alerts; push endpoints need an admin', async () => {
    const send = vi.fn();
    const notify = createNotify(
      loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) }),
      scopeStore(root, 'example'),
      { load: async () => ({ flags: { alerts: false } }) } as any,
      { ...notifiers, whatsapp: { sendOrderAlert: send } }
    );
    await notify('placed', { poId: 'P1' });
    expect(send).not.toHaveBeenCalled();
    expect(pushed).toEqual([]);
    expect((await request(app).get('/api/admin/push/key').set(A).set(await admin(A))).status).toBe(200);
    expect((await request(app).get('/api/admin/push/key').set(A)).status).toBe(401);
  });
});
