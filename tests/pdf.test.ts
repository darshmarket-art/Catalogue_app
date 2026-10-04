import { describe, expect, it } from 'vitest';
import { pdfPages } from '../src/pdfLayout';

describe('PDF page layout (atlas: cover, then 2-column cards)', () => {
  it('puts fewer cards on the cover page, and fills the others', () => {
    const [first, ...rest] = pdfPages(1);
    expect(first).toBe(1);
    expect(rest).toEqual([]);
    const pages = pdfPages(11);
    expect(pages[0]).toBe(2); // one row of two beside the cover
    expect(pages[1]).toBe(4); // two rows of two
    expect(pages.reduce((a, b) => a + b, 0)).toBe(11);
  });

  it('every design lands on exactly one page', () => {
    for (const n of [1, 2, 3, 7, 20, 101]) expect(pdfPages(n).reduce((a, b) => a + b, 0)).toBe(n);
  });
});
