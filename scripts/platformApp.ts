// The Antarixs onboarding app: a native shell that opens app.antarixs.com, where store owners create a store and get its address.
// Pure helpers for scripts/build-platform-app.ts and its test. The store apps are separate (scripts/storeApp.ts).
import { MARK_PATHS } from '../src/components/AntarixsBrand.tsx';

export const PLATFORM_APP_ID = 'com.antarixs.app';
export const PLATFORM_APP_NAME = 'Antarixs';

/** https://app.<base domain>; the server sends "/" on to the welcome page. */
export function platformUrl(baseDomain: string): string {
  const d = baseDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) throw new Error(`Invalid base domain "${baseDomain}"`);
  return `https://app.${d}`;
}

/** From the Antarixs Logo Kit artifact ("On deep tile (app icon)"): the mark's gradient stops, the spark yellow and the Deep icon tile. */
export const LOGO_KIT = { tile: '#1A0B4D', sky: '#7CC4FF', purple: '#6100F0', violet: '#2B0A7A', spark: '#F3E35A', sparkLight: '#FFF6A8' };

/**
 * Launcher icon art, as in the kit: the mark centred on the Deep tile. The mark spans x 8..92, y 8..91 (centre 50, 49.5);
 * scaled to about 59% of the tile so round and adaptive masks do not cut the comet tail.
 */
export function platformIconSvg(): string {
  const k = LOGO_KIT;
  const scale = 0.7;
  const tx = (50 - 50 * scale).toFixed(2);
  const ty = (50 - 49.5 * scale).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
<defs>
<linearGradient id="gl" x1="0.1" y1="0" x2="0.95" y2="1"><stop offset="0" stop-color="${k.sky}"/><stop offset="0.55" stop-color="${k.purple}"/><stop offset="1" stop-color="${k.violet}"/></linearGradient>
<linearGradient id="gs" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.spark}"/><stop offset="1" stop-color="${k.sparkLight}"/></linearGradient>
</defs>
<rect width="100" height="100" fill="${k.tile}"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">
<path d="${MARK_PATHS.lambda}" fill="url(#gl)"/><path d="${MARK_PATHS.swoosh}" fill="url(#gs)"/><path d="${MARK_PATHS.spark}" fill="${k.spark}"/>
</g></svg>`;
}
