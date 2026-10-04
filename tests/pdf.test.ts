import { describe, expect, it } from 'vitest';
import { pdfPages } from '../src/pdfLayout';

describe('PDF page layout (atlas: header, 2-column gold cards, thank-you page)', () => {
  it('puts four cards under the header on page 1, and fills the others', () => {
    const [first, ...rest] = pdfPages(1);
    expect(first).toBe(1);
    expect(rest).toEqual([]);
    const pages = pdfPages(11);
    expect(pages[0]).toBe(4); // two rows of two under the store header (atlas page 1: four designs)
    expect(pages[1]).toBe(6); // three rows of two
    expect(pages.reduce((a, b) => a + b, 0)).toBe(11);
  });

  it('every design lands on exactly one page', () => {
    for (const n of [1, 2, 3, 7, 20, 101]) expect(pdfPages(n).reduce((a, b) => a + b, 0)).toBe(n);
  });
});
