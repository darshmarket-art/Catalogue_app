import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { newStoreRecord } from '../server/tenancy';
import { WiseSenderOtpSender, WhatsAppSendError, createOtpSender } from '../server/whatsapp';

const base = { NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' };
const ws = { WISESENDER_VENDOR_UID: 'vendor-uid-1', WISESENDER_TOKEN: 'secret-token-value', WISESENDER_OTP_TEMPLATE: 'catalogue_login_otp' };
const cfg = (extra: Record<string, string> = {}) => loadConfig({ ...base, ...ws, ...extra } as any).wisesender!;

const reply = (status: number, body: object) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('WiseSender sign-in codes', () => {
  it('posts the code as an authentication template with the bearer token', async () => {
    const calls: any[] = [];
    const sender = new WiseSenderOtpSender(cfg(), (async (url: string, init: any) => {
      calls.push({ url, init });
      return reply(200, { status: 'success', message: 'Message sent' });
    }) as any);
    await sender.sendOtp('919820000001', '123456');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://app.wisesender.in/api/vendor-uid-1/contact/send-template-message');
    expect(calls[0].init.headers.Authorization).toBe('Bearer secret-token-value');
    expect(JSON.parse(calls[0].init.body)).toEqual({ phone_number: '919820000001', template_name: 'catalogue_login_otp', template_language: 'en_US', field_1: '123456', copy_code: '123456' });
  });

  it('retries once on a server error, and does not retry a refusal', async () => {
    let n = 0;
    const flaky = new WiseSenderOtpSender(cfg(), (async () => (++n === 1 ? reply(503, { message: 'busy' }) : reply(200, { status: 'success' }))) as any);
    await flaky.sendOtp('919820000001', '654321');
    expect(n).toBe(2);

    let m = 0;
    const refused = new WiseSenderOtpSender(cfg(), (async () => (++m, reply(400, { status: 'failed', message: 'template not approved' }))) as any);
    await expect(refused.sendOtp('919820000001', '654321')).rejects.toBeInstanceOf(WhatsAppSendError);
    expect(m).toBe(1);
  });

  it('treats a 200 that says failed as a failure, and never puts the token in the error', async () => {
    const sender = new WiseSenderOtpSender(cfg(), (async () => reply(200, { status: 'failed', message: 'WhatsApp not connected' })) as any);
    const err = await sender.sendOtp('919820000001', '111111').catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(String(err.message)).toContain('WhatsApp not connected');
    expect(String(err.message)).not.toContain('secret-token-value');
  });

  it('is chosen automatically when its settings exist, and replaces the static code', () => {
    const config = loadConfig({ ...base, ...ws, OTP_STATIC_CODE: '123456' } as any);
    expect(config.otpProvider).toBe('wisesender');
    expect(config.staticOtp).toBeNull();
    expect(createOtpSender(config)).toBeInstanceOf(WiseSenderOtpSender);
    expect(() => loadConfig({ ...base, OTP_PROVIDER: 'wisesender' } as any)).toThrow(/WISESENDER_VENDOR_UID/);
  });

  it('sign-in sends a fresh random code through WiseSender and that code signs the buyer in', async () => {
    const sent: any[] = [];
    const config = { ...loadConfig({ ...base, ...ws } as any), rateLimit: { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 } };
    const root = new MemoryStore();
    await root.set('stores', 'bhakti', newStoreRecord(config.merchant, { plan: 'pro' }));
    const app = createApp(
      config,
      root,
      new MemoryBlobs(),
      new WiseSenderOtpSender(config.wisesender!, (async (_u: string, init: any) => {
        sent.push(JSON.parse(init.body));
        return reply(200, { status: 'success' });
      }) as any)
    );
    const asked = await request(app).post('/api/auth/retailer/request-otp').send({ phone: '919820000002' });
    expect(asked.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].field_1).toMatch(/^\d{6}$/);
    const verified = await request(app).post('/api/auth/retailer/verify-otp').send({ phone: '919820000002', code: sent[0].field_1, firmName: 'Test Buyer' });
    expect(verified.status).toBe(200);
    expect(verified.body.user.storeName).toBe('Test Buyer');
  });
});
