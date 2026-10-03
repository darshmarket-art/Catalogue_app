import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { scopeStore, newStoreRecord, type StoreRecord } from '../server/tenancy';
import { loadMerchant } from '../server/merchant';
import { sweepTrials, type TrialSender } from '../server/trialSweep';

const DAY = 86400000;
const T0 = Date.parse('2026-10-01T06:00:00Z');
const KEY = 'test-master-provisioning-key';
const AUD = 'https://example.run.app/api/v1/internal/trial-sweep';
const SA = 'scheduler@proj.iam.gserviceaccount.com';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

const good = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const evil = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (k: crypto.KeyObject) => k.export({ type: 'spki', format: 'pem' }) as string;
const oidc = (key: crypto.KeyObject, email = SA, aud = AUD) =>
  jwt.sign({ email, email_verified: true }, key.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'RS256', keyid: 'k1', audience: aud, issuer: 'https://accounts.google.com', expiresIn: 300 });

function fakeSender() {
  const sent: { phone: string; text: string }[] = [];
  const sender: TrialSender = { sendTrialNotice: async (phone, _b, text) => void sent.push({ phone, text }) };
  return { sent, sender };
}

const merchant = (id: string) => ({ ...loadMerchant({ MERCHANT: 'example' }), id });
async function seed(root: MemoryStore) {
  const m = (id: string, patch: Partial<StoreRecord>) => root.set('stores', id, newStoreRecord(merchant(id), { owner: { phone: `91${id.length}00000000` }, ...patch }) as any);
  await m('trialer', { plan: 'basic', trialEndsAt: new Date(T0 + 14 * DAY).toISOString() });
  await m('founderx', { plan: 'founder' });
  await m('ownappx', { plan: 'basic', ownApp: true, trialEndsAt: new Date(T0 + 1 * DAY).toISOString() });
  await m('paidx', { plan: 'pro', trialEndsAt: new Date(T0 + 1 * DAY).toISOString() });
}

describe('sweepTrials', () => {
  it('reminds once at 7, 3, 1 and once at expiry; reruns never double-send; skips founder, own-app and paid', async () => {
    const root = new MemoryStore();
    await seed(root);
    const { sent, sender } = fakeSender();
    const run = (d: number) => sweepTrials(root, sender, T0 + d * DAY);
    await run(0);
    await run(6);
    expect(sent).toHaveLength(0);
    for (let i = 0; i < 2; i++) await run(7); // 7 days left, run twice
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('7 days');
    await run(8); // 6 left: nothing new
    await run(11);
    await run(11);
    await run(13);
    await run(13);
    expect(sent.map((s) => s.text.split(' ')[0])).toEqual(['7', '3', '1']);
    await run(14);
    await run(14);
    await run(20);
    expect(sent).toHaveLength(4);
    expect(sent[3].text).toContain('trial has ended');
    const rec = (await root.get<StoreRecord>('stores', 'trialer'))!;
    expect(rec.remindersSent).toEqual(['7', '3', '1', 'ended']);
    expect(rec.trialNotice).toContain('trial has ended');
    expect(sent.every((s) => s.phone === '91700000000')).toBe(true);
  });

  it('a failed send is retried on the next run', async () => {
    const root = new MemoryStore();
    await seed(root);
    let fail = true;
    const sender: TrialSender = { sendTrialNotice: async () => { if (fail) throw new Error('down'); } };
    await sweepTrials(root, sender, T0 + 7 * DAY);
    expect((await root.get<StoreRecord>('stores', 'trialer'))!.remindersSent ?? []).toEqual([]);
    fail = false;
    await sweepTrials(root, sender, T0 + 7 * DAY);
    expect((await root.get<StoreRecord>('stores', 'trialer'))!.remindersSent).toEqual(['7']);
  });
});

describe('POST /api/v1/internal/trial-sweep auth', () => {
  let app: ReturnType<typeof createApp>;
  const { sent, sender } = fakeSender();
  beforeEach(async () => {
    sent.length = 0;
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pem(good.publicKey) }) }));
    process.env.SWEEP_AUDIENCE = AUD;
    process.env.SWEEP_SERVICE_ACCOUNT = SA;
    delete process.env.SWEEP_DEV_OPEN;
    const config = loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) });
    const root = new MemoryStore();
    await seed(root);
    app = createApp(config, root, new MemoryBlobs(), undefined, undefined, { sender, now: () => T0 + 7 * DAY, keys: async () => ({ k1: pem(good.publicKey) }) });
  });
  afterEach(() => vi.unstubAllGlobals());
  const url = '/api/v1/internal/trial-sweep';

  it('refuses anonymous, forged, wrong audience and other accounts; accepts the scheduler once', async () => {
    expect((await request(app).post(url)).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', 'Bearer junk')).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', `Bearer ${oidc(evil.privateKey)}`)).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', `Bearer ${oidc(good.privateKey, SA, 'other')}`)).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', `Bearer ${oidc(good.privateKey, 'me@gmail.com')}`)).status).toBe(403);
    expect(sent).toHaveLength(0);
    const ok = await request(app).post(url).set('Authorization', `Bearer ${oidc(good.privateKey)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.reminders).toBe(1);
    await request(app).post(url).set('Authorization', `Bearer ${oidc(good.privateKey)}`);
    expect(sent).toHaveLength(1);
  });

  it('header-less only with SWEEP_DEV_OPEN', async () => {
    process.env.SWEEP_DEV_OPEN = 'true';
    expect((await request(app).post(url)).status).toBe(200);
    expect((await request(app).post(url).set('Authorization', 'Bearer junk')).status).toBe(401);
  });
});

describe('end of trial keeps data and restores on upgrade', () => {
  it('only adding beyond Basic limits is blocked; reads, orders and photos stay; upgrade or extension restores Pro', async () => {
    const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    const root = new MemoryStore();
    const store = scopeStore(root, 'bhakti');
    const setEnd = (iso: string | undefined, plan: 'basic' | 'pro' = 'basic') => root.update('stores', 'bhakti', { plan, trialEndsAt: iso } as any);
    await root.set('stores', 'bhakti', newStoreRecord(config.merchant, { plan: 'basic', trialEndsAt: new Date(Date.now() + 5 * DAY).toISOString() }));
    const app = createApp(config, root, new MemoryBlobs());
    const r = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
    const auth = { Authorization: `Bearer ${r.body.sessionToken}` };
    const photo = async () => (await request(app).post('/api/admin/photos').set(auth).set('Content-Type', 'image/jpeg').send(JPEG)).body.data.ref as string;
    // During the trial (Pro): 7 categories, a design with 3 photos, an order.
    for (let i = 0; i < 7; i++) expect((await request(app).post('/api/categories').set(auth).send({ name: `C${i}`, image: await photo() })).status).toBe(201);
    const d = await request(app).post('/api/products').set(auth).send({ title: 'R', category: 'C0', purity: '22K 916', grossWt: 10, images: [await photo(), await photo(), await photo()] });
    expect(d.status).toBe(201);
    await store.set('orders', 'po1', { poId: 'po1', firmName: 'Buyer' });
    expect((await request(app).get('/api/admin/orders').set(auth)).status).toBe(200);

    await setEnd(new Date(Date.now() - 1000).toISOString()); // trial over
    const cats = await request(app).get('/api/categories').set(auth);
    expect(cats.body.data).toHaveLength(7);
    const prods = await request(app).get('/api/products').set(auth);
    expect(prods.body.data[0].images).toHaveLength(3);
    expect((await request(app).get('/api/entitlements')).body.data.effectivePlan).toBe('basic');
    expect((await request(app).post('/api/categories').set(auth).send({ name: 'C8', image: await photo() })).status).toBe(402);
    expect((await request(app).get('/api/admin/orders').set(auth)).status).toBe(402);
    expect(await store.list('orders')).toHaveLength(1); // stored, only locked
    expect(await store.list('categories')).toHaveLength(7);

    await setEnd(undefined, 'pro'); // console sets plan pro
    expect((await request(app).get('/api/admin/orders').set(auth)).status).toBe(200);
    expect((await request(app).post('/api/categories').set(auth).send({ name: 'C8', image: await photo() })).status).toBe(201);

    await setEnd(new Date(Date.now() - 1000).toISOString()); // back to basic, then console extends the trial
    expect((await request(app).get('/api/admin/orders').set(auth)).status).toBe(402);
    await setEnd(new Date(Date.now() + 3 * DAY).toISOString());
    expect((await request(app).get('/api/admin/orders').set(auth)).status).toBe(200);
  });
});
