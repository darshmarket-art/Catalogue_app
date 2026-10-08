import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, handler, newId, parse } from '../http';
import { trimmed } from '../schemas';

/** What a buyer sent to the store on WhatsApp: a question about one design, their shortlist, or a whole order. */
const enquirySchema = z.object({
  kind: z.enum(['design', 'shortlist', 'order']),
  sku: trimmed(60).optional(),
  title: trimmed(200).optional(),
  purity: trimmed(60).optional(),
  count: z.coerce.number().int().min(0).max(100000).optional()
});

/** Buyers' WhatsApp enquiries. Recording is open to every signed-in buyer on any plan; reading them is Pro (the app mounts the flag). */
export function enquiryRoutes(store: Store, requireRetailer: RequestHandler, requireAdmin: RequestHandler, limit: number) {
  const buyer = Router();
  buyer.use(requireRetailer);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message: 'Too many requests. Please slow down.' } });

  buyer.post(
    '/',
    limiter,
    handler(async (req, res) => {
      const body = parse(enquirySchema, req.body);
      const me = user(res);
      const account = await store.get('buyers', me.id);
      const id = newId('enq');
      // The buyer is identified by their account, never by what the client claims.
      await store.set('waEnquiries', id, {
        id,
        kind: body.kind,
        buyerPhone: me.id,
        firmName: me.name,
        ownerName: account?.ownerName ?? '',
        sku: body.sku ?? null,
        title: body.title ?? null,
        purity: body.purity ?? null,
        count: body.count ?? null,
        createdAt: new Date().toISOString()
      });
      res.status(201).json({ status: 'success' });
    })
  );

  const admin = Router();
  admin.use(requireAdmin);
  admin.get(
    '/',
    handler(async (_req, res) => {
      const rows = await store.list('waEnquiries');
      const data = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 500);
      res.json({ status: 'success', count: data.length, data });
    })
  );

  // The owner tapped Reply: the enquiry stops counting as waiting.
  admin.post(
    '/:id/replied',
    handler(async (req, res) => {
      const row = await store.get('waEnquiries', String(req.params.id));
      if (!row) throw new HttpError(404, 'Enquiry not found.');
      if (!row.repliedAt) await store.update('waEnquiries', row.id, { repliedAt: new Date().toISOString() });
      res.json({ status: 'success' });
    })
  );

  return { buyer, admin };
}
