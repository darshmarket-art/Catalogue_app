import type { Config } from './config';
import { HttpError } from './http';
import { logger } from './logger';
import type { MessageLog } from './messages';

/** Sends a one-time code to a phone (digits only, with country code). Resolves to Meta's message id when there is one. */
export interface OtpSender {
  sendOtp(phone: string, code: string): Promise<string | void>;
}

export type OtpChannel = 'whatsapp' | 'dev';
export const SEND_TIMEOUT_MS = 10_000;

// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
const NOT_ON_WHATSAPP = 131026;
const TRANSIENT_CODES = new Set([4, 80007, 130429, 131056, 131000, 131016]);

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public status: number,
    public metaCode: number | null,
    public traceId: string | null,
    public retryable: boolean
  ) {
    super(message);
  }
  get notOnWhatsApp() {
    return this.metaCode === NOT_ON_WHATSAPP;
  }
}

export const maskPhone = (phone: string) => `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;

/** Authentication template with a copy-code button: Meta wants the code once in the body and once in the button. */
export function otpTemplatePayload(c: NonNullable<Config['whatsapp']>, to: string, code: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: c.template,
      language: { code: c.language },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }
      ]
    }
  };
}

/** Meta WhatsApp Cloud API. One retry on throttling, 5xx, network errors and timeouts; permanent failures surface at once. */
export class MetaOtpSender implements OtpSender {
  constructor(
    private c: NonNullable<Config['whatsapp']>,
    private fetchFn: typeof fetch = fetch
  ) {}

  async sendOtp(phone: string, code: string): Promise<string> {
    try {
      return await this.post(phone, code);
    } catch (e) {
      if (!(e instanceof WhatsAppSendError) || !e.retryable) throw e;
      return this.post(phone, code);
    }
  }

  private async post(phone: string, code: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchFn(`https://graph.facebook.com/${this.c.apiVersion}/${this.c.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.c.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(otpTemplatePayload(this.c, phone, code)),
        signal: ctrl.signal
      });
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? `WhatsApp did not answer within ${SEND_TIMEOUT_MS / 1000}s` : `WhatsApp request failed: ${e?.message ?? e}`;
      throw new WhatsAppSendError(msg, 0, null, null, true);
    } finally {
      clearTimeout(timer);
    }
    const body: any = await res.json().catch(() => ({}));
    if (res.ok) {
      const id: string = body?.messages?.[0]?.id ?? '';
      logger.info('WhatsApp OTP accepted', { to: maskPhone(phone), messageId: id || null });
      return id;
    }
    const err = body?.error ?? {};
    const metaCode = typeof err.code === 'number' ? err.code : null;
    const retryable = res.status >= 500 || res.status === 429 || (metaCode !== null && TRANSIENT_CODES.has(metaCode));
    const detail = `${res.status}${metaCode !== null ? ` (#${metaCode})` : ''} ${String(err.message ?? '').slice(0, 300)}`.trim();
    throw new WhatsAppSendError(`WhatsApp send failed: ${detail}`, res.status, metaCode, err.fbtrace_id ?? null, retryable);
  }
}

/**
 * WiseSender: our own 6-digit code goes out as an approved Authentication template (code in the body and on the copy-code button).
 * https://app.wisesender.in/api/docs/ (POST /api/{vendorUid}/contact/send-template-message, Bearer token). One retry on 429, 5xx and network errors.
 */
export class WiseSenderOtpSender implements OtpSender {
  constructor(
    private c: NonNullable<Config['wisesender']>,
    private fetchFn: typeof fetch = fetch
  ) {}

  async sendOtp(phone: string, code: string): Promise<string> {
    try {
      return await this.post(phone, code);
    } catch (e) {
      if (!(e instanceof WhatsAppSendError) || !e.retryable) throw e;
      return this.post(phone, code);
    }
  }

  private async post(phone: string, code: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchFn(`${this.c.baseUrl}/api/${encodeURIComponent(this.c.vendorUid)}/contact/send-template-message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.c.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, template_name: this.c.template, template_language: this.c.language, field_1: code, copy_code: code }),
        signal: ctrl.signal
      });
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? `WiseSender did not answer within ${SEND_TIMEOUT_MS / 1000}s` : `WiseSender request failed: ${e?.message ?? e}`;
      throw new WhatsAppSendError(msg, 0, null, null, true);
    } finally {
      clearTimeout(timer);
    }
    const body: any = await res.json().catch(() => ({}));
    const ok = res.ok && body?.status !== 'failed' && body?.result !== 'failed' && body?.success !== false;
    if (ok) {
      const id: string = body?.data?.messages?.[0]?.id ?? body?.messages?.[0]?.id ?? '';
      logger.info('WiseSender OTP accepted', { to: maskPhone(phone), messageId: id || null });
      return id;
    }
    const detail = `${res.status} ${String(body?.message ?? body?.error ?? '').slice(0, 300)}`.trim();
    throw new WhatsAppSendError(`WiseSender send failed: ${detail}`, res.status, null, null, res.status >= 500 || res.status === 429);
  }
}

/** Development only: prints the code instead of sending it. */
export class ConsoleOtpSender implements OtpSender {
  async sendOtp(phone: string, code: string) {
    logger.info(`[dev] WhatsApp OTP for ${phone}: ${code}`);
  }
}

export function createOtpSender(config: Config): OtpSender {
  switch (config.otpProvider) {
    case 'wisesender':
      return new WiseSenderOtpSender(config.wisesender!);
    case 'whatsapp':
      return new MetaOtpSender(config.whatsapp!);
    case 'static':
      return { sendOtp: async () => {} };
    default:
      // Never log codes in production: an unconfigured server fails the send instead.
      if (config.isProduction) return { sendOtp: async () => { throw new Error('WhatsApp is not configured.'); } };
      return new ConsoleOtpSender();
  }
}

export interface OtpDeliveryResult { channel: OtpChannel; messageId: string | null }

/**
 * Sends sign-in codes for one store (or the platform signup) and logs every attempt.
 * Nothing goes out in static mode; provider failures become friendly HTTP errors.
 */
export function createOtpDelivery(config: Config, sender: OtpSender, log: MessageLog | null, storeId: string | null) {
  return async (phone: string, code: string, kind: 'otp' | 'signup-otp' | 'admin-reset'): Promise<OtpDeliveryResult> => {
    if (config.staticOtp) return { channel: 'dev', messageId: null };
    try {
      const wamid = (await sender.sendOtp(phone, code)) || null;
      const live = config.otpProvider === 'whatsapp' || config.otpProvider === 'wisesender';
      const rec = live && log ? await log.record({ storeId, kind, to: phone, wamid }) : null;
      return { channel: live ? 'whatsapp' : 'dev', messageId: rec?.id ?? null };
    } catch (err) {
      const e = err instanceof WhatsAppSendError ? err : null;
      logger.error(`${kind} send failed`, { to: maskPhone(phone), error: String(err), metaCode: e?.metaCode ?? null, traceId: e?.traceId ?? null });
      if (log) await log.record({ storeId, kind, to: phone, error: String((err as Error)?.message ?? err), errorCode: e?.metaCode ?? null }).catch(() => {});
      if (e?.notOnWhatsApp) throw new HttpError(400, 'This number does not seem to be on WhatsApp. Please check it and try again.', 'NOT_ON_WHATSAPP');
      throw new HttpError(503, 'Could not send the code on WhatsApp. Please try again shortly.');
    }
  };
}
export type OtpDelivery = ReturnType<typeof createOtpDelivery>;
