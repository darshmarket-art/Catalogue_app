import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { createApp } from '../server/app';
import { bulkImportExempt } from '../server/bulkImport';

const KEY = 'bulk-import-key-0123456789abcdef';
const req = (method: string, originalUrl: string, key?: string) => ({ method, originalUrl, get: (h: string) => (h === 'x-bulk-import-key' ? key : undefined) }) as any;

describe('bulk import rate-limit exception', () => {
  it('exempts only the import calls, and only with the right key', () => {
    expect(bulkImportExempt(KEY, req('POST', '/api/admin/photos', KEY))).toBe(true);
    expect(bulkImportExempt(KEY, req('POST', '/api/products', KEY))).toBe(true);
    expect(bulkImportExempt(KEY, req('POST', '/api/categories', KEY))).toBe(true);
    expect(bulkImportExempt(KEY, req('GET', '/api/products?category=x&limit=500', KEY))).toBe(true);
    expect(bulkImportExempt(KEY, req('GET', '/api/entitlements', KEY))).toBe(true);
    // wrong / missing key, or a call the importer never makes
    expect(bulkImportExempt(KEY, req('POST', '/api/products', 'wrong-key'))).toBe(false);
    expect(bulkImportExempt(KEY, req('POST', '/api/products'))).toBe(false);
    expect(bulkImportExempt(KEY, req('DELETE', '/api/products/item-1', KEY))).toBe(false);
    expect(bulkImportExempt(KEY, req('POST', '/api/auth/admin/login', KEY))).toBe(false);
    expect(bulkImportExempt(KEY, req('GET', '/api/orders', KEY))).toBe(false);
    // nothing configured on the server: never exempt
    expect(bulkImportExempt(null, req('POST', '/api/products', KEY))).toBe(false);
  });

  it('refuses a too-short BULK_IMPORT_KEY', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), BULK_IMPORT_KEY: 'short' })).toThrow(/BULK_IMPORT_KEY/);
  });

  it('lets keyed import calls past the limit while everything else still gets 429', async () => {
    const base = loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), BULK_IMPORT_KEY: KEY });
    const app = createApp({ ...base, rateLimit: { auth: 1000, adminRegister: 1000, api: 3, analytics: 100000 } }, new MemoryStore());
    for (let i = 0; i < 3; i++) expect((await request(app).get('/api/config')).status).toBe(200);
    expect((await request(app).get('/api/config')).status).toBe(429); // limit reached
    expect((await request(app).get('/api/entitlements').set('X-Bulk-Import-Key', KEY)).status).toBe(200); // exempt
    expect((await request(app).get('/api/entitlements').set('X-Bulk-Import-Key', 'nope-nope-nope-nope-nope-nope')).status).toBe(429);
    expect((await request(app).get('/api/config').set('X-Bulk-Import-Key', KEY)).status).toBe(429); // not an import route
  });
});
