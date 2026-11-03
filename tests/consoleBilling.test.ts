import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { setBillingSource, type BillingRow } from '../server/billing';

const AUD = '/projects/1/global/backendServices/2';
const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const as = (email = 'boss@antarixs.com') => ({
  'x-goog-iap-jwt-assertion': jwt.sign({ email }, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { algorithm: 'ES256', keyid: 'k1', audience: AUD, issuer: 'https://cloud.google.com/iap', expiresIn: 300 })
});
const url = '/api/v1/console/billing/overview';

// Fixed "today": 2026-11-10 12:00 UTC (9 completed days of November).
const row = (day: string, service: string, sku: string, cost: number, credits = 0): BillingRow => ({ day, service, sku, currency: 'INR', cost, credits });
const nov = (i: number) => `2026-11-${String(i + 1).padStart(2, '0')}`;
const rows: BillingRow[] = [
  row('2026-10-05', 'Cloud Run', 'CPU', 100, -10),
  ...Array.from({ length: 10 }, (_, i) => row(nov(i), 'Cloud Run', 'CPU Allocation Time', 10)),
  ...Array.from({ length: 10 }, (_, i) => row(nov(i), 'Vertex AI', 'Gemini image generation', 4, -1)),
  row('2026-11-02', 'Cloud Firestore', 'Reads', 5)
];
let app: ReturnType<typeof createApp>;
let root: MemoryStore;
const fake = vi.fn(async (_since: string) => rows);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ k1: pair.publicKey.export({ type: 'spki', format: 'pem' }) }) }));
  process.env.CONSOLE_ADMINS = 'boss@antarixs.com';
  process.env.IAP_AUDIENCE = AUD;
  fake.mockClear();
  setBillingSource(fake);
  root = new MemoryStore();
  app = createApp({ ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } }, root, new MemoryBlobs());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setBillingSource(undefined);
  for (const k of ['CONSOLE_ADMINS', 'IAP_AUDIENCE', 'BILLING_EXPORT_TABLE']) delete process.env[k];
});

describe('console billing', () => {
  it('requires a console admin', async () => {
    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set(as('stranger@gmail.com'))).status).toBe(403);
    expect(fake).not.toHaveBeenCalled();
  });

  it('not connected: setup steps, and nothing is called', async () => {
    setBillingSource(undefined); // env decides, BILLING_EXPORT_TABLE is unset
    const res = await request(app).get(url).set(as());
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
    expect(res.body.data.setup.length).toBeGreaterThan(3);
    expect(res.body.data.project).toBe('gen-lang-client-0273003651');
    const ai = await request(app).get('/api/v1/console/ai/overview').set(as());
    expect(ai.body.data.billing.connected).toBe(false);
    expect(fake).not.toHaveBeenCalled();
  });

  it('rejects a malformed table name from the environment instead of calling BigQuery', async () => {
    setBillingSource(undefined);
    process.env.BILLING_EXPORT_TABLE = 'p.d.t; DROP TABLE x';
    const res = await request(app).get(url).set(as());
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/BILLING_EXPORT_TABLE/);
  });

  it('returns month-to-date, trend, services, SKUs, daily series and forecast', async () => {
    const res = await request(app).get(url).set(as());
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.connected).toBe(true);
    expect(d.currency).toBe('INR');
    expect(d.current).toMatchObject({ month: '2026-11', gross: 145, credits: -10, net: 135 });
    expect(d.current.daily).toHaveLength(10);
    expect(d.trend).toHaveLength(12);
    expect(d.trend[11]).toMatchObject({ month: '2026-11', net: 135 });
    expect(d.trend[10]).toMatchObject({ month: '2026-10', gross: 100, credits: -10, net: 90 });
    expect(d.selected.services.map((s: any) => s.service)).toEqual(['Cloud Run', 'Vertex AI', 'Cloud Firestore']);
    const run = d.selected.services[0];
    expect(run.share).toBeCloseTo(100 / 135);
    expect(run.skus[0]).toMatchObject({ sku: 'CPU Allocation Time', net: 100 });
    expect(d.current.forecast.enough).toBe(true);
    expect(d.current.forecast.total).toBeGreaterThan(135);
    expect(d.current.perService).toHaveLength(3);
    const oct = await request(app).get(`${url}?month=2026-10`).set(as());
    expect(oct.body.data.selected).toMatchObject({ month: '2026-10', net: 90 });
    expect((await request(app).get(`${url}?month=nope`).set(as())).status).toBe(400);
  });

  it('AI: actual Vertex cost vs the ledger estimate, with the difference and a forecast', async () => {
    await root.set('aiUsage', 's1:r1', { id: 's1:r1', storeId: 's1', renderId: 'r1', ts: Date.parse('2026-11-03T00:00:00Z'), style: 'cad', model: 'm', outcome: 'ok', costUsd: 0.5, price: 40, listPrice: 40, balanceAfter: 0 });
    const d = (await request(app).get(url).set(as())).body.data;
    expect(d.ai.actual).toMatchObject({ gross: 40, credits: -10, net: 30 });
    expect(d.ai.skus[0]).toMatchObject({ service: 'Vertex AI', sku: 'Gemini image generation' });
    expect(d.ai.estimate).toMatchObject({ costUsd: 0.5, revenueInr: 40, calls: 1 });
    expect(d.ai.estimate.costInr).toBeCloseTo(0.5 * d.ai.estimate.usdInr, 1);
    expect(d.ai.diffInr).toBeCloseTo(30 - d.ai.estimate.costInr, 1);
    expect(d.ai.actualMarginInr).toBeCloseTo(10, 1);
    expect(d.ai.forecast.enough).toBe(true);
  });

  it('caches the export for ten minutes, then reads it again', async () => {
    await request(app).get(url).set(as());
    await request(app).get(`${url}?month=2026-10`).set(as());
    expect(fake).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-11-10T12:11:00Z'));
    await request(app).get(url).set(as());
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('a BigQuery failure is a 502 with a readable message', async () => {
    setBillingSource(async () => { throw new Error('Access Denied: bigquery.jobs.create'); });
    const res = await request(app).get(url).set(as());
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/Access Denied/);
  });
});
