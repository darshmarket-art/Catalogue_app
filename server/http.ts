import crypto from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { logger } from './logger';
import type { Store } from './store';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export const handler =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export function parse<T>(schema: ZodType<T, any, any>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export async function audit(store: Store, req: Request | null, event: string, details: string) {
  const id = newId('log');
  await store.set('auditLogs', id, { id, event, details, timestamp: new Date().toISOString(), ip: req?.ip });
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();
  const started = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started
    });
  });
  next();
}

export function notFoundApi(_req: Request, res: Response) {
  res.status(404).json({ status: 'error', message: 'Endpoint not found.' });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ status: 'error', message: err.message, ...(err.code && { code: err.code }) });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'Request body is too large.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'Malformed JSON body.' });
  }
  logger.error('unhandled error', { path: req.path, error: err?.stack || String(err) });
  res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
}
