import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, audit, handler, parse } from '../http';
import { orderListSchema, orderStatusSchema } from '../schemas';

/** The merchant's view of the orders their buyers have placed. */
export function adminOrderRoutes(store: Store, requireAdmin: RequestHandler) {
  const router = Router();
  router.use(requireAdmin);

  router.get(
    '/',
    handler(async (req, res) => {
      const { limit, status } = parse(orderListSchema, req.query);
      // Newest first; the status filter is applied afterwards so Firestore needs no composite index.
      const recent = await store.list('purchaseOrders', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: 500 });
      const data = (status ? recent.filter((o) => o.status === status) : recent).slice(0, limit);
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.patch(
    '/:poId',
    handler(async (req, res) => {
      const { status } = parse(orderStatusSchema, req.body);
      const order = await store.get('purchaseOrders', req.params.poId);
      if (!order) throw new HttpError(404, 'Order not found.');

      const previous = order.status ?? 'new';
      if (previous !== status) {
        await store.update('purchaseOrders', order.poId, { status, statusUpdatedAt: new Date().toISOString() });
        await audit(store, req, 'ORDER_STATUS_CHANGED', `PO ${order.poId}: ${previous} -> ${status} by ${user(res).name}`);
      }
      res.json({ status: 'success', data: { ...order, status } });
    })
  );

  return router;
}
