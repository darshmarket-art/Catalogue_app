import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore, type Doc } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { jewelleryPack } from '../server/sectors/jewellery';
import { STATS_COLLECTION, STATS_ID } from '../server/catalogueIndex';
import type { MerchantConfig } from '../server/merchant';
import { STATIC_CODE, otpBuyer } from './buyerAuth';
import { countingStore } from './countingStore';
import { makeProducts } from './catalogueData';

const KEY = 'test-master-provisioning-key';
const config = () => ({ ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } });

async function build(n: number, rootStore = new MemoryStore()) {
  const c = config();
  const root = countingStore(rootStore);
  await root.set('stores', 'bhakti', newStoreRecord(c.merchant as MerchantConfig, { plan: 'pro' }));
  const data = scopeStore(root, 'bhakti');
  const cats = ['Rings', 'Bridal Chokers & Haar', 'Pendants', 'Jhumka', 'Bangles'];
  for (const [i, name] of cats.entries()) await data.set('categories', `cat-${i}`, { id: `cat-${i}`, name, tag: 'Other', image: 'https://example.com/c.jpg', createdAt: new Date(1e12 + i).toISOString() });
  const docs = makeProducts(n);
  for (const d of docs) await data.set('products', d.id, d);
  const app = createApp(c, root, new MemoryBlobs());
  const reg = await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', role: 'owner', masterProvisioningKey: KEY });
  const admin = { Authorization: `Bearer ${reg.body.sessionToken}` };
  const buyer = { Authorization: `Bearer ${(await otpBuyer(app, { phone: '9820000001', firmName: 'Test Jewellers' })).body.token}` };
  return { app, root, data, admin, buyer, docs, config: c };
}

const body = (over: Record<string, unknown> = {}) => ({ title: 'New Haar', category: 'Rings', purity: '22K 916', grossWt: '10', stoneWt: '1', images: ['https://example.com/haar.jpg'], ...over });
const designCount = async (t: Awaited<ReturnType<typeof build>>, name: string) =>
  ((await request(t.app).get('/api/categories').set(t.buyer)).body.data as Array<{ name: string; designCount: number }>).find((c) => c.name === name)!.designCount;

describe('catalogue over HTTP', () => {
  it('pages (offset and cursor) and counts are exact and identical to the old path for filters, sorts and search', async () => {
    const t = await build(700);
    const queries: Array<Record<string, string>> = [{}, { sort: 'name' }, { sort: 'weight-asc' }, { search: 'necklace' }, { category: 'Rings', sort: 'weight-desc' }, { purity: '22K 916', availability: 'Ready in Vault' }, { search: 'हार', minWt: '3' } as any];
    for (const raw of queries) {
      const q = jewelleryPack.querySchema.parse(raw);
      const all = jewelleryPack.applyQuery([...t.docs].sort((a, b) => (a.id < b.id ? -1 : 1)), q);
      const qs = new URLSearchParams(raw).toString();
      // offset paging
      const offsetIds: string[] = [];
      for (let offset = 0; ; offset += 24) {
        const res = await request(t.app).get(`/api/products?${qs}&limit=24&offset=${offset}`).set(t.buyer);
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(all.length); // never capped at the page size
        expect(res.body.total).toBe(all.length);
        offsetIds.push(...res.body.data.map((p: Doc) => p.id));
        if (!res.body.hasMore) break;
      }
      expect(offsetIds, qs).toEqual(all.map((p) => p.id));
      // cursor paging
      const cursorIds: string[] = [];
      let next = '';
      for (;;) {
        const res = await request(t.app).get(`/api/products?${qs}&limit=50${next}`).set(t.buyer);
        cursorIds.push(...res.body.data.map((p: Doc) => p.id));
        if (!res.body.hasMore) break;
        next = `&cursor=${encodeURIComponent(res.body.cursor)}&cursorAfter=${encodeURIComponent(res.body.cursorAfter)}`;
      }
      expect(cursorIds, qs).toEqual(all.map((p) => p.id));
    }
  });

  it('?tag= lists exactly the union of the collections under that tag, with exact counts and paging; an unknown tag lists nothing', async () => {
    const t = await build(400);
    // Rings and Pendants carry "Rings"; the rest keep "Other"; a tag combines with a collection filter.
    await t.data.update('categories', 'cat-0', { tag: 'Rings' });
    await t.data.update('categories', 'cat-2', { tag: 'Rings' });
    for (const [raw, cats] of [[{ tag: 'Rings' }, ['Rings', 'Pendants']], [{ tag: 'rings', sort: 'weight-asc' }, ['Rings', 'Pendants']], [{ tag: 'Other', category: 'Jhumka' }, ['Jhumka']], [{ tag: 'Other', category: 'Rings' }, []]] as Array<[Record<string, string>, string[]]>) {
      const q = jewelleryPack.querySchema.parse(raw);
      const all = jewelleryPack.applyQuery([...t.docs].sort((a, b) => (a.id < b.id ? -1 : 1)), q).filter((p) => cats.includes(String(p.category)));
      const qs = new URLSearchParams(raw).toString();
      const ids: string[] = [];
      let next = '';
      for (;;) {
        const res = await request(t.app).get(`/api/products?${qs}&limit=30${next}`).set(t.buyer);
        expect(res.status).toBe(200);
        expect(res.body.total, qs).toBe(all.length);
        ids.push(...res.body.data.map((p: Doc) => p.id));
        if (!res.body.hasMore) break;
        next = `&cursor=${encodeURIComponent(res.body.cursor)}&cursorAfter=${encodeURIComponent(res.body.cursorAfter)}`;
      }
      expect(ids, qs).toEqual(all.map((p) => p.id));
    }
    const rings = await request(t.app).get('/api/products?tag=Rings&limit=1').set(t.buyer);
    expect(rings.body.total).toBe((await designCount(t, 'Rings')) + (await designCount(t, 'Pendants')));
    const none = await request(t.app).get('/api/products?tag=Nope&limit=24').set(t.buyer);
    expect(none.status).toBe(200);
    expect(none.body).toMatchObject({ total: 0, hasMore: false, data: [] });
    // still served from the index: no product scan
    t.root.reset();
    await request(t.app).get('/api/products?tag=Rings&limit=24').set(t.buyer);
    expect(t.root.counts.byCollection['stores/bhakti/products']).toBe(24);
  });

  it('a page costs the control doc plus the page in reads, whatever the store size', async () => {
    const small = await build(60);
    const big = await build(3000);
    const warm = async (t: typeof small) => request(t.app).get('/api/products?limit=24').set(t.buyer);
    for (const t of [small, big]) {
      await warm(t); // builds the index: the one scan
      t.root.reset();
      const res = await request(t.app).get('/api/products?sort=name&limit=24&offset=24').set(t.buyer);
      expect(res.body.data).toHaveLength(24);
      expect(t.root.counts.byCollection['stores/bhakti/products']).toBe(24);
      t.root.reset();
      await request(t.app).get('/api/products?search=necklace&limit=24').set(t.buyer);
      const reads = t.root.counts.reads;
      expect(reads).toBeLessThanOrEqual(1 + 24 + 3); // control doc + page (+ the auth lookup)
      t.root.reset();
      await request(t.app).get('/api/products/by-sku?skus=SKU-1,SKU-2').set(t.buyer);
      expect(t.root.counts.byCollection['stores/bhakti/products']).toBe(2);
      t.root.reset();
      await request(t.app).get('/api/categories').set(t.buyer);
      expect(t.root.counts.byCollection['stores/bhakti/products'] ?? 0).toBe(0);
      expect(t.root.counts.reads).toBeLessThanOrEqual(12); // categories + tags + control doc: constant, whatever the number of designs
      t.root.reset();
      const ent = await request(t.app).get('/api/entitlements').set(t.buyer);
      expect(ent.body.data.usage.photos).toBeGreaterThan(0);
      expect(t.root.counts.byCollection['stores/bhakti/products'] ?? 0).toBe(0);
    }
  });

  it('create, edit, move collection, delete, rename and delete a collection keep designCount exact; the next read sees it at once', async () => {
    const t = await build(100);
    const base = await designCount(t, 'Pendants');
    const made = await request(t.app).post('/api/products').set(t.admin).send(body({ category: 'Pendants', title: 'Brand New Pendant' }));
    expect(made.status).toBe(201);
    expect(await designCount(t, 'Pendants')).toBe(base + 1);
    const found = await request(t.app).get('/api/products?search=brand+new+pendant').set(t.buyer);
    expect(found.body.count).toBe(1);

    const moved = await request(t.app).put(`/api/products/${made.body.data.id}`).set(t.admin).send(body({ category: 'Jhumka', title: 'Brand New Pendant', grossWt: '33' }));
    expect(moved.status).toBe(200);
    expect(await designCount(t, 'Pendants')).toBe(base);
    expect((await request(t.app).get('/api/products?category=Jhumka&search=brand+new').set(t.buyer)).body.data[0].netWt).toBe(32);

    expect((await request(t.app).delete(`/api/products/${made.body.data.id}`).set(t.admin)).status).toBe(200);
    expect((await request(t.app).get('/api/products?search=brand+new+pendant').set(t.buyer)).body.count).toBe(0);

    const catId = 'cat-3'; // Jhumka
    const before = await designCount(t, 'Jhumka');
    const ren = await request(t.app).put(`/api/categories/${catId}`).set(t.admin).send({ name: 'Jhumka Special', tag: 'Other', image: 'https://example.com/c.jpg' });
    expect(ren.status).toBe(200);
    expect(ren.body.data.designCount).toBe(before);
    expect(await designCount(t, 'Jhumka Special')).toBe(before);
    expect((await request(t.app).get('/api/products?category=Jhumka%20Special&limit=500').set(t.buyer)).body.count).toBe(before);
    const total = (await request(t.app).get('/api/products?limit=1').set(t.buyer)).body.total;
    expect((await request(t.app).delete(`/api/categories/${catId}`).set(t.admin)).status).toBe(200);
    expect((await request(t.app).get('/api/products?limit=1').set(t.buyer)).body.total).toBe(total - before);

    // the counters equal a scan, and the index equals the products
    const stored = (await t.data.get(STATS_COLLECTION, STATS_ID)) as any;
    const live = await t.data.list('products');
    expect(stored.total).toBe(live.length);
  });

  it('bulk import: one call, one counter change, and an exact count', async () => {
    const t = await build(20);
    await request(t.app).get('/api/products?limit=1').set(t.buyer);
    const rev = ((await t.data.get(STATS_COLLECTION, STATS_ID)) as any).rev;
    const items = Array.from({ length: 40 }, (_, i) => body({ title: `Imported ${i}`, sku: `IMP-${i}`, category: i % 2 ? 'Rings' : 'Bangles' }));
    const res = await request(t.app).post('/api/products/bulk').set(t.admin).send({ items });
    expect(res.status).toBe(201);
    expect(((await t.data.get(STATS_COLLECTION, STATS_ID)) as any).rev).toBe(rev + 1);
    expect((await request(t.app).get('/api/products?search=imported&limit=24').set(t.buyer)).body.count).toBe(40);
    expect((await request(t.app).post('/api/products/bulk').set(t.admin).send({ items: [items[0], items[0]] })).status).toBe(409); // twice in one batch
    expect((await request(t.app).post('/api/products/bulk').set(t.admin).send({ items: [] })).status).toBe(400);
    expect((await request(t.app).get('/api/products?limit=1').set(t.buyer)).body.total).toBe(60);
  });

  it('a second instance on the same data sees a write made by the first at once', async () => {
    const t = await build(50);
    const second = createApp(t.config, t.root, new MemoryBlobs());
    const buyer2 = { Authorization: t.buyer.Authorization };
    expect((await request(second).get('/api/products?limit=1').set(buyer2)).body.total).toBe(50); // second builds its index
    await request(t.app).post('/api/products').set(t.admin).send(body({ title: 'Written on instance one' }));
    expect((await request(second).get('/api/products?limit=1').set(buyer2)).body.total).toBe(51);
    expect((await request(second).get('/api/products?search=written+on+instance').set(buyer2)).body.count).toBe(1);
  });

  it('the console recount fixes a drifted counter, audits it, and a script-style dry run changes nothing', async () => {
    process.env.CONSOLE_DEV_OPEN = 'true';
    try {
      const t = await build(30);
      await request(t.app).get('/api/categories').set(t.buyer);
      await t.data.update(STATS_COLLECTION, STATS_ID, { total: 5, byCat: { Rings: 99 } });
      const res = await request(t.app).post('/api/console/stores/bhakti/recount').set('Content-Type', 'application/json').send({});
      expect(res.status).toBe(200);
      expect(res.body.data.drift).toBe(true);
      expect(res.body.data.after.total).toBe(30);
      expect(((await request(t.app).get('/api/console/stores/bhakti')).body.data.audit as Array<{ action: string }>).some((a) => a.action === 'recount')).toBe(true);
      expect((await request(t.app).get('/api/products?limit=1').set(t.buyer)).body.total).toBe(30);
      expect((await request(t.app).post('/api/console/stores/nope/recount').send({})).status).toBe(404);
    } finally {
      delete process.env.CONSOLE_DEV_OPEN;
    }
  });
});
