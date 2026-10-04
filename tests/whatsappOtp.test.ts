import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../server/config';
import { MemoryStore } from '../server/store';
import { MemoryBlobs } from '../server/blobs';
import { createApp } from '../server/app';
import { MetaOtpSender, SEND_TIMEOUT_MS, WhatsAppSendError, createOtpSender, otpTemplatePayload, type OtpSender } from '../server/whatsapp';

const BASE = { NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' };
const CREDS = { WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: '1234567890', WHATSAPP_OTP_TEMPLATE: 'verification_code', WHATSAPP_OTP_LANGUAGE: 'en_US' };
const LIMITS = { auth: 1000, adminRegister: 1000, api: 100000, analytics: 100000 };

describe('OTP provider selection (env-driven)', () => {
  it('uses the fixed dev code when only OTP_STATIC_CODE is set', () => {
    const c = loadConfig({ ...BASE, OTP_STATIC_CODE: '123456' });
    expect(c.otpProvider).toBe('static');
    expect(c.staticOtp).toBe('123456');
  });

  it('switches to WhatsApp automatically once credentials exist and ignores the static code', () => {
    const c = loadConfig({ ...BASE, ...CREDS, OTP_STATIC_CODE: '123456' });
    expect(c.otpProvider).toBe('whatsapp');
    expect(c.staticOtp).toBeNull();
    expect(c.whatsapp?.apiVersion).toBe('v25.0');
    expect(createOtpSender(c)).toBeInstanceOf(MetaOtpSender);
  });

  it('OTP_PROVIDER=static keeps the fixed code even with credentials present', () => {
    const c = loadConfig({ ...BASE, ...CREDS, OTP_STATIC_CODE: '123456', OTP_PROVIDER: 'static' });
    expect(c.otpProvider).toBe('static');
    expect(c.staticOtp).toBe('123456');
  });

  it('falls back to console codes in development when nothing is set', () => {
    expect(loadConfig(BASE).otpProvider).toBe('console');
  });

  it('fails fast on impossible settings', () => {
    expect(() => loadConfig({ ...BASE, OTP_PROVIDER: 'whatsapp' })).toThrow(/WHATSAPP_TOKEN/);
    expect(() => loadConfig({ ...BASE, OTP_PROVIDER: 'static' })).toThrow(/OTP_STATIC_CODE/);
    expect(() => loadConfig({ ...BASE, OTP_PROVIDER: 'sms' })).toThrow(/OTP_PROVIDER must be one of/);
    expect(() => loadConfig({ ...BASE, NODE_ENV: 'production', STORE: 'firestore', OTP_PROVIDER: 'console' })).toThrow(/production/);
  });
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const creds = loadConfig({ ...BASE, ...CREDS }).whatsapp!;
const PHONE = '919820011001';

describe('MetaOtpSender', () => {
  it('posts the approved authentication template with the code in the body and in the copy button', async () => {
    const fetchFn = vi.fn(async () => json(200, { messages: [{ id: 'wamid.1' }] }));
    await new MetaOtpSender(creds, fetchFn as any).sendOtp(PHONE, '482913');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v25.0/1234567890/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(otpTemplatePayload(creds, PHONE, '482913'));
    expect(body.to).toBe(PHONE);
    expect(body.template.name).toBe('verification_code');
    expect(body.template.language.code).toBe('en_US');
    expect(body.template.components[0].parameters[0].text).toBe('482913');
    expect(body.template.components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: '0' });
    expect(body.template.components[1].parameters[0].text).toBe('482913');
  });

  it('surfaces the Meta error code and does not retry permanent failures', async () => {
    const fetchFn = vi.fn(async () => json(400, { error: { message: '(#131026) Message Undeliverable', code: 131026, fbtrace_id: 'Axyz' } }));
    const err = await new MetaOtpSender(creds, fetchFn as any).sendOtp(PHONE, '000000').catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(err.metaCode).toBe(131026);
    expect(err.traceId).toBe('Axyz');
    expect(err.notOnWhatsApp).toBe(true);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('#131026');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries once on throttling and server errors', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(429, { error: { message: 'Rate limit hit', code: 130429 } }))
      .mockResolvedValueOnce(json(200, { messages: [{ id: 'wamid.2' }] }));
    await new MetaOtpSender(creds, fetchFn as any).sendOtp(PHONE, '111111');
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const dead = vi.fn(async () => json(500, {}));
    await expect(new MetaOtpSender(creds, dead as any).sendOtp(PHONE, '111111')).rejects.toBeInstanceOf(WhatsAppSendError);
    expect(dead).toHaveBeenCalledTimes(2);
  });

  it('gives up when WhatsApp does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
      );
      const result = new MetaOtpSender(creds, fetchFn as any).sendOtp(PHONE, '222222').catch((e) => e);
      await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS * 2 + 50);
      const err = await result;
      expect(err).toBeInstanceOf(WhatsAppSendError);
      expect(err.message).toMatch(/did not answer/);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('live WhatsApp OTP through the API', () => {
  const build = (sender: OtpSender, extraEnv: Record<string, string> = {}) => {
    const config = { ...loadConfig({ ...BASE, ...CREDS, OTP_STATIC_CODE: '123456', ...extraEnv }), rateLimit: LIMITS };
    return createApp(config, new MemoryStore(), new MemoryBlobs(), sender);
  };
  const ask = (app: ReturnType<typeof createApp>, phone: string) => request(app).post('/api/auth/retailer/request-otp').send({ phone });
  const verify = (app: ReturnType<typeof createApp>, phone: string, code: string) => request(app).post('/api/auth/retailer/verify-otp').send({ phone, code, firmName: 'Shiv Jewels' });

  it('sends a random code on WhatsApp (static code ignored) and reports the channel', async () => {
    const sent: string[] = [];
    const app = build({ sendOtp: async (_p, code) => void sent.push(code) });
    const r = await ask(app, '9820011001');
    expect(r.status).toBe(200);
    expect(r.body.channel).toBe('whatsapp');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^\d{6}$/);
    expect(r.body.devCode).toBe(sent[0]); // still echoed outside production
    expect((await verify(app, '9820011001', sent[0] === '123456' ? '000000' : '123456')).status).toBe(401);
    expect((await verify(app, '9820011001', sent[0])).status).toBe(200);
  });

  it('signup codes also go out on WhatsApp', async () => {
    const sent: string[] = [];
    const app = build({ sendOtp: async (_p, code) => void sent.push(code) });
    const r = await request(app).post('/api/signup/request-otp').send({ phone: '9822222222' });
    expect(r.status).toBe(200);
    expect(r.body.channel).toBe('whatsapp');
    expect(sent).toHaveLength(1);
  });

  it('tells the buyer when the number is not on WhatsApp and stores no code', async () => {
    const app = build({ sendOtp: async () => { throw new WhatsAppSendError('WhatsApp send failed: 400 (#131026)', 400, 131026, 'trace', false); } });
    const r = await ask(app, '9820011002');
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('NOT_ON_WHATSAPP');
    expect(r.body.message).toMatch(/not seem to be on WhatsApp/);
    expect((await verify(app, '9820011002', '123456')).status).toBe(401);
    expect((await request(app).post('/api/signup/request-otp').send({ phone: '9822222223' })).status).toBe(400);
  });

  it('other provider failures become a 503 with a retry message', async () => {
    const app = build({ sendOtp: async () => { throw new WhatsAppSendError('WhatsApp send failed: 500', 500, null, null, true); } });
    const r = await ask(app, '9820011003');
    expect(r.status).toBe(503);
    expect(r.body.message).toMatch(/try again shortly/);
  });

  it('OTP_PROVIDER=static forces the fixed code and sends nothing even with credentials', async () => {
    const sent: string[] = [];
    const app = build({ sendOtp: async (_p, code) => void sent.push(code) }, { OTP_PROVIDER: 'static' });
    const r = await ask(app, '9820011004');
    expect(r.status).toBe(200);
    expect(r.body.channel).toBe('dev');
    expect(r.body.devCode).toBe('123456');
    expect(sent).toHaveLength(0);
    expect((await verify(app, '9820011004', '123456')).status).toBe(200);
  });
});
