import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import { user } from '../auth';
import { handler, parse } from '../http';
import { shortlistSchema } from '../schemas';

/** The buyer's shortlist: SKUs they have hearted, kept so it follows them across phones. */
export function shortlistRoutes(store: Store, requireRetailer: RequestHandler) {
  const router = Router();
  router.use(requireRetailer);

  router.get(
    '/',
    handler(async (_req, res) => {
      const doc = await store.get<{ skus: string[] }>('shortlists', user(res).id);
      res.json({ status: 'success', data: { skus: doc?.skus ?? [] } });
    })
  );

  router.put(
    '/',
    handler(async (req, res) => {
      const { skus } = parse(shortlistSchema, req.body);
      await store.set('shortlists', user(res).id, { id: user(res).id, skus, updatedAt: new Date().toISOString() });
      res.json({ status: 'success', data: { skus } });
    })
  );

  return router;
}
