// The Antarixs onboarding app: a native shell that opens app.antarixs.com, where store owners create a store and get its address.
// Pure helpers for scripts/build-platform-app.ts and its test. The store apps are separate (scripts/storeApp.ts).
import { MARK_COLORS, antarixsIconSvg, markSvgInner } from '../shared/antarixsMark.ts';

export const PLATFORM_APP_ID = 'com.antarixs.app';
export const PLATFORM_APP_NAME = 'Antarixs';

/** https://app.<base domain>; the server sends "/" on to the welcome page. */
export function platformUrl(baseDomain: string): string {
  const d = baseDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) throw new Error(`Invalid base domain "${baseDomain}"`);
  return `https://app.${d}`;
}

/** Launcher icon art: the approved Antarixs mark centred on the deep tile (shared/antarixsMark.ts, the same art as the favicon). */
export const platformIconSvg = () => antarixsIconSvg(false);

/** Adaptive icon foreground: the mark alone (the tile is the adaptive background), drawn in its own 0..100 box. */
export const platformForegroundSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${markSvgInner('ic')}</svg>`;
export const PLATFORM_ICON_TILE = MARK_COLORS.tile;
/** The mark's feet reach 57.7 of its 100 units from the centre; at 57dp per 100 units that is 32.9dp, inside the 33dp radius that every mask shape keeps. */
export const PLATFORM_ICON_BOX_DP = 57;

/** Window and splash ground, the same as the Antarixs site (src/components/platform.css --bg, light and dark). */
export const PLATFORM_GROUND = { light: '#f5f4f9', night: '#110e1d' };
