import crypto from 'crypto';
import type { Config } from './config';
import type { Store } from './store';
import type { Entitlements } from './entitlements';
import type { MerchantConfig } from './merchant';
import type { MessageKind, MessageLog } from './messages';
import { maskPhone } from './whatsapp';
import { logger } from './logger';

export type OrderEvent = 'placed' | 'cancelled' | 'test';
export interface OrderAlert { event: OrderEvent; poId: string; brand: string; buyer: string; grams: number; items: number }
export interface StoreFullAlert { brand: string; count: number; planUrl: string }
export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }

/** WhatsApp alerts to the owner (utility templates). Injectable; tests use a fake. Resolve to Meta's message id when there is one. */
export interface AlertSender {
  sendOrderAlert(phone: string, a: OrderAlert): Promise<string | void>;
  /** "Catalogue full" nudge. Optional: senders without that template simply skip it. */
  sendStoreFullAlert?(phone: string, a: StoreFullAlert): Promise<string | void>;
}
/** Web Push. `send` resolves 'gone' when the subscription is dead and should be pruned. */
export interface PushSender {
  publicKey: string | null;
  send(sub: PushSub, payload: object): Promise<'ok' | 'gone'>;
}
export interface Notifiers { whatsapp: AlertSender; push: PushSender }

export const MAX_ALERT_NUMBERS = 3;

/** Numbers that receive owner alerts: the owner's saved choice, else the merchant config, else the store's WhatsApp number. */
export async function alertNumbers(store: Store, merchant: MerchantConfig): Promise<string[]> {
  const saved = await store.get<{ numbers?: string[] }>('settings', 'alerts');
  if (saved?.numbers?.length) return saved.numbers;
  const { alertNumbers: fromConfig, whatsapp } = merchant.contact;
  return fromConfig?.length ? fromConfig : [whatsapp];
}

export class MetaAlertSender implements AlertSender {
  constructor(
    private c: NonNullable<Config['whatsapp']>,
    private orderTemplate: string,
    private storeFullTemplate: string | null = null
  ) {}
  async sendOrderAlert(phone: string, a: OrderAlert) {
    // {{1}} brand, {{2}} event, {{3}} PO, {{4}} buyer, {{5}} summary
    return this.send(phone, this.orderTemplate, [a.brand, a.event, a.poId, a.buyer, `${a.items} items, ${a.grams.toFixed(3)}g`]);
  }
  async sendStoreFullAlert(phone: string, a: StoreFullAlert) {
    if (!this.storeFullTemplate) return void logger.warn('Store-full alert skipped: WHATSAPP_STORE_FULL_TEMPLATE is not set.');
    // {{1}} brand, {{2}} turned-away count, {{3}} link to the store (Admin → Plan)
    return this.send(phone, this.storeFullTemplate, [a.brand, String(a.count), a.planUrl]);
  }
  private async send(phone: string, template: string, params: string[]): Promise<string> {
    const res = await fetch(`https://graph.facebook.com/${this.c.apiVersion}/${this.c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: template, language: { code: this.c.language }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] }
      })
    });
    if (!res.ok) throw new Error(`WhatsApp alert failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const body: any = await res.json().catch(() => ({}));
    return body?.messages?.[0]?.id ?? '';
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
    whatsapp: config.whatsapp && config.orderTemplate ? new MetaAlertSender(config.whatsapp, config.orderTemplate, config.storeFullTemplate) : { sendOrderAlert: async () => {} },
    push: config.vapid ? new WebPushSender(config.vapid) : { publicKey: null, send: async () => 'ok' }
  };
}

const twice = async <T>(fn: () => Promise<T>) => {
  try { return await fn(); } catch { return await fn(); }
};

export const subId = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
const today = () => new Date().toISOString().slice(0, 10);

/** Pushes to every device of the store, pruning dead subscriptions. Returns how many went out. Never throws. */
export async function pushAll(store: Store, push: PushSender, payload: object): Promise<number> {
  if (!push.publicKey) return 0;
  let sent = 0;
  for (const sub of await store.list<PushSub>('pushSubs')) {
    try {
      if ((await twice(() => push.send(sub, payload))) === 'gone') await store.delete('pushSubs', subId(sub.endpoint));
      else sent++;
    } catch (e) {
      logger.error('Push failed', { error: String(e) });
    }
  }
  return sent;
}

/** Takes one unit of the store's daily WhatsApp alert allowance; false once the cap is reached. */
export async function takeAlertSlot(config: Config, store: Store, day = today()): Promise<boolean> {
  if (((await store.get<{ count: number }>('alertDaily', day))?.count ?? 0) >= config.alertDailyCap) return false;
  await store.increment('alertDaily', day, { count: 1 });
  return true;
}

/** Sends one owner alert with a single retry and logs the attempt (when a log is given). Never throws. */
export async function sendAlertLogged(log: MessageLog | null, storeId: string, kind: MessageKind, phone: string, send: () => Promise<string | void>): Promise<string | null> {
  try {
    const wamid = (await twice(send)) || null;
    const rec = log ? await log.record({ storeId, kind, to: phone, wamid }) : null;
    return rec?.id ?? null;
  } catch (e) {
    logger.error(`${kind} WhatsApp alert failed`, { to: maskPhone(phone), error: String(e) });
    const rec = log ? await log.record({ storeId, kind, to: phone, error: String((e as Error)?.message ?? e) }).catch(() => null) : null;
    return rec?.id ?? null;
  }
}

/**
 * Call without awaiting. Sends only when the store's plan has alerts; every failure is logged, never thrown.
 * Each send is retried once. `config.merchant` is the store's live record.
 */
export function createNotify(config: Config, store: Store, ent: Entitlements, n: Notifiers, log: MessageLog | null = null) {
  return async (event: OrderEvent, order: Record<string, any>) => {
    try {
      if (!(await ent.load()).flags.alerts) return;
      const a: OrderAlert = {
        event, poId: order.poId, brand: config.merchant.brand.name, buyer: order.firmName ?? 'a buyer',
        grams: order.totalNetGrams ?? 0, items: order.itemCount ?? 0
      };
      for (const phone of await alertNumbers(store, config.merchant)) {
        if (!(await takeAlertSlot(config, store))) break;
        await sendAlertLogged(log, config.merchant.id, 'order', phone, () => n.whatsapp.sendOrderAlert(phone, a));
      }
      await pushAll(store, n.push, { title: `${a.brand}: order ${event}`, body: `${a.poId} from ${a.buyer} (${a.items} items, ${a.grams.toFixed(3)}g)`, tag: a.poId });
    } catch (e) {
      logger.error('Order notification failed', { error: String(e) });
    }
  };
}
export type Notify = ReturnType<typeof createNotify>;

/**
 * "Catalogue full" owner nudge: at most once per calendar day, on any plan (it is how a Basic owner learns to upgrade).
 * Call without awaiting; never throws.
 */
export function createStoreFullNotify(config: Config, store: Store, n: Notifiers, log: MessageLog | null = null) {
  return async (turnedAwayToday: number) => {
    try {
      const day = today();
      const key = `store-full-${day}`;
      if (await store.get('alertDaily', key)) return;
      await store.set('alertDaily', key, { id: key, count: turnedAwayToday, at: new Date().toISOString() });
      const a: StoreFullAlert = { brand: config.merchant.brand.name, count: turnedAwayToday, planUrl: `https://${config.merchant.id}.${config.baseDomain}` };
      if (n.whatsapp.sendStoreFullAlert) {
        for (const phone of await alertNumbers(store, config.merchant)) {
          if (!(await takeAlertSlot(config, store, day))) break;
          await sendAlertLogged(log, config.merchant.id, 'store-full', phone, () => n.whatsapp.sendStoreFullAlert!(phone, a));
        }
      }
      const s = turnedAwayToday === 1 ? '' : 's';
      await pushAll(store, n.push, { title: `${a.brand}: catalogue full`, body: `${turnedAwayToday} new buyer${s} could not join today. Pro has no buyer limit.`, tag: key });
    } catch (e) {
      logger.error('Store-full notification failed', { error: String(e) });
    }
  };
}
export type StoreFullNotify = ReturnType<typeof createStoreFullNotify>;
