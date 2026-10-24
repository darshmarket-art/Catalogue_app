import { describe, expect, it } from 'vitest';
import { photoSrcSet } from '../src/photoSrcSet';
import { PHOTO_VARIANT_WIDTHS } from '../shared/photoSpecs';
import { THUMB_WIDTHS } from '../server/routes/photos';

const file = 'a'.repeat(32) + '.jpg';

describe('photoSrcSet', () => {
  it('lists one entry per width the server can make, on the same signed link', () => {
    const link = `/media/${file}?e=9&s=sig&store=bhakti`;
    const set = photoSrcSet(link)!;
    expect(set.split(', ')).toEqual(PHOTO_VARIANT_WIDTHS.map((w) => `${link}&w=${w} ${w}w`));
    expect(PHOTO_VARIANT_WIDTHS.every((w) => THUMB_WIDTHS.has(w))).toBe(true);
  });
  it('works when the native app puts the server address in front', () => {
    expect(photoSrcSet(`https://app.example.com/media/${file}?e=9&s=sig`)).toContain('&w=480 480w');
  });
  it('leaves anything else alone', () => {
    expect(photoSrcSet(undefined)).toBeUndefined();
    expect(photoSrcSet('https://cdn.example.com/a.jpg')).toBeUndefined();
    expect(photoSrcSet(`/media/${file}`)).toBeUndefined();
    expect(photoSrcSet('data:image/svg+xml;base64,AAAA')).toBeUndefined();
  });
});
