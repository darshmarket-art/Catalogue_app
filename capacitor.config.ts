import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// Both apps draw edge to edge (index.html has viewport-fit=cover). SystemBars passes the bar sizes to the page as env(safe-area-inset-*)
// and as --safe-area-inset-* (src/index.css reads both into --sat and --sab). "css" is the default today; Capacitor 9 changes the
// default to "native", which does not set the variables, so it is pinned here. The "cover" hint stops a layout jump on first paint.
// The soft keyboard needs no @capacitor/keyboard: SystemBars pads the window by the keyboard height, so the page shrinks above it.
// Manifest, theme and MainActivity patches for this live in scripts/storeApp.ts (patchAndroidShell).
const systemBars = { insetsHandling: 'css', initialViewportFitValueHint: 'cover' } as const;

// PLATFORM_APP=1: the Antarixs onboarding app. It opens app.antarixs.com (PLATFORM_URL) and shows offline.html when it cannot.
// The app host and the stores under it ([store].<base domain>) stay inside the app, so the remembered store opens in the app. See scripts/build-platform-app.ts.
function platformConfig(url: string): CapacitorConfig {
  return {
    appId: 'com.antarixs.app',
    appName: 'Antarixs',
    webDir: 'dist',
    server: { url, androidScheme: 'https', allowNavigation: [new URL(url).host, '*.' + new URL(url).host.replace(/^app./, '')], errorPath: 'offline.html' },
    plugins: { SystemBars: systemBars }
  };
}

function storeConfig(): CapacitorConfig {
  const m = JSON.parse(readFileSync(`merchants/${process.env.MERCHANT ?? 'bhakti'}/merchant.json`, 'utf8'));
  return {
    appId: m.android.packageName,
    appName: m.brand.name, // MERCHANT=<store> is set by scripts/build-store-app.ts
    webDir: 'dist',
    server: { androidScheme: 'https' },
    plugins: { SystemBars: systemBars }
  };
}

const config: CapacitorConfig = process.env.PLATFORM_APP === '1' ? platformConfig(process.env.PLATFORM_URL ?? 'https://app.antarixs.com') : storeConfig();

export default config;
