import crypto from 'crypto';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Doc, Store } from '../store';
import type { Media } from '../media';
import { user } from '../auth';
import { HttpError, handler, parse } from '../http';
import { trimmed } from '../schemas';
import { SHARE_DAYS } from '../../shared/requests';

/**
 * A shared selection: a buyer turns some pieces into one private link ("a presentation", or a single piece as a hint). Whoever holds the link
 * sees those pieces only (name, photos, and weights if the sharer chose), with no sign-in, for 14 days. The token is random and unguessable;
 * nothing else of the catalogue opens through it.
 */
const shareSchema = z.object({
  skus: z.array(trimmed(60)).min(1).max(30).transform((l) => Array.from(new Set(l))),
  note: trimmed(300).optional(),
  showWeights: z.boolean().default(false)
});

export function shareRoutes(opts: { store: Store; media: Media; brand: () => string; bySkus: (skus: string[]) => Promise<Doc[]>; requireRetailer: RequestHandler; limit: number; now?: () => number }) {
  const { store, media, bySkus, requireRetailer } = opts;
  const now = opts.now ?? Date.now;
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: opts.limit, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message: 'Too many requests. Please slow down.' } });

  router.post(
    '/',
    requireRetailer,
    limiter,
    handler(async (req, res) => {
      const body = parse(shareSchema, req.body);
      const found = await bySkus(body.skus);
      if (found.length !== body.skus.length) throw new HttpError(400, 'One of those pieces is no longer in the catalogue.');
      const token = crypto.randomBytes(16).toString('hex');
      const me = user(res);
      const account = await store.get('buyers', me.id);
      const createdAt = new Date(now()).toISOString();
      const expiresAt = new Date(now() + SHARE_DAYS * 86400_000).toISOString();
      await store.set('shares', token, { id: token, skus: body.skus, note: body.note ?? '', showWeights: body.showWeights, by: account?.ownerName || me.name, byPhone: me.id, createdAt, expiresAt, views: 0 });
      res.status(201).json({ status: 'success', data: { token, expiresAt } });
    })
  );

  // Public on purpose: the link is the key. Pieces removed from the catalogue since simply drop out.
  router.get(
    '/:token',
    limiter,
    handler(async (req, res) => {
      const token = String(req.params.token);
      const share = /^[a-f0-9]{32}$/.test(token) ? await store.get('shares', token) : null;
      if (!share || Date.parse(share.expiresAt) < now()) throw new HttpError(404, 'This link has closed. Ask for a new one.');
      const found = await bySkus(share.skus);
      const pieces = (share.skus as string[])
        .map((sku) => found.find((p) => p.sku === sku))
        .filter((p): p is Doc => Boolean(p))
        .map((p) => {
          const shown = media.present(p);
          return {
            sku: p.sku, title: p.title, ...(p.titleHi ? { titleHi: p.titleHi } : {}), category: p.category, image: shown.image, images: shown.images,
            ...(share.showWeights ? { purity: p.purity, netWt: p.netWt, grossWt: p.grossWt } : {})
          };
        });
      void store.increment('shares', token, { views: 1 }).catch(() => {});
      res.json({ status: 'success', data: { brand: opts.brand(), by: share.by, note: share.note, showWeights: Boolean(share.showWeights), expiresAt: share.expiresAt, pieces } });
    })
  );

  return router;
}
