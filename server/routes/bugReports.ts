import crypto from 'crypto';
import type { Request } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config';
import type { Store } from '../store';
import { handler, parse } from '../http';
import { storeIdOf } from '../tenancy';

/** What went wrong: a thrown error, a rejected promise, console.error, a file that failed to load, a blocked-by-CSP request, a failed or slow API call, a page that died, a server 500, or a note from a person. */
export const BUG_KINDS = ['error', 'promise', 'console', 'resource', 'csp', 'api', 'slow', 'crash', 'server', 'user'] as const;
export type BugKind = (typeof BUG_KINDS)[number];

const text = (max: number) => z.string().max(20_000).transform((v) => v.slice(0, max)).optional();
const reportSchema = z.object({
  message: z.string().min(1).max(20_000).transform((v) => v.slice(0, 500)),
  stack: text(4000),
  where: text(80),
  url: text(500),
  appVersion: text(40),
  native: z.boolean().optional(),
  kind: z.enum(BUG_KINDS).optional(),
  /** The last things the visitor did (taps, screens, API calls), oldest first. */
  crumbs: z.array(z.string().max(200)).max(40).optional(),
  /** Screen, role, window size, connection, memory: one line. */
  ctx: text(400),
  /** What a person typed when they reported a problem themselves. */
  note: text(1000)
});

/** A crash or unexpected error in a customer's app: kept in the root store and listed on console.<domain> (Bug reports). One row per distinct problem per store; `count` says how often it has happened. */
export interface BugReport {
  id: string;
  /** The latest time it happened (the console sorts by this). */
  at: string;
  firstAt: string;
  count: number;
  kind: BugKind;
  storeId: string | null;
  message: string;
  stack?: string;
  where?: string;
  url?: string;
  appVersion?: string;
  native?: boolean;
  userAgent: string;
  crumbs?: string[];
  ctx?: string;
  note?: string;
}

type Input = Omit<BugReport, 'id' | 'at' | 'firstAt' | 'count' | 'storeId' | 'userAgent' | 'kind'> & { kind?: BugKind };

// Digits and long ids differ on every occurrence of the same problem, so they are left out of the grouping key.
const fingerprint = (kind: string, storeId: string | null, where: string | undefined, message: string, stack?: string) =>
  crypto.createHash('sha1').update([kind, storeId ?? '', where ?? '', message.replace(/[0-9a-f-]{8,}|\d+/gi, '#'), (stack ?? '').split('\n')[1] ?? ''].join('|')).digest('hex').slice(0, 24);

/** Stores a report, or counts one more occurrence of one already there. Never throws. User notes are always kept as their own row. */
export async function recordBug(root: Store, config: Config, req: Request, input: Input): Promise<void> {
  try {
    const kind = input.kind ?? 'error';
    const storeId = storeIdOf(req, config);
    const now = new Date().toISOString();
    const id = kind === 'user' ? `bug-${crypto.randomUUID()}` : `bug-${fingerprint(kind, storeId, input.where, input.message, input.stack)}`;
    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);
    const previous = await root.get<BugReport>('bugReports', id);
    const doc: BugReport = { ...input, kind, id, at: now, firstAt: previous?.firstAt ?? now, count: (previous?.count ?? 0) + 1, storeId, userAgent };
    await root.set('bugReports', id, JSON.parse(JSON.stringify(doc)));
  } catch {
    // reporting must never break the request
  }
}

/** Public and unauthenticated (a crashed page may have no session), so it is size-capped and rate-limited per network. */
export function bugReportRoutes(config: Config, root: Store) {
  const r = Router();
  r.post(
    '/',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { status: 'error', message: 'Too many reports.' } }),
    handler(async (req, res) => {
      await recordBug(root, config, req, parse(reportSchema, req.body));
      res.json({ status: 'success' });
    })
  );
  return r;
}
