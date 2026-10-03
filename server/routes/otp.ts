import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import type { OtpSender } from '../whatsapp';
import { RETAILER_TOKEN_TTL, safeEqual, signToken, tokenTtl } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { logger } from '../logger';
import { trimmed } from '../schemas';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 30 * 1000;
export const OTP_PHONE_PER_HOUR = 5;
/** Phase 2b hook: Basic plan buyer limit. Not enforced yet (needs the plan flags from Phase 1). */
export const BASIC_BUYER_LIMIT = 50;

const phone = z
  .string()
  .transform((v) => v.replace(/[^0-9]/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 15, 'Please provide a valid mobile number.');
const requestSchema = z.object({ phone });
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
}

export function otpRoutes(config: Config, store: Store, sender: OtpSender, now: () => number = Date.now) {
  const router = Router();
  if (config.staticOtp) logger.warn('OTP_STATIC_CODE is set: sign-in uses a fixed code and nothing is sent on WhatsApp.');
  const hash = (ph: string, code: string) => crypto.createHmac('sha256', config.jwtSecret).update(`${ph}:${code}`).digest('hex');
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
      const prev = await store.get<OtpDoc>('otps', ph);
      if (prev && t - prev.sentAt < OTP_RESEND_MS) {
        throw new HttpError(429, `Please wait ${Math.ceil((OTP_RESEND_MS - (t - prev.sentAt)) / 1000)} seconds before asking for another code.`);
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
      try {
        if (!config.staticOtp) await sender.sendOtp(ph, code);
      } catch (err) {
        logger.error('OTP send failed', { error: String(err) });
        throw new HttpError(503, 'Could not send the code on WhatsApp. Please try again shortly.');
      }
      await store.increment('otpDaily', day, { count: 1 });
      await store.set('otps', ph, {
        hash: hash(ph, code),
        expiresAt: t + OTP_TTL_MS,
        attempts: 0,
        sentAt: t,
        hourStart: sameHour ? prev!.hourStart : t,
        hourCount: sameHour ? prev!.hourCount + 1 : 1
      } satisfies OtpDoc);
      res.json({ status: 'success', message: 'We sent a 6-digit code to your WhatsApp.', expiresInSeconds: OTP_TTL_MS / 1000 });
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
      await store.delete('otps', body.phone); // single use

      let buyer = await store.get('buyers', body.phone);
      if (!buyer) {
        // ponytail: Phase 2b enforces BASIC_BUYER_LIMIT here (and before sending a code) once plan flags exist.
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

  return router;
}
