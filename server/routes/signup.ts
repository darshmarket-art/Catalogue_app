import crypto from 'crypto';
import type { Request } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Config } from '../config';
import type { Doc, Store } from '../store';
import type { OtpDelivery } from '../whatsapp';
import { ADMIN_REMEMBER_TTL, safeEqual, signToken } from '../auth';
import { HttpError, errorHandler, handler, newId, parse } from '../http';
import { parseMerchant } from '../merchant';
import { devCode } from './otp';
import { hostOf, newStoreRecord, scopeStore, secretFor, type StoreRecord } from '../tenancy';
import { isAvailableStoreName, isReservedStoreName, isValidStoreName } from '../../shared/storeName';
import { trimmed } from '../schemas';

export const TRIAL_DAYS = 14;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 30 * 1000;

const phone = z
  .string()
  .transform((v) => v.replace(/[^0-9]/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 15, 'Please provide a valid mobile number.');
const storeName = z.string().trim().toLowerCase();
/** Honeypot: a field people never see. Bots that fill every input give themselves away. */
const website = z.string().max(200).optional();
const requestSchema = z.object({ phone, website });
const signupSchema = z.object({
  storeName,
  brandName: trimmed(60, 2),
  ownerName: trimmed(100).optional(),
  /** Optional brand colour (#rrggbb) for the store's primary colour; omitted keeps the core theme. */
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  phone,
  email: z.string().trim().toLowerCase().email().max(254),
  password: trimmed(128, 10),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  website
});

const ALREADY_USED = 'This phone number or email has already been used to start a free trial. Please sign in to your store instead.';

/** The starting point for every new store: core-app theme (no colour overrides), editable later by the owner. */
function defaultMerchant(id: string, brandName: string, ownerPhone: string, brandColor?: string) {
  const initials = encodeURIComponent(brandName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'ST');
  return parseMerchant(
    {
      id,
      sector: 'jewellery',
      catalogueAccess: 'login',
      brand: {
        name: brandName,
        tagline: 'Trade Catalogue',
        description: `${brandName} wholesale catalogue`,
        logoUrl: `https://placehold.co/128x128/715509/ffffff/png?text=${initials}`,
        seoTitle: `${brandName} - Catalogue`,
        seoDescription: `Browse the ${brandName} catalogue and order on WhatsApp.`
      },
      theme: { colors: brandColor ? { primary: brandColor } : {} },
      contact: { whatsapp: ownerPhone, deskPhone: `+${ownerPhone}` },
      legal: {},
      orders: { poPrefix: `PO-${id.toUpperCase()}`.slice(0, 20).replace(/-$/, 'X') },
      welcome: {
        features: [{ icon: 'verified', title: 'Genuine jewellery', description: 'Every piece checked before dispatch' }]
      },
      onboarding: { defaultMarketHub: 'Your city', marketHubPlaceholder: 'e.g. your market or city' }
    },
    `signup:${id}`,
    id
  );
}

/** Public URL of a store: [id].<baseDomain> on the real domain; ?store= on localhost and run.app addresses. */
export function storeUrlFor(req: Request, config: Config, id: string) {
  const host = hostOf(req);
  if (host === config.baseDomain || host.endsWith(`.${config.baseDomain}`)) return `https://${id}.${config.baseDomain}`;
  return `${req.protocol}://${req.get('host')}/?store=${id}`;
}

/** Self-serve store creation. Global layer: no store is resolved, so everything here lives in the root store. */
export function signupRoutes(config: Config, root: Store, delivery: OtpDelivery, now: () => number = Date.now) {
  const router = Router();
  const limit = (windowMs: number, n: number, message: string) =>
    rateLimit({ windowMs, limit: n, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message } });
  // Abuse limits: per IP. The honeypot field below catches simple bots; a CAPTCHA (Turnstile) can be added here later.
  const perIp = limit(60 * 60 * 1000, config.rateLimit.auth * 3, 'Too many attempts from this network. Please try again later.');
  // The name check runs live while the owner types, so it gets its own, roomier limit.
  const checkLimit = limit(15 * 60 * 1000, config.rateLimit.auth * 30, 'Too many checks from this network. Please try again in a few minutes.');
  const createLimit = limit(24 * 60 * 60 * 1000, config.rateLimit.auth, 'Too many stores created from this network today.');
  const isBot = (b: { website?: string }) => Boolean(b.website && b.website.trim());

  const hash = (ph: string, code: string) => crypto.createHmac('sha256', config.jwtSecret).update(`signup:${ph}:${code}`).digest('hex');
  const taken = async (id: string) => id === config.defaultStore || (await root.get('stores', id)) !== null; // the default store's record is seeded lazily

  async function suggest(base: string): Promise<string[]> {
    const stem = base.replace(/^-+|-+$/g, '').slice(0, 24);
    const out: string[] = [];
    for (const c of [`${stem}-store`, `${stem}-jewels`, `${stem}-india`, `${stem}-1`, `${stem}-2`, `${stem}-3`]) {
      if (out.length < 3 && isAvailableStoreName(c) && !(await taken(c))) out.push(c);
    }
    return out;
  }

  router.get(
    '/check',
    checkLimit,
    handler(async (req, res) => {
      const name = String(req.query.name ?? '').trim().toLowerCase();
      let reason: string | undefined;
      if (!isValidStoreName(name)) reason = 'Use 3 to 30 letters, digits or hyphens (no hyphen at the start or end).';
      else if (isReservedStoreName(name)) reason = 'That name is reserved. Please choose another.';
      else if (await taken(name)) reason = 'That name is already taken.';
      res.json({ status: 'success', available: !reason, reason, suggestions: reason ? await suggest(name) : [] });
    })
  );

  router.post(
    '/request-otp',
    perIp,
    handler(async (req, res) => {
      const body = parse(requestSchema, req.body);
      const ph = body.phone;
      // A bot gets the normal answer and nothing is sent or stored.
      if (isBot(body)) return void res.json({ status: 'success', message: 'We sent a 6-digit code to your WhatsApp.', expiresInSeconds: OTP_TTL_MS / 1000 });
      if (await root.get('trialClaims', `phone-${ph}`)) {
        throw new HttpError(409, 'This phone number has already been used to start a free trial. Please sign in to your store instead.', 'TRIAL_USED');
      }
      const t = now();
      const prev = await root.get<{ sentAt: number }>('signupOtps', ph);
      if (prev && t - prev.sentAt < OTP_RESEND_MS) {
        throw new HttpError(429, `Please wait ${Math.ceil((OTP_RESEND_MS - (t - prev.sentAt)) / 1000)} seconds before asking for another code.`);
      }
      const code = config.staticOtp ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const { channel, messageId } = await delivery(ph, code, 'signup-otp');
      await root.set('signupOtps', ph, { hash: hash(ph, code), expiresAt: t + OTP_TTL_MS, attempts: 0, sentAt: t });
      res.json({ status: 'success', message: 'We sent a 6-digit code to your WhatsApp.', expiresInSeconds: OTP_TTL_MS / 1000, channel, messageId, ...devCode(config, ph, code) });
    })
  );

  router.post(
    '/',
    perIp,
    createLimit,
    handler(async (req, res) => {
      const b = parse(signupSchema, req.body);
      if (isBot(b)) throw new HttpError(400, 'Could not create the store. Please try again.');
      if (!isValidStoreName(b.storeName)) throw new HttpError(400, 'storeName: Use 3 to 30 letters, digits or hyphens.');
      if (isReservedStoreName(b.storeName)) throw new HttpError(409, 'That store name is reserved. Please choose another.');

      // Phone code first, so nothing else is learned about an unverified caller.
      const otp = await root.get<{ hash: string; expiresAt: number; attempts: number }>('signupOtps', b.phone);
      if (!otp || otp.expiresAt < now()) throw new HttpError(401, 'That code has expired. Please request a new one.');
      if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes. Please request a new one.');
      if (!safeEqual(otp.hash, hash(b.phone, b.code))) {
        await root.update('signupOtps', b.phone, { attempts: otp.attempts + 1 });
        throw new HttpError(401, 'That code is not valid. Please check it or request a new one.');
      }

      // One trial per phone and email. Claims are atomic creates, so concurrent signups cannot both win.
      if ((await root.get('trialClaims', `phone-${b.phone}`)) || (await root.get('trialClaims', `email-${b.email}`))) {
        throw new HttpError(409, ALREADY_USED, 'TRIAL_USED');
      }

      const merchant = defaultMerchant(b.storeName, b.brandName, b.phone, b.brandColor);
      const rec = newStoreRecord(merchant, {
        plan: 'basic',
        trialEndsAt: new Date(now() + TRIAL_DAYS * 86400000).toISOString(),
        status: 'active',
        owner: { email: b.email, phone: b.phone },
        createdAt: new Date(now()).toISOString()
      });
      if (b.storeName === config.defaultStore || !(await root.create('stores', b.storeName, rec as unknown as Doc))) {
        throw new HttpError(409, `That store name is already taken. Try: ${(await suggest(b.storeName)).join(', ')}`);
      }
      const claim = { storeId: b.storeName, at: rec.createdAt };
      const gotPhone = await root.create('trialClaims', `phone-${b.phone}`, claim);
      const gotEmail = gotPhone && (await root.create('trialClaims', `email-${b.email}`, claim));
      if (!gotEmail) {
        await root.delete('stores', b.storeName);
        if (gotPhone) await root.delete('trialClaims', `phone-${b.phone}`);
        throw new HttpError(409, ALREADY_USED, 'TRIAL_USED');
      }
      await root.delete('signupOtps', b.phone); // single use

      const store = scopeStore(root, b.storeName);
      const admin = {
        id: newId('adm'),
        name: b.ownerName || 'Store Owner',
        email: b.email,
        password: await bcrypt.hash(b.password, 12),
        role: 'owner',
        createdAt: rec.createdAt
      };
      await store.create('admins', admin.email, admin);
      const logId = newId('log');
      await store.set('auditLogs', logId, { id: logId, event: 'STORE_CREATED', details: `Self-serve signup by ${b.email}`, timestamp: rec.createdAt, ip: req.ip });

      const storeConfig: Config = { ...config, merchant, jwtSecret: secretFor(config, b.storeName) };
      const storeUrl = storeUrlFor(req, config, b.storeName);
      res.status(201).json({
        status: 'success',
        storeId: b.storeName,
        storeUrl,
        trialEndsAt: (rec as StoreRecord).trialEndsAt,
        sessionToken: signToken(storeConfig, { type: 'admin', sub: admin.email, remember: true }, ADMIN_REMEMBER_TTL),
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
      });
    })
  );

  router.use(errorHandler); // no store app is in play here, so shape errors as JSON ourselves
  return router;
}
