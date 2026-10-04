import type { Store } from './store';
import { TRIAL_DAYS } from './entitlements';
import { daysAgo, loadDaily, sumDays } from './stats';
import { scopeStore, type StoreRecord } from './tenancy';

const DAY = 86400000;
/** A buyer or visitor counts as online when seen within this long. */
const ONLINE_MS = 5 * 60 * 1000;
export const SOON_DAYS = 3;
const FEED_MAX = 100;
const BUYERS_MAX = 500;
const ORDERS_PER_STORE = 50;
const ORDERS_MAX = 200;

/**
 * Privacy: console staff never need a buyer's full number to run the platform, so lists show +91 98••• ••122 only
 * (country code, first two and last three digits). Nothing here returns passwords, hashes or addresses.
 */
export function maskPhone(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length < 8) return null;
  const n = d.slice(-10);
  return `+${d.slice(0, -10) || '91'} ${n.slice(0, 2)}••• ••${n.slice(-3)}`;
}

/** Audit text can quote a buyer's number ("Firm registered: X (Phone: 98...)"); mask any long digit run. */
const scrub = (text: unknown) => String(text ?? '').replace(/\+?\d[\d\s-]{7,}\d/g, (m) => maskPhone(m) ?? '••••');

const iso = (ms: unknown) => (Number(ms) > 0 ? new Date(Number(ms)).toISOString() : null);

/**
 * Runs `fn` for every store against that store's scoped data.
 * ponytail: lists every store record and runs a few bounded queries per store on each call; add paging and
 * pre-computed platform counters (one doc updated on write) past a few hundred stores.
 */
async function eachStore<T>(root: Store, fn: (rec: StoreRecord, data: Store) => Promise<T>): Promise<Array<[StoreRecord, T]>> {
  const recs = await root.list<StoreRecord>('stores');
  return Promise.all(recs.map(async (rec) => [rec, await fn(rec, scopeStore(root, rec.id))] as [StoreRecord, T]));
}

/** Where a store sits in the plan mix. A lapsed trial is Basic again. */
export const planKind = (r: StoreRecord, now = Date.now()) =>
  r.plan === 'founder' ? 'founder' : r.plan === 'pro' ? 'paidPro' : r.trialEndsAt && Date.parse(r.trialEndsAt) > now ? 'proTrial' : 'basic';

export async function summary(root: Store) {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const rows = await eachStore(root, async (_rec, data) => {
    const [stats, buyers, online] = await Promise.all([
      loadDaily(data, 14),
      data.list('buyers'),
      data.list('visitors', { where: [{ field: 'lastSeen', op: '>', value: now - ONLINE_MS }] })
    ]);
    return { stats, buyers: buyers.length, newBuyers: buyers.filter((b) => String(b.createdAt) >= weekAgo).length, online: online.length };
  });

  const planMix = { basic: 0, proTrial: 0, paidPro: 0, founder: 0 };
  const soon: Array<{ id: string; name: string; subdomain: string; trialEndsAt: string; daysLeft: number }> = [];
  for (const [rec] of rows) {
    planMix[planKind(rec, now)]++;
    const ends = rec.trialEndsAt ? Date.parse(rec.trialEndsAt) : 0;
    if (rec.plan === 'basic' && !rec.ownApp && rec.status === 'active' && ends > now && ends <= now + SOON_DAYS * DAY) {
      soon.push({ id: rec.id, name: rec.merchant.brand.name, subdomain: rec.subdomain, trialEndsAt: rec.trialEndsAt!, daysLeft: Math.ceil((ends - now) / DAY) });
    }
  }
  soon.sort((a, b) => a.trialEndsAt.localeCompare(b.trialEndsAt));

  const sum = (field: string, from: number, to: number) => rows.reduce((t, [, r]) => t + sumDays(r.stats, field, from, to), 0);
  const series = Array.from({ length: 14 }, (_, k) => {
    const day = daysAgo(13 - k);
    const total = (field: string) => Math.max(0, rows.reduce((t, [, r]) => t + (Number(r.stats[day]?.[field]) || 0), 0));
    return { day, orders: total('booked'), visits: total('visitors') };
  });
  const active = rows.filter(([r]) => r.status === 'active').length;

  return {
    generatedAt: new Date(now).toISOString(),
    stores: { total: rows.length, active, suspended: rows.length - active, newThisWeek: rows.filter(([r]) => r.createdAt >= weekAgo).length },
    buyers: { total: rows.reduce((t, [, r]) => t + r.buyers, 0), newThisWeek: rows.reduce((t, [, r]) => t + r.newBuyers, 0) },
    orders: { week: sum('booked', 0, 7), prevWeek: sum('booked', 7, 14) },
    visits: { week: sum('visitors', 0, 7), prevWeek: sum('visitors', 7, 14) },
    online: { visitors: rows.reduce((t, [, r]) => t + r.online, 0), stores: rows.filter(([, r]) => r.online > 0).length },
    planMix,
    trialsEndingSoon: { windowDays: SOON_DAYS, count: soon.length, stores: soon },
    series,
    // Nothing below can be read from app data. null = "Not connected" in the console; no number is invented.
    cloud: {
      storageBytes: null as number | null, // ponytail: the Blobs interface cannot list sizes; add a list/size call (or Cloud Monitoring) to fill this
      firestoreReads: null as number | null,
      certificates: null as string | null,
      costInr: null as number | null,
      subdomainsActive: active,
      note: 'Connect Cloud Monitoring'
    },
    env: { revision: process.env.K_REVISION ?? null }
  };
}

// Owner-facing events worth showing across the cloud. Anything not listed (logins, resets, failed attempts) stays out of the feed.
const OWNER_EVENTS: Record<string, string> = {
  PRODUCT_UPDATED: 'Design updated', PRODUCT_DELETED: 'Design removed', CATEGORY_UPDATED: 'Collection updated', CATEGORY_DELETED: 'Collection removed',
  BANNER_ADDED: 'Banner added', BANNER_LINK_CHANGED: 'Banner link changed', BANNER_DELETED: 'Banner removed', PURITIES_UPDATED: 'Purities updated',
  ABOUT_US_UPDATED: 'About page updated', LAYOUT_CHANGED: 'Layout changed', ORDER_STATUS_CHANGED: 'Order status changed',
  ORDER_CANCELLED_BY_BUYER: 'Order cancelled by buyer', RETAILER_SIGNUP_SUCCESS: 'Buyer signed up'
};

export interface FeedItem { id: string; at: string; kind: 'order' | 'store' | 'trial' | 'console' | 'owner'; title: string; detail: string; storeId: string | null; storeName: string | null }

export async function activity(root: Store, limit = 30) {
  const cap = Math.min(Math.max(Math.floor(limit) || 30, 1), FEED_MAX);
  const [perStore, consoleLog] = await Promise.all([
    eachStore(root, async (_rec, data) => {
      const [orders, logs] = await Promise.all([
        data.list('purchaseOrders', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: cap }),
        data.list('auditLogs', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: cap })
      ]);
      return { orders, logs };
    }),
    root.list('consoleAudit', { orderBy: { field: 'at', direction: 'desc' }, limit: cap })
  ]);

  const names = new Map(perStore.map(([rec]) => [rec.id, rec.merchant.brand.name]));
  const items: FeedItem[] = [];
  for (const [rec, { orders, logs }] of perStore) {
    const push = (kind: FeedItem['kind'], id: string, when: string, title: string, detail: string): void => {
      items.push({ id: `${kind}-${rec.id}-${id}`, at: when, kind, title, detail, storeId: rec.id, storeName: rec.merchant.brand.name });
    };
    push('store', 'created', rec.createdAt, 'New store created', rec.subdomain);
    // A signup trial runs TRIAL_DAYS from creation; a console extension later shows up through the console audit instead.
    if (rec.trialEndsAt && Math.abs(Date.parse(rec.trialEndsAt) - Date.parse(rec.createdAt) - TRIAL_DAYS * DAY) < 60_000) {
      push('trial', 'started', rec.createdAt, 'Trial started', `${TRIAL_DAYS} days of Pro`);
    }
    for (const o of orders) {
      push('order', String(o.poId), String(o.timestamp), `Order ${o.poId} placed`, `${(Number(o.totalNetGrams) || 0).toFixed(3)} g across ${Number(o.itemCount) || 0} items`);
    }
    for (const l of logs) {
      if (OWNER_EVENTS[l.event]) push('owner', String(l.id), String(l.timestamp), OWNER_EVENTS[l.event], scrub(l.details));
    }
  }
  for (const a of consoleLog) {
    items.push({
      id: `console-${a.id}`, at: String(a.at), kind: 'console', title: 'Console change',
      detail: `${a.what} · by ${a.who}`, storeId: a.storeId ?? null, storeName: names.get(a.storeId) ?? a.storeId ?? null
    });
  }
  return items.filter((i) => i.at && i.at !== 'undefined').sort((a, b) => b.at.localeCompare(a.at)).slice(0, cap);
}

export async function owners(root: Store) {
  const rows = await eachStore(root, async (_rec, data) =>
    // Field whitelist: the admin document also holds a password hash, which must never leave the server.
    (await data.list('admins')).map((a) => ({ name: a.name ?? null, email: a.email ?? null, phone: a.phone ?? null, role: a.role ?? null, createdAt: a.createdAt ?? null }))
  );
  return rows
    .map(([rec, admins]) => ({ id: rec.id, name: rec.merchant.brand.name, subdomain: rec.subdomain, status: rec.status, owner: rec.owner ?? null, admins }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function buyers(root: Store) {
  const rows = await eachStore(root, async (_rec, data) => {
    // ponytail: lists a store's whole buyer and verified-visitor sets; Basic caps at 50, add paging for big Pro stores.
    const [list, seen] = await Promise.all([data.list('buyers'), data.list('visitors', { where: [{ field: 'kind', op: '==', value: 'verified' }] })]);
    const lastSeen = new Map(seen.map((v) => [String(v.actorId), v.lastSeen]));
    return list.map((b) => ({ firmName: String(b.firmName ?? ''), phone: maskPhone(b.phone), verified: Boolean(b.verified), lastSeen: iso(lastSeen.get(String(b.phone))), createdAt: (b.createdAt as string) ?? null }));
  });
  const all = rows
    .flatMap(([rec, list]) => list.map((b) => ({ storeId: rec.id, storeName: rec.merchant.brand.name, ...b })))
    .sort((a, b) => String(b.lastSeen ?? b.createdAt ?? '').localeCompare(String(a.lastSeen ?? a.createdAt ?? '')));
  return { total: all.length, rows: all.slice(0, BUYERS_MAX) };
}

export async function orders(root: Store) {
  // Net weight and PO number only: no firm, phone or line items. ponytail: newest 50 per store, then the newest 200 overall.
  const rows = await eachStore(root, (_rec, data) => data.list('purchaseOrders', { orderBy: { field: 'timestamp', direction: 'desc' }, limit: ORDERS_PER_STORE }));
  const all = rows
    .flatMap(([rec, list]) => list.map((o) => ({
      storeId: rec.id, storeName: rec.merchant.brand.name, poId: String(o.poId), status: String(o.status ?? 'new'),
      totalNetGrams: Number(o.totalNetGrams) || 0, itemCount: Number(o.itemCount) || 0, timestamp: String(o.timestamp ?? '')
    })))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { total: all.length, rows: all.slice(0, ORDERS_MAX) };
}
