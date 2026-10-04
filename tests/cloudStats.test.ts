import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { certificates, firestoreUsage, resetCloudCache, runRequests, storageUsage, subdomainChecks } from '../server/cloudStats';

const json = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => String(body) });
const point = (end: string, v: number) => ({ interval: { endTime: end }, value: { int64Value: String(v) } });
let calls: string[];
const stub = (fn: (url: string) => unknown) => vi.stubGlobal('fetch', async (url: string) => { calls.push(url); return fn(url); });

beforeEach(() => {
  calls = [];
  resetCloudCache();
  process.env.GOOGLE_OAUTH_ACCESS_TOKEN = 'tok';
  process.env.GOOGLE_CLOUD_PROJECT = 'proj';
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN; delete process.env.GOOGLE_CLOUD_PROJECT; delete process.env.K_SERVICE; });

describe('cloudStats', () => {
  it('firestore: 24 h reads and a 14-day series from Monitoring', async () => {
    const days = Array.from({ length: 14 }, (_, i) => point(`2026-10-${String(14 - i).padStart(2, '0')}T00:00:00Z`, (14 - i) * 10)); // newest first, like Google
    stub((u) => json({ timeSeries: [{ points: u.includes('read_count') ? days : [point('2026-10-14T00:00:00Z', 7)] }] }));
    const { data, note } = await firestoreUsage();
    expect(note).toBe('');
    expect(data!.reads).toBe(140);
    expect(data!.readsDaily).toHaveLength(14);
    expect(data!.writes).toBe(7);
  });

  it('403 gives null plus a role hint, with no Google body leaked', async () => {
    stub(() => json({ error: { message: 'SECRET-DETAIL bucket-object-name' } }, 403));
    const out = await firestoreUsage();
    expect(out.data).toBeNull();
    expect(out.note).toBe('Grant roles/monitoring.viewer to the Cloud Run service account');
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('timeout gives null plus a short note', async () => {
    vi.stubGlobal('fetch', async () => { throw Object.assign(new Error('x'), { name: 'TimeoutError' }); });
    expect(await runRequests()).toEqual({ data: null, note: 'Google did not answer in time' });
  });

  it('without a token outside Cloud Run it explains instead of calling Google', async () => {
    delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    stub(() => json({}));
    const out = await storageUsage({ storageBucket: 'b' });
    expect(out.data).toBeNull();
    expect(out.note).toContain('Cloud Run');
    expect(calls).toHaveLength(0);
  });

  it('uses the metadata server token on Cloud Run', async () => {
    delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    process.env.K_SERVICE = 'svc';
    stub((u) => (u.includes('/token') ? json({ access_token: 'meta', expires_in: 3000 }) : json({ timeSeries: [{ points: [point('2026-10-14T00:00:00Z', 5)] }] })));
    expect((await runRequests()).data).toEqual({ requests: 5 });
    expect(calls[0]).toContain('metadata.google.internal');
  });

  it('storage: sums the listing per store prefix and counts shared files', async () => {
    stub(() => json({ items: [{ name: 'stores/a/1.jpg', size: '100' }, { name: 'stores/a/2.jpg', size: '50' }, { name: 'photos/x.jpg', size: '25' }] }));
    const { data } = await storageUsage({ storageBucket: 'b' });
    expect(data).toMatchObject({ bytes: 175, objects: 3, truncated: false });
    expect(data!.perStore[0]).toEqual({ id: 'a', bytes: 150, objects: 2 });
    expect(data!.perStore[1].id).toBe('(shared)');
  });

  it('storage: 404 and no bucket are null cards', async () => {
    stub(() => json({}, 404));
    expect((await storageUsage({ storageBucket: 'b' })).data).toBeNull();
    resetCloudCache();
    expect((await storageUsage({ storageBucket: null })).note).toContain('No cloud media bucket');
  });

  it('certificates: name, domains, state, expiry', async () => {
    stub(() => json({ certificates: [{ name: 'projects/p/locations/global/certificates/wild', sanDnsnames: ['*.antarixs.com'], expireTime: '2027-01-01T00:00:00Z', managed: { state: 'ACTIVE' } }] }));
    expect((await certificates()).data).toEqual([{ name: 'wild', domains: ['*.antarixs.com'], state: 'ACTIVE', expiresAt: '2027-01-01T00:00:00Z' }]);
  });

  it('subdomains: status per store, failures are not ok, results cached', async () => {
    stub((u) => (u.includes('down.') ? Promise.reject(new Error('refused')) : json({}, u.includes('gone.') ? 503 : 200)));
    const out = await subdomainChecks(['up', 'gone', 'down'], 'antarixs.com');
    expect(out.map((c) => [c.id, c.ok, c.status])).toEqual([['down', false, null], ['gone', false, 503], ['up', true, 200]]);
    await subdomainChecks(['up', 'gone', 'down'], 'antarixs.com');
    expect(calls).toHaveLength(3);
  });
});
