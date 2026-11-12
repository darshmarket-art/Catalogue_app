import { useSyncExternalStore } from 'react';

const root = () => document.documentElement;
const sub = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(root(), { attributes: true, attributeFilter: ['data-mx-theme'] });
  return () => mo.disconnect();
};

/**
 * Noir is more than a palette: it is Maison's immersive layout (full-screen chapters on Home, a gallery of categories, editorial tag and
 * collection pages). The other looks keep the layout they had. The look that is on screen is the data-mx-theme attribute on <html> (App sets it
 * for buyers and takes it off on the owner's console), so the markup this hook switches and the CSS under html[data-mx-theme="noir"] always agree.
 */
export const useImmersive = (): boolean => useSyncExternalStore(sub, () => root().dataset.mxTheme === 'noir');
