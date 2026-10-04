import { Router } from 'express';
import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import type { Config } from '../config';
import type { Store } from '../store';
import { ADMIN_TOKEN_TTL, RETAILER_TOKEN_TTL, safeEqual, signToken, tokenTtl, user, verifyPassword } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import {
  adminLoginSchema,
  adminRegisterSchema
} from '../schemas';

const BCRYPT_ROUNDS = 12;
const HOUR = 60 * 60 * 1000;

const limited = (message: string) => ({ status: 'error', message });

export function authRoutes(config: Config, store: Store, requireRetailer: RequestHandler) {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit.auth,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: limited('Too many failed attempts. Please wait a few minutes and try again.')
  });
  const adminRegisterLimiter = rateLimit({
    windowMs: HOUR,
    limit: config.rateLimit.adminRegister,
    standardHeaders: true,
    legacyHeaders: false,
    message: limited('Too many provisioning attempts. Please try again later.')
  });

  const buyerView = (m: Record<string, any>) => ({
    id: m.id,
    storeName: m.firmName,
    ownerName: m.ownerName,
    gstin: m.gstin,
    phone: m.phone,
    marketHub: m.marketHub,
    verified: m.verified,
    mustChangePassword: Boolean(m.mustChangePassword)
  });

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

      // One administrator per store, on every plan. Extra accounts are refused.
      if ((await store.list('admins')).length > 0) {
        throw new HttpError(409, 'This store already has its administrator account.');
      }

      const admin = {
        id: newId('adm'),
        name: body.name || 'Administrator',
        email: body.email,
        password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        role: 'owner' as const,
        createdAt: new Date().toISOString()
      };

      if (!(await store.create('admins', admin.email, admin))) {
        throw new HttpError(409, 'An administrator with this email already exists.');
      }
      await audit(store, req, 'ADMIN_ACCOUNT_CREATED', `New admin created: ${admin.name} (${admin.email}) with role: ${admin.role}`);

      res.status(201).json({
        status: 'success',
        sessionToken: signToken(config, { type: 'admin', sub: admin.email }, tokenTtl(req, ADMIN_TOKEN_TTL)),
        message: 'Admin account provisioned successfully! You may now authenticate.',
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
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
        sessionToken: signToken(config, { type: 'admin', sub: admin.email }, tokenTtl(req, ADMIN_TOKEN_TTL)),
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
      });
    })
  );

  return router;
}
