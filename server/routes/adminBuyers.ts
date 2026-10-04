import crypto from 'crypto';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, audit, handler } from '../http';

// No look-alike characters (0/O, 1/l/I), so a password read out over the phone is not misheard.
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const temporaryPassword = () => Array.from(crypto.randomBytes(10), (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join('');

/** The merchant's list of buyer accounts, and the owner-only help for a buyer who forgot their password. */
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

  // The temporary password is shown once, to the owner, who passes it to the buyer. The buyer must replace it at next sign-in.
  router.post(
    '/:phone/reset-password',
    handler(async (req, res) => {
      const admin = user(res);
      if (admin.role !== 'owner') throw new HttpError(403, 'Only the owner can reset a buyer\'s password.');
      const buyer = await store.get('buyers', req.params.phone);
      if (!buyer) throw new HttpError(404, 'Buyer not found.');

      const temp = temporaryPassword();
      await store.update('buyers', buyer.phone, { password: await bcrypt.hash(temp, 12), mustChangePassword: true });
      await audit(store, req, 'BUYER_PASSWORD_RESET', `Password reset for ${buyer.firmName} (${buyer.phone}) by ${admin.name}.`);
      res.json({ status: 'success', data: { phone: buyer.phone, firmName: buyer.firmName, temporaryPassword: temp } });
    })
  );

  router.delete(
    '/:phone',
    handler(async (req, res) => {
      const admin = user(res);
      if (admin.role !== 'owner') throw new HttpError(403, 'Only the owner can remove a buyer.');
      const buyer = await store.get('buyers', req.params.phone);
      if (!buyer) throw new HttpError(404, 'Buyer not found.');
      await store.delete('buyers', buyer.phone);
      await audit(store, req, 'BUYER_REMOVED', `Removed buyer ${buyer.firmName} (${buyer.phone}) by ${admin.name}.`);
      res.json({ status: 'success' });
    })
  );

  return router;
}
