import type { Store } from './store';

/**
 * Buyer accounts used to live in a collection called "merchants". That name now means the business that owns the
 * catalogue, so buyers moved to "buyers". This copies any accounts left in the old collection; it never overwrites
 * or deletes anything, so it is safe to run on every start.
 */
export async function migrateLegacyBuyers(store: Store): Promise<number> {
  const legacy = await store.list('merchants');
  let copied = 0;
  for (const doc of legacy) {
    if (await store.create('buyers', String(doc.phone ?? doc.id), doc)) copied++;
  }
  return copied;
}
