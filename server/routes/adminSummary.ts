import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Config } from '../config';
import type { Store } from '../store';
import type { Entitlements } from '../entitlements';
import type { MessageLog } from '../messages';
import { handler } from '../http';

/**
 * What is waiting for the owner, in three numbers: the admin's Today list and its tab badges read this.
 * A count is 0 when the plan does not include the feature behind it (orders, enquiries inbox).
 */
export function adminSummaryRoutes(config: Config, store: Store, log: MessageLog, ent: Entitlements, requireAdmin: RequestHandler) {
  const router = Router();
  router.get(
    '/',
    requireAdmin,
    handler(async (_req, res) => {
      const { flags } = await ent.load();
      const [orders, enquiries, messages] = await Promise.all([
        flags.orders ? store.list('purchaseOrders', { where: [{ field: 'status', op: '==', value: 'new' }] }) : [],
        flags.enquiries ? store.list('waEnquiries') : [],
        log.listForStore(config.merchant.id)
      ]);
      res.json({
        status: 'success',
        data: {
          newOrders: orders.length,
          enquiriesWaiting: enquiries.filter((e) => !e.repliedAt).length,
          messagesFailed: messages.filter((m) => m.status === 'failed').length
        }
      });
    })
  );
  return router;
}
