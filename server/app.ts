import { entitlements } from './entitlements';
import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Config } from './config';
import type { Store } from './store';
import { createAuth, isNativeClient, NATIVE_TOKEN_TTL, signToken, user } from './auth';
import { errorHandler, handler, notFoundApi, requestLogger } from './http';
import { authRoutes } from './routes/auth';
import { catalogueRoutes } from './routes/catalogue';
import { shortlistRoutes } from './routes/shortlist';
import { orderRoutes } from './routes/orders';
import { aboutRoutes } from './routes/about';
import { pwaRoutes } from './routes/pwa';
import { getSectorPack } from './sectors';
import { adminOrderRoutes } from './routes/adminOrders';
import { analyticsRoutes } from './routes/analytics';
import { adminBuyerRoutes } from './routes/adminBuyers';
import { mediaRoute, photoUploadRoutes } from './routes/photos';
import { createBlobs, type Blobs } from './blobs';
import { createMedia } from './media';
import { createOtpSender, type OtpSender } from './whatsapp';
import { otpRoutes } from './routes/otp';

export function createApp(config: Config, store: Store, blobs: Blobs = createBlobs(config), sender: OtpSender = createOtpSender(config)) {
  const app = express();
  const auth = createAuth(config, store);
  const pack = getSectorPack(config.merchant.sector);
  const media = createMedia(config.jwtSecret);

  app.disable('x-powered-by');
  // Cloud Run terminates TLS in front of the container; trust exactly one proxy hop for client IPs.
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(
    helmet({
      // Vite's dev server injects inline scripts, so CSP only applies to the built app.
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"]
            }
          }
        : false
    })
  );
  // Native (Capacitor) webviews call the API cross-origin; web stays same-origin.
  // Photo links are signed and expire; <img> loads send no Origin header, so CORP must be relaxed for every /media response.
  app.use('/media', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use(['/api', '/media'], (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === 'https://localhost' || origin === 'capacitor://localhost') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // helmet sets same-origin, which blocks photos in the app
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-App-Client');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return void res.sendStatus(204);
    }
    next();
  });
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use(pwaRoutes(config.merchant));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.rateLimit.api,
      standardHeaders: true,
      legacyHeaders: false,
      message: { status: 'error', message: 'Too many requests. Please slow down.' }
    })
  );

  // In "login" mode the catalogue is members-only; in "public" mode anyone may browse. Ordering always needs an account.
  const catalogueGuard: RequestHandler =
    config.merchant.catalogueAccess === 'public' ? (_req, _res, next) => next() : auth.requireUser;

  // Public by design: everything in the merchant config is shown to visitors anyway.
  app.get('/api/config', (_req, res) => {
    res.json({ status: 'success', data: config.merchant });
  });

  // Lets the app restore a signed-in session after a reload. The account is re-checked on every call.
  app.get(
    '/api/auth/me',
    auth.requireUser,
    handler(async (req, res) => {
      const me = user(res);
      // Sliding session for the phone app: a fresh 90-day token on every app start.
      const token = isNativeClient(req) ? signToken(config, { type: me.type, sub: me.id }, NATIVE_TOKEN_TTL) : undefined;
      if (me.type === 'admin') {
        res.json({ status: 'success', token, type: 'admin', admin: { name: me.name, email: me.id, role: me.role } });
        return;
      }
      // The profile menu shows the buyer's own business details (never the password hash).
      const buyer = await store.get('buyers', me.id);
      res.json({
        status: 'success',
        token,
        type: 'retailer',
        user: { storeName: me.name, phone: me.id, ownerName: buyer?.ownerName, gstin: buyer?.gstin, marketHub: buyer?.marketHub },
        mustChangePassword: Boolean(me.mustChangePassword)
      });
    })
  );

  const ent = entitlements(store, config.merchant.id);
  // Public: plan, limits and feature flags the app mirrors (the server enforces them). Usage is for the admin hub.
  app.get('/api/entitlements', handler(async (_req, res) => {
    res.json({ status: 'success', data: { ...(await ent.load()), usage: await ent.usage() } });
  }));

  // Photos are private: the app is handed short-lived signed links, and only those links open a photo.
  app.get('/media/:file', mediaRoute(blobs, media));

  app.use('/api/auth', otpRoutes(config, store, sender));
  app.use('/api/auth', authRoutes(config, store, auth.requireRetailer));
  app.use('/api', catalogueRoutes({ store, blobs, media, merchant: config.merchant, pack, requireAdmin: auth.requireAdmin, readGuard: catalogueGuard, ent }));
  app.use('/api/about', aboutRoutes(store, catalogueGuard, auth.requireAdmin));
  app.use('/api/shortlist', shortlistRoutes(store, auth.requireRetailer));
  app.use('/api/orders', orderRoutes(store, config.merchant, pack, media, auth.requireRetailer));
  app.use('/api/admin/orders', adminOrderRoutes(store, media, auth.requireAdmin));
  app.use('/api/admin/buyers', adminBuyerRoutes(store, auth.requireAdmin));
  app.use('/api/admin/photos', photoUploadRoutes(blobs, media, auth.requireAdmin, ent));
  app.use('/api', analyticsRoutes(config, store, auth.requireAdmin, auth));

  app.use('/api', notFoundApi);
  app.use(errorHandler);

  return app;
}
