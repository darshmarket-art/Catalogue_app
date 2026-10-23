import crypto from 'crypto';
import type { Request } from 'express';

/** The only calls scripts/bulk-import-products.mjs makes. Admin sign-in still applies to every one of them. */
const ALLOWED: Array<[method: string, path: RegExp]> = [
  ['POST', /^\/api\/(admin\/photos|products|categories)\/?(\?|$)/],
  ['GET', /^\/api\/(products|categories|tags|entitlements)\/?(\?|$)/]
];

const digest = (s: string) => crypto.createHash('sha256').update(s).digest();

/**
 * True when the request carries the bulk-import key (X-Bulk-Import-Key) AND is one of the import calls above, so the
 * importer is not slowed by the per-IP API rate limit. Anything else, or no key configured, is limited as usual.
 */
export function bulkImportExempt(key: string | null, req: Pick<Request, 'method' | 'originalUrl' | 'get'>): boolean {
  if (!key) return false;
  const given = req.get('x-bulk-import-key');
  if (!given || !crypto.timingSafeEqual(digest(given), digest(key))) return false;
  return ALLOWED.some(([method, path]) => req.method === method && path.test(req.originalUrl));
}
