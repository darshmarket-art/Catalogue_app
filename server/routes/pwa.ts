import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { MerchantConfig } from '../merchant';

/** The icon files a merchant keeps in merchants/<id>/icons/ (see scripts/make-icons.mjs). */
const ICONS = [
  { file: 'icon-192.png', sizes: '192x192', purpose: 'any' },
  { file: 'icon-512.png', sizes: '512x512', purpose: 'any' },
  { file: 'icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }
] as const;
const ALLOWED = new Set<string>([...ICONS.map((i) => i.file), 'apple-touch-icon.png']);

/**
 * What makes the site installable as an app (home-screen icon, full screen) and lets it be wrapped for the Play Store.
 * Everything comes from the merchant's config, so each merchant's app has its own name, colours and icon.
 */
export function pwaRoutes(merchant: MerchantConfig, root: string = process.cwd()) {
  const router = Router();
  const iconDir = path.resolve(root, 'merchants', merchant.id, 'icons');
  const has = (file: string) => fs.existsSync(path.join(iconDir, file));
  const surface = merchant.theme.colors.surface ?? '#fbf4f1';

  router.get('/manifest.webmanifest', (_req, res) => {
    res.type('application/manifest+json').json({
      id: '/',
      name: merchant.brand.name,
      short_name: merchant.brand.name.length > 12 ? merchant.brand.name.split(' ')[0] : merchant.brand.name,
      description: merchant.brand.description,
      lang: 'en-IN',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: surface,
      theme_color: surface,
      categories: ['shopping', 'business'],
      icons: ICONS.filter((i) => has(i.file)).map((i) => ({ src: `/pwa/${i.file}`, sizes: i.sizes, type: 'image/png', purpose: i.purpose }))
    });
  });

  router.get('/pwa/:file', (req, res) => {
    if (!ALLOWED.has(req.params.file) || !has(req.params.file)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400').type('png').sendFile(path.join(iconDir, req.params.file));
  });

  // Proves to Android that the Play Store app and this site belong together. Filled in once the app is signed.
  router.get('/.well-known/assetlinks.json', (_req, res) => {
    const android = merchant.android;
    res.json(
      android && android.sha256CertFingerprints.length > 0
        ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: android.packageName, sha256_cert_fingerprints: android.sha256CertFingerprints } }]
        : []
    );
  });

  return router;
}
