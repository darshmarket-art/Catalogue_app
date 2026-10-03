import type { Config } from './config';
import { logger } from './logger';

/** Sends a one-time code to a phone (digits only, with country code). */
export interface OtpSender {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Meta WhatsApp Cloud API: an authentication-category template with a copy-code button. */
export class MetaOtpSender implements OtpSender {
  constructor(private c: NonNullable<Config['whatsapp']>) {}

  async sendOtp(phone: string, code: string) {
    const res = await fetch(`https://graph.facebook.com/${this.c.apiVersion}/${this.c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: this.c.template,
          language: { code: this.c.language },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }
          ]
        }
      })
    });
    if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

/** Development only: prints the code instead of sending it. */
export class ConsoleOtpSender implements OtpSender {
  async sendOtp(phone: string, code: string) {
    logger.info(`[dev] WhatsApp OTP for ${phone}: ${code}`);
  }
}

export function createOtpSender(config: Config): OtpSender {
  if (config.whatsapp) return new MetaOtpSender(config.whatsapp);
  // Never log codes in production: an unconfigured server fails the send instead.
  if (config.isProduction) return { sendOtp: async () => { throw new Error('WhatsApp is not configured.'); } };
  return new ConsoleOtpSender();
}
