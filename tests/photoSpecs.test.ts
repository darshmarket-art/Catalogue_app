import { describe, expect, it } from 'vitest';
import { PHOTO_SPECS, clampOffset, fitCheck, sourceRect } from '../shared/photoSpecs';

describe('photo shape rules', () => {
  it('passes a right-shaped photo, refuses a small one, flags a wrong shape', () => {
    expect(fitCheck(1600, 800, PHOTO_SPECS.banner)).toBe('ok');
    expect(fitCheck(1650, 800, PHOTO_SPECS.banner)).toBe("ok"); // within 5%
    expect(fitCheck(1000, 500, PHOTO_SPECS.banner)).toBe('small');
    expect(fitCheck(1600, 1200, PHOTO_SPECS.banner)).toBe('ratio');
    expect(fitCheck(1200, 1200, PHOTO_SPECS.collection)).toBe('ok');
    expect(fitCheck(1200, 1600, PHOTO_SPECS.collection)).toBe('ratio');
    expect(fitCheck(700, 700, PHOTO_SPECS.design)).toBe('small');
  });

  it('banner and collection are strict, designs are advice', () => {
    expect([PHOTO_SPECS.banner.strict, PHOTO_SPECS.collection.strict, PHOTO_SPECS.design.strict]).toEqual([true, true, false]);
  });

  it('crops the centre of a portrait photo into a wide frame, and clamps dragging', () => {
    // 1000x2000 photo, 400x200 frame: scale 0.4, shows the full width and 500 source px of height
    const v = { nw: 1000, nh: 2000, cw: 400, ch: 200, zoom: 1, ox: 0, oy: -300 };
    expect(sourceRect(v)).toEqual({ sx: 0, sy: 750, sw: 1000, sh: 500 });
    expect(clampOffset({ ...v, oy: 50 })).toEqual({ ox: 0, oy: 0 });
    expect(clampOffset({ ...v, oy: -9999 }).oy).toBe(200 - 2000 * 0.4);
    // zooming in 2x halves the area shown
    expect(sourceRect({ ...v, zoom: 2, ox: 0, oy: 0 })).toEqual({ sx: 0, sy: 0, sw: 500, sh: 250 });
  });
});
