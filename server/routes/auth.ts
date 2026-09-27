import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import type { Config } from '../config';
import type { Store } from '../store';
import { ADMIN_TOKEN_TTL, RETAILER_TOKEN_TTL, safeEqual, signToken, verifyPassword } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import {
  ACCESS_LEVELS,
  adminLoginSchema,
  adminRegisterSchema,
  retailerLoginSchema,
  retailerSignupSchema
} from '../schemas';

const BCRYPT_ROUNDS = 12;
const HOUR = 60 * 60 * 1000;

const limited = (message: string) => ({ status: 'error', message });

export function authRoutes(config: Config, store: Store) {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit.auth,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: limited('Too many failed attempts. Please wait a few minutes and try again.')
  });
  const signupLimiter = rateLimit({
    windowMs: HOUR,
    limit: config.rateLimit.auth,
    standardHeaders: true,
    legacyHeaders: false,
    message: limited('Too many sign-ups from this network. Please try again later.')
  });
  const adminRegisterLimiter = rateLimit({
    windowMs: HOUR,
    limit: config.rateLimit.adminRegister,
    standardHeaders: true,
    legacyHeaders: false,
    message: limited('Too many provisioning attempts. Please try again later.')
  });

  const merchantView = (m: Record<string, any>) => ({
    id: m.id,
    storeName: m.firmName,
    ownerName: m.ownerName,
    gstin: m.gstin,
    phone: m.phone,
    marketHub: m.marketHub,
    verified: m.verified
  });

  router.post(
    '/retailer/signup',
    signupLimiter,
    handler(async (req, res) => {
      const body = parse(retailerSignupSchema, req.body);
      const gstin = body.gstin || 'PENDING-VERIFY';

      if (gstin !== 'PENDING-VERIFY') {
        const dup = await store.list('merchants', { where: [{ field: 'gstin', op: '==', value: gstin }], limit: 1 });
        if (dup.length > 0) {
          throw new HttpError(409, 'A wholesale account with this Phone or GSTIN is already registered. Please sign in.');
        }
      }

      const merchant = {
        id: newId('merch'),
        firmName: body.firmName,
        gstin,
        ownerName: body.ownerName || 'Authorized Signatory',
        phone: body.phone,
        password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        marketHub: body.marketHub || config.merchant.onboarding.defaultMarketHub,
        verified: true,
        createdAt: new Date().toISOString()
      };

      if (!(await store.create('merchants', merchant.phone, merchant))) {
        throw new HttpError(409, 'A wholesale account with this Phone or GSTIN is already registered. Please sign in.');
      }
      await audit(store, req, 'RETAILER_SIGNUP_SUCCESS', `Firm registered: ${merchant.firmName} (Phone: ${merchant.phone})`);

      res.status(201).json({
        status: 'success',
        token: signToken(config, { type: 'retailer', sub: merchant.phone }, RETAILER_TOKEN_TTL),
        message: 'Wholesale account created successfully! You are now authenticated.',
        user: merchantView(merchant)
      });
    })
  );

  router.post(
    '/retailer/login',
    loginLimiter,
    handler(async (req, res) => {
      const body = parse(retailerLoginSchema, req.body);
      if (body.authMode === 'wa') {
        throw new HttpError(501, 'WhatsApp OTP sign-in is not available yet. Please sign in with your password.');
      }

      const merchant = await store.get('merchants', body.phone);
      const ok = await verifyPassword(body.password, merchant?.password);
      if (!merchant || !ok) {
        await audit(store, req, 'RETAILER_LOGIN_FAILED', `Failed login attempt for phone ${body.phone}.`);
        throw new HttpError(401, 'Access Denied: Incorrect phone number or password.');
      }

      await audit(store, req, 'RETAILER_LOGIN_SUCCESS', `Firm authenticated: ${merchant.firmName} (Phone: ${merchant.phone})`);
      res.json({
        status: 'success',
        token: signToken(config, { type: 'retailer', sub: merchant.phone }, RETAILER_TOKEN_TTL),
        user: merchantView(merchant)
      });
    })
  );

  router.post(
    '/admin/register',
    adminRegisterLimiter,
    handler(async (req, res) => {
      const body = parse(adminRegisterSchema, req.body);

      if (!config.masterProvisioningKey) {
        throw new HttpError(403, 'Admin provisioning is disabled on this server.');
      }
      if (!safeEqual(body.masterProvisioningKey, config.masterProvisioningKey)) {
        await audit(store, req, 'ADMIN_CREATION_FAILED_INVALID_TOKEN', `Unauthorized admin creation attempt for ${body.email}.`);
        throw new HttpError(403, 'Access Denied: Invalid provisioning key. Unauthorized admin account creation is prohibited and logged.');
      }

      const admin = {
        id: newId('adm'),
        name: body.name || 'Staff Administrator',
        email: body.email,
        password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        role: body.role,
        accessLevel: ACCESS_LEVELS[body.role],
        createdAt: new Date().toISOString()
      };

      if (!(await store.create('admins', admin.email, admin))) {
        throw new HttpError(409, 'An administrator with this email already exists.');
      }
      await audit(store, req, 'ADMIN_ACCOUNT_CREATED', `New admin created: ${admin.name} (${admin.email}) with role: ${admin.role}`);

      res.status(201).json({
        status: 'success',
        sessionToken: signToken(config, { type: 'admin', sub: admin.email }, ADMIN_TOKEN_TTL),
        message: 'Admin account provisioned successfully! You may now authenticate.',
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, accessLevel: admin.accessLevel }
      });
    })
  );

  router.post(
    '/admin/login',
    loginLimiter,
    handler(async (req, res) => {
      const body = parse(adminLoginSchema, req.body);
      const email = body.adminId.toLowerCase();

      const admin = await store.get('admins', email);
      const ok = await verifyPassword(body.password, admin?.password);
      if (!admin || !ok) {
        await audit(store, req, 'ADMIN_LOGIN_FAILED', `Failed admin login for identifier ${email}.`);
        throw new HttpError(401, 'Access Denied: Invalid admin identifier or security key.');
      }

      await audit(store, req, 'ADMIN_LOGIN_SUCCESS', `Admin session authenticated for ${admin.name} (${admin.email}) [Role: ${admin.role}]`);
      res.json({
        status: 'success',
        sessionToken: signToken(config, { type: 'admin', sub: admin.email }, ADMIN_TOKEN_TTL),
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, accessLevel: admin.accessLevel }
      });
    })
  );

  return router;
}
