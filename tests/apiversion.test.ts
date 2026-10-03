import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';

const mk = (extra = {}) =>
  createApp(
    loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key', ...extra }),
    new MemoryStore(),
    new MemoryBlobs()
  );

describe('versioned API', () => {
  const app = mk({ MIN_APP_VERSION: '1.2.0', LATEST_APP_VERSION: '1.3.0' });
  it('serves the same routes on /api/v1 and /api', async () => {
    expect((await request(app).get('/api/v1/config')).body).toEqual((await request(app).get('/api/config')).body);
  });
  it('app-config reports versions, even to an outdated app', async () => {
    const res = await request(app).get('/api/v1/app-config').set('X-App-Version', '0.1.0');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ minAppVersion: '1.2.0', latestAppVersion: '1.3.0' });
  });
  it('rejects versions below the minimum with 426', async () => {
    const res = await request(app).get('/api/v1/config').set('X-App-Version', '1.1.9');
    expect(res.status).toBe(426);
    expect(res.body.message).toMatch(/update/i);
    expect((await request(app).get('/api/config').set('X-App-Version', '1.10.0')).status).toBe(200);
    expect((await request(app).get('/api/config')).status).toBe(200);
  });
  it('leaves health and media alone and allows the header in CORS', async () => {
    expect((await request(app).get('/health').set('X-App-Version', '0.0.1')).status).toBe(200);
    expect((await request(app).get('/media/none.jpg').set('X-App-Version', '0.0.1')).status).not.toBe(426);
    const o = await request(app).options('/api/v1/products').set('Origin', 'https://localhost');
    expect(o.headers['access-control-allow-headers']).toContain('X-App-Version');
  });
  it('defaults to 0.0.0', async () => {
    expect((await request(mk()).get('/api/app-config')).body.data.minAppVersion).toBe('0.0.0');
  });
});
