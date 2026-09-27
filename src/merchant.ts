import type { MerchantConfig } from '../server/merchant';

// The server embeds this merchant's config in index.html, so it is available synchronously on first paint.
function loadEmbeddedConfig(): MerchantConfig {
  const el = document.getElementById('merchant-config');
  if (!el?.textContent) throw new Error('Merchant configuration is missing from the page.');
  return JSON.parse(el.textContent) as MerchantConfig;
}

export const merchant: MerchantConfig = loadEmbeddedConfig();
