import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { scopeStore } from '../server/tenancy';
import { KEEP_IDENTICAL, RENDER_PROMPT, STYLES } from '../server/aiRender';
import { placementForTag, STYLE_IDS } from '../shared/aiStyles';
import { acceptRender, enhanceBlocked, swapRender } from '../src/aiRender';

// The provider is mocked: no test ever calls Google.
const renderStudio = vi.fn();
vi.mock('../server/aiRender', async (orig) => ({ ...(await orig<typeof import('../server/aiRender')>()), renderStudio: (...a: unknown[]) => renderStudio(...a) }));

const MASTER_KEY = 'test-master-provisioning-key';
type App = ReturnType<typeof createApp>;
let app: App;
let blobs: MemoryBlobs;
let auth: Record<string, string>;

const png = (r: number) => sharp({ create: { width: 40, height: 40, channels: 3, background: { r, g: 120, b: 40 } } }).png().toBuffer();

beforeEach(async () => {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: MASTER_KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  blobs = new MemoryBlobs();
  await seedDemoCatalogue(scopeStore(root, 'bhakti'), 'bhakti');
  app = createApp(config, root, blobs);
  const res = await request(app).post('/api/auth/admin/register').send({ email: 'owner@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER_KEY });
  auth = { Authorization: `Bearer ${res.body.sessionToken}` };
  process.env.AI_RENDER_ENABLED = 'true';
  process.env.AI_RENDER_MONTHLY_CAP = '2';
  renderStudio.mockReset();
});
afterEach(() => {
  delete process.env.AI_RENDER_ENABLED;
  delete process.env.AI_RENDER_MONTHLY_CAP;
});

const upload = async () => (await request(app).post('/api/admin/photos').set(auth).set('Content-Type', 'image/png').send(await png(10))).body.data.ref as string;
const render = (ref: string) => request(app).post('/api/admin/photos/render').set(auth).send({ ref });
const stored = (ref: string) => blobs.get(`stores/bhakti/photos/${ref.slice(6)}`).then((b) => b ?? blobs.get(`photos/${ref.slice(6)}`));

describe('AI render', () => {
  it('toggle on: stores a new rendered photo and keeps the original untouched', async () => {
    const ref = await upload();
    const before = (await stored(ref))!.data;
    renderStudio.mockResolvedValue({ data: await png(200), mimeType: 'image/png' });
    const res = await render(ref);
    expect(res.status).toBe(201);
    expect(res.body.data.ref).toMatch(/^media:[a-f0-9]{32}\.png$/);
    expect(res.body.data.ref).not.toBe(ref);
    expect(res.body.data.original.ref).toBe(ref);
    expect(res.body.data.url).toContain('/media/');
    expect((await stored(ref))!.data.equals(before)).toBe(true);
    expect(await stored(res.body.data.ref)).toBeTruthy();
    expect(renderStudio).toHaveBeenCalledTimes(1);
  });

  it('toggle off (server switch): no provider call, and the reason is given', async () => {
    delete process.env.AI_RENDER_ENABLED;
    const res = await render(await upload());
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/switched off.*original photo is used/);
    expect(renderStudio).not.toHaveBeenCalled();
  });

  it('stops at the monthly cap per store', async () => {
    renderStudio.mockResolvedValue({ data: await png(200), mimeType: 'image/png' });
    const ref = await upload();
    expect((await render(ref)).status).toBe(201);
    expect((await render(ref)).status).toBe(201);
    const res = await render(ref);
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/used its 2 AI renders/);
    expect(renderStudio).toHaveBeenCalledTimes(2);
  });

  it('provider failure: 502 with a reason, original still there', async () => {
    const ref = await upload();
    renderStudio.mockRejectedValue(new Error('the AI declined this photo'));
    const res = await render(ref);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/declined.*original photo is used/);
    expect(await stored(ref)).toBeTruthy();
  });

  it('only renders photos uploaded here, and only for admins', async () => {
    expect((await render('https://example.com/a.jpg')).status).toBe(400);
    expect((await request(app).post('/api/admin/photos/render').send({ ref: 'media:' + 'a'.repeat(32) + '.jpg' })).status).toBe(401);
  });

  it('revert: swapping goes to the original and back without losing either', () => {
    const rendered = { ref: 'media:r', url: '/r', original: { ref: 'media:o', url: '/o' } };
    const reverted = swapRender(rendered);
    expect(reverted).toEqual({ ref: 'media:o', url: '/o', render: { ref: 'media:r', url: '/r' } });
    expect(swapRender(reverted)).toEqual(rendered);
    expect(swapRender({ ref: 'media:x', url: '/x' })).toEqual({ ref: 'media:x', url: '/x' });
  });
});

describe('Enhance to CAD render (existing photos)', () => {
  const status = () => request(app).get('/api/admin/photos/render').set(auth);

  it('status says on/off and renders left; counts renders already used', async () => {
    expect((await status()).body.data).toMatchObject({ enabled: true, cap: 2, used: 0, left: 2 });
    renderStudio.mockResolvedValue({ data: await png(200), mimeType: 'image/png' });
    await render(await upload());
    expect((await status()).body.data.left).toBe(1);
    delete process.env.AI_RENDER_ENABLED;
    expect((await status()).body.data.enabled).toBe(false);
    expect((await request(app).get('/api/admin/photos/render')).status).toBe(401);
  });

  it('an existing photo given by its /media/ link renders to a new file; the catalogue and the original are untouched', async () => {
    const ref = await upload();
    const link = `/media/${ref.slice(6)}?exp=1&sig=x`; // what an edit form holds for a saved photo
    const before = (await stored(ref))!.data;
    const catalogue = JSON.stringify((await request(app).get('/api/products')).body);
    renderStudio.mockResolvedValue({ data: await png(200), mimeType: 'image/png' });
    const res = await request(app).post('/api/admin/photos/render').set(auth).send({ ref: link });
    expect(res.status).toBe(201);
    expect(res.body.data.original.ref).toBe(ref);
    expect((await stored(ref))!.data.equals(before)).toBe(true);
    expect((await blobs.get(`stores/bhakti/renders/${res.body.data.ref.slice(6)}`)) ?? (await blobs.get(`renders/${res.body.data.ref.slice(6)}`))).toBeTruthy();
    expect(JSON.stringify((await request(app).get('/api/products')).body)).toBe(catalogue);
  });

  it('accepting swaps the reference and keeps the original for revert; not accepting changes nothing', () => {
    const form = [{ ref: '/media/a.jpg', url: '/media/a.jpg' }, { ref: '/media/b.jpg', url: '/media/b.jpg' }];
    const out = { ref: 'media:r', url: '/r', original: { ref: 'media:a', url: '/media/a.jpg' } };
    const snapshot = JSON.stringify(form);
    expect(JSON.stringify(form)).toBe(snapshot); // keep / discard / cancel never call acceptRender
    const accepted = acceptRender(form, '/media/a.jpg', out);
    expect(accepted[0]).toEqual({ ref: 'media:r', url: '/r', original: out.original });
    expect(accepted[1]).toBe(form[1]);
    expect(JSON.stringify(form)).toBe(snapshot);
    const reverted = swapRender(accepted[0]);
    expect(reverted.ref).toBe('media:a');
    expect(reverted.render?.ref).toBe('media:r');
    expect(acceptRender(form, '/media/zzz.jpg', out)).toEqual(form);
  });

  it('says why the button is unavailable', () => {
    expect(enhanceBlocked(null)).toBeNull();
    expect(enhanceBlocked({ enabled: true, cap: 5, left: 3 })).toBeNull();
    expect(enhanceBlocked({ enabled: false, cap: 5, left: 3 })).toMatch(/switched off/);
    expect(enhanceBlocked({ enabled: true, cap: 5, left: 0 })).toMatch(/used its 5 AI renders/);
  });
});

describe('AI render styles', () => {
  const withStyle = (ref: string, body: Record<string, unknown>) => request(app).post('/api/admin/photos/render').set(auth).send({ ref, ...body });
  const ok = async () => renderStudio.mockResolvedValue({ data: await png(200), mimeType: 'image/png' });

  it('every style prompt keeps the piece identical; on-model carries the placement', () => {
    for (const id of STYLE_IDS) expect(STYLES[id]('finger')).toContain(KEEP_IDENTICAL);
    expect(STYLES.cad()).toBe(RENDER_PROMPT);
    expect(STYLES['on-model']('ear')).toMatch(/ear in profile/);
    expect(STYLES['on-model']('wrist')).toMatch(/wrist and forearm/);
    expect(STYLES['on-model']('ear')).toMatch(/FULL contrast/);
  });

  it('server validates the style id and placement; unknown is 400 and costs nothing', async () => {
    await ok();
    const ref = await upload();
    expect((await withStyle(ref, { style: 'nope' })).status).toBe(400);
    expect((await withStyle(ref, { style: 'on-model' })).status).toBe(400);
    expect((await withStyle(ref, { style: 'on-model', placement: 'knee' })).status).toBe(400);
    expect(renderStudio).not.toHaveBeenCalled();
    expect((await request(app).get('/api/admin/photos/render').set(auth)).body.data.used).toBe(0);
    const res = await withStyle(ref, { style: 'on-model', placement: 'neck' });
    expect(res.status).toBe(201);
    expect(res.body.data.style).toBe('on-model');
    expect(renderStudio.mock.calls[0][2]).toMatch(/neck and collarbone/);
    const file = res.body.data.ref.slice(6);
    const rec = JSON.parse(((await blobs.get(`stores/bhakti/renders/${file}`)) ?? (await blobs.get(`renders/${file}`)))!.data.toString());
    expect(rec).toEqual({ original: ref, style: 'on-model', placement: 'neck' });
  });

  it('no style sent means cad; AI_RENDER_STYLES hides the others; each render counts once', async () => {
    await ok();
    const ref = await upload();
    expect((await render(ref)).body.data.style).toBe('cad');
    process.env.AI_RENDER_STYLES = 'cad,silk';
    try {
      expect((await request(app).get('/api/admin/photos/render').set(auth)).body.data.styles).toEqual(['cad', 'silk']);
      expect((await withStyle(ref, { style: 'macro' })).status).toBe(400);
      expect((await withStyle(ref, { style: 'silk' })).status).toBe(201);
      expect((await withStyle(ref, { style: 'silk' })).status).toBe(402); // cap is 2 and both renders counted
    } finally {
      delete process.env.AI_RENDER_STYLES;
    }
  });

  it('collection tag to placement, with a fallback for tags with no body part', () => {
    const want: Array<[string, string | null]> = [
      ['Rings', 'finger'], ['Necklaces', 'neck'], ['Pendants', 'neck'], ['Chains', 'neck'], ['Earrings', 'ear'], ['Bangles', 'wrist'], ['Bracelets', 'wrist'],
      ['Mangalsutra', 'neck'], ['Haar', 'neck'], ['Jhumka', 'ear'], ['Kada', 'wrist'], ['Nose Pin', 'nose'], ['Anklets', 'ankle'], ['Payal', 'ankle'], ['Maang Tikka', 'forehead'],
      ['Brooch', null], ['Coins & Bars', null], ['Sets', null], ['Other', null], ['Something new', null]
    ];
    for (const [tag, p] of want) expect([tag, placementForTag(tag)]).toEqual([tag, p]);
    expect(placementForTag(undefined)).toBeNull();
  });
});
