import { merchant } from './merchant';

/**
 * The public address of this store, as buyers should receive it: the subdomain on the platform domain, or ?store= on
 * localhost, the run.app address and preview hosts (where the host says nothing about the store).
 */
export function currentStoreUrl(loc: Pick<Location, 'origin' | 'hostname'> = window.location): string {
  const parts = loc.hostname.split('.');
  // A [store].domain.tld host already is the store's address.
  if (parts.length >= 3 && parts[0] === merchant.id && parts[0] !== 'www') return loc.origin;
  return `${loc.origin}/?store=${encodeURIComponent(merchant.id)}`;
}

/** The address without its scheme, for display. */
export const bareUrl = (url: string) => url.replace(/^https?:\/\//, '');
