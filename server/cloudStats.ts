/**
 * Real Google figures for the console cloud cards, by plain fetch against the REST APIs (no client library).
 * Every card is `{ data, note }`: data is null with a short, safe note when Google refuses or is unreachable.
 * Raw Google errors, tokens and object names never leave this file.
 */
import type { Config } from './config';

const GOOGLE_MS = 8000;
const CHECK_MS = 3000;
const META = 'http://metadata.google.internal/computeMetadata/v1';
const DAY = 86400000;
const LIST_PAGES = 10; // ponytail: 10 x 1000 objects per refresh; past that per-store bytes are a lower bound (truncated=true). Use Monitoring-only totals or a counter doc.

export interface Card<T> { data: T | null; note: string }
const NOT_ON_RUN = 'Only available on Cloud Run (or set GOOGLE_OAUTH_ACCESS_TOKEN locally)';

const cache = new Map<string, { at: number; ttl: number; v: unknown }>();
/** Cache a result for `ttl` ms (60 s by default). Tests call resetCloudCache(). */
async function cached<T>(key: string, fn: () => Promise<T>, ttl = 60_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.v as T;
  const v = await fn();
  cache.set(key, { at: Date.now(), ttl, v });
  return v;
}
export const resetCloudCache = () => { cache.clear(); tok = null; };

const timed = (url: string, init: RequestInit = {}, ms = GOOGLE_MS) => fetch(url, { ...init, signal: AbortSignal.timeout(ms) });

class Denied extends Error {}
let tok: { value: string; exp: number } | null = null;
async function token(): Promise<string> {
  const env = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (env) return env;
  if (!process.env.K_SERVICE) throw new Denied(NOT_ON_RUN);
  if (tok && tok.exp > Date.now() + 60_000) return tok.value;
  const res = await timed(`${META}/instance/service-accounts/default/token`, { headers: { 'Metadata-Flavor': 'Google' } });
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !j.access_token) throw new Denied('Could not get a service-account token');
  tok = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 300) * 1000 };
  return tok.value;
}
async function projectId(): Promise<string> {
  const env = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (env) return env;
  return cached('project', async () => {
    const res = await timed(`${META}/project/project-id`, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Denied('Project id unknown (set GOOGLE_CLOUD_PROJECT)');
    return (await res.text()).trim();
  }, 3600_000);
}

/** GET a Google REST URL as JSON; 403/404/timeouts become a Denied with a role hint, never the raw body. */
async function gget<T>(url: string, role: string): Promise<T> {
  const res = await timed(url, { headers: { Authorization: `Bearer ${await token()}` } });
  if (res.status === 401 || res.status === 403) throw new Denied(`Grant ${role} to the Cloud Run service account`);
  if (res.status === 404) throw new Denied('Not found in this project');
  if (!res.ok) throw new Denied(`Google returned ${res.status}`);
  return (await res.json()) as T;
}

/** Run a card; every failure (timeout, bad JSON, denied) turns into data:null plus a safe note. */
async function card<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<Card<T>> {
  return cached(key, async () => {
    try {
      return { data: await fn(), note: '' };
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return { data: null, note: e instanceof Denied ? e.message : timeout ? 'Google did not answer in time' : 'Could not read from Google' };
    }
  }, ttl);
}

/* ---------- Cloud Monitoring ---------- */
interface TS { points?: Array<{ interval: { endTime: string }; value: { int64Value?: string; doubleValue?: number } }> }
async function series(project: string, filter: string, days: number, daily: boolean): Promise<TS[]> {
  const end = new Date();
  const q = new URLSearchParams({
    filter, 'interval.startTime': new Date(end.getTime() - days * DAY).toISOString(), 'interval.endTime': end.toISOString()
  });
  if (daily) {
    q.set('aggregation.alignmentPeriod', '86400s');
    q.set('aggregation.perSeriesAligner', 'ALIGN_SUM');
    q.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
  }
  const j = await gget<{ timeSeries?: TS[] }>(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${q}`, 'roles/monitoring.viewer');
  return j.timeSeries ?? [];
}
const val = (p: NonNullable<TS['points']>[number]) => Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
/** Newest-first points to oldest-first daily totals (buckets are aligned to the interval end, so the last one is the last 24 h). */
const dailyTotals = (ts: TS[], days: number) => {
  const pts = ts.flatMap((t) => t.points ?? []).sort((a, b) => a.interval.endTime.localeCompare(b.interval.endTime)).map(val);
  return Array.from({ length: days }, (_, i) => pts[pts.length - days + i] ?? 0);
};
const latest = (ts: TS[]) => {
  const pts = ts.flatMap((t) => t.points ?? []).sort((a, b) => b.interval.endTime.localeCompare(a.interval.endTime));
  return pts.length ? val(pts[0]) : null;
};

export interface Usage { reads: number; writes: number; deletes: number; readsDaily: number[] }
/** Firestore reads, writes and deletes in the last 24 h, plus 14 daily read totals. */
export const firestoreUsage = (): Promise<Card<Usage>> => card('fs', async () => {
  const p = await projectId();
  const f = (m: string) => `metric.type="firestore.googleapis.com/document/${m}"`;
  const [reads, writes, deletes] = await Promise.all([series(p, f('read_count'), 14, true), series(p, f('write_count'), 2, true), series(p, f('delete_count'), 2, true)]);
  const readsDaily = dailyTotals(reads, 14);
  return { reads: readsDaily[13], writes: dailyTotals(writes, 1)[0], deletes: dailyTotals(deletes, 1)[0], readsDaily };
});

/** Cloud Run requests in the last 24 h for this service. */
export const runRequests = (): Promise<Card<{ requests: number }>> => card('run', async () => {
  const p = await projectId();
  const svc = process.env.K_SERVICE ? ` AND resource.labels.service_name="${process.env.K_SERVICE.replace(/[^\w-]/g, '')}"` : '';
  const ts = await series(p, `metric.type="run.googleapis.com/request_count"${svc}`, 1, true);
  return { requests: dailyTotals(ts, 1)[0] };
});

/* ---------- Cloud Storage ---------- */
export interface StorageUsage { bytes: number; objects: number | null; perStore: Array<{ id: string; bytes: number; objects: number }>; truncated: boolean }
/**
 * Bucket bytes and object count from Monitoring (daily-sampled by Google), per-store bytes from a bounded object listing.
 * If Monitoring is not allowed the listing total is used instead.
 */
export const storageUsage = (config: Pick<Config, 'storageBucket'>): Promise<Card<StorageUsage>> => card('storage', async () => {
  const bucket = config.storageBucket;
  if (!bucket) throw new Denied('No cloud media bucket in this environment');
  const per = new Map<string, { bytes: number; objects: number }>();
  let truncated = false;
  let pageToken = '';
  for (let page = 0; ; page++) {
    if (page === LIST_PAGES) { truncated = true; break; }
    const q = new URLSearchParams({ maxResults: '1000', fields: 'items(name,size),nextPageToken' });
    if (pageToken) q.set('pageToken', pageToken);
    const j = await gget<{ items?: Array<{ name: string; size: string }>; nextPageToken?: string }>(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${q}`, 'roles/storage.objectViewer');
    for (const o of j.items ?? []) {
      const id = /^stores\/([^/]+)\//.exec(o.name)?.[1] ?? '(shared)';
      const e = per.get(id) ?? { bytes: 0, objects: 0 };
      e.bytes += Number(o.size) || 0; e.objects++;
      per.set(id, e);
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  const listed = [...per.values()].reduce((t, e) => t + e.bytes, 0);
  const listedObjects = [...per.values()].reduce((t, e) => t + e.objects, 0);
  let bytes = listed, objects: number | null = listedObjects;
  if (truncated) { // the listing is a lower bound: use Monitoring totals when we can
    objects = null;
    try {
      const p = await projectId();
      const b = `resource.labels.bucket_name="${bucket.replace(/[^\w.-]/g, '')}"`;
      const [by, ob] = await Promise.all([
        series(p, `metric.type="storage.googleapis.com/storage/total_bytes" AND ${b}`, 2, false),
        series(p, `metric.type="storage.googleapis.com/storage/object_count" AND ${b}`, 2, false)
      ]);
      bytes = Math.max(listed, latest(by) ?? 0); objects = latest(ob);
    } catch { /* keep the lower bound */ }
  }
  return { bytes, objects, truncated, perStore: [...per].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.bytes - a.bytes) };
});

/* ---------- Subdomains and certificate ---------- */
export interface CertInfo { name: string; domains: string[]; state: string; expiresAt: string | null }
/** Certificate Manager certificates (the load balancer's Google-managed wildcard). */
export const certificates = (): Promise<Card<CertInfo[]>> => card('certs', async () => {
  const p = await projectId();
  const j = await gget<{ certificates?: Array<{ name: string; expireTime?: string; sanDnsnames?: string[]; managed?: { state?: string; domains?: string[] } }> }>(
    `https://certificatemanager.googleapis.com/v1/projects/${p}/locations/global/certificates`, 'roles/certificatemanager.viewer');
  return (j.certificates ?? []).map((c) => ({
    name: c.name.split('/').pop() ?? c.name, domains: c.sanDnsnames ?? c.managed?.domains ?? [], state: c.managed?.state ?? 'ACTIVE', expiresAt: c.expireTime ?? null
  }));
});

export interface SubCheck { id: string; host: string; status: number | null; ok: boolean; ms: number | null; checkedAt: string }
const checkOne = async (id: string, host: string): Promise<SubCheck> => {
  const t0 = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const res = await timed(`https://${host}/health`, { method: 'GET', redirect: 'manual' }, CHECK_MS);
    return { id, host, status: res.status, ok: res.ok, ms: Date.now() - t0, checkedAt };
  } catch {
    return { id, host, status: null, ok: false, ms: null, checkedAt };
  }
};
/** GET https://<id>.<baseDomain>/health for every store, 8 at a time, cached 5 minutes. */
export const subdomainChecks = (ids: string[], baseDomain: string): Promise<SubCheck[]> =>
  cached(`subs:${baseDomain}:${[...ids].sort().join(',')}`, async () => {
    const out: SubCheck[] = [];
    const queue = [...ids];
    await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) out.push(await checkOne(id, `${id}.${baseDomain}`));
    }));
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }, 5 * 60_000);

/** The summary `cloud` block: one network round per card, all in parallel and cached. */
export async function cloudSummary(config: Config, ids: string[]) {
  const [storage, firestore, run, certs, subs] = await Promise.all([
    storageUsage(config), firestoreUsage(), runRequests(), certificates(), subdomainChecks(ids, config.baseDomain)
  ]);
  return {
    region: process.env.CLOUD_REGION || 'asia-south1',
    storage, firestore, run, certs,
    subdomains: { checks: subs, serving: subs.filter((s) => s.ok).length, total: subs.length }
  };
}
