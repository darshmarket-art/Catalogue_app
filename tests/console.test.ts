import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord } from '../server/tenancy';

const AUD = '/projects/1/global/backendServices/2';
const pair = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const good = pair();
const evil = pair();
const pem = (k: crypto.KeyObject) => k.export({ type: 'spki', format: 'pem' }) as string;
const iap = (key: crypto.KeyObject, email: string, aud = AUD) =>
  jwt.sign({ email }, key.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'ES256', keyid: 'k1', audience: aud, issuer: 'https://cloud.google.com/iap', expiresIn: 300 });

let app: ReturnType<typeof createApp>;
let root: MemoryStore;
const as = (email = 'boss@antarixs.com') => ({ 'x-goog-iap-jwt-assertion': iap(good.privateKey, email) });
const api = '/api/v1/console';

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pem(good.publicKey) }) }));
  process.env.CONSOLE_ADMINS = 'boss@antarixs.com, other@antarixs.com';
  process.env.IAP_AUDIENCE = AUD;
  delete process.env.CONSOLE_DEV_OPEN;
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48) }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();
  await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'basic' }));
  app = createApp(config, root, new MemoryBlobs());
  await request(app).get('/api/config'); // seeds the default store record
});
afterEach(() => vi.unstubAllGlobals());

describe('console auth', () => {
  it('refuses no header, forged, wrong audience and non-listed email', async () => {
    expect((await request(app).get(`${api}/stores`)).status).toBe(401);
    expect((await request(app).get(`${api}/stores`).set('x-goog-iap-jwt-assertion', iap(evil.privateKey, 'boss@antarixs.com'))).status).toBe(401);
    expect((await request(app).get(`${api}/stores`).set('x-goog-iap-jwt-assertion', iap(good.privateKey, 'boss@antarixs.com', 'other'))).status).toBe(401);
    expect((await request(app).get(`${api}/stores`).set(as('stranger@gmail.com'))).status).toBe(403);
  });
  it('header-less access only with CONSOLE_DEV_OPEN', async () => {
    process.env.CONSOLE_DEV_OPEN = 'true';
    expect((await request(app).get(`${api}/stores`)).status).toBe(200);
    expect((await request(app).get(`${api}/stores`).set('x-goog-iap-jwt-assertion', 'junk')).status).toBe(401);
  });
  it('the master key is not accepted', async () => {
    expect((await request(app).get(`${api}/stores`).set('x-master-provisioning-key', 'anything')).status).toBe(401);
  });
});

describe('console', () => {
  it('lists with counts and filters', async () => {
    const all = (await request(app).get(`${api}/stores`).set(as())).body.data;
    expect(all.map((s: any) => s.id).sort()).toEqual(['bhakti', 'example']);
    const ex = all.find((s: any) => s.id === 'example');
    expect(ex).toMatchObject({ plan: 'basic', effectivePlan: 'basic', status: 'active', buyers: 0, photos: 0 });
    expect((await request(app).get(`${api}/stores?plan=founder`).set(as())).body.data).toHaveLength(1);
    expect((await request(app).get(`${api}/stores?q=EXAMPLE`).set(as())).body.data).toHaveLength(1);
    expect((await request(app).get(`${api}/stores?status=suspended`).set(as())).body.data).toHaveLength(0);
  });

  it('actions change the store and are audited', async () => {
    const post = (p: string, b: object = {}) => request(app).post(`${api}/stores/example/${p}`).set(as()).send(b);
    expect((await post('plan', { plan: 'pro' })).body.data.plan).toBe('pro');
    expect((await post('plan', { plan: 'gold' })).status).toBe(400);
    const t = (await post('trial', { days: 14 })).body.data.trialEndsAt;
    expect(Date.parse(t)).toBeGreaterThan(Date.now() + 13 * 86400000);
    expect((await post('own-app', { ownApp: true })).body.data.ownApp).toBe(true);
    expect((await post('suspend')).body.data.status).toBe('suspended');
    expect((await post('unsuspend')).body.data.status).toBe('active');
    const log = (await request(app).get(`${api}/stores/example`).set(as())).body.data.audit;
    expect(log.map((a: any) => a.action).sort()).toEqual(['own-app', 'plan', 'suspend', 'trial', 'unsuspend']);
    expect(log[0]).toMatchObject({ who: 'boss@antarixs.com', storeId: 'example' });
    expect((await request(app).post(`${api}/stores/bhakti/plan`).set(as()).send({ plan: 'basic' })).status).toBe(400);
    expect((await request(app).post(`${api}/stores/nope/suspend`).set(as()).send({})).status).toBe(404);
  });

  it('a suspended store answers 403 through the store layer', async () => {
    expect((await request(app).get('/api/config').set('X-Store', 'example')).status).toBe(200);
    await request(app).post(`${api}/stores/example/suspend`).set(as()).send({});
    expect((await request(app).get('/api/config').set('X-Store', 'example')).status).toBe(403);
  });
});
