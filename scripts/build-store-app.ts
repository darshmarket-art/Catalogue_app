// Prepares one store's native app. Env: STORE_ID (required), API_BASE (live API; or STORE_JSON = export-store.ts file).
//   STORE_ID=acme API_BASE=https://... npx tsx scripts/build-store-app.ts
// Writes merchants/<id>/merchant.json + icons, and prints KEY=VALUE lines (also appended to $GITHUB_ENV when set).
// After `npx cap add android`, run with --icons: it patches the generated Android shell (keyboard, edge to edge, splash colour)
// and writes launcher icons from the logo (default icon if no usable logo).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LAUNCHER_SIZES, cornerColor, merchantFileFor, merchantFrom, nativeBuildValues, patchAndroidShell, writeAdaptiveIcon } from './storeApp.ts';

const id = process.env.STORE_ID ?? 'bhakti';
const apiBase = process.env.API_BASE ?? process.env.VITE_API_BASE ?? '';
const dir = path.resolve('merchants', id);

async function logoBuffer(url?: string): Promise<Buffer | null> {
  try {
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await sharp(Buffer.from(await res.arrayBuffer())).png().toBuffer(); // throws on SVG/unreadable -> fallback
  } catch {
    return null;
  }
}

if (process.argv.includes('--icons')) {
  const res = path.resolve('android/app/src/main/res');
  const merchant = JSON.parse(fs.readFileSync(path.join(dir, 'merchant.json'), 'utf8'));
  patchAndroidShell(path.resolve('android'), nativeBuildValues(id, merchant, '').splashColor);
  const logo = await logoBuffer(merchant.brand.logoUrl);
  const fallback = path.join(dir, "icons/icon-512.png");
  const src = logo ?? (fs.existsSync(fallback) ? fs.readFileSync(fallback) : null);
  if (!src) console.log('No logo or icons/icon-512.png: keeping the default Capacitor icon.');
  else {
    // Android 7 and older, and launchers that ignore the adaptive layers, use these squares.
    for (const [d, px] of Object.entries(LAUNCHER_SIZES))
      for (const n of ['ic_launcher', 'ic_launcher_round'])
        await sharp(src).resize(px, px, { fit: 'contain', background: '#ffffff' }).png().toFile(path.join(res, `mipmap-${d}`, `${n}.png`));
    // Android 8+: the template's mipmap-anydpi-v26 xml, with the logo inside the safe zone over its own corner colour.
    await writeAdaptiveIcon(res, src, await cornerColor(src));
    console.log(`Launcher icons written from ${logo ? 'the store logo' : 'icons/icon-512.png'}.`);
  }
  process.exit(0);
}

let json: unknown;
// Bhakti is the founder store: its committed merchants/bhakti/merchant.json (and package name) is always used.
const local = id === 'bhakti' && !process.env.STORE_JSON;
if (local) json = JSON.parse(fs.readFileSync(path.join(dir, 'merchant.json'), 'utf8'));
else if (process.env.STORE_JSON) json = JSON.parse(fs.readFileSync(process.env.STORE_JSON, 'utf8'));
else if (apiBase) {
  const res = await fetch(`${apiBase.replace(/\/+$/, '')}/api/config?store=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/config?store=${id} -> ${res.status}`);
  json = await res.json();
} else throw new Error('Set API_BASE (live API) or STORE_JSON (export file)');
const merchant = merchantFrom(json);
const v = nativeBuildValues(id, merchant, apiBase);
fs.mkdirSync(dir, { recursive: true });
const file = local ? merchant : merchantFileFor(id, merchant);
if (!local) fs.writeFileSync(path.join(dir, 'merchant.json'), JSON.stringify(file, null, 2));
const lines = Object.entries({ ...v.env, APP_ID: file.android.packageName, APP_NAME: v.appName }).map(([k, x]) => `${k}=${x}`);
console.log(lines.join('\n'));
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, lines.join('\n') + '\n');
