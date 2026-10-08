import crypto from 'crypto';
import express, { Router } from 'express';
import type { Config } from '../config';
import { handler } from '../http';
import { logger } from '../logger';
import { isStatus, type MessageLog, type StatusError } from '../messages';

export const receiptsEnabled = (config: Config) => Boolean(config.whatsappAppSecret && config.webhookVerifyToken);

/** `X-Hub-Signature-256: sha256=<hex>` over the exact raw body, with the Meta app secret. */
export function validSignature(rawBody: Buffer, header: unknown, secret: string): boolean {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const received = Buffer.from(header.slice(7), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export interface StatusEvent { wamid: string; status: string; timestampSec: number | null; recipient: string | null; errors: StatusError[] }

/** Pulls the status entries out of a webhook body; inbound messages and other fields are ignored. */
export function collectStatuses(body: any): StatusEvent[] {
  const out: StatusEvent[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      for (const s of change.value?.statuses ?? []) {
        if (typeof s?.id !== 'string' || typeof s?.status !== 'string') continue;
        const ts = Number(s.timestamp);
        out.push({ wamid: s.id, status: s.status, timestampSec: Number.isFinite(ts) ? ts : null, recipient: s.recipient_id ?? null, errors: Array.isArray(s.errors) ? s.errors : [] });
      }
    }
  }
  return out;
}

/**
 * Meta calls here with delivery receipts (sent / delivered / read / failed). Mounted before the JSON body parser:
 * the signature is over the raw bytes. Until WHATSAPP_APP_SECRET and WHATSAPP_WEBHOOK_VERIFY_TOKEN exist this is a 404.
 */
export function whatsappWebhookRoutes(config: Config, log: MessageLog, now: () => number = Date.now) {
  const router = Router();
  const enabled = receiptsEnabled(config);

  router.get('/', (req, res) => {
    if (!enabled) return void res.status(404).end();
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && typeof token === 'string' && token === config.webhookVerifyToken) {
      return void res.status(200).type('text/plain').send(String(challenge ?? ''));
    }
    res.sendStatus(403);
  });

  router.post(
    '/',
    express.raw({ type: () => true, limit: '1mb' }),
    handler(async (req, res) => {
      if (!enabled) return void res.status(404).end();
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!validSignature(raw, req.get('x-hub-signature-256'), config.whatsappAppSecret!)) return void res.sendStatus(403);
      let body: unknown;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        return void res.sendStatus(400);
      }
      let applied = 0;
      for (const s of collectStatuses(body)) {
        if (!isStatus(s.status)) continue;
        if (await log.applyStatus(s.wamid, s.status, s.timestampSec, s.errors, now())) applied++;
      }
      await log.touchReceipt(now());
      logger.info('WhatsApp receipts', { applied });
      res.sendStatus(200);
    })
  );

  return router;
}
