import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { scopeStore } from '../server/tenancy';
import { caratOf, cleanSpec, countText, ctText, groupCt, totalsOf } from '../shared/stoneSpec';

const analyse = vi.fn();
vi.mock('../server/aiSpec', async (orig) => ({ ...(await orig<typeof import('../server/aiSpec')>()), analyseStones: (...a: unknown[]) => analyse(...a) }));

describe('stone maths', () => {
  it('a 6.5 mm round is about one carat and weight grows with the cube', () => {
    expect(caratOf(6.5)).toBeCloseTo(1.016, 2);
    expect(caratOf(1.3)).toBeCloseTo(0.0081, 3);
    expect(caratOf(3)).toBeCloseTo(0.1, 1);
  });
  it('totals the groups as a range', () => {
    const g = { name: 'Pavé', setting: 'Pavé', shape: 'Round', countMin: 50, countMax: 60, mmMin: 1.2, mmMax: 1.4 };
    const c = groupCt(g);
    expect(c.min).toBeCloseTo(50 * caratOf(1.2), 6);
    expect(c.max).toBeCloseTo(60 * caratOf(1.4), 6);
    const t = totalsOf([g, { ...g, countMin: 1, countMax: 1, mmMin: 3, mmMax: 3 }]);
    expect(t.countMin).toBe(51);
    expect(t.countMax).toBe(61);
    expect(countText(50, 50)).toBe('50');
    expect(countText(50, 60)).toBe('50–60');
    expect(ctText(0.3, 0.3)).toBe('0.30');
    expect(ctText(0.001, 0.004)).toBe('< 0.01');
  });
  it('cleans whatever the model sent: bounds, order, junk', () => {
    const s = cleanSpec({ pieceType: ' Necklace ', features: ['a', '', 'b', 'c', 'd', 'e', 'f'], groups: [{ name: 'X', countMin: 9, countMax: 3, mmMin: 2, mmMax: 1, shape: 'Round', setting: 'Pavé' }, { name: 'none', countMin: 0, countMax: 0 }, 'bad'] });
    expect(s.pieceType).toBe('Necklace');
    expect(s.features).toHaveLength(5);
    expect(s.groups).toEqual([{ name: 'X', setting: 'Pavé', shape: 'Round', countMin: 3, countMax: 9, mmMin: 1, mmMax: 2 }]);
    expect(cleanSpec(null)).toEqual({ pieceType: '', metal: '', features: [], groups: [] });
  });
});

describe('POST /api/admin/photos/spec', () => {
  const KEY = 'test-master-provisioning-key';
  let app: ReturnType<typeof createApp>;
  let auth: Record<string, string>;
  beforeEach(async () => {
    const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    const root = new MemoryStore();
    await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
    app = createApp(config, root, new MemoryBlobs());
    const r = await request(app).post('/api/auth/admin/register').send({ email: 'owner@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
    auth = { Authorization: `Bearer ${r.body.sessionToken}` };
    process.env.AI_RENDER_ENABLED = 'true';
    analyse.mockReset();
  });
  afterEach(() => { delete process.env.AI_RENDER_ENABLED; delete process.env.AI_SPEC_DAILY_CAP; });
  const upload = async () => (await request(app).post('/api/admin/photos').set(auth).set('Content-Type', 'image/png').send(await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer())).body.data.ref as string;

  it('returns the stones for an uploaded photo, passing the design hints; needs an admin', async () => {
    const ref = await upload();
    analyse.mockResolvedValue({ pieceType: 'Necklace', metal: 'Yellow gold', features: [], groups: [] });
    expect((await request(app).post('/api/admin/photos/spec').send({ ref })).status).toBe(401);
    const r = await request(app).post('/api/admin/photos/spec').set(auth).send({ ref, title: 'Peacock set', category: 'Sets', grossWt: 12.5 });
    expect(r.status).toBe(200);
    expect(r.body.data.pieceType).toBe('Necklace');
    expect(analyse.mock.calls[0][2]).toEqual({ title: 'Peacock set', category: 'Sets', grossWt: 12.5 });
  });
  it('refuses a photo that is not ours, stops at the daily cap, and reports a provider failure as 502', async () => {
    expect((await request(app).post('/api/admin/photos/spec').set(auth).send({ ref: 'https://x.test/a.jpg' })).status).toBe(400);
    const ref = await upload();
    process.env.AI_SPEC_DAILY_CAP = '1';
    analyse.mockRejectedValue(new Error('Google returned 500'));
    const bad = await request(app).post('/api/admin/photos/spec').set(auth).send({ ref });
    expect(bad.status).toBe(502);
    expect((await request(app).post('/api/admin/photos/spec').set(auth).send({ ref })).status).toBe(429);
  });
  it('is off when AI is switched off', async () => {
    delete process.env.AI_RENDER_ENABLED;
    expect((await request(app).post('/api/admin/photos/spec').set(auth).send({ ref: 'media:' + 'a'.repeat(32) + '.png' })).status).toBe(503);
  });
});
