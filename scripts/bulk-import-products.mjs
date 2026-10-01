#!/usr/bin/env node
/**
 * Bulk-loads a folder of photos into one existing category as separate products, one photo each.
 * Generic across merchants: nothing merchant-specific is hardcoded, everything comes from the environment.
 *
 * Required:
 *   BASE_URL       e.g. https://catalogue-app-456376852191.asia-south1.run.app
 *   ADMIN_EMAIL    an existing Owner/Staff admin
 *   ADMIN_PASSWORD
 *   PHOTOS_DIR     folder of .jpg/.jpeg/.png/.webp files, one per product
 *   CATEGORY_NAME  must already exist in that merchant's catalogue (case-insensitive match)
 *
 * Optional:
 *   TITLE_PREFIX   default: the category name. Products are named "<prefix> 01", "<prefix> 02", ...
 *   PURITY         default: "22K 916"
 *   USE_REAL_WEIGHTS  default: "true". Set to "false" to randomize every photo's weight even when a
 *                     weights manifest is present (e.g. reusing the same photos for a different category).
 *   WEIGHTS_FILE   a {filename: grossWt} JSON manifest, e.g. from scripts/extract-weights.mjs.
 *                  Default: "<PHOTOS_DIR>/weights.json" if it exists. A photo missing from the manifest
 *                  (or with no manifest at all, or USE_REAL_WEIGHTS=false) gets a random weight instead.
 *   MIN_WEIGHT_G   default: 1
 *   MAX_WEIGHT_G   default: 6
 *   PRICE_MODE     "weight" (default) | "fixed" | "on_request"
 *   DRY_RUN        "true" to preview without creating anything
 *
 * Usage (PowerShell):
 *   $env:BASE_URL="https://..."; $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="...";
 *   $env:PHOTOS_DIR="C:\Users\you\Desktop\design"; $env:CATEGORY_NAME="PDM Ladies Ring";
 *   $env:DRY_RUN="true"; node scripts/bulk-import-products.mjs
 */
import fs from 'fs';
import path from 'path';

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const BASE_URL = requireEnv('BASE_URL').replace(/\/$/, '');
const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
const PHOTOS_DIR = requireEnv('PHOTOS_DIR');
const CATEGORY_NAME = requireEnv('CATEGORY_NAME');
const PURITY = process.env.PURITY?.trim() || '22K 916';
const MIN_WEIGHT_G = Number(process.env.MIN_WEIGHT_G ?? 1);
const MAX_WEIGHT_G = Number(process.env.MAX_WEIGHT_G ?? 6);
const PRICE_MODE = process.env.PRICE_MODE?.trim() || 'weight';
const TITLE_PREFIX = (process.env.TITLE_PREFIX?.trim() || CATEGORY_NAME).replace(/\s+$/, '');
const DRY_RUN = process.env.DRY_RUN === 'true';

async function api(path, options = {}, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || `${path} failed with ${res.status}`);
  }
  return json;
}

const randomWeight = () => parseFloat((MIN_WEIGHT_G + Math.random() * (MAX_WEIGHT_G - MIN_WEIGHT_G)).toFixed(3));
const pad = (n, width) => String(n).padStart(width, '0');

function loadWeightsManifest() {
  if (process.env.USE_REAL_WEIGHTS === 'false') {
    console.log('USE_REAL_WEIGHTS=false: every photo gets a random weight, ignoring any weights manifest.');
    return {};
  }
  const file = process.env.WEIGHTS_FILE?.trim() || path.join(PHOTOS_DIR, 'weights.json');
  if (!fs.existsSync(file)) return {};
  console.log(`Using real weights from ${file} where available; other photos get a random weight.`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

async function main() {
  const files = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => CONTENT_TYPES[path.extname(f).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.error(`No .jpg/.jpeg/.png/.webp files found in ${PHOTOS_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} photo(s) in ${PHOTOS_DIR}.`);

  console.log(`Signing in as ${ADMIN_EMAIL}...`);
  const login = await api('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const token = login.sessionToken;

  const { data: categories } = await api('/api/categories', {}, token);
  const category = categories.find((c) => c.name.toLowerCase() === CATEGORY_NAME.toLowerCase());
  if (!category) {
    console.error(`No category named "${CATEGORY_NAME}". Categories in this catalogue:\n - ${categories.map((c) => c.name).join('\n - ')}`);
    process.exit(1);
  }
  console.log(`Category: "${category.name}" (currently ${category.designCount} designs).`);

  const weights = loadWeightsManifest();
  const weightFor = (file) => (typeof weights[file] === 'number' ? weights[file] : randomWeight());
  const realCount = files.filter((f) => typeof weights[f] === 'number').length;

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing will be uploaded or created. Preview:');
    const width = String(files.length).length;
    files.forEach((f, i) => {
      const known = typeof weights[f] === 'number';
      console.log(`  ${pad(i + 1, width)}. ${TITLE_PREFIX} ${pad(i + 1, width)}  <-  ${f}  ${known ? weights[f].toFixed(3) + 'g (real)' : '(random)'}`);
    });
    console.log(
      `\n${files.length} product(s) would be created in "${category.name}", purity ${PURITY}, price mode "${PRICE_MODE}".` +
        ` ${realCount} would use a real weight from the manifest, ${files.length - realCount} a random ${MIN_WEIGHT_G}-${MAX_WEIGHT_G}g weight.`
    );
    return;
  }

  let created = 0;
  const failed = [];
  const width = String(files.length).length;

  for (const [i, file] of files.entries()) {
    const label = `${pad(i + 1, width)}/${files.length} ${file}`;
    try {
      const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
      const bytes = fs.readFileSync(path.join(PHOTOS_DIR, file));
      const upload = await api('/api/admin/photos', { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes }, token);

      const title = `${TITLE_PREFIX} ${pad(i + 1, width)}`;
      const grossWt = weightFor(file);
      await api(
        '/api/products',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            category: category.name,
            purity: PURITY,
            grossWt,
            stoneWt: 0,
            priceMode: PRICE_MODE,
            images: [upload.data.ref]
          })
        },
        token
      );
      created++;
      const source = typeof weights[file] === 'number' ? 'real' : 'random';
      console.log(`  OK    ${label}  ->  "${title}"  (${grossWt.toFixed(3)}g, ${source})`);
    } catch (err) {
      failed.push({ file, message: err.message });
      console.log(`  FAIL  ${label}  ->  ${err.message}`);
    }
  }

  console.log(`\nDone: ${created} created, ${failed.length} failed out of ${files.length}.`);
  if (failed.length > 0) {
    console.log('Failures:');
    failed.forEach((f) => console.log(` - ${f.file}: ${f.message}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
