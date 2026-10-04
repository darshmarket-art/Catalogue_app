import { useEffect, useState } from 'react';

const API = '/api/v1/console';

export async function call<T = any>(path: string, body?: object): Promise<T> {
  const res = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message ?? `Request failed (${res.status})`);
  return j.data;
}

export interface ApiState<T> { data: T | null; error: string; loading: boolean }

/** GET `path`; refetches when `v` changes (the shell bumps it after every change). */
export function useApi<T>(path: string, v = 0): ApiState<T> {
  const [state, set] = useState<ApiState<T>>({ data: null, error: '', loading: true });
  useEffect(() => {
    let live = true;
    set((s) => ({ ...s, loading: true }));
    call<T>(path).then(
      (data) => live && set({ data, error: '', loading: false }),
      (e: Error) => live && set((s) => ({ ...s, error: e.message, loading: false }))
    );
    return () => { live = false; };
  }, [path, v]);
  return state;
}

export interface Row {
  id: string; name: string; subdomain: string; plan: 'basic' | 'pro' | 'founder'; effectivePlan: 'basic' | 'pro'; trialEndsAt: string | null;
  status: string; ownApp: boolean; owner: { email?: string; phone?: string } | null; createdAt: string; buyers: number; photos: number;
  limits: { buyers: number | null; photos: number | null }; lastActiveAt: string | null;
  categories?: number; audit?: AuditRow[];
}
export interface AuditRow { id: string; at: string; who: string; storeId?: string; action?: string; what: string }
export interface Summary {
  generatedAt: string;
  stores: { total: number; active: number; suspended: number; newThisWeek: number };
  buyers: { total: number; newThisWeek: number };
  orders: { week: number; prevWeek: number };
  visits: { week: number; prevWeek: number };
  online: { visitors: number; stores: number };
  planMix: { basic: number; proTrial: number; paidPro: number; founder: number };
  trialsEndingSoon: { windowDays: number; count: number; stores: Array<{ id: string; name: string; subdomain: string; trialEndsAt: string; daysLeft: number }> };
  series: Array<{ day: string; orders: number; visits: number }>;
  cloud: Cloud | null;
  env: { revision: string | null; service: string | null; region: string };
}
export interface Card<T> { data: T | null; note: string }
export interface StorageUsage { bytes: number; objects: number | null; perStore: Array<{ id: string; bytes: number; objects: number }>; truncated: boolean }
export interface SubCheck { id: string; host: string; status: number | null; ok: boolean; ms: number | null; checkedAt: string }
export interface Cloud {
  region: string;
  storage: Card<StorageUsage>;
  firestore: Card<{ reads: number; writes: number; deletes: number; readsDaily: number[] }>;
  run: Card<{ requests: number }>;
  certs: Card<Array<{ name: string; domains: string[]; state: string; expiresAt: string | null }>>;
  subdomains: { checks: SubCheck[]; serving: number; total: number };
}
/** Cloud Run revision names end in -00030-abc: the sidebar shows just 00030. */
export const revisionNo = (r: string | null) => (r ? /-(\d+)-[a-z0-9]+$/.exec(r)?.[1] ?? r : null);
export interface FeedItem { id: string; at: string; kind: 'order' | 'store' | 'trial' | 'console' | 'owner'; title: string; detail: string; storeId: string | null; storeName: string | null }
export interface Action { label: string; path: string; body: object; warn: string }

export const NOT_CONNECTED = 'Not connected';
export const num = (n: number) => n.toLocaleString('en-IN');
export const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const stamp = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const daysLeft = (s: string | null) => {
  if (!s) return '—';
  const d = Math.ceil((Date.parse(s) - Date.now()) / 86400000);
  return d > 0 ? `${d} ${d === 1 ? 'day' : 'days'}` : 'Ended';
};
/** Whole days of an active Pro trial, or null (not on a trial, or it has ended). */
export const trialDays = (s: Pick<Row, 'plan' | 'trialEndsAt'>) =>
  s.plan === 'basic' && s.trialEndsAt && Date.parse(s.trialEndsAt) > Date.now() ? Math.ceil((Date.parse(s.trialEndsAt) - Date.now()) / 86400000) : null;
export const ago = (s: string | null) => {
  if (!s) return '—';
  const m = Math.round((Date.now() - Date.parse(s)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : day(s);
};
export const short = (s: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(s)) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
export const isOnline = (s: string | null) => Boolean(s) && Date.now() - Date.parse(s!) < 5 * 60000;
export const bytes = (n: number) => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};
export const delta = (now: number, before: number) =>
  before === 0 ? (now > 0 ? 'New vs last week' : 'None yet') : `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}% vs last week`;

/** Plan changes that make sense for the Plans page. */
export const planActions = (s: Row): Action[] => [
  { label: 'Extend trial 14 days', path: '/trial', body: { days: 14 }, warn: 'Adds 14 days of Pro.' },
  s.plan === 'pro'
    ? { label: 'Set Basic', path: '/plan', body: { plan: 'basic' }, warn: 'Pro features lock after any trial ends.' }
    : { label: 'Set Pro', path: '/plan', body: { plan: 'pro' }, warn: 'The store gets all Pro features.' }
];

/** Everything staff can change on one store. Every one is confirmed first and recorded in the audit log. */
export const storeActions = (s: Row): Action[] => [
  // The founder store's plan is fixed (the server refuses changes), so no plan buttons for it.
  ...(s.plan === 'founder' ? [] : [
    { label: 'Set Basic', path: '/plan', body: { plan: 'basic' }, warn: 'Pro features lock after any trial ends.' },
    { label: 'Set Pro', path: '/plan', body: { plan: 'pro' }, warn: 'The store gets all Pro features.' },
    { label: 'Extend trial 14 days', path: '/trial', body: { days: 14 }, warn: 'Adds 14 days of Pro.' }
  ]),
  s.status === 'active'
    ? { label: 'Suspend', path: '/suspend', body: {}, warn: 'The store and its app stop working for everyone.' }
    : { label: 'Unsuspend', path: '/unsuspend', body: {}, warn: 'The store comes back online.' },
  { label: s.ownApp ? 'Unmark own app' : 'Mark own app', path: '/own-app', body: { ownApp: !s.ownApp }, warn: 'Own-app stores get Pro features.' },
];
