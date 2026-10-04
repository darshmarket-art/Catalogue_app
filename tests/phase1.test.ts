import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { createApp } from '../server/app';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

// Phase 1: server-side catalogue search, admin accounts, remember-me sessions, dev code hints and the signup honeypot.
const JWT = 'x'.repeat(48);
const KEY = 'k'.repeat(20);
let root: MemoryStore;
let app: ReturnType<typeof createApp>;
const S = { 'X-Store': 'aurum' };

const sign = (o: Record<string, unknown> = {}) => ({ storeName: 'aurum', brandName: 'Aurum Jewels', phone: '9811111111', email: 'owner@aurum.test', password: 'OwnerPass@2026', code: STATIC_CODE, ...o });
async function newStore() {
  await request(app).post('/api/signup/request-otp').send({ phone: '9811111111' });
  const r = await request(app).post('/api/signup').send(sign());
  expect(r.status).toBe(201);
  return r.body.sessionToken as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const product = (o: Record<string, unknown>) => ({ category: 'Rings', purity: '22K 916', grossWt: 10, stoneWt: 0, images: ['https://example.com/p.jpg'], ...o });
const exp = (t: string) => (jwt.decode(t) as any).exp - (jwt.decode(t) as any).iat;

beforeEach(async () => {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: JWT, MASTER_PROVISIONING_KEY: KEY, OTP_STATIC_CODE: STATIC_CODE }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();
  app = createApp(config, root);
});

describe('catalogue search, filters, sort and paging', () => {
  let admin: string;
  beforeEach(async () => {
    admin = await newStore();
    const h = { ...S, ...bearer(admin) };
    for (const name of ['Rings', 'Chains']) await request(app).post('/api/categories').set(h).send({ name, image: 'https://example.com/c.jpg' });
    await request(app).post('/api/products').set(h).send(product({ title: 'Temple Ring', sku: 'R-1', grossWt: 5, description: 'antique matte finish' }));
    await request(app).post('/api/products').set(h).send(product({ title: 'Rope Chain', sku: 'C-1', category: 'Chains', grossWt: 20, purity: '18K 750', stockStatus: 'Made-to-Order' }));
    await request(app).post('/api/products').set(h).send(product({ title: 'Peacock Ring', sku: 'R-2', grossWt: 8, stoneWt: 1 }));
  });
  const q = (query: string) => request(app).get(`/api/products?${query}`).set(S).set(bearer(admin));

  it('matches every word across name, SKU, collection, purity and description', async () => {
    expect((await q('search=ring')).body.total).toBe(2);
    expect((await q('search=antique+ring')).body.data.map((p: any) => p.sku)).toEqual(['R-1']);
    expect((await q('search=18k')).body.data.map((p: any) => p.sku)).toEqual(['C-1']);
    expect((await q('search=c-1')).body.total).toBe(1);
    expect((await q('search=nothing-here')).body.total).toBe(0);
  });

  it('combines collection, purity, weight range and availability', async () => {
    expect((await q('category=Rings&purity=22K%20916')).body.total).toBe(2);
    expect((await q('minWt=6&maxWt=10')).body.data.map((p: any) => p.sku)).toEqual(['R-2']);
    expect((await q('availability=Made-to-Order')).body.data.map((p: any) => p.sku)).toEqual(['C-1']);
    expect((await q('category=Rings&availability=Made-to-Order')).body.total).toBe(0);
  });

  it('sorts by weight and name and pages with hasMore', async () => {
    expect((await q('sort=weight-asc')).body.data.map((p: any) => p.sku)).toEqual(['R-1', 'R-2', 'C-1']);
    expect((await q('sort=weight-desc')).body.data[0].sku).toBe('C-1');
    expect((await q('sort=name')).body.data[0].title).toBe('Peacock Ring');
    const p1 = (await q('limit=2&offset=0')).body;
    expect(p1.data).toHaveLength(2);
    expect(p1.total).toBe(3);
    expect(p1.hasMore).toBe(true);
    const p2 = (await q('limit=2&offset=2')).body;
    expect(p2.data).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    expect((await q('sort=bogus')).status).toBe(400);
  });

  it('has no prices: price fields are ignored', async () => {
    const h = { ...S, ...bearer(admin) };
    const r = await request(app).post('/api/products').set(h).send(product({ title: 'Weight', priceMode: 'fixed', price: 999 }));
    expect(r.status).toBe(201);
    expect(r.body.data.priceMode).toBeUndefined();
    expect(r.body.data.price).toBeUndefined();
  });
});

describe('the admin account', () => {
  it('is one per store (no add / remove routes); the admin can change their own password', async () => {
    const owner = await newStore();
    const h = { ...S, ...bearer(owner) };
    expect((await request(app).get('/api/admin/admins').set(h)).status).toBe(404);
    expect((await request(app).post('/api/admin/admins').set(h).send({ email: 'x@aurum.test', password: 'TempPass@2026' })).status).toBe(404);
    expect((await request(app).post('/api/auth/admin/change-password').set(h).send({ currentPassword: 'wrong-password-1', newPassword: 'MyOwnPass@2026' })).status).toBe(401);
  });
});

describe('sessions', () => {
  it('admin: 8 hours by default, a sliding month with "keep me signed in"; buyers: a sliding month', async () => {
    await newStore();
    const plain = await request(app).post('/api/auth/admin/login').set(S).send({ adminId: 'owner@aurum.test', password: 'OwnerPass@2026' });
    expect(exp(plain.body.sessionToken)).toBe(8 * 3600);
    expect((await request(app).get('/api/auth/me').set(S).set(bearer(plain.body.sessionToken))).body.token).toBeUndefined();
    const kept = await request(app).post('/api/auth/admin/login').set(S).send({ adminId: 'owner@aurum.test', password: 'OwnerPass@2026', remember: true });
    expect(exp(kept.body.sessionToken)).toBe(30 * 86400);
    const me = await request(app).get('/api/auth/me').set(S).set(bearer(kept.body.sessionToken));
    expect(exp(me.body.token)).toBe(30 * 86400);
    const b = await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' }, S);
    expect(exp(b.body.token)).toBe(30 * 86400);
    // renewed on every visit, so a regular buyer is never asked for a code again
    expect(exp((await request(app).get('/api/auth/me').set(S).set(bearer(b.body.token))).body.token)).toBe(30 * 86400);
  });
});

describe('dev code hint and honeypot', () => {
  it('returns the code outside production, never in production', async () => {
    await newStore();
    expect((await request(app).post('/api/auth/retailer/request-otp').set(S).send({ phone: '9820000002' })).body.devCode).toBe(STATIC_CODE);
    expect((await request(app).post('/api/signup/request-otp').send({ phone: '9822222222' })).body.devCode).toBe(STATIC_CODE);
    const prod = createApp({ ...loadConfig({ NODE_ENV: 'production', JWT_SECRET: JWT, MASTER_PROVISIONING_KEY: KEY, OTP_STATIC_CODE: STATIC_CODE, STORE: 'firestore' }), storeKind: 'memory', rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } }, new MemoryStore());
    const r = await request(prod).post('/api/signup/request-otp').send({ phone: '9822222223' });
    expect(r.status).toBe(200);
    expect(r.body.devCode).toBeUndefined();
  });

  it('a filled honeypot gets a quiet success and no code; creating a store with it fails; used trials say TRIAL_USED', async () => {
    const r = await request(app).post('/api/signup/request-otp').send({ phone: '9833333333', website: 'http://spam.example' });
    expect(r.status).toBe(200);
    expect(r.body.devCode).toBeUndefined();
    expect(await root.get('signupOtps', '9833333333')).toBeNull();
    await request(app).post('/api/signup/request-otp').send({ phone: '9833333333' });
    expect((await request(app).post('/api/signup').send(sign({ storeName: 'spam-store', phone: '9833333333', email: 'spam@x.test', website: 'x' }))).status).toBe(400);
    await newStore();
    const again = await request(app).post('/api/signup/request-otp').send({ phone: '9811111111' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('TRIAL_USED');
  });

  it('the live name check is not throttled like the code request', async () => {
    for (let i = 0; i < 40; i++) expect((await request(app).get(`/api/signup/check?name=live-check-${i}`)).status).toBe(200);
  });
});
