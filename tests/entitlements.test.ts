import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { effectivePlan, makeEntitlements, trialEnd } from '../server/entitlements';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';

const KEY = 'test-master-provisioning-key';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

describe('effectivePlan', () => {
  it('trial, expiry, founder and own app', () => {
    const now = Date.now();
    expect(effectivePlan({ plan: 'basic', trialEndsAt: trialEnd(new Date(now)) }, now)).toBe('pro');
    expect(effectivePlan({ plan: 'basic', trialEndsAt: trialEnd(new Date(now)) }, now + 15 * 86400000)).toBe('basic');
    expect(effectivePlan({ plan: 'founder' })).toBe('pro');
    expect(effectivePlan({ plan: 'basic', ownApp: true })).toBe('pro');
    expect(makeEntitlements({ plan: 'basic' }).limits).toMatchObject({ categories: 5, photos: 200, photosPerDesign: 1, users: 50 });
  });
});

async function basicStore() {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const store = new MemoryStore();
  await store.set('settings', 'plan', { id: 'plan', plan: 'basic' });
  const app = createApp(config, store, new MemoryBlobs());
  const r = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const auth = { Authorization: `Bearer ${r.body.sessionToken}` };
  const up = () => request(app).post('/api/admin/photos').set(auth).set('Content-Type', 'image/jpeg').send(JPEG);
  const photo = async () => (await up()).body.data?.ref as string;
  return { app, auth, store, photo, up };
}

describe('Basic plan enforcement', () => {
  it('caps categories at 5 and exposes entitlements', async () => {
    const { app, auth, photo } = await basicStore();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/categories').set(auth).send({ name: `C${i}`, image: await photo() });
      expect(res.status).toBe(201);
    }
    const res = await request(app).post('/api/categories').set(auth).send({ name: 'C6', image: await photo() });
    expect(res.status).toBe(402);
    const e = await request(app).get('/api/entitlements');
    expect(e.body.data).toMatchObject({ effectivePlan: 'basic', usage: { categories: 5 } });
  });

  it('allows 1 photo per design and blocks uploads at the photo cap', async () => {
    const { app, auth, store, photo, up } = await basicStore();
    await request(app).post('/api/categories').set(auth).send({ name: 'Rings', image: await photo() });
    const body = { title: 'R', category: 'Rings', purity: '22K 916', grossWt: 10, images: [await photo(), await photo()] };
    expect((await request(app).post('/api/products').set(auth).send(body)).status).toBe(402);
    for (let i = 0; i < 199; i++) await store.set('banners', `b${i}`, { id: `b${i}`, image: `media:${String(i).padStart(32, '0')}.jpg` });
    expect((await up()).status).toBe(402);
  });
});

describe('Basic buyer limit', () => {
  it('refuses new numbers (no OTP sent) when full; existing buyers and the owner list/remove still work', async () => {
    const { app, auth, store } = await basicStore();
    for (let i = 0; i < 50; i++) await store.set('buyers', `98200000${String(i).padStart(2, '0')}`, { id: `b${i}`, phone: `98200000${String(i).padStart(2, '0')}`, firmName: `F${i}`, createdAt: '2026-01-01' });
    const full = await request(app).post('/api/auth/retailer/request-otp').send({ phone: '9999999999' });
    expect(full.status).toBe(403);
    expect(full.body.code).toBe('CATALOGUE_FULL');
    expect((await request(app).post('/api/auth/retailer/request-otp').send({ phone: '9820000001' })).status).toBe(200);
    expect((await request(app).get('/api/entitlements')).body.data.usage.users).toBe(50);
    expect((await request(app).get('/api/admin/buyers').set(auth)).body.count).toBe(50);
    expect((await request(app).delete('/api/admin/buyers/9820000001').set(auth)).status).toBe(200);
    expect((await request(app).post('/api/auth/retailer/request-otp').send({ phone: '9999999999' })).status).toBe(200);
  });
});

describe('Pro feature gating', () => {
  it('Basic gets 402 on Pro routes; trial and founder are unaffected', async () => {
    const { app, auth, store } = await basicStore();
    const get = (path: string) => request(app).get(path).set(auth);
    for (const path of ['/api/orders', '/api/admin/orders', '/api/admin/visitors?kind=all', '/api/analytics', '/api/analytics/export', '/api/admin/audit-logs']) {
      expect((await get(path)).status, path).toBe(402);
    }
    const staff = { email: 's@example.com', password: 'AdminPass@2026', role: 'staff', masterProvisioningKey: KEY };
    expect((await request(app).post('/api/auth/admin/register').send(staff)).status).toBe(402);
    // Free features still work, and so does tracking.
    expect((await get('/api/admin/buyers')).status).toBe(200);
    // A running trial is Pro.
    await store.set('settings', 'plan', { id: 'plan', plan: 'basic', trialEndsAt: trialEnd() });
    expect((await get('/api/admin/orders')).status).toBe(200);
    expect((await get('/api/analytics')).status).toBe(200);
    expect((await request(app).post('/api/auth/admin/register').send(staff)).status).toBe(201);
  });
});
