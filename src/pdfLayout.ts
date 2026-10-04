// A4 in mm. The layout follows the Emergent atlas PDF: a cover block, a "N selected designs" line, a 2-column grid of cards, a footer with "Powered by Antarixs".
export const W = 210;
export const H = 297;
export const MARGIN = 14;
export const GAP = 6;
export const COLS = 2;
export const CELL = (W - 2 * MARGIN - GAP * (COLS - 1)) / COLS;
export const BODY_H = 19;
export const CARD_H = CELL + BODY_H;
export const FOOTER_H = 18;
export const FIRST_TOP = 104; // below the cover block and the "N selected designs" line
export const NEXT_TOP = 20;

export const rowsFrom = (top: number) => Math.max(1, Math.floor((H - FOOTER_H - top + GAP) / (CARD_H + GAP)));

/** How many designs go on each page: the first page shares space with the cover. */
export function pdfPages(count: number): number[] {
  const pages: number[] = [];
  let left = count;
  let cap = COLS * rowsFrom(FIRST_TOP);
  while (left > 0) {
    pages.push(Math.min(cap, left));
    left -= cap;
    cap = COLS * rowsFrom(NEXT_TOP);
  }
  return pages;
}
