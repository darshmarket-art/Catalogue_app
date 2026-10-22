import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import sharp from 'sharp';
import type { Blobs } from '../blobs';
import type { MerchantConfig } from '../merchant';
import { HttpError, handler } from '../http';

const NAME = 'brand/logo.png';
/** Where the logo is served; the version makes a new upload show at once despite caching. */
export const LOGO_PATH = /^\/brand\/logo\?v=\d+$/;

/**
 * The store's own logo: uploaded by the admin (any JPEG/PNG/WebP), kept as a PNG of at most 512 px (transparency kept) and
 * served publicly at /brand/logo, since it is shown to every visitor. Saving it points merchant.brand.logoUrl at it.
 */
export function brandLogoRoutes(blobs: Blobs, requireAdmin: RequestHandler, patchMerchant: (fn: (m: MerchantConfig) => MerchantConfig) => Promise<void>) {
  const r = Router();
  r.get('/brand/logo', handler(async (_req, res) => {
    const blob = await blobs.get(NAME);
    if (!blob) return void res.status(404).type('text').send('No logo.');
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' }).send(blob.data);
  }));
  r.put(
    '/api/admin/brand/logo',
    requireAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: 10 * 1024 * 1024 }),
    handler(async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(415, 'Send the logo as a JPEG, PNG or WebP image.');
      let png: Buffer;
      try {
        png = await sharp(req.body, { failOn: 'error' }).rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      } catch {
        throw new HttpError(415, 'That file is not a valid JPEG, PNG or WebP image.');
      }
      await blobs.put(NAME, png, 'image/png');
      const logoUrl = `/brand/logo?v=${Date.now()}`;
      await patchMerchant((m) => ({ ...m, brand: { ...m.brand, logoUrl } }));
      res.json({ status: 'success', data: { logoUrl } });
    })
  );
  return r;
}
