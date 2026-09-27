import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import { handler, newId, parse } from '../http';
import { categorySchema, paginationSchema, productSchema } from '../schemas';

const DEFAULT_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDUObQwsOoUT558zd-xq-IRhGUCH3gngnq1CIAJLIn1z1ktCuUgA6vDbd7k0XHEoUENtL9-abjc03ckpFPzrpgn0zi1qrOH9A9yS8oUmcAtc7F9UiucB-QXDrdBXh3wJdsVdX_WSduNHoK9YH5tul8lRn3Kn6EhWljP3GWGyI2QfH9xZPq10TteaS8hZb4sd_u23E7vT3LBRPsUSuklfuu5EC8AiX-S9GMuEvJdApdGBbyOQ87ExOiW';

const byCreatedAt = (dir: 1 | -1) => (a: any, b: any) =>
  dir * String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));

export function catalogueRoutes(store: Store, requireAdmin: RequestHandler) {
  const router = Router();

  router.get(
    '/categories',
    handler(async (_req, res) => {
      const data = (await store.list('categories')).sort(byCreatedAt(1));
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
        designCount: 0,
        avgNetWt: `${min}g – ${max}g`,
        image: body.image || DEFAULT_IMAGE,
        eligibleKarats: body.eligibleKarats?.length ? body.eligibleKarats : ['22K 916'],
        minTargetWt: min,
        maxTargetWt: max,
        createdAt: new Date().toISOString()
      };
      await store.set('categories', id, category);
      res.status(201).json({ status: 'success', message: 'Category created successfully', data: category });
    })
  );

  router.get(
    '/products',
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
      const body = parse(productSchema, req.body);
      const gross = body.grossWt ?? 40;
      const stone = body.stoneWt ?? 0;
      const net = Math.max(0, gross - stone);
      const id = newId('item');

      const product = {
        id,
        sku:
          body.sku ||
          `B2B-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: body.title,
        category: body.category || 'Bridal Chokers & Haar',
        purity: body.purity || '22K 916',
        grossWt: gross,
        netWt: parseFloat(net.toFixed(3)),
        stoneWt: stone,
        makingChargePerGram: 420,
        priceEstimate: Math.round(net * 7200),
        image: body.image || body.angles?.[0] || DEFAULT_IMAGE,
        angles: body.angles ?? [],
        stockStatus: body.stockStatus || 'Ready in Vault',
        huid: `HM/C-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString()
      };
      await store.set('products', id, product);
      res.status(201).json({ status: 'success', message: 'Product listed successfully to live catalogue', data: product });
    })
  );

  return router;
}
