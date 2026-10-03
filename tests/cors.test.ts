import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';

const app = createApp(
  loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' }),
  new MemoryStore(),
  new MemoryBlobs()
);

describe('CORS for native webviews', () => {
  it.each(['https://localhost', 'capacitor://localhost'])('allows %s', async (o) => {
    const res = await request(app).options('/api/products').set('Origin', o);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(o);
  });
  it('ignores other origins', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
