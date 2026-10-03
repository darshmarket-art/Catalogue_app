import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

const m = JSON.parse(readFileSync(`merchants/${process.env.MERCHANT ?? 'bhakti'}/merchant.json`, 'utf8'));

const config: CapacitorConfig = {
  appId: m.android.packageName,
  appName: m.brand.name,
  webDir: 'dist',
  server: { androidScheme: 'https' }
};

export default config;
