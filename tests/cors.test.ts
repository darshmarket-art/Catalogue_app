import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';

import { STATIC_CODE, otpBuyer } from './buyerAuth';
const app = createApp(
  loadConfig({ NODE_ENV: 'test', STORE: 'memory', OTP_STATIC_CODE: STATIC_CODE, JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' }),
  new MemoryStore(),
  new MemoryBlobs()
);

describe('CORS for native webviews', () => {
  it.each(['https://localhost', 'capacitor://localhost'])('allows %s', async (o) => {
    const res = await request(app).options('/api/products').set('Origin', o);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(o);
    expect(res.headers['access-control-allow-headers']).toContain('X-App-Client'); // the app sends it on every call
  });
  it('lets the app load photos cross-origin, with or without an Origin header', async () => {
    const withOrigin = await request(app).get('/media/none.jpg').set('Origin', 'https://localhost');
    expect(withOrigin.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(withOrigin.headers['access-control-allow-origin']).toBe('https://localhost');
    // An <img> tag sends no Origin header at all.
    const img = await request(app).get('/media/none.jpg');
    expect(img.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
  it('ignores other origins', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('phone app sessions', () => {
  const phone = '9876543210';
  const expiryDays = (token: string) => {
    const { exp, iat } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return Math.round((exp - iat) / 86400);
  };
  it('lasts 90 days for the app, 7 days on the web, and renews on /me', async () => {
    const web = await otpBuyer(app, { firmName: 'Test Shop', phone });
    expect(web.status).toBe(200);
    expect(expiryDays(web.body.token)).toBe(7);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${web.body.token}`).set('X-App-Client', 'native');
    expect(me.status).toBe(200);
    expect(expiryDays(me.body.token)).toBe(90);
    const plain = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${web.body.token}`);
    expect(plain.body.token).toBeUndefined();
  });
});
