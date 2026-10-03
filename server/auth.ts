import crypto from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Config } from './config';
import type { Store } from './store';

export const RETAILER_TOKEN_TTL = '24h';
export const ADMIN_TOKEN_TTL = '8h';
/** The phone app keeps people signed in until they log out; every app start renews it via /api/auth/me. */
export const NATIVE_TOKEN_TTL = '90d';
export const isNativeClient = (req: Request) => req.header('x-app-client') === 'native';
export const tokenTtl = (req: Request, web: string) => (isNativeClient(req) ? NATIVE_TOKEN_TTL : web);

export interface TokenClaims {
  type: 'retailer' | 'admin';
  storeId?: string; // the store the token was issued for
  sub: string; // merchant phone / admin email: the store document id
}

export interface AuthedUser {
  type: 'retailer' | 'admin';
  id: string;
  name: string;
  role?: string;
  mustChangePassword?: boolean;
}

export function signToken(config: Config, claims: TokenClaims, expiresIn: string): string {
  return jwt.sign({ ...claims, storeId: config.merchant.id }, config.jwtSecret, { algorithm: 'HS256', issuer: config.merchant.id, expiresIn } as jwt.SignOptions);
}

function readClaims(config: Config, req: Request): TokenClaims | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: config.merchant.id });
    if (typeof decoded === 'string') return null;
    const { type, sub, storeId } = decoded as Partial<TokenClaims>;
    // Tokens from before multi-store carry no storeId; only the default store (their origin) accepts them.
    if (storeId ? storeId !== config.merchant.id : config.merchant.id !== config.defaultStore) return null;
    if ((type !== 'retailer' && type !== 'admin') || typeof sub !== 'string') return null;
    return { type, sub };
  } catch {
    return null;
  }
}

/** Loads the account behind a token, so deleted or unverified accounts lose access immediately. */
async function resolveUser(store: Store, claims: TokenClaims): Promise<AuthedUser | null> {
  if (claims.type === 'admin') {
    const admin = await store.get('admins', claims.sub);
    return admin
      ? { type: 'admin', id: admin.email, name: admin.name, role: admin.role }
      : null;
  }
  const buyer = await store.get('buyers', claims.sub);
  return buyer && buyer.verified
    ? { type: 'retailer', id: buyer.phone, name: buyer.firmName, mustChangePassword: Boolean(buyer.mustChangePassword) }
    : null;
}

export function createAuth(config: Config, store: Store) {
  /** Enforces a valid token for the given account type; the user lands in res.locals.user. */
  const require =
    (type: 'retailer' | 'admin' | 'any'): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const claims = readClaims(config, req);
        if (!claims) {
          return res.status(401).json({ status: 'error', message: 'Authentication required. Please sign in.' });
        }
        if (type !== 'any' && claims.type !== type) {
          return res.status(403).json({ status: 'error', message: 'You do not have permission to perform this action.' });
        }
        const user = await resolveUser(store, claims);
        if (!user) {
          return res.status(401).json({ status: 'error', message: 'Session is no longer valid. Please sign in again.' });
        }
        res.locals.user = user;
        next();
      } catch (err) {
        next(err);
      }
    };

  /** Type of the caller's valid token, or null for anonymous visitors. Never rejects. */
  const tokenType = (req: Request) => readClaims(config, req)?.type ?? null;

  /** The account behind a valid token, or null for anonymous visitors. Never rejects. */
  const optionalUser = async (req: Request) => {
    const claims = readClaims(config, req);
    return claims ? resolveUser(store, claims) : null;
  };

  return { requireRetailer: require('retailer'), requireAdmin: require('admin'), requireUser: require('any'), tokenType, optionalUser };
}

export const user = (res: Response) => res.locals.user as AuthedUser;

const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.6bEuQnYVYHYTBbtDIrnHo0ATTHzy';

/** Constant-work password check: unknown accounts still cost a bcrypt round to avoid timing leaks. */
export async function verifyPassword(plain: string, hash?: string) {
  const ok = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
