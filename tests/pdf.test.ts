import { describe, expect, it } from 'vitest';
import type { Product } from '../src/types';
import { DEFAULT_PDF_OPTIONS, MAX_PDF_DESIGNS, caption, captionHeight, ellipsize, geometry, groupByCollection, normaliseOptions, photoBox, planPages, priceOf } from '../src/pdfLayout';

const mk = (n: number, category = 'Bridal', extra: Partial<Product> = {}): Product =>
  ({ id: `id${n}`, sku: `BJ-${n}`, title: `Design ${n}`, category, purity: '22K 916', grossWt: 12, netWt: 10.5, image: `/media/${n}.jpg`, images: [], stockStatus: 'Ready in Vault', ...extra }) as Product;
const fields = [{ key: 'length', label: 'Length', unit: 'in' }, { key: 'size', label: 'Size' }];
const O = DEFAULT_PDF_OPTIONS;
const counts = (sizes: number[]) => planPages(sizes).filter((p) => p.kind === 'designs').map((p) => (p.kind === 'designs' ? p.to - p.from : 0));

describe('PDF pagination (Editorial grid)', () => {
  it('is cover + divider + design pages + contact', () => {
    expect(planPages([1]).map((p) => p.kind)).toEqual(['cover', 'divider', 'designs', 'contact']);
    expect(planPages([12]).length).toBe(5); // 12 designs = two pages of six
  });

  it('puts six designs on a page, in both orientations, and every design lands on exactly one page', () => {
    expect(counts([7])).toEqual([6, 1]);
    for (const n of [1, 5, 6, 7, 12, 13, 101]) expect(counts([n]).reduce((a, b) => a + b, 0)).toBe(n);
    expect(geometry(false)).toMatchObject({ cols: 2, rows: 3, W: 210, H: 297 });
    expect(geometry(true)).toMatchObject({ cols: 3, rows: 2, W: 297, H: 210 });
  });

  it('inserts a divider before each collection and starts its designs on a fresh page', () => {
    const pages = planPages([7, 3]);
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'divider', 'designs', 'designs', 'divider', 'designs', 'contact']);
    expect(pages.filter((p) => p.kind === 'divider').map((p) => (p.kind === 'divider' ? p.group : -1))).toEqual([0, 1]);
  });

  it('skips an empty collection, and a PDF of nothing is still cover + contact', () => {
    expect(planPages([0, 2]).map((p) => p.kind)).toEqual(['cover', 'divider', 'designs', 'contact']);
    expect(planPages([]).map((p) => p.kind)).toEqual(['cover', 'contact']);
  });

  it('groups picks made across collections, in the order they first appear', () => {
    const groups = groupByCollection([mk(1, 'A'), mk(2, 'B'), mk(3, 'A')]);
    expect(groups.map((g) => [g.name, g.items.map((p) => p.id)])).toEqual([['A', ['id1', 'id3']], ['B', ['id2']]]);
  });

  it('keeps cards and photo boxes inside the page, with room left for the caption', () => {
    for (const land of [false, true]) {
      const g = geometry(land);
      expect(g.bodyX + g.cols * g.cellW + (g.cols - 1) * g.gap).toBeCloseTo(g.W - g.bodyX, 5);
      expect(g.bodyY + g.rows * g.cellH + (g.rows - 1) * g.gap).toBeCloseTo(g.H - 8.5 * g.u, 5);
      for (const [extra, price] of [[false, false], [true, true]]) {
        const b = photoBox(g, extra, price);
        expect(b.h).toBeGreaterThan(g.cellH * 0.35);
        expect(b.y + b.h + g.innerGap + captionHeight(g, extra, price)).toBeLessThanOrEqual(g.cellH - g.pad + 1e-9);
      }
    }
  });

  it('has a sane cap on designs per PDF', () => expect(MAX_PDF_DESIGNS).toBeGreaterThanOrEqual(100));
});

describe('PDF captions and options', () => {
  it('shows SKU, purity and net weight by default, and no price', () => {
    expect(caption(mk(1), O, fields)).toEqual({ name: 'Design 1', meta: ['BJ-1', '22K 916', '10.500 g'], price: null, extra: '' });
  });

  it('the toggles remove their parts; name and purity always stay', () => {
    expect(caption(mk(1), { ...O, sku: false }, fields).meta).toEqual(['22K 916', '10.500 g']);
    expect(caption(mk(1), { ...O, weights: false }, fields).meta).toEqual(['BJ-1', '22K 916']);
    expect(caption(mk(1), { ...O, sku: false, weights: false }, fields)).toMatchObject({ name: 'Design 1', meta: ['22K 916'] });
  });

  it("the store's own product fields ride with the weights, labelled and with units", () => {
    const p = mk(1, 'A', { extra: { length: 18, size: '2.6' } });
    expect(caption(p, O, fields).extra).toBe('Length 18 in · Size 2.6');
    expect(caption(p, { ...O, weights: false }, fields).extra).toBe('');
    expect(caption(mk(2), O, fields).extra).toBe('');
  });

  it('price shows only when asked for and the design has one', () => {
    const priced = mk(1, 'A', { extra: { price: 342000 } });
    expect(priceOf(priced)).toBe('Rs 3,42,000');
    expect(caption(priced, { ...O, price: true }, [{ key: 'price', label: 'Price' }])).toMatchObject({ price: 'Rs 3,42,000', extra: '' });
    expect(caption(priced, O, fields).price).toBeNull();
    expect(caption(mk(2), { ...O, price: true }, fields).price).toBeNull();
    expect(priceOf(mk(3, 'A', { extra: { price: 'on request' } }))).toBeNull();
  });

  it('a long name is cut with an ellipsis to fit; a short one is untouched', () => {
    const measure = (s: string) => s.length;
    const long = 'Maharani Kundan Polki Bridal Choker Necklace with Emerald Drops';
    const cut = ellipsize(long, 24, measure);
    expect(cut.length).toBeLessThanOrEqual(24);
    expect(cut.endsWith('...')).toBe(true);
    expect(long.startsWith(cut.slice(0, -3))).toBe(true);
    expect(ellipsize('Rani Haar', 24, measure)).toBe('Rani Haar');
    expect(ellipsize('Anything', 1, measure)).toBe('...');
  });

  it('a design with no photo still gets a caption and a place on the page', () => {
    const p = mk(1, 'A', { image: '' });
    expect(caption(p, O, fields).name).toBe('Design 1');
    expect(counts([1])).toEqual([1]);
  });

  it('repairs saved options: unknown theme, wrong types, over-long text', () => {
    expect(normaliseOptions(null)).toEqual(DEFAULT_PDF_OPTIONS);
    expect(normaliseOptions({ theme: 'neon', land: 'yes', price: true, title: 'x'.repeat(200) })).toMatchObject({ theme: 'store', land: false, price: true, watermark: true });
    expect(normaliseOptions({ title: 'x'.repeat(200) }).title.length).toBe(60);
    expect(normaliseOptions({ theme: 'garnet', land: true, sku: false })).toMatchObject({ theme: 'garnet', land: true, sku: false, weights: true });
  });
});

import { PALETTES, contrast, paletteFor } from '../src/pdfLayout';
describe('store theme palette', () => {
  it('is the default, can be chosen, and falls back to Ivory with no page to read', () => {
    expect(normaliseOptions({}).theme).toBe('store');
    expect(normaliseOptions({ theme: 'garnet' }).theme).toBe('garnet');
    expect(normaliseOptions({ theme: 'nope' }).theme).toBe('store');
    expect(paletteFor('store')).toEqual(PALETTES.ivory); // node has no document
    expect(paletteFor('midnight')).toBe(PALETTES.midnight);
  });
  it('measures contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.6);
    expect(contrast('#1b1b1b', '#ffffff')).toBeGreaterThan(15);
  });
});

import { trimBox, PDF_FITS } from '../src/pdfLayout';
describe('trimming baked-in padding', () => {
  const make = (w: number, h: number, f: (x: number, y: number) => [number, number, number]) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = f(x, y); const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
    return px;
  };
  const piece = (x: number, y: number): [number, number, number] => ((x + y) % 7 < 3 ? [200, 150, 60] : [120, 90, 40]); // busy, never flat
  it('cuts white bars above and below, keeps the rest', () => {
    const px = make(100, 100, (x, y) => (y < 15 || y >= 88 ? [255, 255, 255] : piece(x, y)));
    expect(trimBox(px, 100, 100)).toEqual({ x: 0, y: 15, w: 100, h: 73 - 0 });
  });
  it('cuts black bars at the sides', () => {
    const px = make(100, 100, (x, y) => (x < 10 || x >= 95 ? [0, 0, 0] : piece(x, y)));
    expect(trimBox(px, 100, 100)).toEqual({ x: 10, y: 0, w: 85, h: 100 });
  });
  it('leaves a plain studio backdrop alone, even a flat grey or cream one', () => {
    expect(trimBox(make(100, 100, () => [231, 228, 223]), 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(trimBox(make(100, 100, (x, y) => (y < 20 ? [244, 236, 223] : piece(x, y))), 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it('never takes more than a fifth from a side', () => {
    expect(trimBox(make(100, 100, (x, y) => (y < 60 ? [255, 255, 255] : piece(x, y))), 100, 100)).toEqual({ x: 0, y: 20, w: 100, h: 80 });
    const blank = trimBox(make(100, 100, () => [255, 255, 255]), 100, 100); // nothing to place: still at least 60% of it
    expect(blank.w).toBeGreaterThanOrEqual(60);
    expect(blank.h).toBeGreaterThanOrEqual(60);
  });
  it('knows its three fit options', () => {
    expect(PDF_FITS).toEqual(['trim', 'whole', 'fill']);
    expect(normaliseOptions({ fit: 'fill' }).fit).toBe('fill');
    expect(normaliseOptions({ fit: 'stretch' }).fit).toBe('trim');
  });
});
