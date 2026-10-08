import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Blob, Blobs } from '../blobs';
import { newPhotoFile, objectName, type Media } from '../media';
import type { Entitlements } from '../entitlements';
import { HttpError, handler } from '../http';
import { logger } from '../logger';
import sharp from 'sharp';

// Uploads can be large (phone photos), so the limit is generous; they are shrunk before they are stored. Cloud Run accepts requests up to 32 MB.
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** The file's real format, from its first bytes, so a renamed file cannot be smuggled in as a photo. */
function sniff(data: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (data.length > 12 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 12 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length > 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/** The longest side a stored photo keeps. Larger than any screen the catalogue shows it on, far smaller than a phone camera's original. */
const MAX_SIDE = 2400;

/**
 * Shrinks an upload before it is stored: turned upright by its camera orientation, no larger than MAX_SIDE, re-saved at a good quality with
 * its hidden camera and location details removed. If that fails or does not make the file smaller, the original is kept as it was sent.
 * Returns the buffer and the actual output format (sharp may not preserve the input format).
 */
export async function optimisePhoto(data: Buffer, type: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<{ buffer: Buffer; type: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  try {
    const img = sharp(data, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    const out = await (type === 'image/jpeg' ? img.jpeg({ quality: 85, mozjpeg: true }) : type === 'image/webp' ? img.webp({ quality: 85 }) : img.png({ compressionLevel: 9 })).toBuffer();
    if (out.length >= data.length) return { buffer: data, type };
    // Detect the actual output format in case sharp changed it
    const detected = sniff(out) ?? type;
    return { buffer: out, type: detected };
  } catch (err) {
    logger.warn('Photo could not be optimised; storing it as sent', { error: err instanceof Error ? err.message : String(err) });
    return { buffer: data, type };
  }
}

/** Admin-only: the browser sends the photo as the raw request body; it is stored in the merchant's bucket. */
export function photoUploadRoutes(blobs: Blobs, media: Media, requireAdmin: RequestHandler, ent: Entitlements) {
  const router = Router();

  router.post(
    '/',
    requireAdmin,
    express.raw({ type: Object.keys(TYPES), limit: MAX_PHOTO_BYTES }),
    handler(async (req, res) => {
      await ent.assertCanUpload();
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new HttpError(415, 'Send the photo as a JPEG, PNG or WebP image.');
      }
      const type = sniff(body);
      if (!type) throw new HttpError(415, 'That file is not a valid JPEG, PNG or WebP image.');

      const result = await optimisePhoto(body, type);
      const file = newPhotoFile(TYPES[result.type]);
      await blobs.put(objectName(file), result.buffer, result.type);
      res.status(201).json({ status: 'success', data: { ref: `media:${file}`, url: media.linkFor(file), bytes: result.buffer.length } });
    })
  );

  return router;
}

/** Serves a photo to anyone holding an unexpired link that this server signed. */
export const THUMB_WIDTHS = new Set([240, 480, 960]);

/** Resized WebP copies for grids, made on first request with sharp and kept next to the originals. Falls back to the original. */
async function thumbnail(blobs: Blobs, file: string, width: number): Promise<Blob | null> {
  const name = `thumbs/${file}-${width}.webp`;
  const cached = await blobs.get(name);
  if (cached) return cached;
  const original = await blobs.get(objectName(file));
  if (!original) return null;
  try {
    const sharp = (await import('sharp')).default;
    const data = await sharp(original.data).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await blobs.put(name, data, 'image/webp');
    return { data, contentType: 'image/webp' };
  } catch (e) {
    logger.warn('Thumbnail failed; serving the original', { file, error: String(e) });
    return original;
  }
}

export function mediaRoute(blobs: Blobs, media: Media): RequestHandler {
  return handler(async (req, res) => {
    const file = String(req.params.file);
    if (!media.verify(file, req.query.e, req.query.s)) {
      res.status(403).type('text').send('This photo link is not valid or has expired.');
      return;
    }
    const width = Number(req.query.w);
    const blob = THUMB_WIDTHS.has(width) ? await thumbnail(blobs, file, width) : await blobs.get(objectName(file));
    if (!blob) {
      res.status(404).type('text').send('Photo not found.');
      return;
    }
    res.setHeader('Content-Type', blob.contentType);
    res.setHeader('Cache-Control', 'private, max-age=21600');
    res.send(blob.data);
  });
}
