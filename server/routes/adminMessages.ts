import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Config } from '../config';
import type { Store } from '../store';
import { HttpError, handler } from '../http';
import { deliverySummary, type MessageDoc, type MessageLog } from '../messages';
import { maskPhone } from '../whatsapp';
import { receiptsEnabled } from './whatsappWebhook';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 200;

/** What the owner sees for one message: masked phone, the buyer's name when known, status and a collapsed error. */
export function presentMessage(m: MessageDoc, buyerName: string | null) {
  return {
    id: m.id, kind: m.kind, to: maskPhone(m.to), buyer: buyerName, status: m.status, failure: m.failure ?? null,
    errorCode: m.errorCode ?? null, errorTitle: m.errorTitle ?? null, createdAt: m.createdAt, updatedAt: m.updatedAt, receiptAt: m.receiptAt ?? null
  };
}

/** The store's WhatsApp message log (last 90 days): sign-in codes and owner alerts with their delivery stage. */
export function adminMessageRoutes(config: Config, store: Store, log: MessageLog, requireAdmin: RequestHandler, now: () => number = Date.now) {
  const router = Router();
  const storeId = config.merchant.id;
  const nameOf = async (rows: MessageDoc[]) => {
    const buyers = await store.list<{ phone: string; firmName?: string }>('buyers');
    const byPhone = new Map(buyers.map((b) => [b.phone, b.firmName ?? null]));
    return (m: MessageDoc) => byPhone.get(m.to) ?? null;
  };

  router.get(
    '/',
    requireAdmin,
    handler(async (req, res) => {
      const t = now();
      const all = await log.listForStore(storeId, t);
      const failedOnly = req.query.filter === 'failed';
      const rows = failedOnly ? all.filter((m) => m.status === 'failed') : all;
      const name = await nameOf(rows);
      const week = all.filter((m) => t - m.createdMs <= 7 * DAY_MS);
      const todayKey = new Date(t).toISOString().slice(0, 10);
      res.json({
        status: 'success',
        data: {
          receipts: { connected: receiptsEnabled(config), lastAt: await log.lastReceiptAt() },
          counts: { today: all.filter((m) => m.createdAt.slice(0, 10) === todayKey).length, failed: all.filter((m) => m.status === 'failed').length, week: deliverySummary(week) },
          total: rows.length,
          data: rows.slice(0, MAX_ROWS).map((m) => presentMessage(m, name(m)))
        }
      });
    })
  );

  router.get(
    '/:id',
    requireAdmin,
    handler(async (req, res) => {
      const m = await log.get(String(req.params.id));
      if (!m || m.storeId !== storeId) throw new HttpError(404, 'Message not found.');
      const name = await nameOf([m]);
      res.json({ status: 'success', data: presentMessage(m, name(m)) });
    })
  );

  return router;
}
