// Pure layout for the PDF catalogue ("Editorial grid", chosen in docs/pdf-picker): no DOM, no jsPDF, so it is unit-tested.
// Every size is in "u" = 1% of the page width (the picker's cqw), so a page looks the same in portrait and landscape.
import type { Product } from './types';

export type PdfTheme = 'ivory' | 'midnight' | 'garnet';
export const PDF_THEMES: PdfTheme[] = ['ivory', 'midnight', 'garnet'];

export interface PdfOptions {
  land: boolean;
  /** Only drawn for designs that carry a price. */
  price: boolean;
  weights: boolean;
  sku: boolean;
  watermark: boolean;
  theme: PdfTheme;
  /** Empty = the collection's name (or "Selection"). */
  title: string;
  subtitle: string;
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { land: false, price: false, weights: true, sku: true, watermark: true, theme: 'ivory', title: '', subtitle: '' };

/** The last options used, repaired: anything missing or of the wrong type falls back to the default. */
export function normaliseOptions(raw: unknown): PdfOptions {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_PDF_OPTIONS;
  const bool = (k: 'land' | 'price' | 'weights' | 'sku' | 'watermark') => (typeof r[k] === 'boolean' ? (r[k] as boolean) : D[k]);
  return {
    land: bool('land'), price: bool('price'), weights: bool('weights'), sku: bool('sku'), watermark: bool('watermark'),
    theme: PDF_THEMES.includes(r.theme as PdfTheme) ? (r.theme as PdfTheme) : D.theme,
    title: typeof r.title === 'string' ? r.title.slice(0, 60) : '',
    subtitle: typeof r.subtitle === 'string' ? r.subtitle.slice(0, 70) : ''
  };
}

const storageKey = (storeId: string) => `pdf-options:${storeId}`;
export function loadPdfOptions(storeId: string): PdfOptions {
  try {
    return normaliseOptions(JSON.parse(localStorage.getItem(storageKey(storeId)) || 'null'));
  } catch {
    return { ...DEFAULT_PDF_OPTIONS };
  }
}
export function savePdfOptions(storeId: string, o: PdfOptions) {
  try {
    localStorage.setItem(storageKey(storeId), JSON.stringify(o));
  } catch {
    // private mode or full storage: the options just are not remembered
  }
}

/** The page colours (picker --g ground, --s surface, --i ink, --m muted, --h hairline, --a accent, --dp / --dpf dark page and its ink, --tile photo background). */
export interface Palette { g: string; s: string; i: string; m: string; h: string; a: string; dp: string; dpf: string; tile: string }
export const PALETTES: Record<PdfTheme, Palette> = {
  ivory: { g: '#ffffff', s: '#f3f1ee', i: '#1b1b1b', m: '#6b6966', h: '#dedbd6', a: '#1b1b1b', dp: '#0c0c0c', dpf: '#ffffff', tile: '#e7e4df' },
  midnight: { g: '#0f1420', s: '#151b2b', i: '#ece7dc', m: '#9aa0ae', h: '#2a3247', a: '#d6b66a', dp: '#080b13', dpf: '#ece7dc', tile: '#1c2336' },
  garnet: { g: '#fbf6f3', s: '#f2e7e2', i: '#2a1118', m: '#7a5f64', h: '#e3d0cb', a: '#8c1d3a', dp: '#3a0f1c', dpf: '#fbf6f3', tile: '#ead9d3' }
};
export const GOLD = '#c9a961';

export const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** a over b, k = share of a (0..1). */
export const mixHex = (a: string, b: string, k: number): [number, number, number] => {
  const [x, y] = [rgb(a), rgb(b)];
  return [0, 1, 2].map((n) => Math.round(y[n] + (x[n] - y[n]) * k)) as [number, number, number];
};

/** Most designs one PDF takes. Every photo stays in the file, so this keeps the PDF (and the phone's memory) sane; larger stores make several PDFs. */
export const MAX_PDF_DESIGNS = 500;
export const PER_PAGE = 6;

export interface Geo {
  W: number; H: number; u: number; cols: number; rows: number;
  bodyX: number; bodyY: number; bodyW: number; bodyH: number;
  gap: number; pad: number; innerGap: number;
  cellW: number; cellH: number;
  /** name and detail sizes in u */
  nameU: number; metaU: number;
}

/** The page grid: 2 x 3 hairline cards on A4 portrait, 3 x 2 on landscape. */
export function geometry(land: boolean): Geo {
  const W = land ? 297 : 210;
  const H = land ? 210 : 297;
  const u = W / 100;
  const cols = land ? 3 : 2;
  const rows = land ? 2 : 3;
  const bodyX = 6 * u;
  const bodyY = 9.5 * u;
  const bodyW = W - 12 * u;
  const bodyH = H - bodyY - 8.5 * u;
  const gap = 2.2 * u;
  return {
    W, H, u, cols, rows, bodyX, bodyY, bodyW, bodyH, gap, pad: 1.5 * u, innerGap: 1.3 * u,
    cellW: (bodyW - gap * (cols - 1)) / cols, cellH: (bodyH - gap * (rows - 1)) / rows,
    nameU: land ? 1.9 : 2.3, metaU: land ? 0.85 : 1
  };
}

/** The room a caption needs under the photo (mm), for the lines this PDF actually shows. Uniform per PDF, so every photo box is the same size. */
export function captionHeight(g: Geo, withExtra: boolean, withPrice: boolean): number {
  const { u, nameU, metaU } = g;
  return (nameU * 1.15 + 0.7 + metaU * 1.5 + (withPrice ? 0.6 + nameU * 0.8 * 1.25 : 0) + (withExtra ? 0.5 + metaU * 1.4 : 0)) * u;
}

/** The photo box inside a card (mm, relative to the card's corner). */
export function photoBox(g: Geo, withExtra: boolean, withPrice: boolean) {
  return { x: g.pad, y: g.pad, w: g.cellW - 2 * g.pad, h: g.cellH - 2 * g.pad - g.innerGap - captionHeight(g, withExtra, withPrice) };
}

export interface PdfGroup { name: string; items: Product[] }

/** Designs grouped by collection, in the order each collection first appears, so picks made across collections still read as sections. */
export function groupByCollection(items: Product[]): PdfGroup[] {
  const groups = new Map<string, PdfGroup>();
  for (const p of items) {
    const g = groups.get(p.category) ?? { name: p.category, items: [] };
    g.items.push(p);
    groups.set(p.category, g);
  }
  return [...groups.values()];
}

export type PdfPage =
  | { kind: 'cover' }
  | { kind: 'divider'; group: number }
  | { kind: 'designs'; group: number; from: number; to: number }
  | { kind: 'contact' };

/** Cover, then per collection a divider and its design pages (six to a page), then the contact page. */
export function planPages(groupSizes: number[]): PdfPage[] {
  const pages: PdfPage[] = [{ kind: 'cover' }];
  groupSizes.forEach((n, group) => {
    if (n <= 0) return;
    pages.push({ kind: 'divider', group });
    for (let from = 0; from < n; from += PER_PAGE) pages.push({ kind: 'designs', group, from, to: Math.min(from + PER_PAGE, n) });
  });
  pages.push({ kind: 'contact' });
  return pages;
}

/** A price to show, or null: designs carry it as `price` or as a store product field called "price". */
export function priceOf(p: Product): string | null {
  const v = (p as unknown as { price?: unknown }).price ?? p.extra?.price;
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : v;
  return typeof n === 'number' && isFinite(n) && n > 0 ? `Rs ${n.toLocaleString('en-IN')}` : null;
}

export interface Caption { name: string; meta: string[]; price: string | null; extra: string }

/** What one design's caption says, for these options. The store's own product fields (never hard-coded weights) go on the extra line with the weights. */
export function caption(p: Product, o: PdfOptions, fields: Array<{ key: string; label: string; unit?: string }>): Caption {
  const meta: string[] = [];
  if (o.sku && p.sku) meta.push(p.sku);
  if (p.purity) meta.push(p.purity);
  if (o.weights) meta.push(`${p.netWt.toFixed(3)} g`);
  const extra = o.weights
    ? fields.filter((f) => f.key !== 'price' && p.extra?.[f.key] !== undefined && p.extra[f.key] !== '').map((f) => `${f.label} ${p.extra![f.key]}${f.unit ? ` ${f.unit}` : ''}`).join(' · ')
    : '';
  return { name: p.title, meta, price: o.price ? priceOf(p) : null, extra };
}

/** Text cut with an ellipsis to fit `max` (any unit, as long as `measure` uses the same). */
export function ellipsize(text: string, max: number, measure: (s: string) => number): string {
  if (measure(text) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid).trimEnd() + '...') <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? '...' : text.slice(0, lo).trimEnd() + '...';
}
