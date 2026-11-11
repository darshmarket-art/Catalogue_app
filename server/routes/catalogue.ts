import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Doc, Store } from '../store';
import type { Blobs } from '../blobs';
import type { MerchantConfig } from '../merchant';
import type { SectorPack } from '../sectors';
import { assertPhotosExist, normalizePhoto, type Media } from '../media';
import { parseExtras } from '../productFields';
import { HttpError, audit, handler, newId, parse } from '../http';
import { bannerLinkSchema, bannerOrderSchema, bannerSchema, categorySchema, heroCollectionsSchema, paginationSchema } from '../schemas';
import type { Entitlements } from '../entitlements';
import type { CatalogueStore } from '../catalogueIndex';
import type { Slim } from '../sectors/jewellery';
import { enabledKeys, loadPurities, puritiesSchema } from '../purities';
import { MAX_TAGS, loadTagCovers, loadTags, resolveTag, sameTag, saveTagCovers, saveTags, tagNameSchema } from '../tags';

const byPosition = (a: any, b: any) =>
  (a.position ?? Infinity) - (b.position ?? Infinity) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));

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
  ent: Entitlements;
  catalogue: CatalogueStore;
}

export function catalogueRoutes({ store, blobs, media, merchant, pack, requireAdmin, readGuard, ent, catalogue }: Deps) {
  const router = Router();

  const categoryDoc = (body: ReturnType<typeof categorySchema.parse>, base: { id: string; createdAt: string }) => {
    const min = body.minTargetWt ?? 20;
    const max = body.maxTargetWt ?? 100;
    return {
      ...base,
      slug: body.slug || `CAT-${body.name.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}`,
      name: body.name,
      tag: body.tag,
      subtitle: body.subtitle || 'Curated wholesale collection',
      ...(body.nameHi ? { nameHi: body.nameHi } : {}),
      ...(body.subtitleHi ? { subtitleHi: body.subtitleHi } : {}),
      ...(body.story ? { story: body.story } : {}),
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
      const [categories, stats, tags] = await Promise.all([store.list('categories'), catalogue.stats(), loadTags(store)]);
      const data = categories.sort(byCreatedAt(1)).map((c) => ({ ...media.present(c), tag: resolveTag(c as { name: string; tag?: string }, tags), designCount: stats.byCat[c.name] ?? 0 }));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.post(
    '/categories',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(categorySchema, req.body);
      if (!(await loadTags(store)).includes(body.tag)) throw new HttpError(400, 'Choose one of the store\'s tags for the collection.');
      await assertPhotosExist(blobs, [body.image]);
      if ((await store.list('categories', { where: [{ field: 'name', op: '==', value: body.name }], limit: 1 })).length > 0) {
        throw new HttpError(409, `A category named "${body.name}" already exists.`);
      }
      await ent.assertCanAddCategory();
      await ent.assertPhotos([body.image]);
      const id = newId('cat');
      const category = categoryDoc(body, { id, createdAt: new Date().toISOString() });
      await store.set('categories', id, category);
      res.status(201).json({ status: 'success', message: 'Category created successfully', data: { ...media.present(category), designCount: 0 } });
    })
  );

  // Which collections the buyers' Home shows as its hero tiles. Stored on the collection (heroOrder), so a rename keeps it.
  router.put(
    '/hero-collections',
    requireAdmin,
    handler(async (req, res) => {
      const { ids } = parse(heroCollectionsSchema, req.body);
      if (new Set(ids).size !== ids.length) throw new HttpError(400, 'A collection can only be chosen once.');
      const all = await store.list('categories');
      const known = new Set(all.map((c) => c.id));
      const missing = ids.find((id) => !known.has(id));
      if (missing) throw new HttpError(404, 'One of those collections no longer exists.');
      await Promise.all(
        all.map((c) => {
          const at = ids.indexOf(c.id);
          return at >= 0 ? store.update('categories', c.id, { heroOrder: at }) : typeof c.heroOrder === 'number' ? store.update('categories', c.id, { heroOrder: null }) : Promise.resolve();
        })
      );
      await audit(store, req, 'HERO_COLLECTIONS_UPDATED', `Home hero collections set to ${ids.length === 0 ? 'none (the busiest ten)' : ids.map((id) => all.find((c) => c.id === id)!.name).join(', ')}.`);
      res.json({ status: 'success', data: { ids } });
    })
  );

  router.put(
    '/categories/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('categories', req.params.id);
      if (!existing) throw new HttpError(404, 'Category not found.');
      const body = parse(categorySchema, req.body);
      if (!(await loadTags(store)).includes(body.tag)) throw new HttpError(400, 'Choose one of the store\'s tags for the collection.');
      await assertPhotosExist(blobs, [body.image]);

      const clash = await store.list('categories', { where: [{ field: 'name', op: '==', value: body.name }], limit: 2 });
      if (clash.some((c) => c.id !== existing.id)) throw new HttpError(409, `A category named "${body.name}" already exists.`);
      await ent.assertPhotos([body.image]);

      const category = { ...categoryDoc(body, { id: existing.id, createdAt: existing.createdAt }), ...(typeof existing.heroOrder === 'number' ? { heroOrder: existing.heroOrder } : {}) };
      await store.set('categories', existing.id, category);

      // Products point at their category by name, so a rename carries them along (and their count moves with them).
      if (body.name !== existing.name) await catalogue.renameCategory(existing.name, body.name);
      await audit(store, req, 'CATEGORY_UPDATED', `Category "${existing.name}" updated${body.name !== existing.name ? ` (renamed to "${body.name}")` : ''}.`);
      res.json({ status: 'success', message: 'Category updated', data: { ...media.present(category), designCount: (await catalogue.stats()).byCat[body.name] ?? 0 } });
    })
  );

  router.delete(
    '/categories/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('categories', req.params.id);
      if (!existing) throw new HttpError(404, 'Category not found.');
      // Deleting a collection takes its designs with it (photos stay in storage: past orders still show them).
      const gone = await catalogue.removeCategory(existing.name);
      await store.delete('categories', existing.id);
      await audit(store, req, 'CATEGORY_DELETED', `Category "${existing.name}" deleted with ${gone} design${gone === 1 ? '' : 's'}.`);
      res.json({ status: 'success', message: 'Category deleted' });
    })
  );

  // Home-page banners are photos the owner uploads; they show oldest first.
  /** A banner may only open a collection that exists. */
  const assertCategory = async (name: string | null | undefined) => {
    if (!name) return;
    const found = await store.list('categories', { where: [{ field: 'name', op: '==', value: name }], limit: 1 });
    if (found.length === 0) throw new HttpError(400, `There is no collection named "${name}".`);
  };

  router.get(
    '/banners',
    readGuard,
    handler(async (_req, res) => {
      const data = (await store.list('banners')).sort(byPosition).map((b) => media.present(b));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.post(
    '/banners',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(bannerSchema, req.body);
      await assertPhotosExist(blobs, [body.image]);
      await assertCategory(body.category);
      await ent.assertPhotos([body.image]);
      const existing = await store.list('banners');
      if (existing.length >= 8) throw new HttpError(409, 'You can keep up to 8 banners. Delete one first.');
      const id = newId('ban');
      const banner = { id, image: body.image, ...(body.category ? { category: body.category } : {}), position: existing.length, createdAt: new Date().toISOString() };
      await store.set('banners', id, banner);
      await audit(store, req, 'BANNER_ADDED', 'Banner added.');
      res.status(201).json({ status: 'success', data: media.present(banner) });
    })
  );

  // The order the owner chose: ids first to last.
  router.put(
    '/banners/order',
    requireAdmin,
    handler(async (req, res) => {
      const { ids } = parse(bannerOrderSchema, req.body);
      await Promise.all(ids.map((id, position) => store.update('banners', id, { position })));
      res.json({ status: 'success', message: 'Banner order saved' });
    })
  );

  // Changes where a banner leads, without re-uploading the photo.
  router.put(
    '/banners/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('banners', req.params.id);
      if (!existing) throw new HttpError(404, 'Banner not found.');
      const { category } = parse(bannerLinkSchema, req.body);
      await assertCategory(category);
      const { category: _old, ...rest } = existing;
      const banner = { ...rest, ...(category ? { category } : {}) };
      await store.set('banners', existing.id, banner);
      await audit(store, req, 'BANNER_LINK_CHANGED', category ? `Banner now opens "${category}".` : 'Banner no longer opens a collection.');
      res.json({ status: 'success', data: media.present(banner) });
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

  // The designs for a list of SKUs (the buyer's shortlist), wherever they sit in the catalogue.
  router.get(
    '/products/by-sku',
    readGuard,
    handler(async (req, res) => {
      const skus = new Set(String(req.query.skus ?? '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, 500));
      const idx = await catalogue.index();
      const found = idx ? await catalogue.fetch(idx.idsForSkus(skus)) : (await store.list('products')).filter((p) => skus.has(String(p.sku)));
      res.json({ status: 'success', data: found.map((p) => media.present(p)) });
    })
  );

  // Search, filters, sort and paging all happen here, so the app only ever downloads the page it shows.
  router.get(
    '/products',
    readGuard,
    handler(async (req, res) => {
      const { limit, offset } = parse(paginationSchema, req.query);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const cursorAfter = typeof req.query.cursorAfter === 'string' ? req.query.cursorAfter : undefined;
      // Strip cursor params before the standard query schema validation.
      const { cursor: _c, cursorAfter: _ca, tag: _t, ...rest } = req.query;
      const q = parse(pack.querySchema, rest);
      // ?tag=Rings: only designs in the collections carrying that tag (the phone tag page's "All <tag>"); an unknown tag matches nothing.
      const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().slice(0, 30) : '';
      const [cats, tags] = tag ? await Promise.all([store.list('categories'), loadTags(store)]) : [[], []];
      const inTag = new Set(cats.filter((c) => sameTag(resolveTag(c as { name: string; tag?: string }, tags), tag)).map((c) => String(c.name).toLowerCase()));
      // From the in-memory index: filter/sort/count there, then fetch only this page's documents by id. A store too big to index falls back to the scan.
      const index = await catalogue.index();
      let list: Array<Doc | Slim> = index ? index.query(pack, q) : pack.applyQuery(await store.list('products'), q);
      if (tag) list = list.filter((p) => inTag.has(String(p.category).toLowerCase()));

      let start = offset;
      if (cursor && cursorAfter) {
        const at = list.findIndex((p) => p.createdAt === cursor && p.id === cursorAfter);
        start = at >= 0 ? at + 1 : 0;
      }
      const slice = list.slice(start, start + limit);
      const page = index ? await catalogue.fetch(slice.map((e) => e.id)) : (slice as Doc[]);
      const lastItem = slice[slice.length - 1];
      res.json({
        status: 'success',
        count: list.length,
        total: list.length,
        offset,
        limit,
        hasMore: start + slice.length < list.length,
        cursor: lastItem?.createdAt,
        cursorAfter: lastItem?.id,
        data: page.map((p) => media.present(p))
      });
    })
  );

  // Collection tags: the owner's own list. Every collection carries exactly one, so a tag in use can only be deleted by moving its collections.
  router.get(
    '/tags',
    readGuard,
    handler(async (_req, res) => {
      res.json({ status: 'success', data: await loadTags(store) });
    })
  );

  // One cover photo per tag (buyers' "Shop by" cards and the tag page banner). Read like the tag list; set from a photo uploaded to this store.
  router.get(
    '/tag-covers',
    readGuard,
    handler(async (_req, res) => {
      const [tags, covers] = await Promise.all([loadTags(store), loadTagCovers(store)]);
      res.json({ status: 'success', data: Object.fromEntries(tags.filter((t) => covers[t]).map((t) => [t, media.url(covers[t])])) });
    })
  );

  router.put(
    '/tag-covers/:name',
    requireAdmin,
    handler(async (req, res) => {
      const tag = req.params.name;
      if (!(await loadTags(store)).includes(tag)) throw new HttpError(404, 'Tag not found.');
      const ref = normalizePhoto(String((req.body ?? {}).ref ?? '').trim());
      if (!ref?.startsWith('media:')) throw new HttpError(400, 'Upload the cover photo here first.');
      await assertPhotosExist(blobs, [ref]); // blobs are this store's own, so another store's photo is "not found"
      await ent.assertPhotos([ref]);
      const covers = await loadTagCovers(store);
      await saveTagCovers(store, { ...covers, [tag]: ref });
      await audit(store, req, 'TAG_COVER_SET', `Cover photo set for tag "${tag}".`);
      res.json({ status: 'success', data: { tag, url: media.url(ref) } });
    })
  );

  router.delete(
    '/tag-covers/:name',
    requireAdmin,
    handler(async (req, res) => {
      const tag = req.params.name;
      const covers = await loadTagCovers(store);
      if (tag in covers) {
        delete covers[tag]; // the photo itself stays in storage
        await saveTagCovers(store, covers);
        await audit(store, req, 'TAG_COVER_CLEARED', `Cover photo removed for tag "${tag}".`);
      }
      res.json({ status: 'success', data: { tag } });
    })
  );

  router.post(
    '/tags',
    requireAdmin,
    handler(async (req, res) => {
      const { name } = parse(tagNameSchema, req.body);
      const list = await loadTags(store);
      if (list.some((t) => sameTag(t, name))) throw new HttpError(409, `A tag named "${name}" already exists.`);
      if (list.length >= MAX_TAGS) throw new HttpError(400, `A store can have up to ${MAX_TAGS} tags.`);
      await saveTags(store, [...list, name]);
      await audit(store, req, 'TAG_CREATED', `Tag "${name}" created.`);
      res.status(201).json({ status: 'success', data: [...list, name] });
    })
  );

  router.put(
    '/tags/:name',
    requireAdmin,
    handler(async (req, res) => {
      const { name } = parse(tagNameSchema, req.body);
      const list = await loadTags(store);
      const old = req.params.name;
      if (!list.includes(old)) throw new HttpError(404, 'Tag not found.');
      if (list.some((t) => t !== old && sameTag(t, name))) throw new HttpError(409, `A tag named "${name}" already exists.`);
      await saveTags(store, list.map((t) => (t === old ? name : t)));
      const cats = await store.list('categories');
      await Promise.all(cats.filter((c) => resolveTag(c as { name: string; tag?: string }, list) === old).map((c) => store.update('categories', c.id, { tag: name })));
      const covers = await loadTagCovers(store);
      if (old in covers && old !== name) {
        covers[name] = covers[old];
        delete covers[old];
        await saveTagCovers(store, covers);
      }
      await audit(store, req, 'TAG_RENAMED', `Tag "${old}" renamed to "${name}".`);
      res.json({ status: 'success', data: list.map((t) => (t === old ? name : t)) });
    })
  );

  router.delete(
    '/tags/:name',
    requireAdmin,
    handler(async (req, res) => {
      const list = await loadTags(store);
      const old = req.params.name;
      if (!list.includes(old)) throw new HttpError(404, 'Tag not found.');
      if (list.length === 1) throw new HttpError(400, 'Keep at least one tag.');
      const cats = (await store.list('categories')).filter((c) => resolveTag(c as { name: string; tag?: string }, list) === old);
      const moveTo = typeof req.query.moveTo === 'string' ? req.query.moveTo : '';
      if (cats.length > 0) {
        if (!moveTo || moveTo === old || !list.includes(moveTo)) throw new HttpError(409, `${cats.length} ${cats.length === 1 ? 'collection uses' : 'collections use'} "${old}". Choose a tag to move ${cats.length === 1 ? 'it' : 'them'} to.`);
        await Promise.all(cats.map((c) => store.update('categories', c.id, { tag: moveTo })));
      }
      const next = list.filter((t) => t !== old);
      await saveTags(store, next);
      const covers = await loadTagCovers(store);
      if (old in covers) {
        delete covers[old]; // the photo itself stays in storage
        await saveTagCovers(store, covers);
      }
      await audit(store, req, 'TAG_DELETED', `Tag "${old}" deleted${cats.length ? `; ${cats.length} collection(s) moved to "${moveTo}"` : ''}.`);
      res.json({ status: 'success', data: next });
    })
  );

  // The purities the owner offers; products and buyers choose from the switched-on ones.
  router.get(
    '/purities',
    readGuard,
    handler(async (_req, res) => {
      res.json({ status: 'success', data: await loadPurities(store) });
    })
  );

  router.put(
    '/purities',
    requireAdmin,
    handler(async (req, res) => {
      const { purities } = parse(puritiesSchema, req.body);
      await store.set('settings', 'purities', { id: 'purities', list: purities, updatedAt: new Date().toISOString() });
      await audit(store, req, 'PURITIES_UPDATED', `Purity options set to: ${purities.filter((p) => p.enabled).map((p) => p.key).join(', ')}.`);
      res.json({ status: 'success', data: await loadPurities(store) });
    })
  );

  /** Validates a product form (sector fields, merchant-defined extras, photos) into a document ready to store. */
  const buildProduct = async (body: unknown, meta: { id: string; now: string; sku?: string; purity?: string }) => {
    const input = parse(pack.productSchema, body);
    // A purity the owner has since switched off stays valid for the products that already use it.
    if (input.purity !== meta.purity && !enabledKeys(await loadPurities(store)).includes(input.purity)) {
      throw new HttpError(400, `"${input.purity}" is not one of your purity options.`);
    }
    const extra = parseExtras(merchant.productFields, (body as { extra?: unknown } | undefined)?.extra);
    await assertPhotosExist(blobs, [...input.images, ...(input.certificate ? [input.certificate] : [])]);
    await ent.assertPhotos(input.images, true);
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
      await catalogue.create(product);
      res.status(201).json({ status: 'success', message: 'Product listed successfully to live catalogue', data: media.present(product) });
    })
  );

  // Bulk import: up to 50 designs per call, ONE transaction and ONE counter change (a call per design would hit the counter document once per design).
  router.post(
    '/products/bulk',
    requireAdmin,
    handler(async (req, res) => {
      const items = (req.body as { items?: unknown })?.items;
      if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new HttpError(400, 'Send 1 to 50 products in "items".');
      const now = new Date().toISOString();
      const built: Doc[] = [];
      const skus = new Set<string>();
      for (const item of items) {
        const product = await buildProduct(item, { id: newId('item'), now });
        if (skus.has(product.sku)) throw new HttpError(409, `SKU ${product.sku} appears twice in this import.`);
        skus.add(product.sku);
        built.push(product);
      }
      await catalogue.createMany(built);
      res.status(201).json({ status: 'success', message: `${built.length} products listed`, data: built.map((p) => media.present(p)) });
    })
  );

  router.put(
    '/products/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('products', req.params.id);
      if (!existing) throw new HttpError(404, 'Product not found.');
      const product = await buildProduct(req.body, { id: existing.id, now: existing.createdAt, sku: existing.sku, purity: existing.purity });
      const saved = { ...product, updatedAt: new Date().toISOString() };
      if (!(await catalogue.replace(existing.id, (cur) => (cur ? saved : null)))) throw new HttpError(404, 'Product not found.');
      await audit(store, req, 'PRODUCT_UPDATED', `Product ${product.sku} (${product.title}) updated.`);
      res.json({ status: 'success', message: 'Product updated', data: media.present(saved) });
    })
  );

  // Photos are kept in storage: past orders still show them.
  router.delete(
    '/products/:id',
    requireAdmin,
    handler(async (req, res) => {
      const existing = await store.get('products', req.params.id);
      if (!existing) throw new HttpError(404, 'Product not found.');
      if (!(await catalogue.remove(existing.id))) throw new HttpError(404, 'Product not found.');
      await audit(store, req, 'PRODUCT_DELETED', `Product ${existing.sku} (${existing.title}) deleted.`);
      res.json({ status: 'success', message: 'Product deleted' });
    })
  );

  return router;
}
