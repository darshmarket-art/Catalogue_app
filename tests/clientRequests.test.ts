import { describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { seedDemoCatalogue } from '../server/seed';
import type { MerchantConfig } from '../server/merchant';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const KEY = 'test-master-provisioning-key';
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function build(access: 'login' | 'public' = 'login') {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY, SEED_DEMO_CATALOGUE: 'true' }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord({ ...(config.merchant as MerchantConfig), catalogueAccess: access }, { plan: 'pro' }));
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  const app = createApp(config, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const admin = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const buyer = { Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers', ownerName: 'Asha' })).body.token}` };
  const products = (await request(app).get('/api/products?limit=5').set(buyer)).body.data as Array<{ id: string; sku: string; title: string }>;
  return { app, admin, buyer, products };
}

describe('client requests', () => {
  it('a signed-in buyer books a viewing with pieces; the owner sees it, counts it and confirms it', async () => {
    const { app, admin, buyer, products } = await build();
    const sent = await request(app).post('/api/requests').set(buyer).send({ kind: 'viewing', where: 'boutique', date: day(2), time: '16:00', occasion: 'Wedding', skus: [products[0].sku, products[1].sku] });
    expect(sent.status).toBe(201);
    expect((await request(app).get('/api/admin/summary').set(admin)).body.data.requestsWaiting).toBe(1);
    const list = (await request(app).get('/api/admin/requests').set(admin)).body.data;
    expect(list[0]).toMatchObject({ kind: 'viewing', status: 'new', where: 'boutique', time: '16:00', clientPhone: '9820000001', clientName: 'Asha', firmName: 'Test Jewellers', guest: false });
    expect(list[0].pieces).toEqual([{ sku: products[0].sku, title: products[0].title }, { sku: products[1].sku, title: products[1].title }]);
    const put = await request(app).put(`/api/admin/requests/${list[0].id}`).set(admin).send({ status: 'confirmed', adminNote: 'Priya will host' });
    expect(put.body.data.status).toBe('confirmed');
    expect((await request(app).get('/api/admin/summary').set(admin)).body.data.requestsWaiting).toBe(0);
    const mine = (await request(app).get('/api/requests/mine').set(buyer)).body.data;
    expect(mine[0]).toMatchObject({ status: 'confirmed', kind: 'viewing' });
    expect(mine[0].adminNote).toBeUndefined(); // the owner's private note stays with the owner
  });

  it('validates: unknown piece, a day in the past, a bad status; buyers cannot read the owner list', async () => {
    const { app, admin, buyer, products } = await build();
    expect((await request(app).post('/api/requests').set(buyer).send({ kind: 'viewing', where: 'video', date: day(1), time: '11:00', skus: ['NOPE'] })).status).toBe(400);
    expect((await request(app).post('/api/requests').set(buyer).send({ kind: 'viewing', where: 'video', date: day(-5), time: '11:00' })).status).toBe(400);
    expect((await request(app).post('/api/requests').set(buyer).send({ kind: 'party' })).status).toBe(400);
    const ok = await request(app).post('/api/requests').set(buyer).send({ kind: 'bespoke', piece: 'Necklace', metal: 'Yellow gold', stones: ['Diamonds', 'Emeralds'], occasion: 'Wedding', skus: [products[0].sku] });
    expect(ok.status).toBe(201);
    expect((await request(app).put(`/api/admin/requests/${ok.body.data.id}`).set(admin).send({ status: 'lost' })).status).toBe(400);
    expect((await request(app).put('/api/admin/requests/req-nope').set(admin).send({ status: 'done' })).status).toBe(404);
    expect((await request(app).get('/api/admin/requests').set(buyer)).status).toBe(403);
    expect((await request(app).get('/api/requests/mine')).status).toBe(401);
  });

  it('a reserve holds one piece for 48 hours and cannot be doubled', async () => {
    const { app, buyer, products } = await build();
    const r = await request(app).post('/api/requests').set(buyer).send({ kind: 'reserve', skus: [products[0].sku] });
    expect(r.status).toBe(201);
    const hours = (Date.parse(r.body.data.expiresAt) - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(47.9);
    expect(hours).toBeLessThan(48.1);
    expect((await request(app).post('/api/requests').set(buyer).send({ kind: 'reserve', skus: [products[0].sku] })).status).toBe(409);
    expect((await request(app).post('/api/requests').set(buyer).send({ kind: 'reserve', skus: [products[1].sku] })).status).toBe(201);
  });

  it('visitors: refused on a login-only store; on a public store they give a name and phone; a bot is ignored', async () => {
    const closed = await build('login');
    expect((await request(closed.app).post('/api/requests').send({ kind: 'bespoke', piece: 'Ring', name: 'Guest', phone: '9811111111' })).status).toBe(401);
    const open = await build('public');
    expect((await request(open.app).post('/api/requests').send({ kind: 'bespoke', piece: 'Ring' })).status).toBe(400);
    expect((await request(open.app).post('/api/requests').send({ kind: 'bespoke', piece: 'Ring', name: 'Guest', phone: '98111 11111' })).status).toBe(201);
    expect((await request(open.app).post('/api/requests').send({ kind: 'bespoke', piece: 'Ring', name: 'Bot', phone: '9811111112', website: 'http://x' })).status).toBe(201);
    const list = (await request(open.app).get('/api/admin/requests').set(open.admin)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ guest: true, clientName: 'Guest', firmName: null });
  });
});

describe('shared selections', () => {
  it('a buyer shares pieces as one link; anyone with it sees only those pieces, weights only if chosen', async () => {
    const { app, buyer, products } = await build();
    const made = await request(app).post('/api/shares').set(buyer).send({ skus: [products[0].sku, products[1].sku], note: 'For the wedding' });
    expect(made.status).toBe(201);
    expect(made.body.data.token).toMatch(/^[a-f0-9]{32}$/);
    const open = await request(app).get(`/api/shares/${made.body.data.token}`); // no sign-in
    expect(open.status).toBe(200);
    expect(open.body.data).toMatchObject({ by: 'Asha', note: 'For the wedding', showWeights: false });
    expect(open.body.data.pieces.map((p: any) => p.sku)).toEqual([products[0].sku, products[1].sku]);
    expect(open.body.data.pieces[0].netWt).toBeUndefined();
    expect(open.body.data.pieces[0].image).toBeTruthy();
    const withWt = await request(app).post('/api/shares').set(buyer).send({ skus: [products[0].sku], showWeights: true });
    expect((await request(app).get(`/api/shares/${withWt.body.data.token}`)).body.data.pieces[0].netWt).toBeGreaterThan(0);
  });
  it('needs a buyer to make one; a wrong or made-up link opens nothing', async () => {
    const { app, buyer, products } = await build();
    expect((await request(app).post('/api/shares').send({ skus: [products[0].sku] })).status).toBe(401);
    expect((await request(app).post('/api/shares').set(buyer).send({ skus: ['NOPE'] })).status).toBe(400);
    expect((await request(app).post('/api/shares').set(buyer).send({ skus: [] })).status).toBe(400);
    expect((await request(app).get('/api/shares/' + 'a'.repeat(32))).status).toBe(404);
    expect((await request(app).get('/api/shares/..%2Fproducts')).status).toBe(404);
  });
});

describe('piece and collection details, and the store look', () => {
  it('a piece keeps its story, pairs and certificate; the certificate comes back as a private link', async () => {
    const { app, admin, buyer, products } = await build();
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer();
    const up = async () => (await request(app).post('/api/admin/photos').set(admin).set('Content-Type', 'image/png').send(png)).body.data.ref as string;
    const [photo, cert] = [await up(), await up()];
    const cats = (await request(app).get('/api/categories').set(admin)).body.data;
    const made = await request(app).post('/api/products').set(admin).send({ title: 'Feather Suite', category: cats[0].name, purity: '22K 916', grossWt: 14.285, images: [photo], story: 'A feather is all curve.', pairs: [products[0].sku, products[0].sku, products[1].sku], certificate: cert });
    expect(made.status).toBe(201);
    expect(made.body.data).toMatchObject({ story: 'A feather is all curve.', pairs: [products[0].sku, products[1].sku] });
    expect(made.body.data.certificate).toMatch(/^\/media\/[a-f0-9]{32}\.png\?/);
    const seen = (await request(app).get(`/api/products/by-sku?skus=${made.body.data.sku}`).set(buyer)).body.data[0];
    expect(seen.story).toBe('A feather is all curve.');
    // saving the form again with the link it was given keeps the certificate
    const again = await request(app).put(`/api/products/${made.body.data.id}`).set(admin).send({ title: 'Feather Suite', category: cats[0].name, purity: '22K 916', grossWt: 14.285, images: [made.body.data.images[0]], certificate: made.body.data.certificate });
    expect(again.status).toBe(200);
    expect(again.body.data.certificate).toMatch(/^\/media\//);
    expect(again.body.data.story).toBeUndefined();
  });
  it('the owner sets the look; only known looks are taken', async () => {
    const { app, admin, buyer } = await build();
    expect((await request(app).put('/api/admin/look').set(admin).send({ look: 'noir' })).body.data.look).toBe('noir');
    expect((await request(app).put('/api/admin/look').set(admin).send({ look: 'neon' })).status).toBe(400);
    expect((await request(app).put('/api/admin/look').set(buyer).send({ look: 'noir' })).status).toBe(403);
  });
});
