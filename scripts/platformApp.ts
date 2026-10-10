// The Antarixs onboarding app: a native shell that opens app.antarixs.com, where store owners create a store and get its address.
// Pure helpers for scripts/build-platform-app.ts and its test. The store apps are separate (scripts/storeApp.ts).
import { antarixsIconSvg } from '../shared/antarixsMark.ts';

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
