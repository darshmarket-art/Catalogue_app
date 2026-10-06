import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

/**
 * True on screens 1024px and wider (the same line the desktop styles in emergent.css use). Only for the few places where desktop needs a different
 * piece of the page rather than different styling, so that piece exists once, on the screen that shows it. Everything else is done with CSS alone.
 */
export const useDesktop = () =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
