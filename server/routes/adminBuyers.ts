import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, audit, handler } from '../http';

// No look-alike characters (0/O, 1/l/I), so a password read out over the phone is not misheard.


/** The merchant's list of buyer accounts, and the help for a buyer who forgot their password. */
export function adminBuyerRoutes(store: Store, requireAdmin: RequestHandler) {
  const router = Router();
  router.use(requireAdmin);

  router.get(
    '/',
    handler(async (_req, res) => {
      const [buyers, seen] = await Promise.all([store.list('buyers'), store.list('visitors', { where: [{ field: 'kind', op: '==', value: 'verified' }] })]);
      const lastSeen = new Map(seen.map((v) => [String(v.actorId), Number(v.lastSeen)]));
      const data = buyers
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((b) => ({
          phone: b.phone,
          firmName: b.firmName,
          ownerName: b.ownerName,
          gstin: b.gstin,
          marketHub: b.marketHub,
          createdAt: b.createdAt,
          mustChangePassword: Boolean(b.mustChangePassword),
          lastSeen: lastSeen.has(String(b.phone)) ? new Date(lastSeen.get(String(b.phone))!).toISOString() : null
        }));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.delete(
    '/:phone',
    handler(async (req, res) => {
      const admin = user(res);
      const buyer = await store.get('buyers', req.params.phone);
      if (!buyer) throw new HttpError(404, 'Buyer not found.');
      await store.delete('buyers', buyer.phone);
      await audit(store, req, 'BUYER_REMOVED', `Removed buyer ${buyer.firmName} (${buyer.phone}) by ${admin.name}.`);
      res.json({ status: 'success' });
    })
  );

  return router;
}
