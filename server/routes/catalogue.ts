import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Doc, Store } from '../store';
import type { Blobs } from '../blobs';
import type { MerchantConfig } from '../merchant';
import type { SectorPack } from '../sectors';
import { assertPhotosExist, type Media } from '../media';
import { parseExtras } from '../productFields';
import { HttpError, audit, handler, newId, parse } from '../http';
import { bannerSchema, categorySchema, paginationSchema } from '../schemas';

const byCreatedAt = (dir: 1 | -1) => (a: any, b: any) =>
  dir * String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));

interface Deps {
  store: Store;
  blobs: Blobs;
  media: Media;
  merchant: MerchantConfig;
  pack: SectorPack;
  requireAdmin: RequestHandler;
  readGuard: RequestHandler;
}

export function catalogueRoutes({ store, blobs, media, merchant, pack, requireAdmin, readGuard }: Deps) {
  const router = Router();

  const categoryDoc = (body: ReturnType<typeof categorySchema.parse>, base: { id: string; createdAt: string }) => {
    const min = body.minTargetWt ?? 20;
    const max = body.maxTargetWt ?? 100;
    return {
      ...base,
      slug: body.slug || `CAT-${body.name.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}`,
      name: body.name,
      subtitle: body.subtitle || 'Curated wholesale collection',
      avgNetWt: `${min}g – ${max}g`,
      image: body.image,
      eligibleKarats: body.eligibleKarats ?? [],
      minTargetWt: min,
      maxTargetWt: max
    };
  };

  // The number of designs in a category is counted from the products, never stored, so it cannot drift.
  router.get(
    '/categories',
    readGuard,
    handler(async (_req, res) => {
      const [categories, products] = await Promise.all([store.list('categories'), store.list('products')]);
      const counts = new Map<string, number>();
      for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
      const data = categories.sort(byCreatedAt(1)).map((c) => ({ ...media.present(c), designCount: counts.get(c.name) ?? 0 }));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.post(
    '/categories',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(categorySchema, req.body);
      await assertPhotosExist(blobs, [body.image]);
      if ((await store.list('categories', { where: [{ field: 'name', op: '==', value: body.name }], limit: 1 })).length > 0) {
        throw new HttpError(409, `A category named "${body.name}" already exists.`);
      }
      const id = newId('cat');
      const category = categoryDoc(body, { id, createdAt: new Date().toISOString() });
      await store.set('categories', id, category);
      res.status(201).json({ status: 'success', message: 'Category created successfully', data: { ...media.present(category), designCount: 0 } });
    })
  );

  router.put(
    '/categories/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('categories', req.params.id);
      if (!existing) throw new HttpError(404, 'Category not found.');
      const body = parse(categorySchema, req.body);
      await assertPhotosExist(blobs, [body.image]);

      const clash = await store.list('categories', { where: [{ field: 'name', op: '==', value: body.name }], limit: 2 });
      if (clash.some((c) => c.id !== existing.id)) throw new HttpError(409, `A category named "${body.name}" already exists.`);

      const category = categoryDoc(body, { id: existing.id, createdAt: existing.createdAt });
      await store.set('categories', existing.id, category);

      // Products point at their category by name, so a rename carries them along.
      const products = await store.list('products', { where: [{ field: 'category', op: '==', value: existing.name }] });
      if (body.name !== existing.name) {
        await Promise.all(products.map((p) => store.update('products', p.id, { category: body.name })));
      }
      await audit(store, req, 'CATEGORY_UPDATED', `Category "${existing.name}" updated${body.name !== existing.name ? ` (renamed to "${body.name}")` : ''}.`);
      res.json({ status: 'success', message: 'Category updated', data: { ...media.present(category), designCount: products.length } });
    })
  );

  router.delete(
    '/categories/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('categories', req.params.id);
      if (!existing) throw new HttpError(404, 'Category not found.');
      const products = await store.list('products', { where: [{ field: 'category', op: '==', value: existing.name }], limit: 1 });
      if (products.length > 0) {
        throw new HttpError(409, 'This category still has designs. Move or delete them first.');
      }
      await store.delete('categories', existing.id);
      await audit(store, req, 'CATEGORY_DELETED', `Category "${existing.name}" deleted.`);
      res.json({ status: 'success', message: 'Category deleted' });
    })
  );

  // Home-page banners are photos the owner uploads; they show oldest first.
  router.get(
    '/banners',
    readGuard,
    handler(async (_req, res) => {
      const data = (await store.list('banners')).sort(byCreatedAt(1)).map((b) => media.present(b));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.post(
    '/banners',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(bannerSchema, req.body);
      await assertPhotosExist(blobs, [body.image]);
      if ((await store.list('banners')).length >= 8) throw new HttpError(409, 'You can keep up to 8 banners. Delete one first.');
      const id = newId('ban');
      const banner = { id, image: body.image, createdAt: new Date().toISOString() };
      await store.set('banners', id, banner);
      await audit(store, req, 'BANNER_ADDED', 'Banner added.');
      res.status(201).json({ status: 'success', data: media.present(banner) });
    })
  );

  router.delete(
    '/banners/:id',
    requireAdmin,
    handler(async (req, res) => {
      if (!(await store.delete('banners', req.params.id))) throw new HttpError(404, 'Banner not found.');
      await audit(store, req, 'BANNER_DELETED', 'Banner deleted.');
      res.json({ status: 'success', message: 'Banner deleted' });
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

      res.json({
        status: 'success',
        count: list.length,
        offset,
        limit,
        data: list.slice(offset, offset + limit).map((p) => media.present(p))
      });
    })
  );

  /** Validates a product form (sector fields, merchant-defined extras, photos) into a document ready to store. */
  const buildProduct = async (body: unknown, meta: { id: string; now: string; sku?: string }) => {
    const input = parse(pack.productSchema, body);
    const extra = parseExtras(merchant.productFields, (body as { extra?: unknown } | undefined)?.extra);
    await assertPhotosExist(blobs, input.images);
    const categories = await store.list('categories', { where: [{ field: 'name', op: '==', value: input.category }], limit: 1 });
    if (categories.length === 0) throw new HttpError(400, `Category "${input.category}" does not exist. Create it first.`);

    if (input.sku) {
      const same = await store.list('products', { where: [{ field: 'sku', op: '==', value: input.sku }], limit: 2 });
      if (same.some((p) => p.id !== meta.id)) throw new HttpError(409, `A product with SKU ${input.sku} already exists.`);
    }
    return { ...pack.buildProduct(input, meta), ...(Object.keys(extra).length ? { extra } : {}) } as Doc;
  };

  router.post(
    '/products',
    requireAdmin,
    handler(async (req, res) => {
      const id = newId('item');
      const product = await buildProduct(req.body, { id, now: new Date().toISOString() });
      await store.set('products', id, product);
      res.status(201).json({ status: 'success', message: 'Product listed successfully to live catalogue', data: media.present(product) });
    })
  );

  router.put(
    '/products/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('products', req.params.id);
      if (!existing) throw new HttpError(404, 'Product not found.');
      const product = await buildProduct(req.body, { id: existing.id, now: existing.createdAt, sku: existing.sku });
      await store.set('products', existing.id, { ...product, updatedAt: new Date().toISOString() });
      await audit(store, req, 'PRODUCT_UPDATED', `Product ${product.sku} (${product.title}) updated.`);
      res.json({ status: 'success', message: 'Product updated', data: media.present({ ...product, updatedAt: new Date().toISOString() }) });
    })
  );

  // Photos are kept in storage: past orders still show them.
  router.delete(
    '/products/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('products', req.params.id);
      if (!existing) throw new HttpError(404, 'Product not found.');
      await store.delete('products', existing.id);
      await audit(store, req, 'PRODUCT_DELETED', `Product ${existing.sku} (${existing.title}) deleted.`);
      res.json({ status: 'success', message: 'Product deleted' });
    })
  );

  return router;
}
