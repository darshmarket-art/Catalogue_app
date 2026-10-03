import crypto from 'crypto';
import type { Config } from './config';
import type { Store } from './store';
import type { Entitlements } from './entitlements';
import { logger } from './logger';

export type OrderEvent = 'placed' | 'cancelled';
export interface OrderAlert { event: OrderEvent; poId: string; brand: string; buyer: string; grams: number; items: number }
export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }

/** WhatsApp alert to the owner (a utility template). Injectable; tests use a fake. */
export interface AlertSender {
  sendOrderAlert(phone: string, a: OrderAlert): Promise<void>;
}
/** Web Push. `send` resolves 'gone' when the subscription is dead and should be pruned. */
export interface PushSender {
  publicKey: string | null;
  send(sub: PushSub, payload: object): Promise<'ok' | 'gone'>;
}
export interface Notifiers { whatsapp: AlertSender; push: PushSender }

export class MetaAlertSender implements AlertSender {
  constructor(private c: NonNullable<Config['whatsapp']>, private template: string) {}
  async sendOrderAlert(phone: string, a: OrderAlert) {
    const text = (s: string) => ({ type: 'text', text: s });
    const res = await fetch(`https://graph.facebook.com/${this.c.apiVersion}/${this.c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: this.template,
          language: { code: this.c.language },
          // {{1}} brand, {{2}} event, {{3}} PO, {{4}} buyer, {{5}} summary
          components: [{ type: 'body', parameters: [a.brand, a.event, a.poId, a.buyer, `${a.items} items, ${a.grams.toFixed(3)}g`].map(text) }]
        }
      })
    });
    if (!res.ok) throw new Error(`WhatsApp alert failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

/** Real push via the 'web-push' package, loaded on first use so nothing runs when VAPID keys are unset. */
class WebPushSender implements PushSender {
  private lib: any;
  constructor(private v: NonNullable<Config['vapid']>) {}
  get publicKey() { return this.v.publicKey; }
  async send(sub: PushSub, payload: object) {
    if (!this.lib) {
      const name = 'web-push';
      this.lib = (await import(name)).default;
      this.lib.setVapidDetails(this.v.subject, this.v.publicKey, this.v.privateKey);
    }
    try {
      await this.lib.sendNotification(sub, JSON.stringify(payload));
      return 'ok' as const;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) return 'gone' as const;
      throw e;
    }
  }
}

export function createNotifiers(config: Config): Notifiers {
  return {
    whatsapp: config.whatsapp && config.orderTemplate ? new MetaAlertSender(config.whatsapp, config.orderTemplate) : { sendOrderAlert: async () => {} },
    push: config.vapid ? new WebPushSender(config.vapid) : { publicKey: null, send: async () => 'ok' }
  };
}

const twice = async <T>(fn: () => Promise<T>) => {
  try { return await fn(); } catch { return await fn(); }
};

export const subId = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

/**
 * Call without awaiting. Sends only when the store's plan has alerts; every failure is logged, never thrown.
 * Each send is retried once. `config.merchant` is the store's live record.
 */
export function createNotify(config: Config, store: Store, ent: Entitlements, n: Notifiers) {
  return async (event: OrderEvent, order: Record<string, any>) => {
    try {
      if (!(await ent.load()).flags.alerts) return;
      const a: OrderAlert = {
        event, poId: order.poId, brand: config.merchant.brand.name, buyer: order.firmName ?? 'a buyer',
        grams: order.totalNetGrams ?? 0, items: order.itemCount ?? 0
      };
      const day = new Date().toISOString().slice(0, 10);
      const { alertNumbers, whatsapp } = config.merchant.contact;
      for (const phone of alertNumbers?.length ? alertNumbers : [whatsapp]) {
        if (((await store.get<{ count: number }>('alertDaily', day))?.count ?? 0) >= config.alertDailyCap) break;
        await store.increment('alertDaily', day, { count: 1 });
        await twice(() => n.whatsapp.sendOrderAlert(phone, a)).catch((e) => logger.error('Order WhatsApp alert failed', { error: String(e) }));
      }
      if (n.push.publicKey) {
        const payload = { title: `${a.brand}: order ${event}`, body: `${a.poId} from ${a.buyer} (${a.items} items, ${a.grams.toFixed(3)}g)`, tag: a.poId };
        for (const sub of await store.list<PushSub>('pushSubs')) {
          try {
            if ((await twice(() => n.push.send(sub, payload))) === 'gone') await store.delete('pushSubs', subId(sub.endpoint));
          } catch (e) {
            logger.error('Order push failed', { error: String(e) });
          }
        }
      }
    } catch (e) {
      logger.error('Order notification failed', { error: String(e) });
    }
  };
}
export type Notify = ReturnType<typeof createNotify>;
