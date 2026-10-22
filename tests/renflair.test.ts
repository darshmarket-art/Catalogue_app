import { describe, expect, it } from 'vitest';
import { loadConfig } from '../server/config';
import { RenflairOtpSender, WhatsAppSendError } from '../server/whatsapp';

const base = { NODE_ENV: 'test', STORE: 'memory', JWT_SECRET: 'x'.repeat(48), MASTER_PROVISIONING_KEY: 'test-master-provisioning-key' };
const config = (extra: Record<string, string> = {}) => loadConfig({ ...base, RENFLAIR_API_KEY: 'test-key-123', ...extra } as any);
const reply = (status: number, body: string) => ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

describe('Renflair sign-in codes', () => {
  it('is picked when its key is set, and sends the national number, code and country code', async () => {
    const c = config();
    expect(c.otpProvider).toBe('renflair');
    const urls: string[] = [];
    await new RenflairOtpSender(c.renflair!, (async (u: string) => (urls.push(u), reply(200, '{"status":"success"}'))) as any).sendOtp('919820000001', '123456');
    const u = new URL(urls[0]);
    expect(u.origin + u.pathname).toBe('https://whatsapp.renflair.in/V1.php');
    expect(Object.fromEntries(u.searchParams)).toEqual({ API: 'test-key-123', PHONE: '9820000001', OTP: '123456', COUNTRY: '91' });
  });

  it('retries once on a server error; a refusal fails without leaking the key', async () => {
    let n = 0;
    const flaky = new RenflairOtpSender(config().renflair!, (async () => (++n === 1 ? reply(502, '') : reply(200, 'OK'))) as any);
    await flaky.sendOtp('919820000001', '123456');
    expect(n).toBe(2);
    const refused = new RenflairOtpSender(config().renflair!, (async () => reply(200, '{"status":"error","message":"Invalid API test-key-123"}')) as any);
    const err = await refused.sendOtp('919820000001', '123456').catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(err.message).not.toContain('test-key-123');
  });

  it('OTP_PROVIDER=renflair without a key is a configuration error', () => {
    expect(() => loadConfig({ ...base, OTP_PROVIDER: 'renflair' } as any)).toThrow(/RENFLAIR_API_KEY/);
  });
});

describe('only real Indian mobile numbers get a code', async () => {
  const { isRealMobile } = await import('../server/routes/otp');
  it('accepts 10-digit mobiles with or without 0 / 91, and refuses made-up or landline-shaped numbers', () => {
    for (const ok of ['9820011111', '09820011111', '919820011111', '6012345678']) expect(isRealMobile(ok)).toBe(true);
    for (const bad of ['9999999999', '9898989898', '0000000000', '1234567890', '5820011111', '98200111', '4498200111110', '919999999999']) expect(isRealMobile(bad)).toBe(false);
  });
});
