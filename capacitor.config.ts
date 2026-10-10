import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// PLATFORM_APP=1: the Antarixs onboarding app. It opens app.antarixs.com (PLATFORM_URL) and shows offline.html when it cannot.
// Only that host stays inside the app; the new store's address opens in the browser. See scripts/build-platform-app.ts.
function platformConfig(url: string): CapacitorConfig {
  return {
    appId: 'com.antarixs.app',
    appName: 'Antarixs',
    webDir: 'dist',
    server: { url, androidScheme: 'https', allowNavigation: [new URL(url).host], errorPath: 'offline.html' }
  };
}

function storeConfig(): CapacitorConfig {
  const m = JSON.parse(readFileSync(`merchants/${process.env.MERCHANT ?? 'bhakti'}/merchant.json`, 'utf8'));
  return {
    appId: m.android.packageName,
    appName: m.brand.name, // MERCHANT=<store> is set by scripts/build-store-app.ts
    webDir: 'dist',
    server: { androidScheme: 'https' }
  };
}

const config: CapacitorConfig = process.env.PLATFORM_APP === '1' ? platformConfig(process.env.PLATFORM_URL ?? 'https://app.antarixs.com') : storeConfig();

export default config;
