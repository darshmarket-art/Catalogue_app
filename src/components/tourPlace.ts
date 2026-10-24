/** Space kept between the lit-up window and the card, and between the card and the screen edge. */
export const CARD_GAP = 14;
export const EDGE = 8;

/**
 * Where the card's top edge should be: centred when nothing is lit up, otherwise just below the window, or above it when there is no room below.
 * `want` is the window's box, `h` the card's measured height and `vh` the viewport height.
 */
export const cardY = (want: { top: number; height: number; width: number }, h: number, vh: number) =>
  want.width === 0 ? (vh - h) / 2 : want.top + want.height + CARD_GAP + h < vh - EDGE ? want.top + want.height + CARD_GAP : Math.max(EDGE, want.top - CARD_GAP - h);

/**
 * Whether the element has to be scrolled into view before it is lit up: it is under the top bar (`topInset` = the bar's measured bottom edge),
 * or too low to leave room for the card under it (`cardH` = the card's measured height).
 */
export const needsScroll = (r: { top: number; bottom: number }, vh: number, topInset: number, cardH: number) => r.top < topInset || r.bottom > vh - (cardH + CARD_GAP + EDGE);
