import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Store } from '../store';
import { HttpError, handler, parse } from '../http';
import { subId, type Notifiers, type PushSub } from '../notify';

const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

/** Admin-only (mounted behind the alerts plan flag). Subscriptions live in the store's own data. */
export function pushRoutes(store: Store, n: Notifiers, requireAdmin: RequestHandler) {
  const router = Router();
  router.use(requireAdmin);
  router.get('/key', (_req, res) => res.json({ status: 'success', data: { enabled: Boolean(n.push.publicKey), publicKey: n.push.publicKey } }));
  router.post('/subscribe', handler(async (req, res) => {
    if (!n.push.publicKey) throw new HttpError(503, 'Notifications are not set up on this service.');
    const sub: PushSub = parse(subSchema, req.body);
    await store.set('pushSubs', subId(sub.endpoint), sub);
    res.status(201).json({ status: 'success' });
  }));
  router.post('/unsubscribe', handler(async (req, res) => {
    const { endpoint } = parse(z.object({ endpoint: z.string().max(1000) }), req.body);
    await store.delete('pushSubs', subId(endpoint));
    res.json({ status: 'success' });
  }));
  return router;
}
