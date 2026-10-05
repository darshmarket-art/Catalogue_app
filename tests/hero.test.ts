import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { seedDemoCatalogue } from '../server/seed';
import type { MerchantConfig } from '../server/merchant';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const KEY = 'test-master-provisioning-key';

async function build() {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY, SEED_DEMO_CATALOGUE: 'true' }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant as MerchantConfig, { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  const app = createApp(config, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const admin = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const buyer = { Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' })).body.token}` };
  const cats = (await request(app).get('/api/categories').set(admin)).body.data as Array<{ id: string; name: string; image: string }>;
  return { app, admin, buyer, cats };
}

describe('hero collections on Home', () => {
  it('the owner picks up to four, in order; buyers read them on the collections list', async () => {
    const { app, admin, buyer, cats } = await build();
    const ids = [cats[2].id, cats[0].id, cats[1].id];
    expect((await request(app).put('/api/hero-collections').set(admin).send({ ids })).status).toBe(200);
    const list = (await request(app).get('/api/categories').set(buyer)).body.data as Array<{ id: string; heroOrder: number | null }>;
    expect(list.find((c) => c.id === cats[2].id)!.heroOrder).toBe(0);
    expect(list.find((c) => c.id === cats[0].id)!.heroOrder).toBe(1);
    expect(list.find((c) => c.id === cats[1].id)!.heroOrder).toBe(2);
    expect(list.find((c) => c.id === cats[3].id)!.heroOrder ?? null).toBeNull();
  });

  it('a new choice replaces the old one, an empty list clears it, and a rename keeps it', async () => {
    const { app, admin, cats } = await build();
    await request(app).put('/api/hero-collections').set(admin).send({ ids: [cats[0].id, cats[1].id] });
    await request(app).put('/api/hero-collections').set(admin).send({ ids: [cats[1].id] });
    let list = (await request(app).get('/api/categories').set(admin)).body.data as Array<{ id: string; heroOrder: number | null }>;
    expect(list.find((c) => c.id === cats[0].id)!.heroOrder ?? null).toBeNull();
    expect(list.find((c) => c.id === cats[1].id)!.heroOrder).toBe(0);
    const renamed = await request(app).put(`/api/categories/${cats[1].id}`).set(admin).send({ tag: 'Rings', name: 'Renamed Hero', image: cats[1].image });
    expect(renamed.status).toBe(200);
    list = (await request(app).get('/api/categories').set(admin)).body.data;
    expect(list.find((c) => c.id === cats[1].id)!.heroOrder).toBe(0);
    await request(app).put('/api/hero-collections').set(admin).send({ ids: [] });
    list = (await request(app).get('/api/categories').set(admin)).body.data;
    expect(list.every((c) => c.heroOrder == null)).toBe(true);
  });

  it('is limited to four, needs real collections, an admin, and is audited', async () => {
    const { app, admin, buyer, cats } = await build();
    expect((await request(app).put('/api/hero-collections').set(admin).send({ ids: cats.slice(0, 5).map((c) => c.id) })).status).toBe(400);
    expect((await request(app).put('/api/hero-collections').set(admin).send({ ids: ['cat-nope'] })).status).toBe(404);
    expect((await request(app).put('/api/hero-collections').set(admin).send({ ids: [cats[0].id, cats[0].id] })).status).toBe(400);
    expect((await request(app).put('/api/hero-collections').set(buyer).send({ ids: [] })).status).toBe(403);
    expect((await request(app).put('/api/hero-collections').send({ ids: [] })).status).toBe(401);
    await request(app).put('/api/hero-collections').set(admin).send({ ids: [cats[0].id] });
    const logs = (await request(app).get('/api/admin/audit-logs').set(admin)).body;
    expect(JSON.stringify(logs)).toContain('HERO_COLLECTIONS_UPDATED');
  });
});

describe('collection tags', () => {
  it('requires a known tag on every new collection and when editing, and lists a guessed tag for older ones', async () => {
    const { app, admin } = await build();
    const img = 'https://example.com/c.jpg';
    expect((await request(app).post('/api/categories').set(admin).send({ name: 'No Tag Line', image: img })).status).toBe(400);
    expect((await request(app).post('/api/categories').set(admin).send({ name: 'Bad Tag', tag: 'Gadgets', image: img })).status).toBe(400);
    const ok = await request(app).post('/api/categories').set(admin).send({ name: 'Solitaire Rings', tag: 'Rings', image: img });
    expect(ok.status).toBe(201);
    expect(ok.body.data.tag).toBe('Rings');
    expect((await request(app).put(`/api/categories/${ok.body.data.id}`).set(admin).send({ name: 'Solitaire Rings', image: img })).status).toBe(400);
    const list = (await request(app).get('/api/categories').set(admin)).body.data;
    expect(list.every((c: any) => typeof c.tag === 'string')).toBe(true);
  });
});
