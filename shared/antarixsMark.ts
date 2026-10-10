// The Antarixs mark, one definition for the app, the server (favicons) and the build scripts. Pure data and strings, no React.
// Drawn on a 0..100 box and centred on x=50, the A's centre line, which the spark also sits on. Source: the approved
// "Antarixs Logo Revision" artifact (the corrected mark), with the thin gap around the yellow line cut into the purple
// shape so canvas, SVG and PNG renderers all draw it the same way with no mask.
export const MARK_PATHS = {
  lambda: 'M50 31.4 L75.4 69.8 L52.8 61.6 L91.6 84.4 L95.6 84.4 L50 15.4 L13.8 70.2 L26.8 66.4 Z M8.4 84.4 L47.2 61.6 L46.5 61.8 L5.6 84.4 Z',
  swoosh: 'M44.8 62 L12.8 71.2 L3.8 84.6 Z',
  spark: 'M50 42.4 C50.5 45.8 51.5 47 55.7 48.4 C51.5 49.8 50.5 51 50 54.4 C49.5 51 48.5 49.8 44.3 48.4 C48.5 47 49.5 45.8 50 42.4 Z'
};

export const MARK_COLORS = { spark: '#F3E35A', tile: '#1A0B4D' };

/** A runs sky-blue at the apex to purple at the feet (userSpace, vertical). `dark` keeps the lower end light enough for a near-black ground. */
export const markGradient = (dark = false) => ({
  y1: 15.4,
  y2: 84.4,
  stops: (dark
    ? [[0, '#5AD4FF'], [0.42, '#4AA8FF'], [0.72, '#8A5BFF'], [1, '#A98AFF']]
    : [[0, '#5AD4FF'], [0.42, '#3FA6FF'], [0.72, '#6A28F2'], [1, '#5A10E8']]) as Array<[number, string]>
});

/** The yellow line: pale at its tip by the centre, deeper at the foot. */
export const SWOOSH_GRADIENT = {
  x1: 44.8,
  y1: 62,
  x2: 3.8,
  y2: 84.6,
  stops: [[0, '#FFF6A8'], [1, '#F3D21A']] as Array<[number, string]>
};

const stopsSvg = (s: Array<[number, string]>) => s.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');

/** Gradients and shapes as one SVG fragment (ids carry `id` so several marks can share a page). Fill the 0..100 box. */
export function markSvgInner(id = 'ax', dark = false): string {
  const g = markGradient(dark);
  return (
    `<defs><linearGradient id="${id}-l" gradientUnits="userSpaceOnUse" x1="0" y1="${g.y1}" x2="0" y2="${g.y2}">${stopsSvg(g.stops)}</linearGradient>` +
    `<linearGradient id="${id}-s" gradientUnits="userSpaceOnUse" x1="${SWOOSH_GRADIENT.x1}" y1="${SWOOSH_GRADIENT.y1}" x2="${SWOOSH_GRADIENT.x2}" y2="${SWOOSH_GRADIENT.y2}">${stopsSvg(SWOOSH_GRADIENT.stops)}</linearGradient></defs>` +
    `<path d="${MARK_PATHS.lambda}" fill="url(#${id}-l)"/><path d="${MARK_PATHS.swoosh}" fill="url(#${id}-s)"/><path d="${MARK_PATHS.spark}" fill="${MARK_COLORS.spark}"/>`
  );
}

/** App/favicon icon: the mark on the deep tile. `rounded` for browser tabs; square for Android and Apple icons, which apply their own mask. */
export function antarixsIconSvg(rounded = false): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100"${rounded ? ' rx="22"' : ''} fill="${MARK_COLORS.tile}"/>` +
    `<g transform="translate(17 17) scale(0.66)">${markSvgInner('ic')}</g></svg>`
  );
}
