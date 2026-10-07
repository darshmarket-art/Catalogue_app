import fs from 'fs';
import path from 'path';
import type { Store } from './store';

interface SeedFile {
  categories?: Array<Record<string, any> & { id: string }>;
  products?: Array<Record<string, any> & { id: string }>;
}

/**
 * Loads a merchant's demo catalogue (merchants/<id>/seed.json) into an empty store, so a fresh development
 * environment has something to browse. A merchant without a seed file simply starts empty.
 */
export async function seedDemoCatalogue(store: Store, merchantId: string, root: string = process.cwd()) {
  const file = path.resolve(root, 'merchants', merchantId, 'seed.json');
  if (!fs.existsSync(file)) return;
  const seed = JSON.parse(fs.readFileSync(file, 'utf-8')) as SeedFile;

  const [existingCategories, existingProducts] = await Promise.all([
    store.list('categories', { limit: 1 }),
    store.list('products', { limit: 1 })
  ]);
  const now = Date.now();

  if (existingCategories.length === 0) {
    // createdAt ascending keeps the listing in the same order as the seed file.
    for (const [i, category] of (seed.categories ?? []).entries()) {
      await store.set('categories', category.id, { ...category, createdAt: new Date(now + i).toISOString() });
    }
  }
  if (existingProducts.length === 0) {
    // Products list newest-first, so the first seed entry gets the latest timestamp.
    for (const [i, product] of (seed.products ?? []).entries()) {
      await store.set('products', product.id, { ...product, createdAt: new Date(now - i * 1000).toISOString() });
    }
    // Recalculate designCount from the actual products so it matches reality,
    // regardless of what value the seed file happened to contain.
    const counts = new Map<string, number>();
    for (const p of seed.products ?? []) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    for (const [name, count] of counts) {
      const cat = await store.list('categories', { where: [{ field: 'name', op: '==', value: name }], limit: 1 });
      if (cat.length > 0) await store.update('categories', cat[0].id, { designCount: count });
    }
  }
}
