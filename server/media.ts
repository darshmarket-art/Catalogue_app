import crypto from 'crypto';
import { z } from 'zod';
import type { Doc } from './store';
import type { Blobs } from './blobs';
import { HttpError } from './http';
import { PLACEHOLDER_IMAGE } from './placeholder';

/** Stored form of an uploaded photo: "media:<32 hex>.<jpg|png|webp>". Anything else must be an http(s) URL. */
const FILE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const MEDIA_REF = /^media:([a-f0-9]{32}\.(?:jpg|png|webp))$/;
// The native app sees these links with the server address in front, so allow an optional origin.
const MEDIA_URL = /^(?:https?:\/\/[^/?#]+)?\/media\/([a-f0-9]{32}\.(?:jpg|png|webp))(?:\?.*)?$/;

const LINK_WINDOW_MS = 6 * 60 * 60 * 1000;

export const objectName = (file: string) => `photos/${file}`;
export const isMediaFile = (file: string) => FILE.test(file);

/** Accepts a stored ref or a signed link the app received earlier, and returns the stored ref. */
export function normalizePhoto(value: string): string | null {
  const ref = MEDIA_REF.exec(value);
  if (ref) return value;
  const url = MEDIA_URL.exec(value);
  if (url) return `media:${url[1]}`;
  return /^https?:\/\//i.test(value) && value.length <= 2048 && URL.canParse(value) ? value : null;
}

export const photoRef = z
  .string()
  .transform((v, ctx) => {
    const ref = normalizePhoto(v.trim());
    if (!ref) ctx.addIssue({ code: 'custom', message: 'Photo is not valid. Upload it again.' });
    return ref ?? '';
  });

export function newPhotoFile(ext: 'jpg' | 'png' | 'webp') {
  return `${crypto.randomBytes(16).toString('hex')}.${ext}`;
}

export function createMedia(secret: string) {
  const key = crypto.createHmac('sha256', secret).update('media-links').digest();
  const sign = (file: string, exp: number) => crypto.createHmac('sha256', key).update(`${file}|${exp}`).digest('base64url');

  /** A private link that stops working after 6 to 12 hours. Stable within a window, so browsers can cache the photo. */
  const linkFor = (file: string, now = Date.now()) => {
    const exp = (Math.floor(now / LINK_WINDOW_MS) + 2) * LINK_WINDOW_MS;
    return `/media/${file}?e=${exp}&s=${sign(file, exp)}`;
  };

  const verify = (file: string, e: unknown, s: unknown, now = Date.now()) => {
    const exp = Number(e);
    if (!isMediaFile(file) || !Number.isFinite(exp) || exp < now || typeof s !== 'string') return false;
    const expected = Buffer.from(sign(file, exp));
    const given = Buffer.from(s);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  };

  /** Turns a stored ref into something the browser can load. */
  const url = (ref: string | undefined | null) => {
    if (!ref) return PLACEHOLDER_IMAGE;
    const m = MEDIA_REF.exec(ref);
    return m ? linkFor(m[1]) : ref;
  };

  const refsOf = (doc: Doc): string[] => {
    const refs: unknown[] = doc.images?.length ? doc.images : [doc.image, ...(doc.angles ?? [])];
    return refs.filter((r): r is string => typeof r === 'string' && r.length > 0);
  };

  /** Product or category for the browser: photos become links; `image` is always the first photo. */
  const present = <T extends Doc>(doc: T) => {
    const refs = refsOf(doc);
    const { angles: _angles, ...rest } = doc as Doc;
    const images = refs.map(url);
    return { ...rest, images, image: images[0] ?? PLACEHOLDER_IMAGE } as Omit<T, 'angles'> & { images: string[]; image: string };
  };

  const presentItem = <T extends Doc>(item: T) => ({ ...item, image: url(item.image) });

  return { linkFor, verify, url, present, presentItem, refsOf };
}

export type Media = ReturnType<typeof createMedia>;

/** Every uploaded photo a request refers to must really be in the bucket. */
export async function assertPhotosExist(blobs: Blobs, refs: string[]) {
  for (const ref of refs) {
    const m = MEDIA_REF.exec(ref);
    if (m && !(await blobs.exists(objectName(m[1])))) {
      throw new HttpError(400, 'A photo has not finished uploading. Please upload it again.');
    }
  }
}
