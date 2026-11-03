import type { Doc, Store, Tx } from './store';
import type { CatalogueQuery, Slim } from './sectors/jewellery';
import type { SectorPack } from './sectors';

/**
 * Two things that stop every product request from reading the whole collection (docs/PERF_STORE_FIX.md):
 *
 * 1. CONTROL DOC  stores/<id>/settings/catalogueStats: exact counters (total designs, designs per collection) and a `rev`
 *    that goes up by one on EVERY product write. Each write changes the product and this doc in ONE Store.transact.
 *    Missing, `stale` or an old `v` means "not trusted": the next read rebuilds it with one scan (single-flight, and
 *    guarded by `rev` so a write racing the scan forces a re-scan instead of a wrong count).
 * 2. INDEX  a per-store, in-memory list of slim products (see Slim) built lazily from one scan. This process updates it
 *    after each of its own writes; any other instance's write shows up as a `rev` change in the control doc, which the
 *    request path reads (one document) and answers with a rebuild. Pages are built from the index, then only the
 *    page's full documents are fetched by id. A memory budget across stores evicts the least recently used index.
 */

export const STATS_COLLECTION = 'settings';
export const STATS_ID = 'catalogueStats';
/** Bump to force every store's counters to be rebuilt on next read. */
export const STATS_VERSION = 1;

export interface StatsDoc {
  id: string;
  v: number;
  rev: number;
  updatedAt: string;
  total: number;
  /** Designs per collection, keyed by collection NAME (products point at their collection by name). */
  byCat: Record<string, number>;
  stale?: boolean;
}

/** Product count changes of one write. */
export interface Delta { total: number; cats: Record<string, number> }
export const noDelta = (): Delta => ({ total: 0, cats: {} });
export const bump = (d: Delta, category: unknown, by: number) => {
  const k = String(category ?? '');
  d.total += by;
  d.cats[k] = (d.cats[k] ?? 0) + by;
};

const trusted = (d: StatsDoc | null | undefined): d is StatsDoc =>
  Boolean(d) && !d!.stale && d!.v === STATS_VERSION && typeof d!.total === 'number' && typeof d!.byCat === 'object' && d!.byCat !== null;

/** The next control doc after a write. An untrusted doc stays untrusted (only `rev` moves) so a rebuild notices the write. */
export function applyDelta(cur: StatsDoc | null, d: Delta, now = new Date().toISOString()): StatsDoc {
  const rev = cur?.rev ?? 0;
  if (!trusted(cur)) return { id: STATS_ID, v: STATS_VERSION, rev: rev + 1, updatedAt: now, stale: true, total: 0, byCat: {} };
  const byCat = { ...cur.byCat };
  for (const [k, n] of Object.entries(d.cats)) {
    const v = (byCat[k] ?? 0) + n;
    if (v > 0) byCat[k] = v;
    else delete byCat[k];
  }
  return { id: STATS_ID, v: STATS_VERSION, rev: cur.rev + 1, updatedAt: now, total: Math.max(0, cur.total + d.total), byCat };
}

export const emptyStats = (): StatsDoc => ({ id: STATS_ID, v: STATS_VERSION, rev: 1, updatedAt: new Date().toISOString(), total: 0, byCat: {} });

/** A new store starts with a trusted, empty control doc (no-op when one exists). */
export const initStats = (store: Store) => store.create(STATS_COLLECTION, STATS_ID, emptyStats());

const yieldLoop = () => new Promise<void>((r) => setImmediate(r));
const SCAN_RETRIES = 4;

/** What one committed write did, for the in-process index. */
interface Committed { rev: number; trusted: boolean; upserts: Doc[]; removes: string[] }

class Index {
  rev: number;
  touched = Date.now();
  entries = new Map<string, Slim>();
  private bySku = new Map<string, Set<string>>();
  private orders = new Map<string, Slim[]>();
  private photoCache: Set<string> | null = null;
  constructor(rev: number) { this.rev = rev; }

  get size() { return this.entries.size; }

  put(e: Slim) {
    const old = this.entries.get(e.id);
    if (old) this.unsku(old);
    this.entries.set(e.id, e);
    let s = this.bySku.get(e.sku);
    if (!s) this.bySku.set(e.sku, (s = new Set()));
    s.add(e.id);
    this.dirty();
  }

  remove(id: string) {
    const old = this.entries.get(id);
    if (!old) return;
    this.unsku(old);
    this.entries.delete(id);
    this.dirty();
  }

  private unsku(e: Slim) {
    const s = this.bySku.get(e.sku);
    s?.delete(e.id);
    if (s && !s.size) this.bySku.delete(e.sku);
  }

  private dirty() {
    this.orders.clear();
    this.photoCache = null;
  }

  idsForSkus(skus: Set<string>): string[] {
    const out: string[] = [];
    for (const sku of skus) for (const id of this.bySku.get(sku) ?? []) out.push(id);
    return out.sort(); // the old path listed by document id
  }

  /** Every entry in id order (what an unordered Firestore list returns), then stably sorted: the same input order applyQuery sees. */
  private ordered(pack: SectorPack, sort: CatalogueQuery['sort']): Slim[] {
    let o = this.orders.get(sort);
    if (!o) {
      let base = this.orders.get('id');
      if (!base) this.orders.set('id', (base = [...this.entries.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))));
      o = [...base].sort(pack.comparator(sort));
      this.orders.set(sort, o);
    }
    return o;
  }

  query(pack: SectorPack, q: CatalogueQuery): Slim[] {
    this.touched = Date.now();
    const match = pack.matcher(q);
    return this.ordered(pack, q.sort).filter(match);
  }

  photos(): Set<string> {
    if (!this.photoCache) {
      const s = new Set<string>();
      for (const e of this.entries.values()) for (const i of e.images) s.add(i);
      this.photoCache = s;
    }
    return this.photoCache;
  }
}

/** Shared memory budget across stores' indexes. */
export interface Registry {
  /** The catalogue handle of one store (created once, reused). */
  for(storeId: string, store: Store, pack: SectorPack): CatalogueStore;
  /** Product entries currently held in memory, all stores. */
  held(): number;
  maxEntries: number;
  /** Evicts least recently used indexes of OTHER stores until the budget fits; returns false if `current` alone does not fit. */
  enforce(current: CatalogueStore): boolean;
}

export function createCatalogueRegistry(opts: { maxEntries?: number } = {}): Registry {
  const all = new Map<string, CatalogueStore>();
  const maxEntries = opts.maxEntries ?? (Number(process.env.CATALOGUE_INDEX_MAX_ENTRIES) || 300_000);
  const reg: Registry = {
    maxEntries,
    held: () => [...all.values()].reduce((n, c) => n + (c.idx?.size ?? 0), 0),
    enforce(current) {
      let total = reg.held();
      const others = [...all.values()].filter((c) => c !== current && c.idx).sort((a, b) => a.idx!.touched - b.idx!.touched);
      for (const c of others) {
        if (total <= maxEntries) break;
        total -= c.idx!.size;
        c.drop();
      }
      return total <= maxEntries;
    },
    for(storeId, store, pack) {
      let c = all.get(storeId);
      if (!c) all.set(storeId, (c = new CatalogueStore(store, pack, reg)));
      return c;
    }
  };
  return reg;
}

/** Everything about one store's products that is not a plain read/write of a single product. */
export class CatalogueStore {
  idx: Index | null = null;
  private pending = new Map<number, Committed>();
  private building: Promise<Index | null> | null = null;
  private rebuilding: Promise<StatsDoc> | null = null;
  private tooBigUntil = 0;

  constructor(private store: Store, private pack: SectorPack | null = null, private reg: Registry | null = null) {}

  // ---- counters ----

  /** The trusted control doc: one document read, or a rebuild when it is missing or untrusted. */
  async stats(): Promise<StatsDoc> {
    const cur = await this.store.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
    return trusted(cur) ? cur : this.rebuild(false);
  }

  /** Rebuilds the control doc by one scan. `force` recounts even when the doc looks fine (console "Recount store"). */
  rebuild(force: boolean): Promise<StatsDoc> {
    if (!force && this.rebuilding) return this.rebuilding;
    const run = this.scanAndWrite(force).finally(() => { if (this.rebuilding === run) this.rebuilding = null; });
    this.rebuilding = run;
    return run;
  }

  private async scanAndWrite(force: boolean): Promise<StatsDoc> {
    let last: StatsDoc | null = null;
    for (let attempt = 0; attempt < SCAN_RETRIES; attempt++) {
      const cur = await this.store.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
      if (!force && trusted(cur)) return cur; // another instance got there first
      const r0 = cur?.rev ?? 0;
      const { counts, index } = await this.scan();
      const next: StatsDoc = { id: STATS_ID, v: STATS_VERSION, rev: r0 + 1, updatedAt: new Date().toISOString(), total: counts.total, byCat: counts.cats };
      last = next;
      const ok = await this.store.transact(async (tx) => {
        const now = await tx.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
        if ((now?.rev ?? 0) !== r0) return false; // a product write landed during the scan: count again
        tx.set(STATS_COLLECTION, STATS_ID, next);
        return true;
      });
      if (ok) {
        if (index) this.adopt(index, next.rev);
        return next;
      }
    }
    return last!; // a store written to constantly: serve the scan, leave the doc untrusted so the next read tries again
  }

  /** Read-only comparison of the control doc with what the products say. Writes nothing. */
  async check(): Promise<{ stored: StatsDoc | null; actual: { total: number; byCat: Record<string, number> }; drift: boolean }> {
    const stored = await this.store.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
    const { counts } = await this.scan(false);
    const actual = { total: counts.total, byCat: counts.cats };
    const drift = !trusted(stored) || stored.total !== actual.total || JSON.stringify(sortKeys(stored.byCat)) !== JSON.stringify(sortKeys(actual.byCat));
    return { stored: stored ?? null, actual, drift };
  }

  /** Owner-invisible reconcile: recount from the products and write the control doc. */
  async recount() {
    const before = await this.store.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
    const after = await this.rebuild(true);
    const drift = !trusted(before) || before.total !== after.total || JSON.stringify(sortKeys(before.byCat)) !== JSON.stringify(sortKeys(after.byCat));
    return { before: before ?? null, after, drift };
  }

  /** One pass over the products: exact counts, and (when allowed) the slim index. */
  private async scan(wantIndex = true): Promise<{ counts: Delta; index: Index | null }> {
    const docs = await this.store.list<Doc>('products');
    const counts = noDelta();
    const pack = wantIndex ? this.pack : null;
    const index = pack ? new Index(0) : null;
    let n = 0;
    for (const p of docs) {
      bump(counts, p.category, 1);
      index?.put(pack!.slim(p));
      if (++n % 2000 === 0) await yieldLoop(); // keep the event loop breathing: Hindi search text is the costly part
    }
    return { counts, index: index && docs.length <= (this.reg?.maxEntries ?? Infinity) ? index : null };
  }

  // ---- index ----

  /** Takes a freshly scanned index as current, then replays this process's writes that committed after it. */
  private adopt(index: Index, rev: number) {
    index.rev = rev;
    this.idx = index;
    this.drain();
    this.enforceBudget();
  }

  private drain() {
    const idx = this.idx;
    if (!idx) return;
    for (let c = this.pending.get(idx.rev + 1); c; c = this.pending.get(idx.rev + 1)) {
      this.pending.delete(c.rev);
      this.applyCommitted(idx, c);
    }
    for (const r of this.pending.keys()) if (r <= idx.rev) this.pending.delete(r);
  }

  private applyCommitted(idx: Index, c: Committed) {
    for (const id of c.removes) idx.remove(id);
    for (const d of c.upserts) idx.put(this.pack!.slim(d));
    idx.rev = c.rev;
  }

  private enforceBudget() {
    if (this.reg && !this.reg.enforce(this)) {
      this.drop();
      this.tooBigUntil = Date.now() + 60_000;
    }
  }

  /** Forget the index (memory eviction or an untrusted counter); it is rebuilt on demand. */
  drop() {
    this.idx = null;
    this.pending.clear();
  }

  /** The current index, or null when this store is too big to hold (callers then fall back to a scan). */
  async index(): Promise<Index | null> {
    if (!this.pack) return null;
    const ctl = await this.stats(); // one document read (a rebuild also builds the index)
    if (this.idx && this.idx.rev === ctl.rev) {
      this.idx.touched = Date.now();
      return this.idx;
    }
    if (Date.now() < this.tooBigUntil) return null;
    if (!this.building) {
      const run = (async () => {
        const { index } = await this.scan();
        if (!index) {
          this.tooBigUntil = Date.now() + 60_000;
          this.drop();
          return null;
        }
        this.adopt(index, ctl.rev); // rev read BEFORE the scan: a write during it leaves the index one behind, so the next request rebuilds
        return this.idx;
      })().finally(() => { this.building = null; });
      this.building = run;
    }
    return this.building;
  }

  /** Distinct photo refs used by designs; null when the index cannot be held (caller scans). */
  async photos(): Promise<Set<string> | null> {
    return (await this.index())?.photos() ?? null;
  }

  /** The full documents for these ids, in order; ids that no longer exist are dropped from the index. */
  async fetch(ids: string[]): Promise<Doc[]> {
    const docs = await this.store.getMany<Doc>('products', ids);
    const out: Doc[] = [];
    docs.forEach((d, i) => {
      if (d) out.push(d);
      else this.idx?.remove(ids[i]);
    });
    return out;
  }

  // ---- writes: the product change and the control doc change commit together ----

  /**
   * Runs `plan` inside one transaction. It may read (tx.get) and returns what to write plus the count change.
   * Do not put side effects in `plan`: Firestore re-runs it on contention.
   */
  async write<T>(plan: (tx: Tx) => Promise<{ result: T; delta: Delta; upserts?: Doc[]; removes?: string[] }>): Promise<T> {
    let committed: Committed | undefined;
    const out = await this.store.transact(async (tx) => {
      const cur = await tx.get<StatsDoc>(STATS_COLLECTION, STATS_ID);
      const p = await plan(tx);
      const next = applyDelta(cur, p.delta);
      tx.set(STATS_COLLECTION, STATS_ID, next);
      for (const d of p.upserts ?? []) tx.set('products', d.id, d);
      for (const id of p.removes ?? []) tx.delete('products', id);
      committed = { rev: next.rev, trusted: !next.stale, upserts: p.upserts ?? [], removes: p.removes ?? [] };
      return p.result;
    });
    this.afterCommit(committed!);
    return out;
  }

  private afterCommit(c: Committed) {
    const idx = this.idx;
    if (!c.trusted) return this.drop(); // counters were not trusted, so neither is the index
    if (!idx) {
      if (this.building || this.rebuilding) this.pending.set(c.rev, c); // a scan is running: replay this write onto it
      return;
    }
    if (c.rev <= idx.rev) return;
    if (c.rev === idx.rev + 1) { this.applyCommitted(idx, c); this.drain(); } else {
      this.pending.set(c.rev, c);
      if (this.pending.size > 200) this.drop();
    }
  }

  create(doc: Doc) {
    return this.write(async () => {
      const delta = noDelta();
      bump(delta, doc.category, 1);
      return { result: doc, delta, upserts: [doc] };
    });
  }

  /** Several new products, one transaction and one counter change. (Firestore allows 500 writes in one.) */
  createMany(docs: Doc[]) {
    return this.write(async () => {
      const delta = noDelta();
      for (const d of docs) bump(delta, d.category, 1);
      return { result: docs, delta, upserts: docs };
    });
  }

  /** Replaces a product; `build` gets the current stored one (null if it vanished) and returns the new document. */
  replace(id: string, build: (cur: Doc | null) => Doc | null) {
    return this.write(async (tx) => {
      const cur = await tx.get<Doc>('products', id);
      const next = build(cur);
      const delta = noDelta();
      if (cur && next) {
        if (cur.category !== next.category) { bump(delta, cur.category, -1); bump(delta, next.category, 1); }
      }
      return { result: next, delta, upserts: next ? [next] : [] };
    });
  }

  remove(id: string) {
    return this.write(async (tx) => {
      const cur = await tx.get<Doc>('products', id);
      const delta = noDelta();
      if (cur) bump(delta, cur.category, -1);
      return { result: cur, delta, removes: cur ? [id] : [] };
    });
  }

  /** Moves the given products to another collection name (collection rename), CHUNK at a time. Returns how many moved. */
  async renameCategory(from: string, to: string, chunk = 200): Promise<number> {
    const ids = (await this.store.list<Doc>('products', { where: [{ field: 'category', op: '==', value: from }] })).map((p) => p.id as string);
    let moved = 0;
    for (let i = 0; i < ids.length; i += chunk) {
      moved += await this.write(async (tx) => {
        const delta = noDelta();
        const upserts: Doc[] = [];
        for (const id of ids.slice(i, i + chunk)) {
          const cur = await tx.get<Doc>('products', id);
          if (!cur || cur.category !== from) continue;
          upserts.push({ ...cur, category: to });
          bump(delta, from, -1);
          bump(delta, to, 1);
        }
        return { result: upserts.length, delta, upserts };
      });
    }
    return moved;
  }

  /** Deletes every product of a collection, CHUNK at a time. Returns how many went. */
  async removeCategory(name: string, chunk = 200): Promise<number> {
    const ids = (await this.store.list<Doc>('products', { where: [{ field: 'category', op: '==', value: name }] })).map((p) => p.id as string);
    let gone = 0;
    for (let i = 0; i < ids.length; i += chunk) {
      gone += await this.write(async (tx) => {
        const delta = noDelta();
        const removes: string[] = [];
        for (const id of ids.slice(i, i + chunk)) {
          const cur = await tx.get<Doc>('products', id);
          if (!cur) continue;
          removes.push(id);
          bump(delta, cur.category, -1);
        }
        return { result: removes.length, delta, removes };
      });
    }
    return gone;
  }
}

const sortKeys = (o: Record<string, number>) => Object.fromEntries(Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));

export type { Index };
