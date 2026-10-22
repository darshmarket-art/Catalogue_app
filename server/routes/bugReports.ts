import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import { handler, parse } from '../http';
import { storeIdOf } from '../tenancy';

const text = (max: number) => z.string().max(20_000).transform((v) => v.slice(0, max)).optional();
const reportSchema = z.object({
  message: z.string().min(1).max(20_000).transform((v) => v.slice(0, 500)),
  stack: text(4000),
  where: text(80),
  url: text(500),
  appVersion: text(40),
  native: z.boolean().optional()
});

/** A crash or unexpected error in a customer's app: kept in the root store and listed on console.<domain> (Bug reports). */
export interface BugReport {
  id: string;
  at: string;
  storeId: string | null;
  message: string;
  stack?: string;
  where?: string;
  url?: string;
  appVersion?: string;
  native?: boolean;
  userAgent: string;
}

/** Public and unauthenticated (a crashed page may have no session), so it is size-capped and rate-limited per network. */
export function bugReportRoutes(config: Config, root: Store) {
  const r = Router();
  r.post(
    '/',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message: 'Too many reports.' } }),
    handler(async (req, res) => {
      const b = parse(reportSchema, req.body);
      const id = `bug-${crypto.randomUUID()}`;
      const doc: BugReport = { id, at: new Date().toISOString(), storeId: storeIdOf(req, config), userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300), ...b };
      await root.set('bugReports', id, JSON.parse(JSON.stringify(doc)));
      res.json({ status: 'success' });
    })
  );
  return r;
}
