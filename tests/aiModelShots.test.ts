import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { loadMerchant } from '../server/merchant';
import { newStoreRecord } from '../server/tenancy';
import { change, getWallet } from '../server/aiCredits';
import { BASE_PROMPTS, KEEP_IDENTICAL, STYLES } from '../server/aiRender';
import { recipeForTag, SHOT_OF } from '../shared/aiStyles';

// The provider is mocked: no test ever calls Google.
const renderStudio = vi.fn();
vi.mock('../server/aiRender', async (orig) => ({ ...(await orig<typeof import('../server/aiRender')>()), renderStudio: (...a: unknown[]) => renderStudio(...a) }));

const MASTER = 'test-master-provisioning-key';
const A = { 'X-Store': 'example' };
const B = { 'X-Store': 'other' };
let app: ReturnType<typeof createApp>;
let root: MemoryStore;
let authA: Record<string, string>;
let authB: Record<string, string>;
const png = (r = 10) => sharp({ create: { width: 40, height: 40, channels: 3, background: { r, g: 120, b: 40 } } }).png().toBuffer();

beforeEach(async () => {
  process.env.AI_RENDER_ENABLED = 'true';
  process.env.AI_RENDER_MONTHLY_CAP = '50';
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: MASTER }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  root = new MemoryStore();
  await root.set('stores', 'example', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro' }));
  await root.set('stores', 'other', newStoreRecord(loadMerchant({ MERCHANT: 'example' }), { plan: 'pro', id: 'other', subdomain: 'other', merchant: { ...loadMerchant({ MERCHANT: 'example' }), id: 'other' } }));
  app = createApp(config, root, new MemoryBlobs());
  const reg = async (h: Record<string, string>) => ({ Authorization: `Bearer ${(await request(app).post('/api/auth/admin/register').set(h).send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: MASTER })).body.sessionToken}` });
  authA = { ...A, ...(await reg(A)) };
  authB = { ...B, ...(await reg(B)) };
  renderStudio.mockReset();
  renderStudio.mockImplementation(async () => ({ data: await png(200), mimeType: 'image/png' }));
});
afterEach(() => { delete process.env.AI_RENDER_ENABLED; delete process.env.AI_RENDER_MONTHLY_CAP; });

const upload = async (h = authA) => (await request(app).post('/api/admin/photos').set(h).set('Content-Type', 'image/png').send(await png())).body.data.ref as string;
const post = (path: string, body: object, h = authA) => request(app).post(`/api/admin/photos/${path}`).set(h).send(body);
const fund = (n: number, storeId = 'example') => change(root, { storeId, kind: 'topup', amount: n, actor: 'test', note: 'test' });
const balance = async (storeId = 'example') => (await getWallet(root, storeId)).balance;
const shots = async (h = authA) => (await request(app).get('/api/admin/photos/render').set(h)).body.data.modelShots;
const makeBase = async (shot = 'ring-women', h = authA) => {
  const res = await post('render', { baseShot: shot }, h);
  expect(res.status).toBe(201);
  const ok = await post('model-shots', { shot, ref: res.body.data.ref }, h);
  expect(ok.status).toBe(200);
  return res.body.data.ref as string;
};

describe('model shots', () => {
  it('tag suggests the recipe; every recipe prompt names both images, the black background and the identical-piece block', () => {
    expect(recipeForTag('Necklaces')).toBe('black-necklace');
    expect(recipeForTag('Gold Rings')).toBe('ring-hand-women');
    expect(recipeForTag('Earrings')).toBeNull();
    for (const s of Object.keys(SHOT_OF) as Array<keyof typeof SHOT_OF>) {
      const p = STYLES[s]!();
      expect(p).toContain(KEEP_IDENTICAL);
      expect(p).toMatch(/IMAGE 1[\s\S]*IMAGE 2/);
      expect(p).toMatch(/PURE BLACK/);
    }
    for (const p of Object.values(BASE_PROMPTS)) expect(p).toMatch(/NO jewellery[\s\S]*pure black/);
  });

  it('a recipe without an approved base shot is refused (409) before any charge or provider call', async () => {
    await fund(50);
    const res = await post('render', { ref: await upload(), style: 'ring-hand-women' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: 'no-model-shot', shot: 'ring-women' });
    expect(renderStudio).not.toHaveBeenCalled();
    expect(await balance()).toBe(50);
  });

  it('base shot: text-only request at the normal price, approved by the owner, then listed', async () => {
    await fund(50);
    const ref = await makeBase('ring-women');
    expect(renderStudio).toHaveBeenCalledWith(null, '', BASE_PROMPTS['ring-women']);
    expect(await balance()).toBe(38);
    expect((await shots())['ring-women'].ref).toBe(ref);
    expect((await shots())['ring-men']).toBeNull();
  });

  it('recipe render sends TWO images: the base shot first, the product second; charged once', async () => {
    await fund(50);
    await makeBase('ring-men');
    const product = await upload();
    renderStudio.mockClear();
    const res = await post('render', { ref: product, style: 'ring-hand-men' });
    expect(res.status).toBe(201);
    expect(renderStudio).toHaveBeenCalledTimes(1);
    const [img1, mime1, prompt, extra] = renderStudio.mock.calls[0];
    expect(Buffer.isBuffer(img1)).toBe(true);
    expect(mime1).toBe('image/png');
    expect(prompt).toBe(STYLES['ring-hand-men']!());
    expect(extra).toHaveLength(1);
    const red = async (b: Buffer) => (await sharp(b).raw().toBuffer())[0];
    expect(await red(img1)).toBe(200); // image 1 = the approved base shot (the faked model returns red 200)
    expect(await red(extra[0].data)).toBe(10); // image 2 = the uploaded product photo
    expect(res.body.data.original.ref).toBe(product);
    expect(await balance()).toBe(50 - 12 - 12);
  });

  it('a failed recipe render refunds the credits', async () => {
    await fund(50);
    await makeBase('neck-women');
    renderStudio.mockRejectedValue(new Error('Google returned 503'));
    const res = await post('render', { ref: await upload(), style: 'black-necklace' });
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/credits were returned/);
    expect(await balance()).toBe(38);
  });

  it('the same renderId again never charges or calls the model twice', async () => {
    await fund(50);
    await makeBase('neck-women');
    const body = { ref: await upload(), style: 'black-necklace', renderId: 'render-abc-12345' };
    expect((await post('render', body)).status).toBe(201);
    renderStudio.mockClear();
    expect((await post('render', body)).body.data.replay).toBe(true);
    expect(renderStudio).not.toHaveBeenCalled();
    expect(await balance()).toBe(26);
  });

  it('is isolated per store: B has no shot and cannot use or approve the shot of A', async () => {
    await fund(50); await fund(50, 'other');
    const ref = await makeBase('ring-women');
    expect((await shots(authB))['ring-women']).toBeNull();
    expect((await post('render', { ref: await upload(authB), style: 'ring-hand-women' }, authB)).status).toBe(409);
    expect((await post('model-shots', { shot: 'ring-women', ref }, authB)).status).toBe(400);
  });

  it('approval accepts only a base shot made for that shot id (not a product photo, not another shot)', async () => {
    await fund(50);
    expect((await post('model-shots', { shot: 'ring-women', ref: await upload() })).status).toBe(400);
    const made = (await post('render', { baseShot: 'ring-women' })).body.data.ref;
    expect((await post('model-shots', { shot: 'ring-men', ref: made })).status).toBe(400);
    expect((await post('model-shots', { shot: 'nope', ref: made })).status).toBe(400);
    expect((await post('model-shots', { shot: 'ring-women', ref: made })).status).toBe(200);
  });

  it('validates input: model-base is not a style, unknown base shot refused, admin only', async () => {
    expect((await post('render', { ref: await upload(), style: 'model-base' })).status).toBe(400);
    expect((await post('render', { baseShot: 'foot' })).status).toBe(400);
    expect((await request(app).post('/api/admin/photos/model-shots').set(A).send({})).status).toBe(401);
    expect(renderStudio).not.toHaveBeenCalled();
  });

  it('existing single-image styles still call the model with one image and no extras', async () => {
    await fund(50);
    const res = await post('render', { ref: await upload(), style: 'silk' });
    expect(res.status).toBe(201);
    expect(renderStudio.mock.calls[0]).toHaveLength(3);
  });
});
