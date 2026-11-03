import { describe, expect, it } from 'vitest';
import { MemoryStore, type Doc, type Store } from '../server/store';
import { scopeStore } from '../server/tenancy';
import { CatalogueStore, STATS_COLLECTION, STATS_ID, STATS_VERSION, createCatalogueRegistry, type StatsDoc } from '../server/catalogueIndex';
import { jewelleryPack } from '../server/sectors/jewellery';
import { countingStore } from './countingStore';
import { makeProducts } from './catalogueData';

const pack = jewelleryPack;
const seed = async (store: Store, docs: Doc[]) => {
  for (const d of docs) await store.set('products', d.id, d);
};
const byId = (docs: Doc[]) => [...docs].sort((a, b) => (a.id < b.id ? -1 : 1));
const scan = (docs: Doc[]) => {
  const byCat: Record<string, number> = {};
  for (const d of docs) byCat[d.category] = (byCat[d.category] ?? 0) + 1;
  return { total: docs.length, byCat };
};
const mk = (over: Partial<Doc> = {}): Doc => ({ ...makeProducts(1)[0], ...over });

/** Counters must equal a scan of the products, exactly. */
async function expectExact(store: Store, cat: CatalogueStore) {
  const stats = await cat.stats();
  const truth = scan(await store.list('products'));
  expect({ total: stats.total, byCat: stats.byCat }).toEqual(truth);
  const c = await cat.check();
  expect(c.drift).toBe(false);
}

describe('control doc: counter correctness across every write path', () => {
  it('create, edit (moving collection), delete', async () => {
    const store = new MemoryStore();
    const cat = new CatalogueStore(store, pack);
    await cat.stats(); // empty store: builds the doc
    await cat.create(mk({ id: 'a', sku: 'A', category: 'Rings' }));
    await cat.create(mk({ id: 'b', sku: 'B', category: 'Rings' }));
    await cat.create(mk({ id: 'c', sku: 'C', category: 'Pendants' }));
    expect((await cat.stats()).byCat).toEqual({ Rings: 2, Pendants: 1 });
    // edit: move collection and change net weight (weight is not a counter, the move is)
    await cat.replace('a', (cur) => ({ ...cur!, category: 'Pendants', netWt: 99 }));
    expect((await cat.stats()).byCat).toEqual({ Rings: 1, Pendants: 2 });
    // edit without a move changes nothing
    await cat.replace('b', (cur) => ({ ...cur!, title: 'renamed' }));
    expect((await cat.stats()).total).toBe(3);
    await cat.remove('b');
    expect(await cat.remove('b')).toBeNull(); // deleting twice counts once
    expect((await cat.stats()).byCat).toEqual({ Pendants: 2 });
    await expectExact(store, cat);
  });

  it('concurrent writes (creates, moves, deletes) never lose a count', async () => {
    const store = new MemoryStore();
    const cat = new CatalogueStore(store, pack, createCatalogueRegistry());
    await cat.stats();
    const docs = makeProducts(60);
    await Promise.all(docs.map((d) => cat.create(d)));
    await Promise.all([
      ...docs.slice(0, 20).map((d) => cat.replace(d.id, (cur) => ({ ...cur!, category: 'Moved' }))),
      ...docs.slice(20, 35).map((d) => cat.remove(d.id)),
      ...makeProducts(10, 'late').map((d) => cat.create(d))
    ]);
    await expectExact(store, cat);
    expect((await cat.stats()).total).toBe(60 - 15 + 10);
    // the index agrees with the counters
    expect((await cat.index())!.size).toBe(55);
  });

  it('bulk import is ONE transaction and ONE counter change for the whole batch', async () => {
    const store = countingStore(new MemoryStore());
    const cat = new CatalogueStore(store, pack);
    await cat.stats();
    const before = (await cat.stats()).rev;
    store.reset();
    await cat.createMany(makeProducts(50, 'imp'));
    expect(store.counts.reads).toBe(1); // the control doc, once
    expect((await cat.stats()).rev).toBe(before + 1);
    expect((await cat.stats()).total).toBe(50);
    await expectExact(store, cat);
  });

  it('rename moves the count; delete collection removes it (chunked)', async () => {
    const store = new MemoryStore();
    const cat = new CatalogueStore(store, pack);
    await seed(store, makeProducts(70));
    await cat.stats();
    const rings = (await cat.stats()).byCat.Rings;
    expect(await cat.renameCategory('Rings', 'Finger Rings', 8)).toBe(rings);
    const s = await cat.stats();
    expect(s.byCat.Rings).toBeUndefined();
    expect(s.byCat['Finger Rings']).toBe(rings);
    await expectExact(store, cat);
    expect(await cat.removeCategory('Finger Rings', 8)).toBe(rings);
    expect((await cat.stats()).total).toBe(70 - rings);
    await expectExact(store, cat);
  });
});

describe('control doc: lazy rebuild and forced recount', () => {
  it('a missing doc is rebuilt by ONE scan even for concurrent readers, then written', async () => {
    const store = countingStore(new MemoryStore());
    await seed(store, makeProducts(40));
    const cat = new CatalogueStore(store, pack);
    store.reset();
    const all = await Promise.all([cat.stats(), cat.stats(), cat.stats(), cat.stats()]);
    expect(store.counts.lists).toBe(1);
    expect(all.every((s) => s.total === 40)).toBe(true);
    expect(await store.get(STATS_COLLECTION, STATS_ID)).toMatchObject({ total: 40, v: STATS_VERSION });
    store.reset();
    await cat.stats();
    expect(store.counts.lists).toBe(0); // the doc is trusted now
  });

  it('a write to a store with no counters leaves them untrusted; the next read recounts', async () => {
    const store = new MemoryStore();
    await seed(store, makeProducts(10));
    const cat = new CatalogueStore(store, pack);
    await cat.create(mk({ id: 'new', sku: 'NEW' }));
    expect((await store.get<StatsDoc>(STATS_COLLECTION, STATS_ID))!.stale).toBe(true);
    expect((await cat.stats()).total).toBe(11);
    await expectExact(store, cat);
  });

  it('an old version is rebuilt; recount forces a rebuild and reports drift', async () => {
    const store = new MemoryStore();
    await seed(store, makeProducts(25));
    const cat = new CatalogueStore(store, pack);
    await cat.stats();
    await store.update(STATS_COLLECTION, STATS_ID, { v: STATS_VERSION - 1 });
    expect((await cat.stats()).v).toBe(STATS_VERSION);
    await store.update(STATS_COLLECTION, STATS_ID, { total: 999 }); // tamper: looks trusted but is wrong
    expect((await cat.stats()).total).toBe(999);
    const dry = await cat.check();
    expect(dry.drift).toBe(true);
    expect((await store.get<StatsDoc>(STATS_COLLECTION, STATS_ID))!.total).toBe(999); // check wrote nothing
    const fixed = await cat.recount();
    expect(fixed.drift).toBe(true);
    expect(fixed.after.total).toBe(25);
    expect((await cat.recount()).drift).toBe(false);
  });

  it('a write that lands during the rebuild scan forces a re-scan, not a wrong count', async () => {
    const mem = new MemoryStore();
    await seed(mem, makeProducts(20));
    let gate: (() => void) | null = null;
    let first = true;
    const racing: Store = Object.assign(Object.create(mem), {
      list: async (c: string, o?: any) => {
        const out = await mem.list(c, o);
        if (c === 'products' && first) {
          first = false;
          await new Promise<void>((r) => (gate = r)); // hold the first scan open
        }
        return out;
      }
    });
    const cat = new CatalogueStore(racing, pack);
    const rebuilding = cat.stats();
    await new Promise((r) => setTimeout(r, 20));
    await cat.create(mk({ id: 'during', sku: 'DURING' })); // writes a stale marker (rev moves) while the scan is paused
    gate!();
    const stats = await rebuilding;
    expect(stats.total).toBe(21);
    await expectExact(mem, new CatalogueStore(mem, pack));
  });
});

describe('index: same answers as the old scan', () => {
  const docs = makeProducts(1500);
  const queries: Array<Record<string, unknown>> = [
    {}, { sort: 'weight-asc' }, { sort: 'weight-desc' }, { sort: 'name' }, { search: 'necklace' }, { search: 'necklace lakshmi' }, { search: 'हार' },
    { search: 'sku-12' }, { search: 'kundan' }, { search: 'HM77' }, { category: 'Rings' }, { category: 'rings,Pendants' }, { category: 'all' }, { purity: '22K 916' },
    { purity: '18k 750,14K 585', sort: 'weight-desc' }, { minWt: 10 }, { maxWt: 5 }, { minWt: 5, maxWt: 20, sort: 'weight-asc' }, { availability: 'Ready in Vault' },
    { availability: 'made-to-order,draft', sort: 'name' }, { search: 'temple', category: 'Jhumka', purity: '22K 916', minWt: 2, sort: 'name' }, { search: 'zzzz-no-match' }
  ];

  it('filters, sorts and search return exactly the old applyQuery list (incl. ties)', async () => {
    const store = new MemoryStore();
    await seed(store, docs);
    const cat = new CatalogueStore(store, pack);
    const idx = (await cat.index())!;
    for (const raw of queries) {
      const q = pack.querySchema.parse(raw);
      const oldIds = pack.applyQuery(byId(docs), q).map((p) => p.id);
      expect(idx.query(pack, q).map((e) => e.id), JSON.stringify(raw)).toEqual(oldIds);
    }
  });

  it('stays identical after writes (edit, move, delete, create)', async () => {
    const store = new MemoryStore();
    await seed(store, docs);
    const cat = new CatalogueStore(store, pack);
    await cat.index();
    await cat.replace(docs[5].id, (cur) => ({ ...cur!, title: 'Zebra Necklace', category: 'Rings', netWt: 77.7 }));
    await cat.remove(docs[6].id);
    await cat.create(mk({ id: 'zz-new', sku: 'ZZ', title: 'Necklace Special', createdAt: '2030-01-01T00:00:00.000Z' }));
    const now = await store.list('products');
    const idx = (await cat.index())!;
    expect(cat.idx).toBe(idx); // updated in place by write-through, not rebuilt
    for (const raw of queries) {
      const q = pack.querySchema.parse(raw);
      expect(idx.query(pack, q).map((e) => e.id), JSON.stringify(raw)).toEqual(pack.applyQuery(byId(now), q).map((p) => p.id));
    }
  });

  it('another instance writing shows up (control doc rev) and by-sku works', async () => {
    const store = new MemoryStore();
    await seed(store, docs.slice(0, 100));
    const a = new CatalogueStore(store, pack);
    const b = new CatalogueStore(store, pack);
    expect((await a.index())!.size).toBe(100);
    await b.index();
    await b.create(mk({ id: 'from-b', sku: 'FROM-B' }));
    expect((await a.index())!.size).toBe(101);
    expect((await a.index())!.idsForSkus(new Set(['FROM-B', 'SKU-3', 'NOPE']))).toEqual(['from-b', 'item-000003']);
  });
});

describe('reads are O(page), not O(n)', () => {
  it('a warm page costs the control doc plus the page; a scan only happens once', async () => {
    const store = countingStore(new MemoryStore());
    await seed(store, makeProducts(2000));
    const cat = new CatalogueStore(store, pack);
    await cat.index(); // first request: the one scan
    store.reset();
    const idx = (await cat.index())!;
    const page = idx.query(pack, pack.querySchema.parse({ search: 'necklace', sort: 'name' })).slice(0, 24);
    const docs = await cat.fetch(page.map((e) => e.id));
    expect(docs).toHaveLength(24);
    expect(store.counts.reads).toBe(1 + 24);
    expect(store.counts.lists).toBe(0);
    store.reset();
    await cat.stats();
    expect(store.counts.reads).toBe(1);
  });
});

describe('isolation and memory cap', () => {
  it("store A's counters and index never leak into B", async () => {
    const root = new MemoryStore();
    const reg = createCatalogueRegistry();
    const A = reg.for('aaa', scopeStore(root, 'aaa'), pack);
    const B = reg.for('b', scopeStore(root, 'bbb'), pack);
    await seed(scopeStore(root, 'aaa'), makeProducts(30));
    await seed(scopeStore(root, 'bbb'), makeProducts(7)); // same ids, skus and categories on purpose
    expect((await A.stats()).total).toBe(30);
    expect((await B.stats()).total).toBe(7);
    await A.create(mk({ id: 'only-a', sku: 'ONLY-A', category: 'Only A' }));
    expect((await B.stats()).byCat['Only A']).toBeUndefined();
    expect((await B.index())!.idsForSkus(new Set(['ONLY-A']))).toEqual([]);
    expect((await A.index())!.size).toBe(31);
    expect((await B.index())!.size).toBe(7);
    await B.remove('item-000001');
    expect((await A.stats()).total).toBe(31);
    expect(await root.get('stores/aaa/settings', STATS_ID)).toMatchObject({ total: 31 });
    expect(await root.get('stores/bbb/settings', STATS_ID)).toMatchObject({ total: 6 });
  });

  it('evicts the least recently used store beyond the budget and rebuilds on demand; an oversized store is not indexed', async () => {
    const root = new MemoryStore();
    const reg = createCatalogueRegistry({ maxEntries: 100 });
    const names = ['sto1', 'sto2', 'sto3'];
    const cats = names.map((n) => reg.for(n, scopeStore(root, n), pack));
    for (const [i, n] of names.entries()) await seed(scopeStore(root, n), makeProducts(60, n));
    for (const c of cats) await c.index();
    expect(reg.held()).toBeLessThanOrEqual(100);
    expect(cats[2].idx?.size).toBe(60); // the newest stays
    expect(cats[0].idx).toBeNull(); // the oldest went
    expect((await cats[0].index())!.size).toBe(60); // rebuilt lazily, correct
    expect(reg.held()).toBeLessThanOrEqual(100);
    expect((await cats[0].stats()).total).toBe(60); // counters never depended on the index

    await seed(scopeStore(root, 'big'), makeProducts(150, 'big'));
    const big = reg.for('big', scopeStore(root, 'big'), pack);
    expect(await big.index()).toBeNull();
    expect((await big.stats()).total).toBe(150);
    expect(reg.held()).toBeLessThanOrEqual(100);
  });
});
