import { AX, MARK_PATHS } from './components/AntarixsBrand';

/** The Antarixs mark as a PNG data URL (for the PDF footer), drawn from the same paths as the on-screen logo. */
export function antarixsMarkPng(px = 128, onDark = false): string | null {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    g.scale(px / 100, px / 100);
    const lam = g.createLinearGradient(10, 0, 95, 100);
    lam.addColorStop(0, AX.blue);
    lam.addColorStop(0.55, onDark ? '#8a4dff' : AX.purple);
    lam.addColorStop(1, onDark ? '#c9b2ff' : AX.deep);
    g.fillStyle = lam;
    g.fill(new Path2D(MARK_PATHS.lambda));
    g.fillStyle = AX.spark;
    g.fill(new Path2D(MARK_PATHS.swoosh));
    g.fill(new Path2D(MARK_PATHS.spark));
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
