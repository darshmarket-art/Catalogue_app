import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { MerchantConfig } from '../merchant';

/** The icon files a merchant keeps in merchants/<id>/icons/ (see scripts/make-icons.mjs). */
const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const ALLOWED = new Set<string>([...ICONS, 'apple-touch-icon.png']);

/**
 * Store icons (Apple touch icon) and the Android link file. There is deliberately no web app manifest:
 * install / "add to home screen" prompts are not offered, by decision.
 */
export function pwaRoutes(merchant: MerchantConfig, root: string = process.cwd()) {
  const router = Router();
  const iconDir = path.resolve(root, 'merchants', merchant.id, 'icons');
  const has = (file: string) => fs.existsSync(path.join(iconDir, file));

  // Explicit 404 so the SPA fallback never hands a browser an HTML "manifest".
  router.get('/manifest.webmanifest', (_req, res) => res.status(404).end());

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
