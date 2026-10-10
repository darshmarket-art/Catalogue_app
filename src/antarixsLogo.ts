import { MARK_COLORS, MARK_PATHS, SWOOSH_GRADIENT, markGradient } from '../shared/antarixsMark';

/** Draws the Antarixs mark into a 0..100 box at the context's current transform. One drawing for every canvas (PDF footer, share card). */
export function drawAntarixsMark(g: CanvasRenderingContext2D, dark = false) {
  const m = markGradient(dark);
  const lam = g.createLinearGradient(0, m.y1, 0, m.y2);
  for (const [o, c] of m.stops) lam.addColorStop(o, c);
  g.fillStyle = lam;
  g.fill(new Path2D(MARK_PATHS.lambda));
  const sw = g.createLinearGradient(SWOOSH_GRADIENT.x1, SWOOSH_GRADIENT.y1, SWOOSH_GRADIENT.x2, SWOOSH_GRADIENT.y2);
  for (const [o, c] of SWOOSH_GRADIENT.stops) sw.addColorStop(o, c);
  g.fillStyle = sw;
  g.fill(new Path2D(MARK_PATHS.swoosh));
  g.fillStyle = MARK_COLORS.spark;
  g.fill(new Path2D(MARK_PATHS.spark));
}

/** The Antarixs mark as a PNG data URL (for the PDF footer), drawn from the same paths as the on-screen logo. */
export function antarixsMarkPng(px = 128, onDark = false): string | null {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    g.scale(px / 100, px / 100);
    drawAntarixsMark(g, onDark);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
