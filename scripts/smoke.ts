/**
 * Credential-free smoke checks. Usage: BASE_URL=https://bhakti.antarixs.com STORE=bhakti npx tsx scripts/smoke.ts
 * STORE is sent as X-Store (needed for run.app / localhost; ignored on a real store subdomain). Exit code 1 on any failure.
 */
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const store = process.env.STORE || '';
const hdr: Record<string, string> = store ? { 'X-Store': store } : {};
const FAKE_PHOTO = `/media/${'a'.repeat(32)}.jpg?e=1&s=${'0'.repeat(64)}`;

const checks: [string, string, Record<string, string>, (s: number, body: any) => boolean, string][] = [
  ['health', '/health', {}, (s, b) => s === 200 && b?.status === 'ok', '200 ok'],
  ['app-config', '/api/app-config', {}, (s, b) => s === 200 && !!b?.data?.minAppVersion, '200 with versions'],
  ['config', '/api/v1/config', hdr, (s, b) => s === 200 && !!b?.data, '200 with data'],
  ['entitlements', '/api/v1/entitlements', hdr, (s, b) => s === 200 && !!b?.data?.plan, '200 with plan'],
  ['bad photo link', FAKE_PHOTO, hdr, (s) => s === 403, '403 (invalid signature)'],
  ['unknown store', '/api/v1/config', { 'X-Store': 'zz-no-such-store-zz' }, (s) => s === 404, '404']
];

const rows: string[][] = [];
let failed = 0;
for (const [name, path, headers, ok, want] of checks) {
  let got = '';
  let pass = false;
  try {
    const res = await fetch(base + path, { headers, redirect: 'manual' });
    const body = await res.json().catch(() => null);
    pass = ok(res.status, body);
    got = String(res.status);
  } catch (e) {
    got = `error: ${(e as Error).message}`;
  }
  if (!pass) failed++;
  rows.push([pass ? 'PASS' : 'FAIL', name, want, got]);
}
const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log(r.map((c, i) => c.padEnd(w[i])).join('  '));
console.log(failed ? `\n${failed} check(s) FAILED against ${base}` : `\nAll ${rows.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
