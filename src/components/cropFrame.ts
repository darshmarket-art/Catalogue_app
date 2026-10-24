/** Width of the crop frame for a window this wide: at most 320px, and always inside the dialog's padding. */
export const frameWidth = (windowWidth: number) => Math.min(320, windowWidth - 64);

/**
 * The photo's position inside the crop frame as a fraction of the frame (not pixels). The frame keeps its ratio, so when it gets bigger or smaller
 * (rotation, unfold, split screen) the same fractions put the photo on the same part of the frame, and the saved crop stays the same region.
 */
export interface FrameOffset {
  fx: number;
  fy: number;
}

export const toPx = (o: FrameOffset, cw: number, ch: number) => ({ ox: o.fx * cw, oy: o.fy * ch });
export const toFraction = (p: { ox: number; oy: number }, cw: number, ch: number): FrameOffset => ({ fx: p.ox / cw, fy: p.oy / ch });
