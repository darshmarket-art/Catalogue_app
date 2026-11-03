import type { Doc, Store, Tx } from '../server/store';

/**
 * Test-only: wraps a Store and counts the documents it READS (what Firestore bills): a get is 1, a getMany is its ids,
 * a list is the documents returned, and each get inside a transaction is 1. `reads` is resettable between measurements.
 */
export function countingStore(inner: Store) {
  const c = { reads: 0, writes: 0, lists: 0, byCollection: {} as Record<string, number> };
  const read = (col: string, n: number) => {
    c.reads += n;
    c.byCollection[col] = (c.byCollection[col] ?? 0) + n;
  };
  const store: Store = {
    get: async (col, id) => (read(col, 1), inner.get(col, id)),
    getMany: async (col, ids) => (read(col, ids.length), inner.getMany(col, ids)),
    list: async (col, o) => {
      const out = await inner.list(col, o);
      c.lists++;
      read(col, out.length);
      return out as any;
    },
    set: async (col, id, d) => (c.writes++, inner.set(col, id, d)),
    create: async (col, id, d) => (c.writes++, inner.create(col, id, d)),
    delete: async (col, id) => (c.writes++, inner.delete(col, id)),
    update: async (col, id, d) => (c.writes++, inner.update(col, id, d)),
    increment: async (col, id, f, e) => (c.writes++, inner.increment(col, id, f, e)),
    transact: (fn) =>
      inner.transact((tx: Tx) =>
        fn({
          get: async (col, id) => (read(col, 1), tx.get(col, id)) as any,
          set: (col, id, d: Doc) => (c.writes++, tx.set(col, id, d)),
          delete: (col, id) => (c.writes++, tx.delete(col, id))
        })
      )
  };
  return Object.assign(store, { counts: c, reset: () => { c.reads = 0; c.writes = 0; c.lists = 0; c.byCollection = {}; } });
}
