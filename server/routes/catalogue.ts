import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import type { SectorPack } from '../sectors';
import { PLACEHOLDER_IMAGE } from '../placeholder';
import { HttpError, handler, newId, parse } from '../http';
import { categorySchema, paginationSchema } from '../schemas';

const byCreatedAt = (dir: 1 | -1) => (a: any, b: any) =>
  dir * String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));

export function catalogueRoutes(store: Store, pack: SectorPack, requireAdmin: RequestHandler, readGuard: RequestHandler) {
  const router = Router();

  // The number of designs in a category is counted from the products, never stored, so it cannot drift.
  router.get(
    '/categories',
    readGuard,
    handler(async (_req, res) => {
      const [categories, products] = await Promise.all([store.list('categories'), store.list('products')]);
      const counts = new Map<string, number>();
      for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
      const data = categories.sort(byCreatedAt(1)).map((c) => ({ ...c, designCount: counts.get(c.name) ?? 0 }));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.post(
    '/categories',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(categorySchema, req.body);
      const min = body.minTargetWt ?? 20;
      const max = body.maxTargetWt ?? 100;
      const id = newId('cat');
      const category = {
        id,
        slug: body.slug || `CAT-${body.name.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}`,
        name: body.name,
        subtitle: body.subtitle || 'Curated wholesale collection',
        avgNetWt: `${min}g – ${max}g`,
        image: body.image || PLACEHOLDER_IMAGE,
        eligibleKarats: body.eligibleKarats ?? [],
        minTargetWt: min,
        maxTargetWt: max,
        createdAt: new Date().toISOString()
      };
      await store.set('categories', id, category);
      res.status(201).json({ status: 'success', message: 'Category created successfully', data: { ...category, designCount: 0 } });
    })
  );

  router.get(
    '/products',
    readGuard,
    handler(async (req, res) => {
      const { limit, offset } = parse(paginationSchema, req.query);
      const { search, category, purity } = req.query;
      let list = (await store.list('products')).sort(byCreatedAt(-1));

      if (typeof search === 'string' && search) {
        const q = search.toLowerCase();
        list = list.filter(
          (p) => p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
        );
      }
      if (typeof category === 'string' && category && category !== 'all') {
        list = list.filter((p) => p.category.toLowerCase().includes(category.toLowerCase()));
      }
      if (typeof purity === 'string' && purity && purity !== 'all') {
        list = list.filter((p) => p.purity.toLowerCase().includes(purity.toLowerCase()));
      }

      res.json({ status: 'success', count: list.length, offset, limit, data: list.slice(offset, offset + limit) });
    })
  );

  router.post(
    '/products',
    requireAdmin,
    handler(async (req, res) => {
      const input = parse(pack.productSchema, req.body);

      if (input.sku) {
        const existing = await store.list('products', { where: [{ field: 'sku', op: '==', value: input.sku }], limit: 1 });
        if (existing.length > 0) throw new HttpError(409, `A product with SKU ${input.sku} already exists.`);
      }

      const id = newId('item');
      const product = pack.buildProduct(input, { id, now: new Date().toISOString() });
      await store.set('products', id, product);
      res.status(201).json({ status: 'success', message: 'Product listed successfully to live catalogue', data: product });
    })
  );

  return router;
}
