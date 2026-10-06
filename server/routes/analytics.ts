import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { Config } from '../config';
import type { Store } from '../store';
import type { createAuth } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { activitySchema, heartbeatSchema, inquirySchema, productViewsSchema } from '../schemas';
import { actorFor, bumpVisitor, logActivity } from '../visitors';
import { dayKey, loadDaily, recordDaily, sumDays, trendLabel } from '../stats';
import { buildInsights } from '../insights';
import type { MessageLog } from '../messages';

// Visitors ping every 15s; a session counts as live for three missed beats' worth of grace.
const LIVE_WINDOW_MS = 45 * 1000;
const HEARTBEAT_MS = 15 * 1000;
const SESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const VIEW_EVENT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EXPORT_ROW_LIMIT = 5000;

// Spreadsheet apps execute cells starting with these characters as formulas.
const VISITOR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const visitorSummary = (v: Record<string, any>) => ({
  id: v.actorId,
  kind: v.kind,
  name: v.name,
  lastSeen: new Date(v.lastSeen).toISOString(),
  activeSeconds: Math.round((Number(v.activeMs) || 0) / 1000),
  sessions: Number(v.sessions) || 0,
  productsViewed: Number(v.views) || 0,
  dwellSeconds: Math.round((Number(v.dwellMs) || 0) / 1000),
  searches: Number(v.searches) || 0,
  selections: Number(v.selections) || 0,
  addedToCart: Number(v.addedToCart) || 0
});

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function analyticsRoutes(
  config: Config,
  store: Store,
  requireAdmin: RequestHandler,
  auth: Pick<ReturnType<typeof createAuth>, 'tokenType' | 'optionalUser'>,
  insights: { log: MessageLog | null; receiptsConnected: boolean } = { log: null, receiptsConnected: false }
) {
  const router = Router();

  // Owner dashboard: what buyers looked at, what they ordered, who is active, how WhatsApp is doing.
  router.get(
    '/analytics/insights',
    requireAdmin,
    handler(async (_req, res) => {
      res.json({ status: 'success', data: await buildInsights(store, config.merchant.id, insights.log, insights.receiptsConnected) });
    })
  );

  const publicCatalogue = config.merchant.catalogueAccess === 'public';

  const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit.analytics,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests. Please slow down.' }
  });

  // One view = one design details page opened by one visitor session on one day. Admin browsing is excluded.
  router.post(
    '/analytics/product-views',
    trackingLimiter,
    handler(async (req, res) => {
      const { sessionId, skus } = parse(productViewsSchema, req.body);
      if (auth.tokenType(req) === 'admin') return res.json({ status: 'success', counted: 0 });
      const actor = actorFor(await auth.optionalUser(req), sessionId, publicCatalogue);

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
      if (counted > 0) {
        await recordDaily(store, { views: counted });
        if (actor) await bumpVisitor(store, actor, { views: counted });
      }
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
          // The admin's own browsing before they signed in must not show up as a guest visitor.
          if (earlier.actorId === sessionId) await store.delete('visitors', sessionId);
          await recordDaily(store, { visitors: -1, verifiedVisitors: earlier.everVerified ? -1 : 0 }, new Date(earlier.firstSeen));
        }
      } else {
        const verified = kind === 'retailer';
        const now = Date.now();
        const expireAt = new Date(now + SESSION_TTL_MS);
        const existing = await store.get('sessions', sessionId);

        // Time actually spent in the app: the gap since the last ping, capped so a closed laptop does not count.
        const activeMs = existing ? Math.min(Math.max(now - existing.lastPing, 0), 2 * HEARTBEAT_MS) : 0;
        const actor = actorFor(await auth.optionalUser(req), sessionId, publicCatalogue);
        // A visit is counted once per person, even when the browser tab was already open as a guest before they signed in.
        if (actor) await bumpVisitor(store, actor, { activeMs, sessions: existing?.actorId === actor.id ? 0 : 1 });

        const isNew =
          !existing &&
          (await store.create('sessions', sessionId, {
            sessionId,
            firstSeen: now,
            lastPing: now,
            isVerified: verified,
            everVerified: verified,
            actorId: actor?.id ?? null,
            expireAt
          }));

        if (isNew) {
          await recordDaily(store, { visitors: 1, verifiedVisitors: verified ? 1 : 0 });
        } else {
          const firstVerification = verified && existing !== null && !existing.everVerified;
          await store.update('sessions', sessionId, {
            lastPing: now,
            isVerified: verified,
            actorId: actor?.id ?? null,
            expireAt,
            ...(firstVerification ? { everVerified: true } : {})
          });
          if (firstVerification) await recordDaily(store, { verifiedVisitors: 1 });
        }
      }
      res.json({ status: 'success' });
    })
  );

  // What each buyer looks at: time on each product, searches and selections. Admin browsing is excluded.
  router.post(
    '/analytics/activity',
    trackingLimiter,
    handler(async (req, res) => {
      const { sessionId, events } = parse(activitySchema, req.body);
      const actor = actorFor(await auth.optionalUser(req), sessionId, publicCatalogue);
      if (!actor) return res.json({ status: 'success', recorded: 0 });

      const totals = { dwellMs: 0, searches: 0, selections: 0 };
      for (const event of events) {
        await logActivity(store, actor, event);
        if (event.type === 'dwell') totals.dwellMs += event.ms;
        else if (event.type === 'search') totals.searches += 1;
        else if (event.type === 'select') totals.selections += 1;
      }
      await bumpVisitor(store, actor, totals);
      res.json({ status: 'success', recorded: events.length });
    })
  );

  // The people behind the Admin Hub counts. "guest" only exists when the catalogue is public.
  router.get(
    '/admin/visitors',
    requireAdmin,
    handler(async (req, res) => {
      const kind = ['verified', 'guest'].includes(String(req.query.kind)) ? String(req.query.kind) : 'all';
      const since = Date.now() - VISITOR_WINDOW_MS;
      const rows = (await store.list('visitors', { where: [{ field: 'lastSeen', op: '>', value: since }] }))
        .filter((v) => kind === 'all' || v.kind === kind)
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, 200);
      res.json({ status: 'success', windowDays: 30, count: rows.length, data: rows.map(visitorSummary) });
    })
  );

  router.get(
    '/admin/visitors/:actorId',
    requireAdmin,
    handler(async (req, res) => {
      const visitor = await store.get('visitors', req.params.actorId);
      if (!visitor) throw new HttpError(404, 'Visitor not found.');
      const [events, products] = await Promise.all([
        store.list('activityEvents', { where: [{ field: 'actorId', op: '==', value: visitor.actorId }] }),
        store.list('products')
      ]);
      const bySku = new Map(products.map((p) => [p.sku, p]));
      const titleOf = (sku: string) => bySku.get(sku)?.title ?? sku;
      events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

      const viewed = new Map<string, { sku: string; title: string; seconds: number; lastAt: string }>();
      const searched = new Map<string, { term: string; count: number; lastAt: string }>();
      const picked = new Map<string, { sku: string; title: string; count: number; lastAt: string }>();
      for (const e of events) {
        if (e.type === 'dwell') {
          const row = viewed.get(e.sku) ?? { sku: e.sku, title: titleOf(e.sku), seconds: 0, lastAt: e.ts };
          row.seconds += Math.round(e.ms / 1000);
          viewed.set(e.sku, row);
        } else if (e.type === 'search') {
          const key = String(e.term).toLowerCase();
          const row = searched.get(key) ?? { term: e.term, count: 0, lastAt: e.ts };
          row.count += 1;
          searched.set(key, row);
        } else if (e.type === 'select' || e.type === 'cart') {
          const row = picked.get(e.sku) ?? { sku: e.sku, title: titleOf(e.sku), count: 0, lastAt: e.ts };
          row.count += 1;
          picked.set(e.sku, row);
        }
      }
      res.json({
        status: 'success',
        data: {
          ...visitorSummary(visitor),
          products: [...viewed.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 50),
          searchTerms: [...searched.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 50),
          picked: [...picked.values()].sort((a, b) => b.count - a.count).slice(0, 50)
        }
      });
    })
  );

  router.get(
    '/analytics',
    requireAdmin,
    handler(async (_req, res) => {
      const [stats, live, drafts, newOrders] = await Promise.all([
        loadDaily(store, 14),
        store.list('sessions', { where: [{ field: 'lastPing', op: '>', value: Date.now() - LIVE_WINDOW_MS }] }),
        store.list('products', { where: [{ field: 'stockStatus', op: '==', value: 'Draft' }] }),
        store.list('purchaseOrders', { where: [{ field: 'status', op: '==', value: 'new' }] })
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
          pendingDrafts: drafts.length,
          newOrders: newOrders.length
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
      res.setHeader('Content-Disposition', `attachment; filename="${config.merchant.id}_audit_ledger.csv"`);
      res.send(['Timestamp,Event_Type,Details,Session_IP', ...rows].join('\n'));
    })
  );

  return router;
}
