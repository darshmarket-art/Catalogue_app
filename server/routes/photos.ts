import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Blobs } from '../blobs';
import { newPhotoFile, objectName, type Media } from '../media';
import { HttpError, handler } from '../http';

// Originals are kept as uploaded (no resizing), so the limit is generous. Cloud Run accepts requests up to 32 MB.
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** The file's real format, from its first bytes, so a renamed file cannot be smuggled in as a photo. */
function sniff(data: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (data.length > 12 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 12 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length > 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/** Admin-only: the browser sends the photo as the raw request body; it is stored in the merchant's bucket. */
export function photoUploadRoutes(blobs: Blobs, media: Media, requireAdmin: RequestHandler) {
  const router = Router();

  router.post(
    '/',
    requireAdmin,
    express.raw({ type: Object.keys(TYPES), limit: MAX_PHOTO_BYTES }),
    handler(async (req, res) => {
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new HttpError(415, 'Send the photo as a JPEG, PNG or WebP image.');
      }
      const type = sniff(body);
      if (!type) throw new HttpError(415, 'That file is not a valid JPEG, PNG or WebP image.');

      const file = newPhotoFile(TYPES[type]);
      await blobs.put(objectName(file), body, type);
      res.status(201).json({ status: 'success', data: { ref: `media:${file}`, url: media.linkFor(file), bytes: body.length } });
    })
  );

  return router;
}

/** Serves a photo to anyone holding an unexpired link that this server signed. */
export function mediaRoute(blobs: Blobs, media: Media): RequestHandler {
  return handler(async (req, res) => {
    const file = String(req.params.file);
    if (!media.verify(file, req.query.e, req.query.s)) {
      res.status(403).type('text').send('This photo link is not valid or has expired.');
      return;
    }
    const blob = await blobs.get(objectName(file));
    if (!blob) {
      res.status(404).type('text').send('Photo not found.');
      return;
    }
    res.setHeader('Content-Type', blob.contentType);
    res.setHeader('Cache-Control', 'private, max-age=21600');
    res.send(blob.data);
  });
}
