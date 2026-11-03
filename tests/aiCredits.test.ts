import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord } from '../server/tenancy';
import { change, getWallet, usageSince } from '../server/aiCredits';

// The provider is mocked: no test ever calls Google.
const renderStudio = vi.fn();
vi.mock('../server/aiRender', async (orig) => ({ ...(await orig<typeof import('../server/aiRender')>()), renderStudio: (...a: unknown[]) => renderStudio(...a) }));

const MASTER = 'test-master-provisioning-key';
const AUD = '/projects/1/global/backendServices/2';
const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const iap = (email: string) =>
  jwt.sign({ email }, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'ES256', keyid: 'k1', audience: AUD, issuer: 'https://cloud.google.com/iap', expiresIn: 300 });
const as = (email = 'boss@antarixs.com') => ({ 'x-goog-iap-jwt-assertion': iap(email) });
const con = '/api/v1/console/ai';

const A = { 'X-Store': 'example' };
const B = { 'X-Store': 'other' };
let app: ReturnType<typeof createApp>;
let root: MemoryStore;
let authA: Record<string, string>;
let authB: Record<string, string>;
const png = (r = 10) => sharp({ create: { width: 40, height: 40, channels: 3, background: { r, g: 120, b: 40 } } }).png().toBuffer();

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pair.publicKey.export({ type: 'spki', format: 'pem' }) }) }));
  process.env.CONSOLE_ADMINS = 'boss@antarixs.com';
  process.env.IAP_AUDIENCE = AUD;
  process.env.AI_RENDER_ENABLED = 'true';
  process.env.AI_RENDER_MONTHLY_CAP = '50';
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: MASTER }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();
  await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro' }));
  await root.set('stores', 'other', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro', id: 'other', subdomain: 'other', merchant: { ...loadMerchant({ MERCHANT: 'example' }), id: 'other' } }));
  app = createApp(config, root, new MemoryBlobs());
  const reg = async (h: Record<string, string>) => ({ Authorization: `Bearer ${(await request(app).post('/api/auth/admin/register').set(h).send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER })).body.sessionToken}` });
  authA = { ...A, ...(await reg(A)) };
  authB = { ...B, ...(await reg(B)) };
  renderStudio.mockReset();
  renderStudio.mockImplementation(async () => ({ data: await png(200), mimeType: 'image/png' }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ['AI_RENDER_ENABLED', 'AI_RENDER_MONTHLY_CAP', 'CONSOLE_ADMINS', 'IAP_AUDIENCE']) delete process.env[k];
});

const upload = async (h = authA) => (await request(app).post('/api/admin/photos').set(h).set('Content-Type', 'image/png').send(await png())).body.data.ref as string;
const render = (ref: string, h = authA, body: object = {}) => request(app).post('/api/admin/photos/render').set(h).send({ ref, ...body });
const fund = (n: number, storeId = 'example') => change(root, { storeId, kind: 'topup', amount: n, actor: 'test', note: 'test' });
const balance = async (storeId = 'example') => (await getWallet(root, storeId)).balance;

describe('charging', () => {
  it('charges the server-side price on success and logs the usage with an estimated cost', async () => {
    await fund(20);
    const res = await render(await upload(), authA, { style: 'silk', price: 1 }); // a client-sent price is ignored
    expect(res.status).toBe(201);
    expect(res.body.data.credits).toMatchObject({ balance: 12, charged: 8 });
    expect(await balance()).toBe(12);
    const [u] = await usageSince(root, 0);
    expect(u).toMatchObject({ storeId: 'example', style: 'silk', outcome: 'ok', price: 8, balanceAfter: 12, model: 'gemini-nano-banana-2.1' });
    expect(u.costUsd).toBeCloseTo(0.034);
    expect((await root.list('aiLedger')).map((l: any) => [l.kind, l.amount])).toEqual(expect.arrayContaining([['spend', -8]]));
  });

  it('on-model costs more than the others', async () => {
    await fund(20);
    const res = await render(await upload(), authA, { style: 'on-model', placement: 'neck' });
    expect(res.body.data.credits.charged).toBe(12);
  });

  it('refunds automatically when the provider fails (502), and logs it', async () => {
    await fund(20);
    renderStudio.mockRejectedValue(new Error('Google returned 503'));
    const res = await render(await upload());
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/credits were returned/);
    expect(await balance()).toBe(20);
    const [u] = await usageSince(root, 0);
    expect(u).toMatchObject({ outcome: 'provider_failed', price: 0, refunded: 8 });
    expect((await root.list('aiLedger')).filter((l: any) => l.kind === 'refund')).toHaveLength(1);
  });

  it('a render the owner discards stays charged', async () => {
    await fund(20);
    const res = await render(await upload());
    const keep = await request(app).post('/api/admin/ai-credits/keep').set(authA).send({ renderId: res.body.data.renderId, kept: false });
    expect(keep.status).toBe(200);
    expect(await balance()).toBe(12);
    expect((await usageSince(root, 0))[0]).toMatchObject({ outcome: 'ok', kept: false, price: 8 });
  });

  it('402 {reason: credits} before any provider call when the balance is short', async () => {
    await fund(7);
    const res = await render(await upload());
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ reason: 'credits', balance: 7, price: 8 });
    expect(renderStudio).not.toHaveBeenCalled();
    expect(await balance()).toBe(7);
    expect((await usageSince(root, 0))[0].outcome).toBe('blocked_credits');
  });

  it('the monthly cap stays a separate 402 reason', async () => {
    process.env.AI_RENDER_MONTHLY_CAP = '1';
    await fund(50);
    const ref = await upload();
    expect((await render(ref)).status).toBe(201);
    const res = await render(ref);
    expect(res.status).toBe(402);
    expect(res.body.reason).toBe('cap');
    expect(await balance()).toBe(42);
  });

  it('two parallel renders with balance for one: exactly one is served, balance never negative', async () => {
    await fund(8);
    renderStudio.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 40)); return { data: await png(200), mimeType: 'image/png' }; });
    const ref = await upload();
    const [a, b] = await Promise.all([render(ref), render(ref)]);
    expect([a.status, b.status].sort()).toEqual([201, 402]);
    expect(renderStudio).toHaveBeenCalledTimes(1);
    expect(await balance()).toBe(0);
  });

  it('a retry with the same render id is never charged or sent to Google twice', async () => {
    await fund(20);
    const ref = await upload();
    const first = await render(ref, authA, { renderId: 'retry-0001' });
    expect(first.status).toBe(201);
    const again = await render(ref, authA, { renderId: 'retry-0001' });
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ ref: first.body.data.ref, replay: true });
    expect(renderStudio).toHaveBeenCalledTimes(1);
    expect(await balance()).toBe(12);
    expect((await render(ref, authA, { renderId: 'bad id!' })).status).toBe(400);
  });

  it('aiFree stores are not charged but are logged with their cost', async () => {
    await request(app).post(`${con}/stores/example/settings`).set(as()).send({ aiFree: true }).expect(200);
    const res = await render(await upload());
    expect(res.status).toBe(201);
    expect(await balance()).toBe(0);
    const [u] = await usageSince(root, 0);
    expect(u).toMatchObject({ outcome: 'ok', price: 0, listPrice: 8 });
    expect(u.costUsd).toBeGreaterThan(0);
  });

  it('the founder store (bhakti) is exempt by default', async () => {
    await root.set('stores', 'bhakti', newStoreRecord(loadMerchant({ MERCHANT: 'bhakti' })));
    const h = { 'X-Store': 'bhakti' };
    const auth = { ...h, Authorization: `Bearer ${(await request(app).post('/api/auth/admin/register').set(h).send({ email: 'f@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER })).body.sessionToken}` };
    expect((await render(await upload(auth), auth)).status).toBe(201);
    expect((await usageSince(root, 0))[0]).toMatchObject({ storeId: 'bhakti', price: 0 });
  });

  it('a per-store price override changes the charge; the global table changes it for everyone else', async () => {
    await fund(30);
    await request(app).post(`${con}/stores/example/settings`).set(as()).send({ priceOverride: { all: 3, silk: 5 } }).expect(200);
    expect((await render(await upload(), authA, { style: 'silk' })).body.data.credits.charged).toBe(5);
    expect((await render(await upload(), authA, { style: 'cad' })).body.data.credits.charged).toBe(3);
    await request(app).post(`${con}/config`).set(as()).send({ prices: { macro: 20 } }).expect(200);
    await request(app).post(`${con}/stores/example/settings`).set(as()).send({ priceOverride: {} }).expect(200);
    expect((await render(await upload(), authA, { style: 'macro' })).body.data.credits.charged).toBe(20);
  });

  it('the console kill switch stops new renders platform-wide (503, nothing charged); AI off for one store only blocks that store', async () => {
    await fund(20);
    await fund(20, 'other');
    await request(app).post(`${con}/stores/example/settings`).set(as()).send({ aiEnabled: false }).expect(200);
    const off = await render(await upload());
    expect(off).toMatchObject({ status: 503 });
    expect(off.body.reason).toBe('disabled');
    expect((await render(await upload(authB), authB)).status).toBe(201);
    await request(app).post(`${con}/config`).set(as()).send({ killSwitch: true }).expect(200);
    const paused = await render(await upload(authB), authB);
    expect(paused.status).toBe(503);
    expect(paused.body.reason).toBe('paused');
    expect(await balance('other')).toBe(12);
    expect(renderStudio).toHaveBeenCalledTimes(1);
  });
});

describe('owner scope', () => {
  it('each store sees only its own wallet; an unauthenticated caller sees nothing', async () => {
    await fund(40);
    await fund(5, 'other');
    expect((await request(app).get('/api/admin/ai-credits').set(authA)).body.data).toMatchObject({ balance: 40, lastTopup: { amount: 40 } });
    expect((await request(app).get('/api/admin/ai-credits').set(authB)).body.data.balance).toBe(5);
    expect((await request(app).get('/api/admin/ai-credits').set(A)).status).toBe(401);
    // A's token does not work on B, and a client cannot name another store's wallet.
    expect((await request(app).get('/api/admin/ai-credits').set({ ...authA, ...B })).status).toBe(401);
    expect((await request(app).get('/api/admin/ai-credits?storeId=other').set(authA)).body.data.balance).toBe(40);
  });

  it('the render status carries the balance and per-style prices', async () => {
    await fund(120);
    const s = (await request(app).get('/api/admin/photos/render').set(authA)).body.data;
    expect(s.credits).toMatchObject({ balance: 120, free: false, low: false });
    expect(s.credits.prices).toMatchObject({ cad: 8, 'on-model': 12 });
  });
});

describe('console', () => {
  it('requires a console admin', async () => {
    expect((await request(app).get(`${con}/overview`)).status).toBe(401);
    expect((await request(app).get(`${con}/stores`).set(as('stranger@gmail.com'))).status).toBe(403);
    expect((await request(app).post(`${con}/stores/example/topup`).send({ amount: 10, note: 'x' })).status).toBe(401);
    expect((await request(app).post(`${con}/stores/example/topup`).set(authA).send({ amount: 10, note: 'x' })).status).toBe(401); // an owner token is not a console login
  });

  it('top-up changes the balance, writes the ledger and an audit entry', async () => {
    const res = await request(app).post(`${con}/stores/example/topup`).set(as()).send({ amount: 100, note: 'UPI ref 123' });
    expect(res.body.data.balance).toBe(100);
    const w = await getWallet(root, 'example');
    expect(w).toMatchObject({ balance: 100, paidTotal: 100, lastTopupAmount: 100 });
    expect((await root.list('aiLedger'))[0]).toMatchObject({ kind: 'topup', amount: 100, actor: 'boss@antarixs.com', note: 'UPI ref 123', balanceAfter: 100 });
    const audit = (await root.list('consoleAudit')).find((a: any) => a.action === 'ai-topup');
    expect(audit).toMatchObject({ who: 'boss@antarixs.com', storeId: 'example' });
    expect(audit!.what).toMatch(/UPI ref 123/);
  });

  it('validates amounts: whole, bounded, never below zero, note required', async () => {
    const post = (path: string, body: object) => request(app).post(`${con}/stores/example/${path}`).set(as()).send(body);
    expect((await post('topup', { amount: 1.5, note: 'x' })).status).toBe(400);
    expect((await post('topup', { amount: 0, note: 'x' })).status).toBe(400);
    expect((await post('topup', { amount: -5, note: 'x' })).status).toBe(400);
    expect((await post('topup', { amount: 100001, note: 'x' })).status).toBe(400);
    expect((await post('topup', { amount: 10 })).status).toBe(400);
    expect((await post('topup', { amount: 10, note: 'x', extra: 1 })).status).toBe(400);
    await post('topup', { amount: 10, note: 'x' });
    expect((await post('adjust', { amount: -11, note: 'fix' })).status).toBe(400);
    expect((await post('adjust', { amount: -4, note: 'fix' })).body.data.balance).toBe(6);
    expect((await post('refund', { amount: 5, note: 'goodwill' })).body.data.balance).toBe(11);
    expect((await request(app).post(`${con}/stores/nobody/topup`).set(as()).send({ amount: 5, note: 'x' })).status).toBe(404);
    expect(await balance()).toBe(11);
  });

  it('a refund tied to a render cannot exceed what that render charged', async () => {
    await fund(20);
    const id = (await render(await upload())).body.data.renderId;
    const post = (amount: number) => request(app).post(`${con}/stores/example/refund`).set(as()).send({ amount, note: 'bad result', renderId: id });
    expect((await post(9)).status).toBe(400);
    expect((await post(8)).body.data.balance).toBe(20);
    expect((await post(1)).status).toBe(400);
  });

  it('overview, store table, alerts and CSV report real numbers', async () => {
    await fund(20);
    await render(await upload());
    renderStudio.mockRejectedValueOnce(new Error('Google returned 500'));
    await render(await upload());
    await render(await upload());
    await render(await upload()); // balance 4 now: blocked
    const o = (await request(app).get(`${con}/overview`).set(as())).body.data;
    expect(o.windows.today).toMatchObject({ calls: 3, ok: 2, failed: 1, blocked: 1 });
    expect(o.credits).toMatchObject({ sold: 20, spent: 16, refunded: 8 });
    expect(o.money).toMatchObject({ revenue: 16, estimated: true });
    expect(o.money.costInr).toBeCloseTo(3 * 0.034 * 95);
    expect(o.billing.connected).toBe(false);
    expect(o.daily).toHaveLength(30);
    expect(o.topStores[0]).toMatchObject({ storeId: 'example', calls: 3 });
    const rows = (await request(app).get(`${con}/stores`).set(as())).body.data.rows;
    expect(rows.find((r: any) => r.id === 'example')).toMatchObject({ balance: 4, rendersMonth: 3, spendMonth: 16, status: 'low' });
    const alerts = (await request(app).get(`${con}/alerts`).set(as())).body.data.rows;
    expect(alerts.map((a: any) => a.id)).toContain('example');
    const usage = (await request(app).get(`${con}/usage?outcome=blocked_credits&store=example`).set(as())).body.data;
    expect(usage).toHaveLength(1);
    const csv = await request(app).get(`${con}/usage.csv?store=example`).set(as());
    expect(csv.type).toBe('text/csv');
    expect(csv.text.split('\r\n')).toHaveLength(5); // header and four attempts
    expect(csv.text).toMatch(/blocked_credits/);
  });

  it('config edits are validated and audited', async () => {
    const post = (b: object) => request(app).post(`${con}/config`).set(as()).send(b);
    expect((await post({ prices: { cad: -1 } })).status).toBe(400);
    expect((await post({ prices: { nope: 4 } })).status).toBe(400);
    expect((await post({ usdInr: 0 })).status).toBe(400);
    const ok = await post({ usdInr: 90, lowBalance: 40, modelCostUsd: { 'gemini-nano-banana-2.1': 0.05 } });
    expect(ok.body.data).toMatchObject({ usdInr: 90, lowBalance: 40 });
    expect((await root.list('consoleAudit')).some((a: any) => a.action === 'ai-config' && /USD-INR 95 -> 90/.test(a.what))).toBe(true);
    expect((await request(app).get(`${con}/config`).set(as())).body.data.config.modelCostUsd['gemini-nano-banana-2.1']).toBe(0.05);
  });
});
