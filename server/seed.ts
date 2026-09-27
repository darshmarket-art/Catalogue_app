import type { Store } from './store';
import seed from './seed/catalogue.json';

/** Loads the demo catalogue into an empty store so a fresh dev environment has something to browse. */
export async function seedDemoCatalogue(store: Store) {
  const [existingCategories, existingProducts] = await Promise.all([
    store.list('categories', { limit: 1 }),
    store.list('products', { limit: 1 })
  ]);
  const now = Date.now();

  if (existingCategories.length === 0) {
    // createdAt ascending keeps the listing in the same order as the seed file.
    for (const [i, category] of seed.categories.entries()) {
      await store.set('categories', category.id, { ...category, createdAt: new Date(now + i).toISOString() });
    }
  }
  if (existingProducts.length === 0) {
    // Products list newest-first, so the first seed entry gets the latest timestamp.
    for (const [i, product] of seed.products.entries()) {
      await store.set('products', product.id, { ...product, createdAt: new Date(now - i * 1000).toISOString() });
    }
  }
}
