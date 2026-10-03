import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { OTP_MAX_ATTEMPTS } from '../server/routes/otp';
import type { OtpSender } from '../server/whatsapp';

class FakeSender implements OtpSender {
  sent: { phone: string; code: string }[] = [];
  async sendOtp(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
  last = () => this.sent[this.sent.length - 1].code;
}

let app: ReturnType<typeof createApp>;
let sender: FakeSender;
const PHONE = '9820012345';

function build(cap = 500) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' }),
    otpDailyCap: cap,
    rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 }
  };
  sender = new FakeSender();
  app = createApp(config, new MemoryStore(), new MemoryBlobs(), sender);
}
const ask = (phone = PHONE) => request(app).post('/api/auth/retailer/request-otp').send({ phone });
const verify = (code: string, extra = {}) => request(app).post('/api/auth/retailer/verify-otp').send({ phone: PHONE, code, ...extra });

describe('WhatsApp OTP login', () => {
  beforeEach(() => build());

  it('sends a 6-digit code, signs in, creates the buyer, and the code is single use', async () => {
    expect((await ask()).status).toBe(200);
    expect(sender.last()).toMatch(/^\d{6}$/);
    const res = await verify(sender.last(), { firmName: 'Shiv Jewels' });
    expect(res.status).toBe(200);
    expect(res.body.user.storeName).toBe('Shiv Jewels');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect((await verify(sender.last())).status).toBe(401);
  });

  it('rejects a wrong code and locks after 5 attempts', async () => {
    await ask();
    const good = sender.last();
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) expect((await verify(wrong)).status).toBe(401);
    expect((await verify(good)).status).toBe(429);
  });

  it('enforces the resend cooldown', async () => {
    await ask();
    expect((await ask()).status).toBe(429);
    expect(sender.sent).toHaveLength(1);
  });

  it('enforces the daily cap per store', async () => {
    build(2);
    expect((await ask('9820000001')).status).toBe(200);
    expect((await ask('9820000002')).status).toBe(200);
    expect((await ask('9820000003')).status).toBe(429);
  });

  it('returns 503 and stores nothing when the send fails', async () => {
    sender.sendOtp = async () => {
      throw new Error('boom');
    };
    expect((await ask()).status).toBe(503);
    expect((await verify('123456')).status).toBe(401);
  });

  it('rejects malformed input', async () => {
    expect((await ask('123')).status).toBe(400);
    expect((await verify('12ab')).status).toBe(400);
  });
});
