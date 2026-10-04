import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Store } from '../store';
import type { entitlements } from '../entitlements';
import { audit, handler, HttpError, parse } from '../http';
import { LAYOUT_IDS, LAYOUTS, layoutPlan } from '../../shared/layouts';
import { UPGRADE_TO_PRO } from '../../shared/sales';

/** The owner picks the storefront layout. Gilded is for every plan; the others need Pro (402 otherwise). */
export function layoutRoutes(store: Store, requireAdmin: RequestHandler, ent: ReturnType<typeof entitlements>, save: (layout: (typeof LAYOUT_IDS)[number]) => Promise<void>) {
  const router = Router();
  router.put(
    '/',
    requireAdmin,
    handler(async (req, res) => {
      const { layout } = parse(z.object({ layout: z.enum(LAYOUT_IDS) }), req.body);
      if (layoutPlan(layout) === 'pro' && !(await ent.load()).flags.premiumLayouts) {
        throw new HttpError(402, `The ${LAYOUTS.find((l) => l.id === layout)?.name} layout is a Pro feature. ${UPGRADE_TO_PRO}`);
      }
      await save(layout);
      await audit(store, req, 'LAYOUT_CHANGED', `Storefront layout set to ${layout}.`);
      res.json({ status: 'success', data: { layout } });
    })
  );
  return router;
}
