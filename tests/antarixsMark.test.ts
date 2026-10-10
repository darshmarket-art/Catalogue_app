import { describe, expect, it } from 'vitest';
import { MARK_COLORS, MARK_PATHS, antarixsIconSvg, markGradient, markSvgInner } from '../shared/antarixsMark';

const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('Antarixs mark', () => {
  it('keeps every point inside the 0..100 box', () => {
    for (const d of Object.values(MARK_PATHS)) for (const n of nums(d)) expect(n).toBeGreaterThanOrEqual(0), expect(n).toBeLessThanOrEqual(100);
  });

  it('puts the spark on the A\'s centre line, x = 50', () => {
    const xs = nums(MARK_PATHS.spark).filter((_, i) => i % 2 === 0); // x, y pairs
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(100.0, 0); // symmetric about 50 within a unit
    expect(xs[0]).toBe(50); // the top point is on the axis
    expect(nums(MARK_PATHS.lambda)[0]).toBe(50); // so is the A's inner apex
  });

  it('starts the yellow line at the A\'s bottom, below the left foot, and ends it by the spark', () => {
    const [tipX, tipY, , , footX, footY] = nums(MARK_PATHS.swoosh);
    expect(footY).toBeGreaterThan(80); // at the foot
    expect(footX).toBeLessThan(10);
    expect(tipX).toBeGreaterThan(40); // runs toward the centre
    expect(tipX).toBeLessThan(50);
    expect(tipY).toBeGreaterThan(55); // under the spark, not beside it
  });

  it('has a lighter dark-ground gradient and the same stops otherwise', () => {
    expect(markGradient(false).stops).toHaveLength(markGradient(true).stops.length);
    expect(markGradient(true).stops.at(-1)![1]).not.toBe(markGradient(false).stops.at(-1)![1]);
  });

  it('builds a self-contained icon on the deep tile, rounded only when asked', () => {
    expect(antarixsIconSvg(true)).toContain('rx="22"');
    expect(antarixsIconSvg(false)).not.toContain('rx=');
    expect(antarixsIconSvg()).toContain(MARK_COLORS.tile);
    expect(markSvgInner('x')).toContain('url(#x-l)');
  });
});
