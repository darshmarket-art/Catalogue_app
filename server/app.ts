import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Config } from './config';
import type { Store } from './store';
import { createAuth, user } from './auth';
import { errorHandler, notFoundApi, requestLogger } from './http';
import { authRoutes } from './routes/auth';
import { catalogueRoutes } from './routes/catalogue';
import { orderRoutes } from './routes/orders';
import { adminOrderRoutes } from './routes/adminOrders';
import { analyticsRoutes } from './routes/analytics';

export function createApp(config: Config, store: Store) {
  const app = express();
  const auth = createAuth(config, store);

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
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

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

  app.get('/api/rates', catalogueGuard, (_req, res) => {
    res.json({
      status: 'success',
      data: {
        settlementType: 'PURE_GRAM_BASIS',
        goldPurityStandards: {
          '24K': '999.9 Fine Gold Assay Bar',
          '22K': '916 Hallmarked Luxury Jewellery',
          '18K': '750 Diamond & Polki Setting',
          '14K': '585 Export Lightweight Standard'
        },
        mcx24k: 72480, // reference benchmark for valuation only
        gold916: 66420,
        gold750: 54360,
        silver999: 84600,
        lastSync: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
        deskPhone: config.merchant.contact.deskPhone
      }
    });
  });

  // Public by design: everything in the merchant config is shown to visitors anyway.
  app.get('/api/config', (_req, res) => {
    res.json({ status: 'success', data: config.merchant });
  });

  // Lets the app restore a signed-in session after a reload. The account is re-checked on every call.
  app.get('/api/auth/me', auth.requireUser, (_req, res) => {
    const me = user(res);
    if (me.type === 'admin') {
      res.json({ status: 'success', type: 'admin', admin: { name: me.name, email: me.id, role: me.role, accessLevel: me.accessLevel } });
    } else {
      res.json({ status: 'success', type: 'retailer', user: { storeName: me.name, phone: me.id } });
    }
  });

  app.use('/api/auth', authRoutes(config, store));
  app.use('/api', catalogueRoutes(store, auth.requireAdmin, catalogueGuard));
  app.use('/api/orders', orderRoutes(store, config.merchant, auth.requireRetailer));
  app.use('/api/admin/orders', adminOrderRoutes(store, auth.requireAdmin));
  app.use('/api', analyticsRoutes(config, store, auth.requireAdmin, auth));

  app.use('/api', notFoundApi);
  app.use(errorHandler);

  return app;
}
