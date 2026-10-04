import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import type { OtpDelivery } from '../whatsapp';
import { RETAILER_TOKEN_TTL, safeEqual, signToken, tokenTtl } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { logger } from '../logger';
import type { Entitlements } from '../entitlements';
import type { StoreFullNotify } from '../notify';
import type { MessageLog } from '../messages';
import { receiptsEnabled } from './whatsappWebhook';
import { recordTurnedAway } from '../storeFull';
import { trimmed } from '../schemas';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 30 * 1000;
export const OTP_PHONE_PER_HOUR = 5;

/**
 * Development and test only: the code travels back in the response (and the log) so the app can show it and nobody needs WhatsApp.
 * In production nothing is ever revealed, even when OTP_STATIC_CODE is set. The real sender drops in without touching this.
 */
export function devCode(config: Config, phone: string, code: string): { devCode?: string } {
  if (config.isProduction) return {};
  if (config.staticOtp) logger.info(`[dev] OTP for ${phone} is the static code ${code}`);
  return { devCode: code };
}

const phone = z
  .string()
  .transform((v) => v.replace(/[^0-9]/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 15, 'Please provide a valid mobile number.');
const requestSchema = z.object({ phone });
const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetSchema = forgotSchema.extend({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'), newPassword: trimmed(128, 10) });
const verifySchema = z.object({
  phone,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  firmName: trimmed(120, 2).optional(),
  ownerName: trimmed(100).optional(),
  marketHub: trimmed(120).optional()
});

interface OtpDoc {
  hash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
  hourStart: number;
  hourCount: number;
  /** Message-log id of the WhatsApp send, when there was one. */
  messageId?: string | null;
}

export interface OtpDeps { delivery: OtpDelivery; log?: MessageLog | null; onStoreFull?: StoreFullNotify; now?: () => number }

export function otpRoutes(config: Config, store: Store, ent: Entitlements, deps: OtpDeps) {
  const { delivery, log = null, onStoreFull } = deps;
  const now = deps.now ?? Date.now;
  const router = Router();
  if (config.staticOtp) logger.warn('OTP_STATIC_CODE is set: sign-in uses a fixed code and nothing is sent on WhatsApp.');
  const hash = (ph: string, code: string) => crypto.createHmac('sha256', config.jwtSecret).update(`${ph}:${code}`).digest('hex');
  // The 30-second resend wait is waived once when WhatsApp reported the previous code as failed.
  const resendBlocked = async (prev: OtpDoc | null, t: number) => {
    if (!prev || t - prev.sentAt >= OTP_RESEND_MS) return false;
    const m = prev.messageId && log ? await log.get(prev.messageId) : null;
    return m?.status !== 'failed';
  };
  const ipLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit.auth * 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many attempts from this network. Please wait a few minutes.' }
  });

  router.post(
    '/retailer/request-otp',
    ipLimiter,
    handler(async (req, res) => {
      const { phone: ph } = parse(requestSchema, req.body);
      const t = now();
      try {
        await ent.assertCanAddBuyer(ph); // before any code is sent
      } catch (e) {
        if (e instanceof HttpError && e.code === 'CATALOGUE_FULL') {
          // A full store: count the buyer (once per day), tell the owner, spend nothing on a code.
          const { today } = await recordTurnedAway(store, ph, t);
          await audit(store, req, 'BUYER_TURNED_AWAY', `Catalogue full: ${ph} asked to join (${today} today).`);
          void onStoreFull?.(today);
        }
        throw e;
      }
      const prev = await store.get<OtpDoc>('otps', ph);
      if (await resendBlocked(prev, t)) {
        throw new HttpError(429, `Please wait ${Math.ceil((OTP_RESEND_MS - (t - prev!.sentAt)) / 1000)} seconds before asking for another code.`);
      }
      const sameHour = Boolean(prev && t - prev.hourStart < 3600_000);
      if (prev && sameHour && prev.hourCount >= OTP_PHONE_PER_HOUR) {
        throw new HttpError(429, 'Too many codes requested for this number. Please try again later.');
      }
      // Daily cap per store (this deployment is one store until Phase 4).
      const day = new Date(t).toISOString().slice(0, 10);
      const used = (await store.get<{ count: number }>('otpDaily', day))?.count ?? 0;
      if (used >= config.otpDailyCap) throw new HttpError(429, 'Sign-in codes are temporarily unavailable. Please try again tomorrow.');

      const code = config.staticOtp ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const { channel, messageId } = await delivery(ph, code, 'otp');
      await store.increment('otpDaily', day, { count: 1 });
      await store.set('otps', ph, {
        hash: hash(ph, code),
        expiresAt: t + OTP_TTL_MS,
        attempts: 0,
        sentAt: t,
        hourStart: sameHour ? prev!.hourStart : t,
        hourCount: sameHour ? prev!.hourCount + 1 : 1,
        messageId
      } satisfies OtpDoc);
      res.json({ status: 'success', message: 'We sent a 6-digit code to your WhatsApp.', expiresInSeconds: OTP_TTL_MS / 1000, channel, messageId, receipts: receiptsEnabled(config), ...devCode(config, ph, code) });
    })
  );

  // The buyer's code screen polls this while waiting: did WhatsApp deliver the code? No PII comes back.
  router.get(
    '/otp-status/:id',
    ipLimiter,
    handler(async (req, res) => {
      const m = log ? await log.get(String(req.params.id)) : null;
      if (!m || m.storeId !== config.merchant.id) throw new HttpError(404, 'Unknown message.');
      res.json({ status: 'success', data: { status: m.status, failure: m.failure ?? null, receipts: receiptsEnabled(config) } });
    })
  );

  router.post(
    '/retailer/verify-otp',
    ipLimiter,
    handler(async (req, res) => {
      const body = parse(verifySchema, req.body);
      const rec = await store.get<OtpDoc>('otps', body.phone);
      if (!rec || rec.expiresAt < now()) throw new HttpError(401, 'That code has expired. Please request a new one.');
      if (rec.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes. Please request a new one.');
      if (!safeEqual(rec.hash, hash(body.phone, body.code))) {
        await store.update('otps', body.phone, { attempts: rec.attempts + 1 });
        await audit(store, req, 'RETAILER_OTP_FAILED', `Wrong OTP for phone ${body.phone}.`);
        throw new HttpError(401, 'That code is not valid. Please check it or request a new one.');
      }
      let buyer = await store.get('buyers', body.phone);
      // A new number is asked for a name before the account exists; the code stays valid for that second step.
      if (!buyer && !body.firmName) return void res.json({ status: 'needs-name' });
      await store.delete('otps', body.phone); // single use
      if (!buyer) {
        await ent.assertCanAddBuyer(body.phone); // re-check at creation
        buyer = {
          id: newId('merch'),
          firmName: body.firmName || `Buyer ${body.phone.slice(-4)}`,
          gstin: 'PENDING-VERIFY',
          ownerName: body.ownerName || 'Authorized Signatory',
          phone: body.phone,
          marketHub: body.marketHub || config.merchant.onboarding.defaultMarketHub,
          verified: true,
          createdAt: new Date(now()).toISOString()
        };
        await store.create('buyers', body.phone, buyer);
      }
      if (body.firmName && body.firmName !== buyer.firmName) {
        // A returning buyer who types a name at sign-in is renaming themselves (they just proved the number with a code).
        buyer = { ...buyer, firmName: body.firmName, ownerName: body.ownerName || body.firmName };
        await store.update('buyers', body.phone, { firmName: buyer.firmName, ownerName: buyer.ownerName });
      }
      await audit(store, req, 'RETAILER_OTP_LOGIN', `Signed in by WhatsApp OTP: ${buyer.firmName} (Phone: ${body.phone})`);
      res.json({
        status: 'success',
        token: signToken(config, { type: 'retailer', sub: body.phone }, tokenTtl(req, RETAILER_TOKEN_TTL)),
        user: {
          id: buyer.id,
          storeName: buyer.firmName,
          ownerName: buyer.ownerName,
          gstin: buyer.gstin,
          phone: buyer.phone,
          marketHub: buyer.marketHub,
          verified: buyer.verified,
          mustChangePassword: false
        }
      });
    })
  );

  // Admin forgot password: a code goes to the store's registered WhatsApp number (the owner's phone from signup).
  // The reply is the same whether or not the email is an admin, so it cannot be used to find accounts.
  router.post(
    '/admin/forgot/request-otp',
    ipLimiter,
    handler(async (req, res) => {
      const { email } = parse(forgotSchema, req.body);
      const ph = config.merchant.contact.whatsapp.replace(/[^0-9]/g, '');
      const reply = (code?: string) => res.json({ status: 'success', message: `If that is the store admin, a 6-digit code was sent to the store's WhatsApp number ending ${ph.slice(-4)}.`, expiresInSeconds: OTP_TTL_MS / 1000, ...(code ? devCode(config, ph, code) : {}) });
      if (!(await store.get('admins', email))) return void reply();
      const key = `admin-reset:${email}`;
      const t = now();
      const prev = await store.get<OtpDoc>('otps', key);
      if (prev && t - prev.sentAt < OTP_RESEND_MS) throw new HttpError(429, `Please wait ${Math.ceil((OTP_RESEND_MS - (t - prev.sentAt)) / 1000)} seconds before asking for another code.`);
      const sameHour = Boolean(prev && t - prev.hourStart < 3600_000);
      if (prev && sameHour && prev.hourCount >= OTP_PHONE_PER_HOUR) throw new HttpError(429, 'Too many codes requested. Please try again later.');
      const code = config.staticOtp ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const { messageId } = await delivery(ph, code, 'admin-reset');
      await store.set('otps', key, {
        hash: hash(key, code), expiresAt: t + OTP_TTL_MS, attempts: 0, sentAt: t, hourStart: sameHour ? prev!.hourStart : t, hourCount: sameHour ? prev!.hourCount + 1 : 1, messageId
      } satisfies OtpDoc);
      await audit(store, req, 'ADMIN_RESET_CODE_SENT', `Password reset code requested for ${email}.`);
      reply(code);
    })
  );

  router.post(
    '/admin/forgot/reset',
    ipLimiter,
    handler(async (req, res) => {
      const body = parse(resetSchema, req.body);
      const key = `admin-reset:${body.email}`;
      const rec = await store.get<OtpDoc>('otps', key);
      if (!rec || rec.expiresAt < now()) throw new HttpError(401, 'That code has expired. Please request a new one.');
      if (rec.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes. Please request a new one.');
      if (!safeEqual(rec.hash, hash(key, body.code))) {
        await store.update('otps', key, { attempts: rec.attempts + 1 });
        await audit(store, req, 'ADMIN_RESET_FAILED', `Wrong reset code for ${body.email}.`);
        throw new HttpError(401, 'That code is not valid. Please check it or request a new one.');
      }
      await store.delete('otps', key); // single use
      if (!(await store.get('admins', body.email))) throw new HttpError(401, 'That code is not valid. Please check it or request a new one.');
      await store.update('admins', body.email, { password: await bcrypt.hash(body.newPassword, 12) });
      await audit(store, req, 'ADMIN_PASSWORD_RESET', `Admin password reset by WhatsApp code for ${body.email}.`);
      res.json({ status: 'success', message: 'Password updated. Sign in with the new password.' });
    })
  );

  return router;
}
