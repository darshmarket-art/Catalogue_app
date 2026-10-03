import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { hostOf, storeIdOf } from '../server/tenancy';

const cfg = loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'k'.repeat(20), BASE_DOMAIN: 'antarixs.com' });
const fake = (host: string, headers: Record<string, string> = {}, query: Record<string, string> = {}) =>
  ({ headers: { host }, header: (n: string) => headers[n.toLowerCase()], query }) as any;

describe('host parsing', () => {
  it('lowercases, strips port and trailing dot', () => {
    expect(hostOf(fake('Shop.Antarixs.COM:8080'))).toBe('shop.antarixs.com');
    expect(hostOf(fake('shop.antarixs.com.'))).toBe('shop.antarixs.com');
  });
  it('derives the store from the subdomain', () => {
    expect(storeIdOf(fake('Gold-Shop.antarixs.com:443'), cfg)).toBe('gold-shop');
  });
  it('rejects bare domain, reserved, nested and invalid labels', () => {
    for (const h of ['antarixs.com', 'www.antarixs.com', 'console.antarixs.com', 'api.antarixs.com', 'app.antarixs.com', 'a.b.antarixs.com', 'ab.antarixs.com', '-x-.antarixs.com'])
      expect(storeIdOf(fake(h), cfg), h).toBeNull();
  });
  it('X-Store, ?store= and X-Forwarded-Host never override a real subdomain', () => {
    const r = fake('shop.antarixs.com', { 'x-store': 'other', 'x-forwarded-host': 'bhakti.antarixs.com' }, { store: 'other' });
    expect(storeIdOf(r, cfg)).toBe('shop');
    expect(storeIdOf(fake('antarixs.com', { 'x-store': 'bhakti' }), cfg)).toBeNull();
  });
  it('X-Forwarded-Host is ignored even for run.app hosts', () => {
    expect(storeIdOf(fake('x.run.app', { 'x-forwarded-host': 'shop.antarixs.com' }), cfg)).toBe(cfg.defaultStore);
  });
});

describe('marketing hosts are not served', () => {
  const app = createApp(cfg, new MemoryStore(), new MemoryBlobs());
  it.each(['antarixs.com', 'www.antarixs.com', 'WWW.ANTARIXS.COM:443'])('%s -> 404 JSON', async (h) => {
    for (const path of ['/', '/api/config', '/index.html']) {
      const res = await request(app).get(path).set('Host', h).set('X-Store', 'bhakti').set('X-Forwarded-Host', 'bhakti.antarixs.com');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/json/);
    }
  });
  it('unknown subdomain -> 404', async () => {
    expect((await request(app).get('/api/entitlements').set('Host', 'nope-store.antarixs.com')).status).toBe(404);
  });
});
