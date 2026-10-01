import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig, type Config } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { seedDemoCatalogue } from '../server/seed';
import { createMedia } from '../server/media';
import { parseMerchant } from '../server/merchant';
import type { ProductField } from '../server/merchant';

const MASTER_KEY = 'test-master-provisioning-key';
const JWT_SECRET = 'x'.repeat(48);

let store: MemoryStore;
let blobs: MemoryBlobs;
let config: Config;

async function build(opts: { access?: 'public' | 'login'; productFields?: ProductField[] } = {}) {
  config = {
    ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET, MASTER_PROVISIONING_KEY: MASTER_KEY }),
    rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 }
  };
  config.merchant = { ...config.merchant, catalogueAccess: opts.access ?? 'login', productFields: opts.productFields ?? [] };
  store = new MemoryStore();
  blobs = new MemoryBlobs();
  await seedDemoCatalogue(store, 'bhakti');
  return createApp(config, store, blobs);
}

type App = ReturnType<typeof createApp>;

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)]);

async function admin(app: App, role: 'owner' | 'staff' = 'owner', email = `${role}@example.com`) {
  const res = await request(app)
    .post('/api/auth/admin/register')
    .send({ email, password: 'AdminPass@2026', role, masterProvisioningKey: MASTER_KEY });
  return { Authorization: `Bearer ${res.body.sessionToken}` };
}

async function buyer(app: App, n = 1) {
  const phone = `98200000${String(n).padStart(2, '0')}`;
  const res = await request(app).post('/api/auth/retailer/signup').send({ firmName: `Shop ${n}`, phone, password: 'StrongPass@1' });
  return { Authorization: `Bearer ${res.body.token}`, phone };
}

const upload = (app: App, auth: Record<string, string>, body: Buffer = JPEG, type = 'image/jpeg') =>
  request(app).post('/api/admin/photos').set(auth).set('Content-Type', type).send(body);

const product = (images: string[], extra: object = {}) => ({
  title: 'Photo Haar',
  category: 'Bridal Chokers & Haar',
  purity: '22K 916',
  grossWt: '50',
  stoneWt: '5',
  images,
  ...extra
});

describe('photo upload and private links', () => {
  let app: App;
  beforeEach(async () => {
    app = await build();
  });

  it('only admins can upload', async () => {
    expect((await request(app).post('/api/admin/photos').set('Content-Type', 'image/jpeg').send(JPEG)).status).toBe(401);
    expect((await upload(app, await buyer(app))).status).toBe(403);
    expect((await upload(app, await admin(app))).status).toBe(201);
  });

  it('stores the original bytes untouched and returns a stored ref plus a signed link', async () => {
    const auth = await admin(app);
    const res = await upload(app, auth, PNG, 'image/png');
    expect(res.status).toBe(201);
    expect(res.body.data.ref).toMatch(/^media:[a-f0-9]{32}\.png$/);
    expect(res.body.data.bytes).toBe(PNG.length);

    const photo = await request(app).get(res.body.data.url);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect(photo.headers['cache-control']).toMatch(/private/);
    expect(Buffer.compare(photo.body, PNG)).toBe(0);
  });

  it('rejects files that are not really images, even when labelled as one', async () => {
    const auth = await admin(app);
    expect((await upload(app, auth, Buffer.from('<script>alert(1)</script>'.repeat(5)), 'image/jpeg')).status).toBe(415);
    expect((await upload(app, auth, JPEG, 'image/gif')).status).toBe(415);
    expect((await upload(app, auth, Buffer.alloc(0), 'image/jpeg')).status).toBe(415);
  });

  it('refuses a photo over the size limit', async () => {
    const auth = await admin(app);
    const big = Buffer.concat([JPEG, Buffer.alloc(26 * 1024 * 1024)]);
    expect((await upload(app, auth, big)).status).toBe(413);
  });

  it('accepts only links this server signed, and only until they expire', async () => {
    const auth = await admin(app);
    const { url } = (await upload(app, auth)).body.data;
    expect((await request(app).get(url)).status).toBe(200);

    const file = url.split('?')[0].replace('/media/', '');
    expect((await request(app).get(`/media/${file}`)).status).toBe(403);
    expect((await request(app).get(url.replace(/s=.*/, 's=forged'))).status).toBe(403);

    const media = createMedia(JWT_SECRET);
    expect(media.verify(file, String(Date.now() - 1000), 'x')).toBe(false);
    const longAgo = media.linkFor(file, Date.now() - 13 * 60 * 60 * 1000);
    expect((await request(app).get(longAgo)).status).toBe(403);
    // the same file under another secret is rejected
    expect((await request(app).get(createMedia('y'.repeat(48)).linkFor(file))).status).toBe(403);
  });

  it('links are stable within a window, so browsers can cache the photo', () => {
    const media = createMedia(JWT_SECRET);
    const t = Date.UTC(2026, 0, 1, 7, 0, 0);
    expect(media.linkFor('a'.repeat(32) + '.jpg', t)).toBe(media.linkFor('a'.repeat(32) + '.jpg', t + 60_000));
  });

  it('a photo cannot be fetched by guessing a path', async () => {
    expect((await request(app).get('/media/..%2F..%2Fpackage.json')).status).toBe(403);
    expect((await request(app).get('/media/notaphoto.jpg')).status).toBe(403);
  });
});

describe('products: photos, prices, extra fields, edit and delete', () => {
  it('needs 1 to 3 photos, and an uploaded photo must really exist', async () => {
    const app = await build();
    const auth = await admin(app);
    const post = (body: object) => request(app).post('/api/products').set(auth).send(body);
    const a = (await upload(app, auth)).body.data.ref;
    const b = (await upload(app, auth)).body.data.ref;
    const c = (await upload(app, auth)).body.data.ref;
    const d = (await upload(app, auth)).body.data.ref;

    expect((await post(product([]))).status).toBe(400);
    expect((await post(product([a, b, c, d]))).status).toBe(400);
    expect((await post(product(['media:' + 'f'.repeat(32) + '.jpg']))).status).toBe(400);
    expect((await post(product([a, b, c], { sku: 'THREE' }))).status).toBe(201);
    expect((await post(product([a], { sku: 'ONE' }))).status).toBe(201);
  });

  it('serves photos as private links, never the raw storage reference', async () => {
    const app = await build();
    const auth = await admin(app);
    const ref = (await upload(app, auth)).body.data.ref;
    const created = await request(app).post('/api/products').set(auth).send(product([ref], { sku: 'LINK-1' }));
    expect(created.body.data.image).toMatch(/^\/media\/[a-f0-9]{32}\.jpg\?e=\d+&s=/);
    expect(created.body.data.images).toHaveLength(1);
    expect(JSON.stringify(created.body)).not.toContain('media:');

    const listed = await request(app).get('/api/products').set(auth);
    const row = listed.body.data.find((p: any) => p.sku === 'LINK-1');
    expect((await request(app).get(row.image)).status).toBe(200);
    // the stored document keeps the ref, not a link that would expire
    expect((await store.list('products')).find((p) => p.sku === 'LINK-1')!.images).toEqual([ref]);
  });

  it('products carry no price: price fields in a request are ignored, never stored or returned', async () => {
    const app = await build();
    const auth = await admin(app);
    const post = (body: object) => request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], body));

    const res = await post({ priceMode: 'fixed', fixedPrice: '9000', makingChargePerGram: '300', sku: 'F1' });
    expect(res.status).toBe(201);
    for (const price of ['priceMode', 'fixedPrice', 'makingChargePerGram']) expect(res.body.data[price]).toBeUndefined();
    const listed = await request(app).get('/api/products').set(auth);
    expect(JSON.stringify(listed.body)).not.toMatch(/priceMode|fixedPrice|makingChargePerGram/);
  });

  it('checks merchant-defined extra fields against the merchant config', async () => {
    const fields: ProductField[] = [
      { key: 'finish', label: 'Finish', type: 'select', options: ['Matte', 'Polished'], required: true },
      { key: 'lengthCm', label: 'Length', type: 'number', required: false, unit: 'cm' },
      { key: 'note', label: 'Design note', type: 'text', required: false }
    ];
    const app = await build({ productFields: fields });
    const auth = await admin(app);
    const post = (extra: unknown, sku: string) =>
      request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { sku, extra }));

    const missing = await post({}, 'E0');
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/Finish is required/);
    expect((await post({ finish: 'Glossy' }, 'E1')).status).toBe(400);
    expect((await post({ finish: 'Matte', lengthCm: 'long' }, 'E2')).status).toBe(400);

    const ok = await post({ finish: 'Matte', lengthCm: '42.5', note: ' Temple ', unknown: 'dropped' }, 'E3');
    expect(ok.status).toBe(201);
    expect(ok.body.data.extra).toEqual({ finish: 'Matte', lengthCm: 42.5, note: 'Temple' });
  });

  it('merchants without extra fields store none', async () => {
    const app = await build();
    const auth = await admin(app);
    const res = await request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { extra: { finish: 'Matte' } }));
    expect(res.status).toBe(201);
    expect(res.body.data.extra).toBeUndefined();
  });

  it('refuses a product in a category that does not exist', async () => {
    const app = await build();
    const auth = await admin(app);
    const res = await request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { category: 'Nope' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not exist/);
  });

  it('edits a product, keeping its id, SKU and listing date; a returned photo link is accepted', async () => {
    const app = await build();
    const auth = await admin(app);
    const ref = (await upload(app, auth)).body.data.ref;
    const created = (await request(app).post('/api/products').set(auth).send(product([ref], { sku: 'EDIT-1' }))).body.data;

    const other = (await upload(app, auth, PNG, 'image/png')).body.data.ref;
    const edited = await request(app)
      .put(`/api/products/${created.id}`)
      .set(auth)
      .send(product([created.image, other], { title: 'Renamed Haar', grossWt: '60', stoneWt: '10' }));
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ id: created.id, sku: 'EDIT-1', title: 'Renamed Haar', netWt: 50 });
    expect(edited.body.data.images).toHaveLength(2);
    expect(edited.body.data.createdAt).toBe(created.createdAt);
    expect((await store.get('products', created.id))!.images).toEqual([ref, other]);

    expect((await request(app).put('/api/products/nope').set(auth).send(product([ref]))).status).toBe(404);
  });

  it('will not move a product onto another product\'s SKU', async () => {
    const app = await build();
    const auth = await admin(app);
    const a = (await request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { sku: 'A-1' }))).body.data;
    await request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { sku: 'B-1' }));
    const res = await request(app).put(`/api/products/${a.id}`).set(auth).send(product(['https://example.com/x.jpg'], { sku: 'B-1' }));
    expect(res.status).toBe(409);
  });

  it('deletes a product; old orders keep their line and photo', async () => {
    const app = await build();
    const auth = await admin(app);
    const shop = await buyer(app);
    const ref = (await upload(app, auth)).body.data.ref;
    const created = (await request(app).post('/api/products').set(auth).send(product([ref], { sku: 'GONE-1' }))).body.data;
    await request(app).post('/api/orders/items').set(shop).send({ sku: 'GONE-1' });
    await request(app).post('/api/orders/confirm').set(shop);

    expect((await request(app).delete(`/api/products/${created.id}`).set(auth)).status).toBe(200);
    expect((await request(app).delete(`/api/products/${created.id}`).set(auth)).status).toBe(404);
    expect((await store.list('products')).some((p) => p.sku === 'GONE-1')).toBe(false);

    const history = await request(app).get('/api/orders/history').set(shop);
    const line = history.body.data[0].items[0];
    expect(line.sku).toBe('GONE-1');
    expect((await request(app).get(line.image)).status).toBe(200);
  });

  it('only admins can edit or delete', async () => {
    const app = await build();
    const shop = await buyer(app);
    const id = (await store.list('products'))[0].id;
    expect((await request(app).put(`/api/products/${id}`).set(shop).send(product(['https://example.com/x.jpg']))).status).toBe(403);
    expect((await request(app).delete(`/api/products/${id}`).set(shop)).status).toBe(403);
    expect((await request(app).delete(`/api/products/${id}`)).status).toBe(401);
  });
});

describe('categories: one photo, rename, delete', () => {
  it('needs a photo, and rejects a duplicate name', async () => {
    const app = await build();
    const auth = await admin(app);
    const ref = (await upload(app, auth)).body.data.ref;
    expect((await request(app).post('/api/categories').set(auth).send({ name: 'Rings' })).status).toBe(400);
    expect((await request(app).post('/api/categories').set(auth).send({ name: 'Rings', image: ref })).status).toBe(201);
    expect((await request(app).post('/api/categories').set(auth).send({ name: 'Rings', image: ref })).status).toBe(409);
  });

  it('a rename carries its products along; a category with products cannot be deleted', async () => {
    const app = await build();
    const auth = await admin(app);
    const cat = (await request(app).post('/api/categories').set(auth).send({ name: 'Chains', image: 'https://example.com/c.jpg' })).body.data;
    await request(app).post('/api/products').set(auth).send(product(['https://example.com/x.jpg'], { category: 'Chains', sku: 'CH-1' }));

    expect((await request(app).delete(`/api/categories/${cat.id}`).set(auth)).status).toBe(409);

    const renamed = await request(app).put(`/api/categories/${cat.id}`).set(auth).send({ name: 'Gold Chains', image: 'https://example.com/c.jpg' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.designCount).toBe(1);
    expect((await store.list('products')).find((p) => p.sku === 'CH-1')!.category).toBe('Gold Chains');

    const clash = await request(app).put(`/api/categories/${cat.id}`).set(auth).send({ name: 'Bridal Chokers & Haar', image: 'https://example.com/c.jpg' });
    expect(clash.status).toBe(409);

    const productId = (await store.list('products')).find((p) => p.sku === 'CH-1')!.id;
    await request(app).delete(`/api/products/${productId}`).set(auth);
    expect((await request(app).delete(`/api/categories/${cat.id}`).set(auth)).status).toBe(200);
    expect((await request(app).put('/api/categories/none').set(auth).send({ name: 'X', image: 'https://example.com/c.jpg' })).status).toBe(404);
  });
});

describe('home banners', () => {
  it('admin adds and deletes; buyers can only read', async () => {
    const app = await build();
    const auth = await admin(app);
    const ref = (await upload(app, auth)).body.data.ref;
    expect((await request(app).post('/api/banners').set(auth).send({})).status).toBe(400);
    expect((await request(app).post('/api/banners').send({ image: ref })).status).toBe(401);
    const made = await request(app).post('/api/banners').set(auth).send({ image: ref });
    expect(made.status).toBe(201);
    const list = (await request(app).get('/api/banners').set(auth)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0].image.startsWith("/media/")).toBe(true);
    expect((await request(app).delete(`/api/banners/${made.body.data.id}`).set(auth)).status).toBe(200);
    expect((await request(app).delete('/api/banners/none').set(auth)).status).toBe(404);
  });
});

describe('merchant config: product fields', () => {
  const base = () => JSON.parse(JSON.stringify(loadConfig({ NODE_ENV: 'test', STORE: 'memory' }).merchant));

  it('accepts well-formed fields and rejects bad ones', () => {
    const ok = base();
    ok.productFields = [{ key: 'finish', label: 'Finish', type: 'select', options: ['Matte'] }];
    expect(parseMerchant(ok, 'test').productFields[0]).toMatchObject({ key: 'finish', required: false });

    for (const bad of [
      [{ key: 'Finish', label: 'x' }],
      [{ key: 'finish', label: 'x', type: 'select' }],
      [{ key: 'a', label: 'x' }, { key: 'a', label: 'y' }]
    ]) {
      const cfg = base();
      cfg.productFields = bad;
      expect(() => parseMerchant(cfg, 'test')).toThrow();
    }
  });

  it('names the source and refuses a config for another merchant', () => {
    expect(() => parseMerchant({}, 'merchant.json in storage')).toThrow(/merchant\.json in storage/);
    expect(() => parseMerchant(base(), 'test', 'someone-else')).toThrow(/does not match/);
  });
});

describe('buyer order history', () => {
  it('shows a buyer only their own orders, newest first', async () => {
    const app = await build();
    const one = await buyer(app, 1);
    const two = await buyer(app, 2);
    await request(app).post('/api/orders/items').set(one).send({ sku: 'B2B-COIN-0010' });
    const first = (await request(app).post('/api/orders/confirm').set(one)).body.poId;
    await request(app).post('/api/orders/items').set(one).send({ sku: 'B2B-COIN-0010', batchQty: 2 });
    const second = (await request(app).post('/api/orders/confirm').set(one)).body.poId;
    await request(app).post('/api/orders/items').set(two).send({ sku: 'B2B-COIN-0010' });
    await request(app).post('/api/orders/confirm').set(two);

    const mine = await request(app).get('/api/orders/history').set(one);
    expect(mine.body.data.map((o: any) => o.poId)).toEqual([second, first]);
    expect(mine.body.data[0]).toMatchObject({ status: 'new', itemCount: 1 });
    expect(JSON.stringify(mine.body)).not.toContain('98200000');
    expect((await request(app).get('/api/orders/history').set(two)).body.count).toBe(1);
    expect((await request(app).get('/api/orders/history')).status).toBe(401);
    expect((await request(app).get('/api/orders/history').set(await admin(app))).status).toBe(403);
  });
});

describe('buyer accounts for the owner', () => {
  it('lists buyers without their passwords', async () => {
    const app = await build();
    const auth = await admin(app);
    await buyer(app, 1);
    const res = await request(app).get('/api/admin/buyers').set(auth);
    expect(res.body.count).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
    expect((await request(app).get('/api/admin/buyers').set(await buyer(app, 2))).status).toBe(403);
    expect((await request(app).get('/api/admin/buyers')).status).toBe(401);
  });

  it('owner resets a forgotten password; the buyer must set a new one before carrying on', async () => {
    const app = await build();
    const owner = await admin(app, 'owner');
    const shop = await buyer(app, 1);

    const reset = await request(app).post(`/api/admin/buyers/${shop.phone}/reset-password`).set(owner);
    expect(reset.status).toBe(200);
    const temp = reset.body.data.temporaryPassword;
    expect(temp).toHaveLength(10);

    expect((await request(app).post('/api/auth/retailer/login').send({ phone: shop.phone, password: 'StrongPass@1' })).status).toBe(401);
    const login = await request(app).post('/api/auth/retailer/login').send({ phone: shop.phone, password: temp });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    const tempAuth = { Authorization: `Bearer ${login.body.token}` };
    expect((await request(app).get('/api/auth/me').set(tempAuth)).body.mustChangePassword).toBe(true);

    expect((await request(app).post('/api/auth/retailer/change-password').set(tempAuth).send({ currentPassword: 'wrong-one', newPassword: 'Brand-New-Pass1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/retailer/change-password').set(tempAuth).send({ currentPassword: temp, newPassword: temp })).status).toBe(400);
    expect((await request(app).post('/api/auth/retailer/change-password').set(tempAuth).send({ currentPassword: temp, newPassword: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/retailer/change-password').set(tempAuth).send({ currentPassword: temp, newPassword: 'Brand-New-Pass1' })).status).toBe(200);

    expect((await request(app).post('/api/auth/retailer/login').send({ phone: shop.phone, password: temp })).status).toBe(401);
    const again = await request(app).post('/api/auth/retailer/login').send({ phone: shop.phone, password: 'Brand-New-Pass1' });
    expect(again.body.user.mustChangePassword).toBe(false);
    const events = (await store.list('auditLogs')).map((l) => l.event);
    expect(events).toContain('BUYER_PASSWORD_RESET');
    expect(events).toContain('RETAILER_PASSWORD_CHANGED');
  });

  it('staff cannot reset passwords, and an unknown buyer is a 404', async () => {
    const app = await build();
    const shop = await buyer(app, 1);
    const staff = await admin(app, 'staff');
    expect((await request(app).post(`/api/admin/buyers/${shop.phone}/reset-password`).set(staff)).status).toBe(403);
    expect((await request(app).post('/api/admin/buyers/0000000000/reset-password').set(await admin(app, 'owner'))).status).toBe(404);
    expect((await request(app).post(`/api/admin/buyers/${shop.phone}/reset-password`).set(shop)).status).toBe(403);
  });
});

describe('visitor engagement', () => {
  const sid = (n: number) => `sess-test-${String(n).padStart(6, '0')}`;
  const beat = (app: App, auth: Record<string, string> | null, session: string) => {
    const req = request(app).post('/api/analytics/heartbeat');
    return (auth ? req.set(auth) : req).send({ sessionId: session });
  };
  const activity = (app: App, auth: Record<string, string> | null, session: string, events: object[]) => {
    const req = request(app).post('/api/analytics/activity');
    return (auth ? req.set(auth) : req).send({ sessionId: session, events });
  };

  it('records what a signed-in buyer views, searches for and selects, and shows it to the owner', async () => {
    const app = await build();
    const owner = await admin(app);
    const shop = await buyer(app, 1);
    const sku = (await store.list('products'))[0].sku;

    await beat(app, shop, sid(1));
    await request(app).post('/api/analytics/product-views').set(shop).send({ sessionId: sid(1), skus: [sku] });
    const res = await activity(app, shop, sid(1), [
      { type: 'dwell', sku, ms: 12000 },
      { type: 'dwell', sku, ms: 3000 },
      { type: 'search', term: 'temple haar' },
      { type: 'select', sku }
    ]);
    expect(res.body.recorded).toBe(4);
    await request(app).post('/api/orders/items').set(shop).send({ sku });

    const list = await request(app).get('/api/admin/visitors?kind=verified').set(owner);
    expect(list.body.count).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      id: shop.phone,
      kind: 'verified',
      name: 'Shop 1',
      productsViewed: 1,
      dwellSeconds: 15,
      searches: 1,
      selections: 1,
      addedToCart: 1
    });

    const detail = await request(app).get(`/api/admin/visitors/${shop.phone}`).set(owner);
    expect(detail.body.data.products[0]).toMatchObject({ sku, seconds: 15 });
    expect(detail.body.data.products[0].title).toBeTruthy();
    expect(detail.body.data.searchTerms[0]).toMatchObject({ term: 'temple haar', count: 1 });
    expect(detail.body.data.picked[0]).toMatchObject({ sku, count: 2 });
  });

  it('counts active time from heartbeats, capped so an idle laptop does not pile up hours', async () => {
    const app = await build();
    const owner = await admin(app);
    const shop = await buyer(app, 1);
    await beat(app, shop, sid(1));
    await store.update('sessions', sid(1), { lastPing: Date.now() - 15000 });
    await beat(app, shop, sid(1));
    await store.update('sessions', sid(1), { lastPing: Date.now() - 3 * 60 * 60 * 1000 });
    await beat(app, shop, sid(1));
    const row = (await request(app).get('/api/admin/visitors').set(owner)).body.data[0];
    expect(row.activeSeconds).toBeGreaterThanOrEqual(44);
    expect(row.activeSeconds).toBeLessThanOrEqual(46);
    expect(row.sessions).toBe(1);
  });

  it('counts one visit for a buyer who signs in on a tab that was already open', async () => {
    const app = await build();
    const owner = await admin(app);
    const shop = await buyer(app, 1);
    await beat(app, null, sid(3));
    await beat(app, shop, sid(3));
    await beat(app, shop, sid(3));
    const row = (await request(app).get('/api/admin/visitors').set(owner)).body.data[0];
    expect(row.sessions).toBe(1);
  });

  it('never tracks admins, and ignores signed-out visitors of a login-only catalogue', async () => {
    const app = await build({ access: 'login' });
    const owner = await admin(app);
    await beat(app, owner, sid(1));
    await beat(app, null, sid(2));
    expect((await activity(app, owner, sid(1), [{ type: 'search', term: 'ring' }])).body.recorded).toBe(0);
    expect((await activity(app, null, sid(2), [{ type: 'search', term: 'ring' }])).body.recorded).toBe(0);
    expect((await request(app).get('/api/admin/visitors').set(owner)).body.count).toBe(0);
  });

  it('a public catalogue also tracks guests, kept apart from verified buyers', async () => {
    const app = await build({ access: 'public' });
    const owner = await admin(app);
    const shop = await buyer(app, 1);
    await beat(app, null, sid(7));
    await activity(app, null, sid(7), [{ type: 'search', term: 'bangles' }]);
    await beat(app, shop, sid(8));

    const all = await request(app).get('/api/admin/visitors').set(owner);
    expect(all.body.count).toBe(2);
    const guests = await request(app).get('/api/admin/visitors?kind=guest').set(owner);
    expect(guests.body.data).toHaveLength(1);
    expect(guests.body.data[0]).toMatchObject({ kind: 'guest', name: 'Guest visitor', searches: 1 });
    const verified = await request(app).get('/api/admin/visitors?kind=verified').set(owner);
    expect(verified.body.data.map((v: any) => v.name)).toEqual(['Shop 1']);
  });

  it('an admin who browsed the public catalogue before signing in is not left behind as a guest', async () => {
    const app = await build({ access: 'public' });
    const owner = await admin(app);
    await beat(app, null, sid(9));
    expect((await request(app).get('/api/admin/visitors?kind=guest').set(owner)).body.count).toBe(1);
    await beat(app, owner, sid(9));
    expect((await request(app).get('/api/admin/visitors?kind=guest').set(owner)).body.count).toBe(0);
  });

  it('validates events and protects the visitor lists', async () => {
    const app = await build();
    const owner = await admin(app);
    const shop = await buyer(app, 1);
    expect((await activity(app, shop, sid(1), [])).status).toBe(400);
    expect((await activity(app, shop, sid(1), [{ type: 'dwell', sku: 'X', ms: 99999999 }])).status).toBe(400);
    expect((await activity(app, shop, sid(1), [{ type: 'hack', sku: 'X' }])).status).toBe(400);
    expect((await activity(app, shop, 'bad id', [{ type: 'search', term: 'ok' }])).status).toBe(400);

    expect((await request(app).get('/api/admin/visitors')).status).toBe(401);
    expect((await request(app).get('/api/admin/visitors').set(shop)).status).toBe(403);
    expect((await request(app).get(`/api/admin/visitors/${shop.phone}`).set(shop)).status).toBe(403);
    expect((await request(app).get('/api/admin/visitors/unknown').set(owner)).status).toBe(404);
  });
});
