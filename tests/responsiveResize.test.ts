import { describe, expect, it } from 'vitest';
import { sourceRect, clampOffset } from '../shared/photoSpecs';
import { frameWidth, toFraction, toPx } from '../src/components/cropFrame';
import { cardY, needsScroll } from '../src/components/tourPlace';

describe('crop frame survives a resize', () => {
  it('sizes the frame to the window, at most 320px', () => {
    expect(frameWidth(1200)).toBe(320);
    expect(frameWidth(390)).toBe(320);
    expect(frameWidth(360)).toBe(296);
    expect(frameWidth(320)).toBe(256);
  });

  it('keeps the same source region when the frame goes from portrait width to landscape width and back', () => {
    for (const ratio of [1, 2]) {
      const nw = 3000, nh = 2000, zoom = 1.7;
      const at = (cw: number, off: { fx: number; fy: number }) => {
        const ch = cw / ratio;
        return sourceRect({ nw, nh, cw, ch, zoom, ...toPx(off, cw, ch) });
      };
      // the user panned to some place inside a 296px frame
      const cw0 = 296, ch0 = cw0 / ratio;
      const panned = clampOffset({ nw, nh, cw: cw0, ch: ch0, zoom, ox: -140, oy: -90 });
      const off = toFraction(panned, cw0, ch0);
      const before = at(cw0, off);
      for (const cw of [136, 256, 320]) {
        const after = at(cw, off);
        for (const k of ['sx', 'sy', 'sw', 'sh'] as const) expect(after[k]).toBeCloseTo(before[k], 6);
      }
    }
  });

  it('keeps a round logo (unclamped, zoomed out) in the same place relative to the frame', () => {
    const off = toFraction({ ox: 30, oy: -12 }, 300, 300);
    expect(toPx(off, 200, 200)).toEqual({ ox: 20, oy: -8 });
  });
});

describe('tour placement uses measured sizes', () => {
  const vh = 800;
  it('scrolls when the element is under the top bar or leaves no room for the card', () => {
    expect(needsScroll({ top: 50, bottom: 100 }, vh, 84, 230)).toBe(true);
    expect(needsScroll({ top: 200, bottom: 400 }, vh, 84, 230)).toBe(false);
    expect(needsScroll({ top: 200, bottom: 548 }, vh, 84, 230)).toBe(false); // 800 - (230 + 14 + 8) = 548 is the limit
    expect(needsScroll({ top: 200, bottom: 549 }, vh, 84, 230)).toBe(true);
  });

  it('a taller card or a shorter screen (rotation) moves the limit', () => {
    expect(needsScroll({ top: 100, bottom: 300 }, 800, 84, 230)).toBe(false);
    expect(needsScroll({ top: 100, bottom: 300 }, 390, 60, 230)).toBe(true);
    expect(needsScroll({ top: 100, bottom: 300 }, 800, 84, 600)).toBe(true);
  });

  it('puts the card under the window, above it when there is no room, centred when nothing is lit', () => {
    expect(cardY({ top: 100, height: 40, width: 100 }, 200, vh)).toBe(154);
    expect(cardY({ top: 600, height: 40, width: 100 }, 200, vh)).toBe(386);
    expect(cardY({ top: 0, height: 0, width: 0 }, 200, vh)).toBe(300);
    // a short landscape screen: no room either side, so the card stays on screen at the top
    expect(cardY({ top: 20, height: 300, width: 100 }, 250, 390)).toBe(8);
  });
});
