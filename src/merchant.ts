import type { MerchantConfig } from '../server/merchant';
import { addHindi } from './i18n';

// The server embeds this merchant's config in index.html, so it is available synchronously on first paint.
function loadEmbeddedConfig(): MerchantConfig {
  const el = document.getElementById('merchant-config');
  if (!el?.textContent) throw new Error('Merchant configuration is missing from the page.');
  return JSON.parse(el.textContent) as MerchantConfig;
}

export const merchant: MerchantConfig = loadEmbeddedConfig();
// Buyers who pick Hindi see the store's own Hindi for its wording.
addHindi(merchant.hindi);

/**
 * The logo's address for <img> and the PDF. An uploaded logo is served by the store at /brand/logo; inside the Antarixs app
 * the page is app.<domain>, which only knows the store from ?store=.
 */
export const logoSrc = (): string => {
  const u = merchant.brand.logoUrl;
  return u.startsWith('/') ? `${u}&store=${encodeURIComponent(merchant.id)}` : u;
};

/** After an upload: every BrandMark on screen switches to the new logo. */
export const setLogo = (logoUrl: string) => {
  merchant.brand.logoUrl = logoUrl;
  window.dispatchEvent(new Event('brand-logo'));
};
