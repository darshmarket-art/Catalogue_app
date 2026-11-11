import type { Product } from './types';

/**
 * The house's services, opened from anywhere (a piece, the selection, Home) without threading callbacks through every screen:
 * a screen calls openService(...), and the one <ServiceSheets/> at the app root shows the sheet.
 */
export type Piece = Pick<Product, 'sku' | 'title' | 'image'>;
export type ServiceAsk =
  | { kind: 'viewing'; pieces?: Piece[] }
  | { kind: 'bespoke'; pieces?: Piece[] }
  | { kind: 'reserve'; piece: Piece }
  | { kind: 'share'; pieces: Piece[]; hint?: boolean }
  | { kind: 'compare'; pieces: [Product, Product] }
  | { kind: 'sizes' }
  | { kind: 'care' };

const EVENT = 'ax-service';
export const openService = (ask: ServiceAsk) => window.dispatchEvent(new CustomEvent<ServiceAsk>(EVENT, { detail: ask }));
export const onService = (fn: (ask: ServiceAsk) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<ServiceAsk>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
};
export const pieceOf = (p: Product): Piece => ({ sku: p.sku, title: p.title, image: p.image });

/** Indian ring sizes: the size is the inner circumference in millimetres less 40. */
export const RING_SIZES = Array.from({ length: 21 }, (_, i) => { const size = i + 6; const c = size + 40; return { size, circumference: c, diameter: Math.round((c / Math.PI) * 10) / 10 }; });
/** Bangle sizes are the inner diameter in inches and sixteenths: 2-6 is 2 and 6/16 inches. */
export const BANGLE_SIZES = [2, 4, 6, 8, 10, 12].map((n) => ({ size: `2-${n}`, inches: `2 ${n}/16`, mm: Math.round((2 + n / 16) * 25.4 * 10) / 10 }));
