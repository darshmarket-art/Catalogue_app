import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { Config } from '../config';
import type { Store } from '../store';
import type { createAuth } from '../auth';
import { audit, handler, newId, parse } from '../http';
import { heartbeatSchema, inquirySchema, productViewsSchema } from '../schemas';
import { dayKey, loadDaily, recordDaily, sumDays, trendLabel } from '../stats';

// Visitors ping every 15s; a session counts as live for three missed beats' worth of grace.
const LIVE_WINDOW_MS = 45 * 1000;
const SESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const VIEW_EVENT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EXPORT_ROW_LIMIT = 5000;

// Spreadsheet apps execute cells starting with these characters as formulas.
function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function analyticsRoutes(
  config: Config,
  store: Store,
  requireAdmin: RequestHandler,
  auth: Pick<ReturnType<typeof createAuth>, 'tokenType' | 'optionalUser'>
) {
  const router = Router();

  const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit.analytics,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests. Please slow down.' }
  });

  // One view = one product card seen by one visitor session on one day. Admin browsing is excluded.
  router.post(
    '/analytics/product-views',
    trackingLimiter,
    handler(async (req, res) => {
      const { sessionId, skus } = parse(productViewsSchema, req.body);
      if (auth.tokenType(req) === 'admin') return res.json({ status: 'success', counted: 0 });

      const day = dayKey();
      const now = Date.now();
      const results = await Promise.all(
        [...new Set(skus)].map((sku) => {
          const id = crypto.createHash('sha1').update(`${day}|${sessionId}|${sku}`).digest('hex');
          return store.create('productViews', id, {
            day,
            sku,
            sessionId,
            timestamp: new Date(now).toISOString(),
            expireAt: new Date(now + VIEW_EVENT_TTL_MS)
          });
        })
      );
      const counted = results.filter(Boolean).length;
      if (counted > 0) await recordDaily(store, { views: counted });
      res.json({ status: 'success', counted });
    })
  );

  router.post(
    '/analytics/track-inquiry',
    trackingLimiter,
    handler(async (req, res) => {
      const body = parse(inquirySchema, req.body);
      const user = await auth.optionalUser(req);
      const retailer = user?.type === 'retailer' ? user : null;
      // A signed-in firm is identified by its account, not by what the client claims.
      const firmName = retailer?.name ?? body.clientFirm ?? 'Guest Jeweller';

      const id = newId('inq');
      await store.set('inquiries', id, {
        id,
        firmName,
        retailerId: retailer?.id ?? null,
        itemsCount: body.itemsCount ?? 1,
        totalNetWeight: body.totalNetWeight ?? 0,
        timestamp: new Date().toISOString()
      });
      await recordDaily(store, { inquiries: 1 });
      await audit(
        store,
        req,
        'WHOLESALE_REQUISITION_INQUIRY',
        `Requisition Inquiry from ${firmName}: ${body.itemsCount ?? 1} items (${body.totalNetWeight ?? 'N/A'}g net gold)`
      );
      res.json({ status: 'success' });
    })
  );

  // Presence + unique-visitor counting. "Verified" comes from the caller's token, never from the body.
  router.post(
    '/analytics/heartbeat',
    trackingLimiter,
    handler(async (req, res) => {
      const { sessionId } = parse(heartbeatSchema, req.body);
      const kind = auth.tokenType(req);
      if (kind === 'admin') {
        // This tab was counted as a guest before the admin signed in; take it back out.
        const earlier = await store.get('sessions', sessionId);
        if (earlier) {
          await store.delete('sessions', sessionId);
          await recordDaily(store, { visitors: -1, verifiedVisitors: earlier.everVerified ? -1 : 0 }, new Date(earlier.firstSeen));
        }
      } else {
        const verified = kind === 'retailer';
        const now = Date.now();
        const expireAt = new Date(now + SESSION_TTL_MS);
        const existing = await store.get('sessions', sessionId);

        const isNew =
          !existing &&
          (await store.create('sessions', sessionId, {
            sessionId,
            firstSeen: now,
            lastPing: now,
            isVerified: verified,
            everVerified: verified,
            expireAt
          }));

        if (isNew) {
          await recordDaily(store, { visitors: 1, verifiedVisitors: verified ? 1 : 0 });
        } else {
          const firstVerification = verified && existing !== null && !existing.everVerified;
          await store.update('sessions', sessionId, {
            lastPing: now,
            isVerified: verified,
            expireAt,
            ...(firstVerification ? { everVerified: true } : {})
          });
          if (firstVerification) await recordDaily(store, { verifiedVisitors: 1 });
        }
      }
      res.json({ status: 'success' });
    })
  );

  router.get(
    '/analytics',
    requireAdmin,
    handler(async (_req, res) => {
      const [stats, live, drafts] = await Promise.all([
        loadDaily(store, 14),
        store.list('sessions', { where: [{ field: 'lastPing', op: '>', value: Date.now() - LIVE_WINDOW_MS }] }),
        store.list('products', { where: [{ field: 'stockStatus', op: '==', value: 'Draft' }] })
      ]);

      const week = (field: string) => sumDays(stats, field, 0, 7);
      const previousWeek = (field: string) => sumDays(stats, field, 7, 14);
      const liveVerified = live.filter((s) => s.isVerified).length;

      res.json({
        status: 'success',
        data: {
          periodLabel: 'Last 7 days',
          views: week('views'),
          viewsTrend: trendLabel(week('views'), previousWeek('views')),
          inquiries: week('inquiries'),
          bookedOrders: week('booked'),
          bookedWeightKg: parseFloat((week('bookedGrams') / 1000).toFixed(3)),
          liveVisitors: live.length,
          verifiedMerchants: liveVerified,
          guestRetailers: live.length - liveVerified,
          todayVisitors: sumDays(stats, 'visitors', 0, 1),
          verifiedToday: sumDays(stats, 'verifiedVisitors', 0, 1),
          pendingDrafts: drafts.length
        }
      });
    })
  );

  router.get(
    '/admin/audit-logs',
    requireAdmin,
    handler(async (_req, res) => {
      const data = await store.list('auditLogs', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: 50 });
      res.json({ status: 'success', count: data.length, data });
    })
  );

  router.get(
    '/analytics/export',
    requireAdmin,
    handler(async (_req, res) => {
      const logs = await store.list('auditLogs', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: EXPORT_ROW_LIMIT });
      const rows = logs.map((l) => [l.timestamp, l.event, l.details, l.ip ?? ''].map(csvCell).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bhakti_audit_ledger.csv"');
      res.send(['Timestamp,Event_Type,Details,Session_IP', ...rows].join('\n'));
    })
  );

  return router;
}
