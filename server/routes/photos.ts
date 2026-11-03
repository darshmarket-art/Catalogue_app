import { bulkImportExempt } from '../bulkImport';
import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Blob, Blobs } from '../blobs';
import { newPhotoFile, normalizePhoto, objectName, type Media } from '../media';
import type { Entitlements } from '../entitlements';
import type { Store } from '../store';
import { allowedStyles, renderEnabled, renderMonthlyCap, renderStudio, STYLES } from '../aiRender';
import { PLACEMENTS, STYLE_IDS, type Placement, type StyleId } from '../../shared/aiStyles';
import { HttpError, handler } from '../http';
import { logger } from '../logger';
import sharp from 'sharp';
import { PHOTO_VARIANT_WIDTHS } from '../../shared/photoSpecs';

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
export function photoUploadRoutes(blobs: Blobs, media: Media, requireAdmin: RequestHandler, ent: Entitlements, bulkImportKey: string | null, store: Store) {
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

      // The bulk importer pads and encodes its photos itself; re-saving them here would only add another round of JPEG loss.
      const result = bulkImportExempt(bulkImportKey, req) ? { buffer: body, type } : await optimisePhoto(body, type);
      const file = newPhotoFile(TYPES[result.type]);
      await blobs.put(objectName(file), result.buffer, result.type);
      res.status(201).json({ status: 'success', data: { ref: `media:${file}`, url: media.linkFor(file), bytes: result.buffer.length } });
    })
  );

  /** Whether AI render can be used now, so the form can hide or disable "Enhance to CAD render" with a reason. */
  router.get(
    '/render',
    requireAdmin,
    handler(async (_req, res) => {
      const cap = renderMonthlyCap();
      const used = Number((await store.get('aiRenderMonthly', new Date().toISOString().slice(0, 7)))?.count ?? 0);
      res.json({ status: 'success', data: { enabled: renderEnabled(), styles: allowedStyles(), cap, used, left: Math.max(0, cap - used) } });
    })
  );

  /**
   * AI render of a photo (just uploaded, or an existing one the owner chose to enhance): a NEW file is stored next to the original, which is never changed or deleted.
   * `renders/<new file>` records which original it came from. Any refusal leaves the caller with the original photo.
   * Nothing is attached to a design or collection here: the owner decides in the form and saves.
   */
  router.post(
    '/render',
    requireAdmin,
    handler(async (req, res) => {
      if (!renderEnabled()) throw new HttpError(503, 'AI render is switched off on this server. Your original photo is used.');
      const ref = normalizePhoto(String((req.body as { ref?: unknown } | undefined)?.ref ?? ''));
      if (!ref?.startsWith('media:')) throw new HttpError(400, 'Only a photo uploaded here can be rendered.');
      const body = req.body as { style?: unknown; placement?: unknown };
      const style = (body.style ?? 'cad') as StyleId;
      if (!STYLE_IDS.includes(style) || !allowedStyles().includes(style)) throw new HttpError(400, 'Choose one of the available AI render styles.');
      const placement = body.placement as Placement | undefined;
      if (style === 'on-model' && !PLACEMENTS.includes(placement as Placement)) throw new HttpError(400, 'Choose where the piece is worn.');
      const original = await blobs.get(objectName(ref.slice(6)));
      if (!original) throw new HttpError(404, 'Photo not found. Upload it again.');

      // ponytail: read-then-increment, so two renders racing at the cap can overshoot by one. Use a Firestore transaction if that ever matters.
      const month = new Date().toISOString().slice(0, 7);
      const cap = renderMonthlyCap();
      if (Number((await store.get('aiRenderMonthly', month))?.count ?? 0) >= cap) {
        throw new HttpError(402, `This store has used its ${cap} AI renders for this month. Your original photo is used.`);
      }
      await store.increment('aiRenderMonthly', month, { count: 1 }, { month });

      let rendered: Awaited<ReturnType<typeof optimisePhoto>>;
      try {
        const out = await renderStudio(original.data, original.contentType, STYLES[style](placement));
        const type = sniff(out.data);
        if (!type) throw new Error('the AI returned an unreadable image');
        rendered = await optimisePhoto(out.data, type);
      } catch (err) {
        const why = err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'the AI did not answer in time';
        logger.warn('AI render failed; keeping the original', { error: err instanceof Error ? err.message : String(err) });
        throw new HttpError(502, `AI render did not work for this photo (${why}). Your original photo is used.`);
      }
      const file = newPhotoFile(TYPES[rendered.type]);
      await blobs.put(objectName(file), rendered.buffer, rendered.type);
      await blobs.put(`renders/${file}`, Buffer.from(JSON.stringify({ original: ref, style, ...(style === 'on-model' ? { placement } : {}) })), 'application/json');
      res.status(201).json({ status: 'success', data: { ref: `media:${file}`, url: media.linkFor(file), style, original: { ref, url: media.url(ref) } } });
    })
  );

  return router;
}

export const THUMB_WIDTHS: ReadonlySet<number> = new Set(PHOTO_VARIANT_WIDTHS);

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

/** Serves a photo to anyone holding an unexpired link that this server signed. ?w=<one of THUMB_WIDTHS> returns a resized WebP; any other value gets the original, as before. */
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
