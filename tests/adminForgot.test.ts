import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord } from '../server/tenancy';

const KEY = 'test-master-provisioning-key';
const CODE = '123456';

async function build() {
  const config = { ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: KEY, OTP_STATIC_CODE: CODE }), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
  const root = new MemoryStore();
  await root.set('stores', 'bhakti', newStoreRecord(config.merchant, {}));
  const app = createApp(config, root, new MemoryBlobs());
  await request(app).post('/api/auth/admin/register').send({ email: 'o@example.com', password: 'AdminPass@2026', masterProvisioningKey: KEY });
  return app;
}

describe('admin forgot password (WhatsApp code)', () => {
  it('resets with the code, then the new password signs in and the old one does not', async () => {
    const app = await build();
    const asked = await request(app).post('/api/auth/admin/forgot/request-otp').send({ email: 'o@example.com' });
    expect(asked.status).toBe(200);
    const bad = await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: '000000', newPassword: 'BrandNewPass@1' });
    expect(bad.status).toBe(401);
    const ok = await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: CODE, newPassword: 'BrandNewPass@1' });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/admin/login').send({ adminId: 'o@example.com', password: 'BrandNewPass@1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/admin/login').send({ adminId: 'o@example.com', password: 'AdminPass@2026' })).status).toBe(401);
    // single use
    expect((await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: CODE, newPassword: 'AnotherPass@12' })).status).toBe(401);
  });

  it('answers the same for an unknown email and cannot reset it', async () => {
    const app = await build();
    const asked = await request(app).post('/api/auth/admin/forgot/request-otp').send({ email: 'nobody@example.com' });
    expect(asked.status).toBe(200);
    expect((await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'nobody@example.com', code: CODE, newPassword: 'BrandNewPass@1' })).status).toBe(401);
  });

  it('refuses short passwords and locks after 5 wrong codes', async () => {
    const app = await build();
    await request(app).post('/api/auth/admin/forgot/request-otp').send({ email: 'o@example.com' });
    expect((await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: CODE, newPassword: 'short' })).status).toBe(400);
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: '999999', newPassword: 'BrandNewPass@1' });
    expect((await request(app).post('/api/auth/admin/forgot/reset').send({ email: 'o@example.com', code: CODE, newPassword: 'BrandNewPass@1' })).status).toBe(429);
  });
});
