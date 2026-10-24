import { PHOTO_VARIANT_WIDTHS } from '../shared/photoSpecs';

/** `sizes` hints for the usual photo slots, so the browser downloads the smallest variant that still looks sharp. A grid card is 2, 3 or 4 columns wide depending on the screen. */
export const SIZES_GRID = '(min-width: 900px) 25vw, (min-width: 560px) 34vw, 52vw';
export const SIZES_THUMB = '(min-width: 1024px) 200px, 96px';
export const SIZES_FULL = '100vw';

/** A signed /media link (as the API returns it, possibly with the server address and store in front). */
const MEDIA_LINK = /\/media\/[a-f0-9]{32}\.(?:jpg|png|webp)\?/;

/** The srcset for a stored photo: the same link at each width the /media route can resize to. Undefined for anything else (external URLs, the placeholder), which keep their plain src. */
export const photoSrcSet = (src: string | undefined): string | undefined =>
  src && MEDIA_LINK.test(src) ? PHOTO_VARIANT_WIDTHS.map((w) => `${src}&w=${w} ${w}w`).join(', ') : undefined;
