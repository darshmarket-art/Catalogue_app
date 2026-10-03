import jwt from 'jsonwebtoken';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Config } from './config';
import type { Store } from './store';
import { HttpError, handler } from './http';
import { logger } from './logger';
import { trialMessage } from '../shared/trial';
import type { StoreRecord } from './tenancy';

const KEYS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
export type OidcKeys = () => Promise<Record<string, string>>;
const fetchKeys: OidcKeys = async () => {
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error('Could not fetch Google keys');
  return (await res.json()) as Record<string, string>;
};

/** WhatsApp utility template to the owner. Injectable; tests use a fake. */
export interface TrialSender {
  sendTrialNotice(phone: string, brand: string, text: string): Promise<void>;
}

export function createTrialSender(config: Config, template = process.env.WHATSAPP_TRIAL_TEMPLATE?.trim()): TrialSender {
  const c = config.whatsapp;
  if (!c || !template) return { sendTrialNotice: async () => {} };
  return {
    async sendTrialNotice(phone, brand, text) {
      const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: phone, type: 'template',
          // {{1}} store name, {{2}} message
          template: { name: template, language: { code: c.language }, components: [{ type: 'body', parameters: [brand, text].map((t) => ({ type: 'text', text: t })) }] }
        })
      });
      if (!res.ok) throw new Error(`Trial notice failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
  };
}

/** Google OIDC token from the Cloud Scheduler service account. Dev/test: open only with SWEEP_DEV_OPEN=true. */
export function sweepAuth(config: Config, keys: OidcKeys): RequestHandler {
  return async (req, _res, next) => {
    try {
      const m = /^Bearer (.+)$/.exec(req.header('authorization') ?? '');
      if (!m) {
        if (process.env.SWEEP_DEV_OPEN === 'true' && !config.isProduction) return next();
        throw new HttpError(401, 'Not allowed.');
      }
      const audience = process.env.SWEEP_AUDIENCE;
      const allowed = process.env.SWEEP_SERVICE_ACCOUNT?.trim().toLowerCase();
      if (!audience || !allowed) throw new HttpError(401, 'Not allowed.');
      const kid = (jwt.decode(m[1], { complete: true })?.header as { kid?: string } | undefined)?.kid;
      const pem = kid ? (await keys())[kid] : undefined;
      if (!pem) throw new HttpError(401, 'Not allowed.');
      let claims: jwt.JwtPayload;
      try {
        claims = jwt.verify(m[1], pem, { algorithms: ['RS256'], audience, issuer: ['https://accounts.google.com', 'accounts.google.com'] }) as jwt.JwtPayload;
      } catch {
        throw new HttpError(401, 'Not allowed.');
      }
      if (claims.email_verified === false || String(claims.email ?? '').toLowerCase() !== allowed) throw new HttpError(403, 'Not allowed.');
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** 7, 3 or 1 once days left falls to that mark (so a missed day still sends the next one); null while more than 7 remain. */
const markFor = (days: number) => (days > 7 ? null : days > 3 ? 7 : days > 1 ? 3 : 1);

export async function sweepTrials(root: Store, sender: TrialSender, now = Date.now()) {
  const out = { checked: 0, reminders: 0, ended: 0 };
  for (const rec of await root.list<StoreRecord>('stores')) {
    if (rec.plan !== 'basic' || rec.ownApp || !rec.trialEndsAt || rec.status !== 'active') continue;
    out.checked++;
    const left = Date.parse(rec.trialEndsAt) - now;
    const days = left > 0 ? Math.ceil(left / 86400000) : null;
    const mark = days === null ? 'ended' : markFor(days);
    const key = mark === null ? null : String(mark);
    const sent = rec.remindersSent ?? [];
    if (!key || sent.includes(key)) continue;
    const text = trialMessage(days);
    try {
      if (rec.owner?.phone) await sender.sendTrialNotice(rec.owner.phone, rec.merchant.brand.name, text);
      await root.update('stores', rec.id, { remindersSent: [...sent, key], trialNotice: text });
      if (days === null) out.ended++;
      else out.reminders++;
    } catch (e) {
      logger.error('Trial notice failed', { store: rec.id, error: String(e) }); // not recorded, so the next run retries
    }
  }
  return out;
}

export function sweepRoutes(config: Config, root: Store, sender: TrialSender, now: () => number, keys: OidcKeys = fetchKeys) {
  const r = Router();
  r.post('/', sweepAuth(config, keys), handler(async (_req, res) => {
    res.json({ status: 'success', data: await sweepTrials(root, sender, now()) });
  }));
  return r;
}
