import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord } from '../server/tenancy';
import { STATIC_CODE, otpBuyer } from './buyerAuth';

const MASTER = 'test-master-provisioning-key';
const A = { 'X-Store': 'example' };
const B = { 'X-Store': 'other' };
let app: ReturnType<typeof createApp>;
let authA: Record<string, string>;
let authB: Record<string, string>;
let buyerA: Record<string, string>;
let tags: string[];
const png = () => sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 120, b: 40 } } }).png().toBuffer();

beforeEach(async () => {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: MASTER }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro' }));
  await root.set('stores', 'other', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro', id: 'other', subdomain: 'other', merchant: { ...loadMerchant({ MERCHANT: 'example' }), id: 'other' } }));
  app = createApp(config, root, new MemoryBlobs());
  const reg = async (h: Record<string, string>) => ({ Authorization: `Bearer ${(await request(app).post('/api/auth/admin/register').set(h).send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER })).body.sessionToken}` });
  authA = { ...A, ...(await reg(A)) };
  authB = { ...B, ...(await reg(B)) };
  buyerA = { ...A, Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' }, A)).body.token}` };
  tags = (await request(app).get('/api/tags').set(authA)).body.data;
});

const upload = async (h = authA) => (await request(app).post('/api/admin/photos').set(h).set('Content-Type', 'image/png').send(await png())).body.data.ref as string;
const covers = async (h: Record<string, string> = buyerA) => (await request(app).get('/api/tag-covers').set(h)).body.data as Record<string, string>;
const setCover = (tag: string, ref: string, h = authA) => request(app).put(`/api/tag-covers/${encodeURIComponent(tag)}`).set(h).send({ ref });

describe('tag covers', () => {
  it('the owner sets, changes and clears a cover; buyers read it as a signed link', async () => {
    const [t] = tags;
    expect(await covers()).toEqual({});
    const ref = await upload();
    const res = await setCover(t, ref);
    expect(res.status).toBe(200);
    const map = await covers();
    expect(Object.keys(map)).toEqual([t]);
    expect(map[t]).toMatch(new RegExp(`^/media/${ref.slice(6)}\\?e=\\d+&s=`));
    expect((await request(app).get(map[t]).set(A)).status).toBe(200);
    const ref2 = await upload();
    await setCover(t, ref2);
    expect((await covers())[t]).toContain(ref2.slice(6));
    expect((await request(app).delete(`/api/tag-covers/${encodeURIComponent(t)}`).set(authA)).status).toBe(200);
    expect(await covers()).toEqual({});
  });

  it('rename carries the cover; delete drops it (photo blob kept)', async () => {
    const [t, u] = tags;
    const ref = await upload();
    await setCover(t, ref);
    expect((await request(app).put(`/api/tags/${encodeURIComponent(t)}`).set(authA).send({ name: 'Renamed' })).status).toBe(200);
    expect(Object.keys(await covers())).toEqual(['Renamed']);
    const del = await request(app).delete(`/api/tags/Renamed?moveTo=${encodeURIComponent(u)}`).set(authA);
    expect(del.status).toBe(200);
    expect(await covers()).toEqual({});
    // the photo is still in storage: it can be set again
    expect((await setCover(u, ref)).status).toBe(200);
  });

  it('writes need an admin, a real tag and a photo uploaded to this store', async () => {
    const [t] = tags;
    const ref = await upload();
    expect((await setCover(t, ref, buyerA)).status).toBe(403);
    expect((await request(app).put(`/api/tag-covers/${t}`).set(A).send({ ref })).status).toBe(401);
    expect((await request(app).delete(`/api/tag-covers/${t}`).set(buyerA)).status).toBe(403);
    expect((await setCover('No such tag', ref)).status).toBe(404);
    expect((await setCover(t, 'https://example.com/x.jpg')).status).toBe(400);
    expect((await setCover(t, 'media:' + '0'.repeat(32) + '.png')).status).toBe(400);
    expect((await setCover(t, ref, authB)).status).toBe(400); // store A's photo is not in store B
    expect(await covers()).toEqual({});
  });

  it('each store keeps its own covers', async () => {
    const [t] = tags;
    await setCover(t, await upload());
    expect(Object.keys(await covers())).toEqual([t]);
    expect(await covers(authB)).toEqual({});
  });
});
