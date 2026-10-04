import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from './config';
import type { Blobs } from './blobs';
import type { Store, Doc } from './store';
import type { MerchantConfig } from './merchant';
import type { PlanDoc } from './entitlements';
import { isReservedStoreName, isValidStoreName } from '../shared/storeName';

/** One document per store in the top-level "stores" collection (the only data not inside a store's namespace). */
export interface StoreRecord {
  id: string;
  subdomain: string;
  status: 'active' | 'suspended';
  plan: PlanDoc['plan'];
  trialEndsAt?: string;
  ownApp?: boolean;
  /** Trial reminder marks already sent (7, 3, 1, ended); cleared when the trial is extended. */
  remindersSent?: string[];
  trialNotice?: string;
  owner?: { email?: string; phone?: string };
  /** Brand, theme, WhatsApp number and the rest of what merchants/<id>/merchant.json holds. */
  merchant: MerchantConfig;
  createdAt: string;
}

/** A new store record from a merchant config (id = subdomain). Bhakti is the permanent founder; everyone else starts Basic. */
export const newStoreRecord = (merchant: MerchantConfig, patch: Partial<StoreRecord> = {}): StoreRecord => ({
  id: merchant.id, subdomain: merchant.id, status: 'active', plan: merchant.id === 'bhakti' ? 'founder' : 'basic',
  merchant, createdAt: new Date().toISOString(), ...patch
});

export const planOf = (r: StoreRecord): PlanDoc => ({ plan: r.plan, trialEndsAt: r.trialEndsAt, ownApp: r.ownApp, trialNotice: r.trialNotice });

const COLLECTION = /^[A-Za-z0-9_]+$/;
const nsOf = (storeId: string) => {
  if (!isValidStoreName(storeId)) throw new Error('Invalid store id');
  return `stores/${storeId}/`;
};

/**
 * A Store that can only see one store's data: every collection becomes stores/<id>/<collection>.
 * Routes receive only this, so a query can never cross stores.
 */
export function scopeStore(root: Store, storeId: string): Store {
  const ns = nsOf(storeId);
  const c = (name: string) => {
    if (!COLLECTION.test(name)) throw new Error(`Invalid collection name "${name}"`);
    return ns + name;
  };
  return {
    get: (col, id) => root.get(c(col), id),
    set: (col, id, data) => root.set(c(col), id, data),
    create: (col, id, data) => root.create(c(col), id, data),
    delete: (col, id) => root.delete(c(col), id),
    list: (col, o) => root.list(c(col), o),
    update: (col, id, data) => root.update(c(col), id, data),
    increment: (col, id, f, extra) => root.increment(c(col), id, f, extra)
  } as Store;
}

/** Same idea for photos: every object name lives under stores/<id>/. */
export function scopeBlobs(root: Blobs, storeId: string): Blobs {
  const ns = nsOf(storeId);
  const n = (name: string) => {
    if (name.includes('..') || name.startsWith('/')) throw new Error('Invalid blob name');
    return ns + name;
  };
  return { put: (name, d, t) => root.put(n(name), d, t), get: (name) => root.get(n(name)), exists: (name) => root.exists(n(name)) };
}

/**
 * Signing secret per store, so a token or photo link made for one store fails verification on another.
 * The default (founder) store keeps the root secret so sessions issued before multi-store stay valid.
 */
export const secretFor = (config: Config, storeId: string) =>
  storeId === config.defaultStore ? config.jwtSecret : crypto.createHmac('sha256', config.jwtSecret).update(`store:${storeId}`).digest('hex');

/**
 * The host the client asked for: the Host header only, lowercased, port and trailing dot removed. X-Forwarded-Host is
 * deliberately ignored: Cloud Run and the load balancer pass the real Host through, and a client-sent forwarded
 * header must never pick the store.
 */
export function hostOf(req: Request): string {
  const raw = (req.headers?.host ?? req.hostname ?? '').toString().toLowerCase();
  return raw.replace(/:\d+$/, '').replace(/\.$/, '');
}

/** Bare domain and www belong to the marketing site (WordPress at Hostinger); the app never serves them. */
export const isMarketingHost = (host: string, config: Config) => host === config.baseDomain || host === `www.${config.baseDomain}`;

/**
 * Which store a request is for. A [store].<baseDomain> host wins and cannot be overridden; otherwise the X-Store
 * header or ?store= (localhost, installed apps, tests); otherwise the default store (the existing run.app address).
 * Returns null for a host that is not a valid store address (bare domain, reserved names such as www, console).
 */
export function storeIdOf(req: Request, config: Config): string | null {
  const host = hostOf(req);
  if (host === config.baseDomain) return null;
  const suffix = `.${config.baseDomain}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    return isValidStoreName(sub) && !isReservedStoreName(sub) ? sub : null;
  }
  const picked = req.header('x-store') ?? (typeof req.query.store === 'string' ? req.query.store : undefined);
  const id = (picked ?? config.defaultStore).trim().toLowerCase();
  return isValidStoreName(id) ? id : null;
}

/**
 * True when the request is for the Antarixs entry page, not a store: app.<baseDomain>, or (PLATFORM_MODE=true) any
 * host that is not a store host and names no store via X-Store or ?store=. Off by default, so run.app keeps serving the default store.
 * Android apps built before multi-store name no store; they keep reaching the default store (see fromStorelessApp).
 */
export function isPlatformRequest(req: Request, config: Config): boolean {
  const host = (req.hostname || '').toLowerCase();
  if (host === `app.${config.baseDomain}`) return true;
  if (!config.platformMode || host.endsWith(`.${config.baseDomain}`)) return false;
  if (req.header('x-store') || typeof req.query.store === 'string') return false;
  return !fromStorelessApp(req);
}

/**
 * An installed app that predates X-Store: its API calls come from the Capacitor WebView (origin https://localhost) or say
 * X-App-Client: native, and its <img> photo loads send neither, so /media also goes to the default store (the entry page has no photos).
 * ponytail: drop once every installed app is a per-store build that sends X-Store.
 */
const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost', 'http://localhost']);
const fromStorelessApp = (req: Request) =>
  req.header('x-app-client') === 'native' || APP_ORIGINS.has(req.header('origin') ?? '') || (req.path ?? '').startsWith('/media/');

export interface StoreEntry<A> {
  rec: StoreRecord;
  at: number;
  app?: A;
  mjson: string;
}

/** Reads store records (cached briefly), seeds the default store from merchants/<id>/merchant.json, and caches one built app per store. */
export function createStoreResolver<A>(config: Config, root: Store, build: (id: string, entry: StoreEntry<A>) => A) {
  const cache = new Map<string, StoreEntry<A>>();

  async function load(id: string): Promise<StoreRecord | null> {
    let rec = await root.get<StoreRecord>('stores', id);
    if (!rec && id === config.defaultStore) {
      rec = newStoreRecord(config.merchant);
      if (!(await root.create('stores', id, rec as unknown as Doc))) rec = await root.get<StoreRecord>('stores', id);
    }
    return rec;
  }

  async function resolve(id: string): Promise<StoreEntry<A> | null> {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < config.storeCacheMs) return hit;
    const rec = await load(id);
    if (!rec) {
      cache.delete(id);
      return null;
    }
    const mjson = JSON.stringify(rec.merchant);
    if (hit && hit.mjson === mjson) {
      hit.rec = rec;
      hit.at = Date.now();
      return hit;
    }
    const entry: StoreEntry<A> = { rec, at: Date.now(), mjson };
    entry.app = build(id, entry);
    cache.set(id, entry);
    return entry;
  }

  const middleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (isPlatformRequest(req, config)) {
        if (req.path.startsWith('/api') || req.path.startsWith('/media')) return void res.status(404).json({ status: 'error', message: 'Store not found.' });
        if (req.path === '/') return void res.redirect(302, '/welcome-antarixs');
        const b = config.merchant.brand;
        res.locals.merchant = { ...config.merchant, brand: { ...b, seoTitle: 'Antarixs: your jewellery catalogue store', seoDescription: 'Create your own catalogue store with Antarixs. Free for 14 days.', logoUrl: '' } };
        return void next();
      }
      const id = storeIdOf(req, config);
      const entry = id ? await resolve(id) : null;
      const wantsJson = req.path.startsWith('/api') || req.path.startsWith('/media') || isMarketingHost(hostOf(req), config);
      if (!entry) return void (wantsJson ? res.status(404).json({ status: 'error', message: 'Store not found.' }) : res.status(404).type('text').send('Store not found.'));
      if (entry.rec.status !== 'active') {
        return void (wantsJson ? res.status(403).json({ status: 'error', message: 'This store is not available right now.' }) : res.status(403).type('text').send('This store is not available right now.'));
      }
      res.locals.storeId = entry.rec.id;
      res.locals.merchant = entry.rec.merchant;
      (entry.app as unknown as (a: Request, b: Response, c: NextFunction) => void)(req, res, next);
    } catch (e) {
      next(e);
    }
  };
  return { middleware, resolve };
}
