// A4 in mm, drawn at the atlas proportions (its page is 334 px wide, so 1 px = 0.6287 mm and 1 px of type = 1.78 pt). The layout follows the Emergent atlas "PDF layout": page 1 has the store header and gold-bordered design cards in two
// columns; the last page is a dark "Thank you" page with a QR and the store's phone number.
export const W = 210;
export const H = 297;
export const MARGIN = 10;
export const GAP = 6.3;
export const COLS = 2;
export const CELL = (W - 2 * MARGIN - GAP * (COLS - 1)) / COLS;
export const CARD_PAD = 3.8;
/** Photo shape inside a card (atlas: 1 : 0.78). */
export const PHOTO_W = CELL - 2 * CARD_PAD;
export const PHOTO_H = PHOTO_W * 0.78;
export const FOOTER_H = 16;
/** Page 1 starts its cards below the store header. */
export const FIRST_TOP = 50;
export const NEXT_TOP = 12;

/** Card height: photo, name, SKU / net weight line, and one more line when the store records its own product fields. */
export const cardHeight = (withDetail: boolean) => CARD_PAD + PHOTO_H + 27 + (withDetail ? 5.5 : 0);

export const rowsFrom = (top: number, withDetail = false) => Math.max(1, Math.floor((H - FOOTER_H - top + GAP) / (cardHeight(withDetail) + GAP)));

/** How many designs go on each design page (the closing page is extra). */
export function pdfPages(count: number, withDetail = false): number[] {
  const pages: number[] = [];
  let left = count;
  let cap = COLS * rowsFrom(FIRST_TOP, withDetail);
  while (left > 0) {
    pages.push(Math.min(cap, left));
    left -= cap;
    cap = COLS * rowsFrom(NEXT_TOP, withDetail);
  }
  return pages;
}
