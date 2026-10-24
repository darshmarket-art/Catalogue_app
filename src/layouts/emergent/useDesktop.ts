import { useSyncExternalStore } from 'react';

/** The two width breakpoints of the layout. They must match the media queries in the CSS (min-width: 640px for tablet, min-width: 1024px for desktop). */
export const TABLET_MIN = 640;
export const DESKTOP_MIN = 1024;

/** Re-renders when a media query starts or stops matching (so a rotation or an unfold is picked up with no resize listener). */
const useMedia = (query: string) =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false
  );

/**
 * True on screens 1024px and wider (the same line the desktop styles in emergent.css use). Only for the few places where desktop needs a different
 * piece of the page rather than different styling, so that piece exists once, on the screen that shows it. Everything else is done with CSS alone.
 */
export const useDesktop = () => useMedia(`(min-width: ${DESKTOP_MIN}px)`);

/**
 * 'phone' below 640px, 'tablet' from 640px to 1023px, 'desktop' from 1024px. Follows the width available to the page, not the device or its
 * orientation, so a rotated phone, a folded-out phone and a split-screen tablet all land in the tier that matches the space they have.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';
export const useTier = (): Tier => {
  const desktop = useDesktop();
  const tablet = useMedia(`(min-width: ${TABLET_MIN}px)`);
  return desktop ? 'desktop' : tablet ? 'tablet' : 'phone';
};

/** True only in the tablet tier (640px to 1023px). */
export const useTablet = () => useTier() === 'tablet';

/** A list and its detail side by side needs height as well as width: below this a wide window (a phone on its side) keeps the detail as an overlay. Matches the min-height in emergent.css. */
export const PANE_MIN_H = 560;
/** True when the detail belongs in a pane beside the list: the tablet tier, and tall enough. */
export const usePane = () => useMedia(`(min-width: ${TABLET_MIN}px) and (max-width: ${DESKTOP_MIN - 0.02}px) and (min-height: ${PANE_MIN_H}px)`);
