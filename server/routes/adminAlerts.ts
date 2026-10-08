import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import type { Entitlements } from '../entitlements';
import { MAX_ALERT_NUMBERS, alertNumbers, pushAll, takeAlertSlot, type Notifiers, type OrderAlert } from '../notify';
import { HttpError, audit, handler, parse } from '../http';
import { maskPhone } from '../whatsapp';
import type { MessageLog } from '../messages';
import { receiptsEnabled } from './whatsappWebhook';

export const TEST_ALERT_COOLDOWN_MS = 60 * 1000;

/** Exact wording of the Meta utility templates, shown to the owner so an alert never surprises them. */
export const ALERT_WORDING = {
  placed: '{Store}: New order {PO} from {Buyer} — {n} items, {grams} g. Open the admin to confirm.',
  cancelled: '{Store}: Order {PO} from {Buyer} was cancelled — {n} items, {grams} g.',
  storeFull: '{Store}: {n} new buyers could not join today because your catalogue is full. Pro has no buyer limit: {link}'
};

const phone = z
  .string()
  .transform((v) => v.replace(/[^0-9]/g, ''))
  .refine((v) => v.length >= 8 && v.length <= 15, 'Enter a WhatsApp number with the country code, e.g. 91 98765 43210.');
const saveSchema = z.object({ numbers: z.array(phone).min(1, 'Keep at least one number.').max(MAX_ALERT_NUMBERS, `Up to ${MAX_ALERT_NUMBERS} numbers can receive alerts.`) });

export interface TestResult { to: string; ok: boolean; error?: string; messageId?: string | null }

/** Owner alert settings: which WhatsApp numbers hear about orders, plus a test send. Saving and testing are Pro (alerts flag). */
export function adminAlertRoutes(config: Config, store: Store, n: Notifiers, requireAdmin: RequestHandler, ent: Entitlements, log: MessageLog | null = null, now: () => number = Date.now) {
  const router = Router();
  const whatsappConfigured = Boolean(config.whatsapp && config.orderTemplate);
  const pro = ent.requireFlag('alerts', 'WhatsApp alerts');

  const status = async () => ({
    numbers: await alertNumbers(store, config.merchant),
    maxNumbers: MAX_ALERT_NUMBERS,
    defaultNumber: config.merchant.contact.whatsapp,
    whatsappConfigured,
    storeFullConfigured: Boolean(config.whatsapp && config.storeFullTemplate),
    pushConfigured: Boolean(n.push.publicKey),
    receiptsConnected: receiptsEnabled(config),
    wording: ALERT_WORDING
  });

  router.get('/', requireAdmin, handler(async (_req, res) => res.json({ status: 'success', data: await status() })));

  router.put(
    '/',
    requireAdmin,
    pro,
    handler(async (req, res) => {
      const numbers = [...new Set(parse(saveSchema, req.body).numbers)];
      await store.set('settings', 'alerts', { id: 'alerts', numbers, updatedAt: new Date(now()).toISOString() });
      await audit(store, req, 'ALERT_NUMBERS_UPDATED', `Alert numbers set to ${numbers.map(maskPhone).join(', ')}.`);
      res.json({ status: 'success', data: await status() });
    })
  );

  router.post(
    '/test',
    requireAdmin,
    pro,
    handler(async (req, res) => {
      const t = now();
      const last = await store.get<{ at: number }>('settings', 'alerts-test');
      if (last && t - last.at < TEST_ALERT_COOLDOWN_MS) {
        throw new HttpError(429, `Please wait ${Math.ceil((TEST_ALERT_COOLDOWN_MS - (t - last.at)) / 1000)} seconds before sending another test.`);
      }
      await store.set('settings', 'alerts-test', { id: 'alerts-test', at: t });
      const a: OrderAlert = { event: 'test', poId: 'TEST-0001', brand: config.merchant.brand.name, buyer: 'Test Jewellers', grams: 12.5, items: 2 };
      const results: TestResult[] = [];
      for (const to of await alertNumbers(store, config.merchant)) {
        if (!whatsappConfigured) {
          results.push({ to: maskPhone(to), ok: false, error: 'WhatsApp alerts are not connected on the platform yet.' });
          continue;
        }
        if (!(await takeAlertSlot(config, store))) {
          results.push({ to: maskPhone(to), ok: false, error: "Today's alert allowance is used up." });
          continue;
        }
        try {
          const wamid = (await n.whatsapp.sendOrderAlert(to, a)) || null;
          const rec = log ? await log.record({ storeId: config.merchant.id, kind: 'test', to, wamid }) : null;
          results.push({ to: maskPhone(to), ok: true, messageId: rec?.id ?? null });
        } catch (e) {
          const error = String((e as Error)?.message ?? e).slice(0, 200);
          const rec = log ? await log.record({ storeId: config.merchant.id, kind: 'test', to, error }).catch(() => null) : null;
          results.push({ to: maskPhone(to), ok: false, error, messageId: rec?.id ?? null });
        }
      }
      const pushed = await pushAll(store, n.push, { title: `${a.brand}: test alert`, body: 'Order alerts are working on this device.', tag: 'test-alert' });
      await audit(store, req, 'ALERT_TEST_SENT', `Test alert sent to ${results.length} number(s); ${results.filter((r) => r.ok).length} accepted.`);
      res.json({ status: 'success', data: { results, pushed, whatsappConfigured } });
    })
  );

  return router;
}
