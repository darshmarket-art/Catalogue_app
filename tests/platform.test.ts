import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { isPlatformRequest } from '../server/tenancy';
import { CONTACT_SALES, SALES_EMAIL, UPGRADE_TO_PRO } from '../shared/sales';
import { trialMessage } from '../shared/trial';

const env = { NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' };
const req = (host: string, o: { store?: string; header?: string } = {}) =>
  ({ hostname: host, header: (h: string) => (h === 'x-store' ? o.header : undefined), query: o.store ? { store: o.store } : {} }) as any;

describe('platform detection', () => {
  const off = loadConfig(env);
  const on = loadConfig({ ...env, PLATFORM_MODE: 'true' });
  it('app.<base> is always the platform', () => {
    expect(isPlatformRequest(req('app.antarixs.com'), off)).toBe(true);
  });
  it('run.app keeps the default store unless PLATFORM_MODE=true', () => {
    expect(isPlatformRequest(req('x.run.app'), off)).toBe(false);
    expect(isPlatformRequest(req('x.run.app'), on)).toBe(true);
  });
  it('a store host or an explicit store is never the platform', () => {
    expect(isPlatformRequest(req('sharma.antarixs.com'), on)).toBe(false);
    expect(isPlatformRequest(req('localhost', { store: 'sharma' }), on)).toBe(false);
    expect(isPlatformRequest(req('localhost', { header: 'sharma' }), on)).toBe(false);
  });
  it('an installed app that names no store still reaches the default store', () => {
    const app = (headers: Record<string, string>, path = '/api/products') =>
      ({ hostname: 'x.run.app', path, query: {}, header: (h: string) => headers[h] }) as any;
    expect(isPlatformRequest(app({ 'x-app-client': 'native' }), on)).toBe(false);
    expect(isPlatformRequest(app({ origin: 'https://localhost' }, '/api/analytics/activity'), on)).toBe(false);
    expect(isPlatformRequest(app({}, '/media/photos/a.jpg'), on)).toBe(false);
    expect(isPlatformRequest(app({ origin: 'https://evil.example' }), on)).toBe(true);
    expect(isPlatformRequest(app({}, '/'), on)).toBe(true);
  });
  it('serves the entry route, not the store, in platform mode; default untouched', async () => {
    const mk = (c: typeof off) => createApp(c, new MemoryStore(), new MemoryBlobs());
    expect((await request(mk(on)).get('/')).headers.location).toBe('/welcome-antarixs');
    expect((await request(mk(on)).get('/api/v1/products')).status).toBe(404);
    expect((await request(mk(off)).get('/api/v1/products')).status).not.toBe(404);
    // The pre-multi-store Android app on the run.app address keeps working with the entry page switched on.
    expect((await request(mk(on)).get('/api/products').set('X-App-Client', 'native')).status).not.toBe(404);
    expect((await request(mk(on)).options('/api/products').set('Origin', 'https://localhost')).status).not.toBe(404);
  });
});

describe('sales wording', () => {
  it('is one constant everywhere', () => {
    expect(CONTACT_SALES).toBe('contact sales at hello@antarixs.com');
    expect(UPGRADE_TO_PRO).toContain(CONTACT_SALES);
    expect(trialMessage(null)).toContain(CONTACT_SALES);
    expect(trialMessage(3)).toContain(CONTACT_SALES);
    expect(trialMessage(3)).not.toMatch(/Contact Antarixs/);
    expect(SALES_EMAIL).toBe('hello@antarixs.com');
  });
});
