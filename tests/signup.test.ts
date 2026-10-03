import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { createApp } from '../server/app';

let root: MemoryStore;
let app: ReturnType<typeof createApp>;
const CODE = '123456';
const body = (o: Record<string, unknown> = {}) => ({
  storeName: 'sparkle-gems', brandName: 'Sparkle Gems', phone: '9811111111', email: 'Owner@Sparkle.com', password: 'OwnerPass@2026', code: CODE, ...o
});
const signup = async (o: Record<string, unknown> = {}) => {
  const b = body(o) as any;
  await request(app).post('/api/v1/signup/request-otp').send({ phone: b.phone });
  return request(app).post('/api/v1/signup').send(b);
};

beforeEach(() => {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'k'.repeat(20), OTP_STATIC_CODE: CODE }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();
  app = createApp(config, root);
});

describe('self-serve signup', () => {
  it('creates a Basic store with a 14-day trial, an owner admin and a working token', async () => {
    const before = Date.now();
    const r = await signup();
    expect(r.status).toBe(201);
    expect(r.body.storeUrl).toContain('?store=sparkle-gems');
    expect(JSON.stringify(r.body)).not.toContain('k'.repeat(20));
    const rec = (await root.get('stores', 'sparkle-gems')) as any;
    expect(rec).toMatchObject({ plan: 'basic', status: 'active', owner: { email: 'owner@sparkle.com', phone: '9811111111' } });
    expect(rec.merchant.brand.name).toBe('Sparkle Gems');
    const days = (Date.parse(rec.trialEndsAt) - before) / 86400000;
    expect(days).toBeGreaterThan(13.99);
    expect(days).toBeLessThan(14.01);
    const ent = await request(app).get('/api/entitlements').set('X-Store', 'sparkle-gems');
    expect(ent.body.data.plan).toBe('basic');
    expect(ent.body.data.trialEndsAt).toBe(rec.trialEndsAt);
    const me = await request(app).get('/api/auth/me').set('X-Store', 'sparkle-gems').set('Authorization', `Bearer ${r.body.sessionToken}`);
    expect(me.body.type).toBe('admin');
    const login = await request(app).post('/api/auth/admin/login').set('X-Store', 'sparkle-gems').send({ adminId: 'owner@sparkle.com', password: 'OwnerPass@2026' });
    expect(login.status).toBe(200);
  });

  it('needs the phone code', async () => {
    await request(app).post('/api/signup/request-otp').send({ phone: '9811111111' });
    expect((await request(app).post('/api/signup').send(body({ code: '000000' }))).status).toBe(401);
    expect((await request(app).get('/api/config?store=sparkle-gems')).status).toBe(404);
  });

  it('refuses reserved, invalid and taken names, and suggests alternatives', async () => {
    expect((await signup({ storeName: 'console' })).status).toBe(409);
    expect((await signup({ storeName: 'a' })).status).toBe(400);
    expect((await signup({ storeName: 'bhakti' })).status).toBe(409); // the default store is never claimable
    await signup();
    const c = await request(app).get('/api/signup/check?name=sparkle-gems');
    expect(c.body.available).toBe(false);
    expect(c.body.suggestions.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/signup/check?name=fresh-name')).body.available).toBe(true);
    expect((await request(app).get('/api/signup/check?name=www')).body.available).toBe(false);
    const dup = await signup({ phone: '9822222222', email: 'x@y.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toContain('taken');
  });

  it('allows one trial per phone and per email', async () => {
    expect((await signup()).status).toBe(201);
    expect((await request(app).post('/api/signup/request-otp').send({ phone: '9811111111' })).status).toBe(409);
    expect((await signup({ storeName: 'second', phone: '9833333333' })).status).toBe(409); // same email
    expect(await root.get('stores', 'second')).toBeNull();
    expect((await signup({ storeName: 'third', email: 'other@x.com' })).status).toBeGreaterThanOrEqual(401); // same phone: no code is even sent
    expect(await root.get('stores', 'third')).toBeNull();
    expect((await signup({ storeName: 'fourth', phone: '9844444444', email: 'other@x.com' })).status).toBe(201);
  });

  it('isolates the new store from others', async () => {
    const a = await signup();
    const b = await signup({ storeName: 'other-shop', phone: '9855555555', email: 'b@b.com' });
    const asB = await request(app).get('/api/auth/me').set('X-Store', 'other-shop').set('Authorization', `Bearer ${a.body.sessionToken}`);
    expect(asB.status).toBe(401);
    const onBhakti = await request(app).get('/api/auth/me').set('X-Store', 'bhakti').set('Authorization', `Bearer ${b.body.sessionToken}`);
    expect(onBhakti.status).toBe(401);
    expect((await root.list('stores/sparkle-gems/admins')).length).toBe(1);
    expect((await root.list('stores/other-shop/admins')).length).toBe(1);
    expect((await root.list('admins')).length).toBe(0);
  });

  it('builds the store URL from BASE_DOMAIN on the real host', async () => {
    await request(app).post('/api/signup/request-otp').set('Host', 'antarixs.com').send({ phone: '9811111111' });
    const r = await request(app).post('/api/signup').set('Host', 'antarixs.com').send(body());
    expect(r.body.storeUrl).toBe('https://sparkle-gems.antarixs.com');
  });
});

describe('signup brand colour', () => {
  it('applies an optional brand colour as the store primary and rejects a bad one', async () => {
    expect((await signup({ brandColor: 'red' })).status).toBe(400);
    expect((await signup({ brandColor: '#0a7d5a' })).status).toBe(201);
    const rec = (await root.get('stores', 'sparkle-gems')) as any;
    expect(rec.merchant.theme.colors.primary).toBe('#0a7d5a');
  });
  it('keeps the core theme when no colour is chosen', async () => {
    await signup();
    expect(((await root.get('stores', 'sparkle-gems')) as any).merchant.theme.colors).toEqual({});
  });
});
