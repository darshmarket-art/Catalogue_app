import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Doc, Store } from '../store';
import type { AuthedUser } from '../auth';
import { user } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { trimmed } from '../schemas';
import { phone } from './otp';
import { REQUEST_STATUSES, RESERVE_HOURS } from '../../shared/requests';

/**
 * What a client asks the house for, beyond an order: a private viewing (in the boutique or on a video call), a bespoke piece, or holding one piece
 * for 48 hours. One collection (clientRequests) so the owner works one list from first message to done. A signed-in buyer is identified by their
 * account; a visitor of a store whose catalogue is public gives a name and phone. Nothing here locks stock: a reserve is a promise the owner keeps.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a day.');
const who = { name: trimmed(100).optional(), phone: phone.optional(), note: trimmed(600).optional(), website: z.string().max(200).optional() };
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('viewing'), where: z.enum(['boutique', 'video']), date: day, time: trimmed(20), occasion: trimmed(120).optional(), skus: z.array(trimmed(60)).max(12).default([]), ...who }),
  z.object({
    kind: z.literal('bespoke'), piece: trimmed(40), metal: trimmed(40).optional(), stones: z.array(trimmed(30)).max(8).default([]),
    occasion: trimmed(120).optional(), neededBy: trimmed(40).optional(), budget: trimmed(60).optional(), skus: z.array(trimmed(60)).max(6).default([]), ...who
  }),
  z.object({ kind: z.literal('reserve'), skus: z.array(trimmed(60)).min(1).max(1), ...who })
]);
const statusSchema = z.object({ status: z.enum(REQUEST_STATUSES), adminNote: trimmed(300).optional() });

const MAX_OPEN = 20;

export function requestRoutes(opts: {
  store: Store;
  /** The pieces for a list of SKUs, from the catalogue (never the client's word for a title). */
  bySkus: (skus: string[]) => Promise<Doc[]>;
  optionalUser: (req: Request) => Promise<AuthedUser | null>;
  requireRetailer: RequestHandler;
  requireAdmin: RequestHandler;
  /** Visitors may ask without an account only where the catalogue itself is public. */
  publicCatalogue: () => boolean;
  /** Tells the owner's devices; never throws. */
  alert: (title: string, body: string) => void;
  limit: number;
  now?: () => number;
}) {
  const { store, bySkus, optionalUser, requireRetailer, requireAdmin, publicCatalogue, alert } = opts;
  const now = opts.now ?? Date.now;
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: opts.limit, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message: 'Too many requests. Please slow down.' } });

  const buyer = Router();
  buyer.post(
    '/',
    limiter,
    handler(async (req, res) => {
      const body = parse(requestSchema, req.body);
      if (body.website && body.website.trim()) return void res.status(201).json({ status: 'success' }); // honeypot: a bot is told yes and nothing is stored
      const me = await optionalUser(req);
      const signedIn = me?.type === 'retailer';
      if (!signedIn && !publicCatalogue()) throw new HttpError(401, 'Please sign in to send this request.');
      if (!signedIn && (!body.name || !body.phone)) throw new HttpError(400, 'Enter your name and WhatsApp number so the house can reply.');
      const account = signedIn ? await store.get('buyers', me!.id) : null;
      const clientPhone = signedIn ? me!.id : body.phone!;
      const clientName = signedIn ? (body.name || account?.ownerName || me!.name) : body.name!;

      if (body.kind === 'viewing') {
        const at = Date.parse(`${body.date}T00:00:00Z`);
        if (!Number.isFinite(at) || at < now() - 36 * 3600_000 || at > now() + 120 * 86400_000) throw new HttpError(400, 'Choose a day within the next four months.');
      }
      const skus = Array.from(new Set(body.skus));
      const found = skus.length ? await bySkus(skus) : [];
      if (found.length !== skus.length) throw new HttpError(400, 'One of those pieces is no longer in the catalogue.');
      const pieces = skus.map((sku) => { const p = found.find((x) => x.sku === sku)!; return { sku, title: String(p.title) }; });

      const mine = await store.list('clientRequests', { where: [{ field: 'clientPhone', op: '==', value: clientPhone }] });
      const open = mine.filter((r) => r.status === 'new' || r.status === 'confirmed');
      if (open.length >= MAX_OPEN) throw new HttpError(429, 'You have many requests open already. The house will reply to those first.');
      if (body.kind === 'reserve' && open.some((r) => r.kind === 'reserve' && r.pieces?.[0]?.sku === skus[0] && Date.parse(r.expiresAt) > now())) {
        throw new HttpError(409, 'You already hold this piece. The house has your request.');
      }

      const id = newId('req');
      const createdAt = new Date(now()).toISOString();
      const { website: _w, name: _n, phone: _p, skus: _s, ...detail } = body;
      const row = {
        id, ...detail, pieces, status: 'new', createdAt,
        clientPhone, clientName, firmName: signedIn ? me!.name : null, guest: !signedIn,
        ...(body.kind === 'reserve' ? { expiresAt: new Date(now() + RESERVE_HOURS * 3600_000).toISOString() } : {})
      };
      await store.set('clientRequests', id, row);
      const label = body.kind === 'viewing' ? `Private viewing, ${body.date} ${body.time}` : body.kind === 'bespoke' ? `Bespoke ${body.piece.toLowerCase()}` : `Reserve ${pieces[0].title}`;
      alert(`New request from ${clientName}`, label);
      res.status(201).json({ status: 'success', data: { id, status: 'new', ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}) } });
    })
  );

  // A signed-in buyer's own requests, newest first, so the app can show what the house answered.
  buyer.get(
    '/mine',
    requireRetailer,
    handler(async (_req, res) => {
      const rows = await store.list('clientRequests', { where: [{ field: 'clientPhone', op: '==', value: user(res).id }] });
      const data = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50).map(({ adminNote: _a, ...r }) => r);
      res.json({ status: 'success', data });
    })
  );

  const admin = Router();
  admin.use(requireAdmin);
  admin.get(
    '/',
    handler(async (_req, res) => {
      const rows = await store.list('clientRequests');
      const data = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 500);
      res.json({ status: 'success', count: data.length, data });
    })
  );
  admin.put(
    '/:id',
    handler(async (req, res) => {
      const { status, adminNote } = parse(statusSchema, req.body);
      const row = await store.get('clientRequests', String(req.params.id));
      if (!row) throw new HttpError(404, 'Request not found.');
      const next = { status, statusAt: new Date(now()).toISOString(), ...(adminNote !== undefined ? { adminNote } : {}) };
      await store.update('clientRequests', row.id, next);
      if (row.status !== status) await audit(store, req, 'CLIENT_REQUEST_STATUS', `${row.kind} request of ${row.clientName}: ${row.status} -> ${status} by ${user(res).name}`);
      res.json({ status: 'success', data: { ...row, ...next } });
    })
  );

  return { buyer, admin };
}
