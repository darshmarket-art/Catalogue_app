import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import { HttpError, handler, parse } from '../http';
import { LIMITS, effectivePlan, photosInUse } from '../entitlements';
import { effectiveLayout, hostOf, planOf, scopeStore, type StoreRecord } from '../tenancy';
import { DEFAULT_LAYOUT, LAYOUT_IDS } from '../../shared/layouts';
import { activity, buyers, orders, owners, summary } from '../consoleStats';

const IAP_KEYS_URL = 'https://www.gstatic.com/iap/verify/public_key';
export type IapKeys = () => Promise<Record<string, string>>;

let keyCache: { at: number; keys: Record<string, string> } | null = null;
/** Google's IAP signing keys (kid -> PEM), cached an hour. */
const fetchIapKeys: IapKeys = async () => {
  if (keyCache && Date.now() - keyCache.at < 3600_000) return keyCache.keys;
  const res = await fetch(IAP_KEYS_URL);
  if (!res.ok) throw new Error('Could not fetch IAP keys');
  keyCache = { at: Date.now(), keys: (await res.json()) as Record<string, string> };
  return keyCache.keys;
};

const csv = (v?: string) => (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Who is calling. Production: a valid Google IAP JWT whose email is in CONSOLE_ADMINS.
 * No header is accepted only when CONSOLE_DEV_OPEN=true outside production. MASTER_PROVISIONING_KEY plays no part.
 */
export function consoleAuth(config: Config, keys: IapKeys): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = req.header('x-goog-iap-jwt-assertion');
      if (!token) {
        if (process.env.CONSOLE_DEV_OPEN === 'true' && !config.isProduction) {
          res.locals.actor = 'dev';
          return next();
        }
        throw new HttpError(401, 'Sign in through the console proxy.');
      }
      const audience = process.env.IAP_AUDIENCE;
      if (!audience) throw new HttpError(401, 'Console auth is not configured.');
      const kid = (jwt.decode(token, { complete: true })?.header as { kid?: string } | undefined)?.kid;
      const pem = kid ? (await keys())[kid] : undefined;
      if (!pem) throw new HttpError(401, 'Invalid console credentials.');
      let claims: jwt.JwtPayload;
      try {
        claims = jwt.verify(token, pem, { algorithms: ['ES256'], audience, issuer: 'https://cloud.google.com/iap' }) as jwt.JwtPayload;
      } catch {
        throw new HttpError(401, 'Invalid console credentials.');
      }
      const email = String(claims.email ?? '').toLowerCase();
      if (!email || !csv(process.env.CONSOLE_ADMINS).includes(email)) throw new HttpError(403, 'This account is not allowed in the console.');
      res.locals.actor = email;
      next();
    } catch (e) {
      next(e);
    }
  };
}

const view = async (root: Store, rec: StoreRecord) => {
  const data = scopeStore(root, rec.id);
  const plan = effectivePlan(planOf(rec));
  const [buyerDocs, photos, [seen]] = await Promise.all([
    data.list('buyers'), photosInUse(data), data.list('visitors', { orderBy: { field: 'lastSeen', direction: 'desc' }, limit: 1 })
  ]);
  return {
    id: rec.id, name: rec.merchant.brand.name, subdomain: rec.subdomain, plan: rec.plan, effectivePlan: plan,
    trialEndsAt: rec.trialEndsAt ?? null, status: rec.status, ownApp: Boolean(rec.ownApp), owner: rec.owner ?? null, createdAt: rec.createdAt,
    buyers: buyerDocs.length, photos: photos.size, limits: { buyers: LIMITS[plan].users, photos: LIMITS[plan].photos },
    // The saved choice, and what the store really shows (a Pro layout falls back to Gilded while the store is on Basic).
    layout: rec.merchant.layout ?? DEFAULT_LAYOUT, effectiveLayout: effectiveLayout(rec),
    // Latest time any tracked buyer or guest was seen in the store; null when nobody has visited yet.
    lastActiveAt: seen?.lastSeen ? new Date(Number(seen.lastSeen)).toISOString() : null
  };
};

const DAY = 86400000;

export function consoleApi(config: Config, root: Store, keys: IapKeys = fetchIapKeys) {
  const r = Router();
  r.use(consoleAuth(config, keys));

  const getRec = async (id: string) => {
    const rec = await root.get<StoreRecord>('stores', id);
    if (!rec) throw new HttpError(404, 'Store not found.');
    return rec;
  };
  // ponytail: reads every store record and counts per store on each call; add paging/cached counters past a few hundred stores.
  r.get('/stores', handler(async (req, res) => {
    const q = String(req.query.q ?? '').toLowerCase();
    const { plan, status } = req.query;
    let rows = await Promise.all((await root.list<StoreRecord>('stores')).map((s) => view(root, s)));
    rows = rows.filter((s) =>
      (!q || s.name.toLowerCase().includes(q) || s.subdomain.includes(q)) && (!plan || s.plan === plan || s.effectivePlan === plan) && (!status || s.status === status));
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ status: 'success', data: rows });
  }));

  const audits = async (storeId?: string) =>
    (await root.list('consoleAudit', storeId ? { where: [{ field: 'storeId', op: '==', value: storeId }] } : undefined))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
  r.get('/audit', handler(async (req, res) => {
    res.json({ status: 'success', data: await audits(typeof req.query.storeId === 'string' ? req.query.storeId : undefined) });
  }));
  // Cross-store reads for the platform console (see consoleStats.ts: bounded queries, masked buyer phones, no hashes).
  r.get('/summary', handler(async (_req, res) => void res.json({ status: 'success', data: await summary(root) })));
  r.get('/activity', handler(async (req, res) => void res.json({ status: 'success', data: await activity(root, Number(req.query.limit)) })));
  r.get('/owners', handler(async (_req, res) => void res.json({ status: 'success', data: await owners(root) })));
  r.get('/buyers', handler(async (_req, res) => void res.json({ status: 'success', data: await buyers(root) })));
  r.get('/orders', handler(async (_req, res) => void res.json({ status: 'success', data: await orders(root) })));
  r.get('/stores/:id', handler(async (req, res) => {
    const rec = await getRec(req.params.id);
    const data = scopeStore(root, rec.id);
    res.json({ status: 'success', data: { ...(await view(root, rec)), categories: (await data.list('categories')).length, audit: await audits(rec.id) } });
  }));

  // Writes: JSON only (a cross-site form post cannot send it), always audited.
  const write = (action: string, schema: z.ZodType<any>, apply: (rec: StoreRecord, body: any) => { patch: Partial<StoreRecord>; what: string }) =>
    r.post(`/stores/:id/${action}`, handler(async (req, res) => {
      if (!req.is('application/json')) throw new HttpError(415, 'Send JSON.');
      const rec = await getRec(req.params.id);
      const { patch, what } = apply(rec, parse(schema, req.body));
      await root.update('stores', rec.id, patch);
      const id = `aud-${crypto.randomUUID()}`;
      await root.set('consoleAudit', id, { id, at: new Date().toISOString(), who: res.locals.actor, storeId: rec.id, action, what });
      res.json({ status: 'success', data: await view(root, { ...rec, ...patch }) });
    }));
  const notFounder = (rec: StoreRecord) => {
    if (rec.plan === 'founder') throw new HttpError(400, 'The founder store plan cannot be changed.');
  };
  write('plan', z.object({ plan: z.enum(['basic', 'pro']) }), (rec, b) => {
    notFounder(rec);
    return { patch: { plan: b.plan }, what: `plan ${rec.plan} -> ${b.plan}` };
  });
  write('trial', z.object({ days: z.number().int().min(1).max(90) }), (rec, b) => {
    notFounder(rec);
    const from = Math.max(Date.now(), rec.trialEndsAt ? Date.parse(rec.trialEndsAt) : 0);
    const trialEndsAt = new Date(from + b.days * DAY).toISOString();
    return { patch: { trialEndsAt, remindersSent: [], trialNotice: '' }, what: `trial extended ${b.days} day(s) to ${trialEndsAt}` };
  });
  write('suspend', z.object({}), () => ({ patch: { status: 'suspended' }, what: 'suspended' }));
  write('unsuspend', z.object({}), () => ({ patch: { status: 'active' }, what: 'unsuspended' }));
  // Console staff may set any layout whatever the plan; a Pro layout on a Basic store shows only once the store is on Pro.
  write('layout', z.object({ layout: z.enum(LAYOUT_IDS) }), (rec, b) => ({
    patch: { merchant: { ...rec.merchant, layout: b.layout } }, what: `layout ${rec.merchant.layout ?? DEFAULT_LAYOUT} -> ${b.layout}`
  }));
  write('own-app', z.object({ ownApp: z.boolean() }), (_rec, b) => ({ patch: { ownApp: b.ownApp }, what: `ownApp ${b.ownApp}` }));

  r.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));
  r.use((e: any, _req: any, res: any, _next: any) => {
    const status = e instanceof HttpError ? e.status : 500;
    res.status(status).json({ status: 'error', message: status === 500 ? 'Something went wrong.' : e.message });
  });
  return r;
}

/**
 * Mounted ahead of the store resolver: the API (and, built, the page) on console.<baseDomain>,
 * and on any host outside production so it can be tried locally at /console.
 */
export function consoleMount(config: Config, root: Store, keys?: IapKeys) {
  const r = Router();
  const isConsoleHost: RequestHandler = (req, _res, next) =>
    hostOf(req) === `console.${config.baseDomain}` || !config.isProduction ? next() : next('router');
  r.use('/api/console', isConsoleHost, consoleApi(config, root, keys));
  if (config.isProduction) {
    const dist = path.resolve(process.cwd(), 'dist');
    const page = path.join(dist, 'console.html');
    const assets = express.static(dist, { index: false });
    r.get('*', (req, res, next) => {
      if (hostOf(req) !== `console.${config.baseDomain}`) return next();
      assets(req, res, () => (fs.existsSync(page) ? res.sendFile(page) : next()));
    });
  }
  return r;
}
