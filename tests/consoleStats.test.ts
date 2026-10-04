import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord, scopeStore, type StoreRecord } from '../server/tenancy';
import { maskPhone } from '../server/consoleStats';
import { daysAgo } from '../server/stats';
import { Overview, PlansPage, StoragePage, StoresPage, type PageProps } from '../src/console/pages';

const AUD = '/projects/1/global/backendServices/2';
const key = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = (k: crypto.KeyObject) => k.export({ type: 'spki', format: 'pem' }) as string;
const as = (email = 'boss@antarixs.com') => ({
  'x-goog-iap-jwt-assertion': jwt.sign({ email }, key.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'ES256', keyid: 'k1', audience: AUD, issuer: 'https://cloud.google.com/iap', expiresIn: 300 })
});
const api = '/api/v1/console';
const HASH = '$2a$12$SECRETHASHSECRETHASHSECRETHASHSECRETHASH';
const DAY = 86400000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

let app: ReturnType<typeof createApp>;
let root: MemoryStore;

const seedStore = async (id: string, name: string, patch: Partial<StoreRecord>) => {
  const m = loadMerchant({ MERCHANT: 'example' });
  await root.set('stores', id, newStoreRecord({ ...m, id, brand: { ...m.brand, name } }, { id, subdomain: id, createdAt: iso(-30), ...patch }));
  return scopeStore(root, id);
};

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pem(key.publicKey) }) }));
  process.env.CONSOLE_ADMINS = 'boss@antarixs.com';
  process.env.IAP_AUDIENCE = AUD;
  delete process.env.CONSOLE_DEV_OPEN;
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();

  // alpha: Basic, signup trial ending in 2 days, two buyers, one online now, one order, owner + admin with a password hash.
  const a = await seedStore('alpha', 'Alpha Jewels', { trialEndsAt: iso(2), createdAt: iso(-12), owner: { email: 'a@alpha.test', phone: '9811100001' } });
  await a.set('buyers', '9812345678', { id: 'm1', firmName: 'Shree Gold', phone: '9812345678', password: HASH, verified: true, createdAt: iso(-1) });
  await a.set('buyers', '919876543210', { id: 'm2', firmName: 'Kapoor Ornaments', phone: '919876543210', password: HASH, verified: false, createdAt: iso(-20) });
  await a.set('visitors', '9812345678', { actorId: '9812345678', kind: 'verified', name: 'Shree Gold', lastSeen: Date.now() - 60_000 });
  await a.set('dailyStats', daysAgo(0), { day: daysAgo(0), booked: 2, visitors: 10 });
  await a.set('dailyStats', daysAgo(10), { day: daysAgo(10), booked: 1, visitors: 5 });
  await a.set('dailyStats', daysAgo(20), { day: daysAgo(20), booked: 100, visitors: 100 }); // outside the 14-day window
  await a.set('admins', 'a@alpha.test', { id: 'adm1', name: 'Asha Owner', email: 'a@alpha.test', phone: '9811100001', password: HASH, role: 'owner', createdAt: iso(-12) });
  await a.set('purchaseOrders', 'PO-111111', { poId: 'PO-111111', status: 'new', retailerId: '9812345678', firmName: 'Shree Gold', buyer: { phone: '9812345678', gstin: 'X' }, totalNetGrams: 96.56, itemCount: 4, timestamp: iso(-0.01) });
  await a.set('auditLogs', 'l1', { id: 'l1', event: 'PRODUCT_UPDATED', details: 'Product MJ-1 (Ring) updated.', timestamp: iso(-0.02), ip: '1.2.3.4' });
  await a.set('auditLogs', 'l2', { id: 'l2', event: 'RETAILER_SIGNUP_SUCCESS', details: 'Firm registered: Shree Gold (Phone: 9812345678)', timestamp: iso(-0.03) });
  await a.set('auditLogs', 'l3', { id: 'l3', event: 'RETAILER_LOGIN_SUCCESS', details: 'Firm authenticated: Shree Gold (Phone: 9812345678)', timestamp: iso(-0.04) });

  // beta: Basic with a 10-day trial; its only visitor was seen an hour ago.
  const b = await seedStore('beta', 'Beta Gold', { trialEndsAt: iso(10), createdAt: iso(-3), owner: { email: 'b@beta.test' } });
  await b.set('visitors', 'g1', { actorId: 'g1', kind: 'guest', name: 'Guest visitor', lastSeen: Date.now() - 3600_000 });
  await b.set('dailyStats', daysAgo(0), { day: daysAgo(0), booked: 3, visitors: 20 });

  // gamma: paid Pro, last week's numbers only.
  const g = await seedStore('gamma', 'Gamma Ornaments', { plan: 'pro', createdAt: iso(-60) });
  await g.set('dailyStats', daysAgo(8), { day: daysAgo(8), booked: 4, visitors: 7 });

  app = createApp(config, root, new MemoryBlobs());
});
afterEach(() => vi.unstubAllGlobals());

const get = async (p: string) => (await request(app).get(`${api}${p}`).set(as())).body.data;

describe('console cross-store reads', () => {
  it('need the IAP header', async () => {
    for (const p of ['/summary', '/activity', '/owners', '/buyers', '/orders']) expect((await request(app).get(`${api}${p}`)).status).toBe(401);
    expect((await request(app).post(`${api}/stores/alpha/layout`).send({ layout: 'emergent' })).status).toBe(401);
  });

  it('summary totals across three stores', async () => {
    const s = await get('/summary');
    expect(s.stores).toMatchObject({ total: 3, active: 3, suspended: 0, newThisWeek: 1 });
    expect(s.buyers).toEqual({ total: 2, newThisWeek: 1 });
    expect(s.orders).toEqual({ week: 5, prevWeek: 5 });
    expect(s.visits).toEqual({ week: 30, prevWeek: 12 });
    expect(s.online).toEqual({ visitors: 1, stores: 1 });
    expect(s.series).toHaveLength(14);
    expect(s.series[13]).toMatchObject({ day: daysAgo(0), orders: 5, visits: 30 });
    expect(s.series.reduce((t: number, d: any) => t + d.orders, 0)).toBe(10); // the 20-day-old day is outside the window
  });

  it('plan mix and the trials-ending window', async () => {
    const s = await get('/summary');
    expect(s.planMix).toEqual({ basic: 0, proTrial: 2, paidPro: 1, founder: 0 });
    expect(s.trialsEndingSoon).toMatchObject({ windowDays: 3, count: 1 });
    expect(s.trialsEndingSoon.stores).toEqual([expect.objectContaining({ id: 'alpha', daysLeft: 2 })]);
    // A lapsed trial is Basic again and no longer "ending".
    await root.update('stores', 'alpha', { trialEndsAt: iso(-1) });
    const later = await get('/summary');
    expect(later.planMix).toMatchObject({ basic: 1, proTrial: 1 });
    expect(later.trialsEndingSoon.count).toBe(0);
  });

  it('returns null, not made-up numbers, for what the app cannot know', async () => {
    const { cloud } = await get('/summary');
    expect(cloud).toMatchObject({ storageBytes: null, firestoreReads: null, certificates: null, costInr: null, subdomainsActive: 3, note: 'Connect Cloud Monitoring' });
  });

  it('masks buyer phones', async () => {
    expect(maskPhone('9812345678')).toBe('+91 98••• ••678');
    expect(maskPhone('+91 98765 43210')).toBe('+91 98••• ••210');
    expect(maskPhone('919876543210')).toBe('+91 98••• ••210');
    expect(maskPhone('12')).toBeNull();
    const { total, rows } = await get('/buyers');
    expect(total).toBe(2);
    const shree = rows.find((b: any) => b.firmName === 'Shree Gold');
    expect(shree).toMatchObject({ storeId: 'alpha', storeName: 'Alpha Jewels', phone: '+91 98••• ••678', verified: true });
    expect(shree.lastSeen).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(rows.find((b: any) => b.firmName === 'Kapoor Ornaments')).toMatchObject({ phone: '+91 98••• ••210', verified: false, lastSeen: null });
  });

  it('never leaks hashes, full buyer phones or addresses from any endpoint', async () => {
    await request(app).post(`${api}/stores/alpha/layout`).set(as()).send({ layout: 'emergent' });
    const all = JSON.stringify([
      await get('/summary'), await get('/activity?limit=100'), await get('/owners'), await get('/buyers'), await get('/orders'),
      await get('/stores'), await get('/stores/alpha'), await get('/audit')
    ]);
    expect(all).not.toContain('SECRETHASH');
    expect(all).not.toContain('password');
    expect(all).not.toContain('9812345678');
    expect(all).not.toContain('9876543210');
    expect(all).not.toContain('1.2.3.4'); // audit-log IPs stay home
  });

  it('owners: contact and staff, no password field', async () => {
    const o = await get('/owners');
    const alpha = o.find((s: any) => s.id === 'alpha');
    expect(alpha.owner).toEqual({ email: 'a@alpha.test', phone: '9811100001' });
    expect(alpha.admins).toEqual([{ name: 'Asha Owner', email: 'a@alpha.test', phone: '9811100001', role: 'owner', createdAt: expect.any(String) }]);
    expect(o.find((s: any) => s.id === 'gamma')).toMatchObject({ owner: null, admins: [] });
  });

  it('orders: store, PO, status, net weight, date only', async () => {
    const { rows } = await get('/orders');
    expect(rows).toEqual([{ storeId: 'alpha', storeName: 'Alpha Jewels', poId: 'PO-111111', status: 'new', totalNetGrams: 96.56, itemCount: 4, timestamp: expect.any(String) }]);
  });

  it('activity: merged, newest first, owner events only, numbers masked', async () => {
    await request(app).post(`${api}/stores/beta/plan`).set(as()).send({ plan: 'pro' });
    const feed = await get('/activity?limit=100');
    const titles = feed.map((i: any) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Order PO-111111 placed', 'New store created', 'Trial started', 'Design updated', 'Buyer signed up', 'Console change']));
    expect(titles).not.toContain('Firm authenticated'); // logins are not feed material
    expect(feed.map((i: any) => i.kind)).not.toContain(undefined);
    expect(feed.every((i: any, k: number) => k === 0 || feed[k - 1].at >= i.at)).toBe(true);
    expect(feed.find((i: any) => i.title === 'Buyer signed up').detail).toBe('Firm registered: Shree Gold (Phone: +91 98••• ••678)');
    expect(feed.find((i: any) => i.kind === 'console')).toMatchObject({ storeId: 'beta', storeName: 'Beta Gold', detail: 'plan basic -> pro · by boss@antarixs.com' });
    expect((await get('/activity?limit=2'))).toHaveLength(2);
  });
});

describe('console layout write', () => {
  const post = (id: string, b: object) => request(app).post(`${api}/stores/${id}/layout`).set(as()).send(b);

  it('accepts a Pro layout on a Basic store, audits it and keeps the effective layout Gilded', async () => {
    await root.update('stores', 'alpha', { trialEndsAt: iso(-1) }); // lapsed trial: Basic
    const res = await post('alpha', { layout: 'emergent' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'alpha', plan: 'basic', effectivePlan: 'basic', layout: 'emergent', effectiveLayout: 'gilded' });
    expect(((await root.get<StoreRecord>('stores', 'alpha'))!).merchant.layout).toBe('emergent');
    const log = (await get('/stores/alpha')).audit;
    expect(log[0]).toMatchObject({ action: 'layout', who: 'boss@antarixs.com', storeId: 'alpha', what: 'layout gilded -> emergent' });
    // Back on Pro the saved choice shows.
    await root.update('stores', 'alpha', { plan: 'pro' });
    expect((await get('/stores/alpha')).effectiveLayout).toBe('emergent');
  });

  it('rejects an unknown layout and an unknown store, and needs JSON', async () => {
    expect((await post('alpha', { layout: 'neon' })).status).toBe(400);
    expect((await post('alpha', {})).status).toBe(400);
    expect((await post('nope', { layout: 'gilded' })).status).toBe(404);
    expect((await request(app).post(`${api}/stores/alpha/layout`).set(as()).type('form').send('layout=gilded')).status).toBe(415);
    expect(((await root.get<StoreRecord>('stores', 'alpha'))!).merchant.layout).toBe('gilded');
    expect((await get('/audit'))).toHaveLength(0);
  });

  it('the store view carries owner, layout and last activity', async () => {
    const rows = await get('/stores');
    const alpha = rows.find((s: any) => s.id === 'alpha');
    expect(alpha).toMatchObject({ owner: { email: 'a@alpha.test' }, layout: 'gilded', effectiveLayout: 'gilded', buyers: 2, limits: { buyers: null, photos: 3000 } });
    expect(Date.now() - Date.parse(alpha.lastActiveAt)).toBeLessThan(5 * 60_000);
    expect(rows.find((s: any) => s.id === 'gamma').lastActiveAt).toBeNull();
  });
});

// The pages take the API's own JSON, so rendering them from real responses catches a server/UI shape mismatch.
describe('console pages render real data', () => {
  const state = <T,>(data: T) => ({ data, error: '', loading: false });
  const html = async (Page: (p: PageProps) => ReactElement | null) =>
    renderToStaticMarkup(createElement(Page, { stores: state(await get('/stores')), summary: state(await get('/summary')), v: 0, ask: () => {} }));

  it('overview: KPIs, chart, plan mix, trial warning, stores and Not connected cloud cards', async () => {
    const out = await html(Overview);
    expect(out).toContain('Alpha Jewels');
    expect(out).toContain('Pro trial · 2d');
    expect(out).toContain('1 trial ends within 3 days');
    expect(out).toContain('10 orders and 42 visits'); // 14-day totals in the chart's label
    expect(out).toContain('Not connected');
    expect(out).toContain('Connect Cloud Monitoring');
    expect(out).not.toContain('SECRETHASH');
  });

  it('stores, plans and storage pages', async () => {
    expect(await html(StoresPage)).toMatch(/Alpha Jewels[\s\S]*Gilded/);
    const plans = await html(PlansPage);
    expect(plans).toContain('Extend trial 14 days');
    expect(plans).toContain('Set Pro');
    expect(plans).toContain('Set Basic'); // gamma is paid Pro
    expect((await html(StoragePage)).match(/Not connected/g)!.length).toBeGreaterThanOrEqual(4);
  });
});
