#!/usr/bin/env node
/**
 * Bulk-loads photos into a merchant's catalogue as separate products, one photo each, creating the category
 * (collection) first when it does not exist. Generic across merchants: everything comes from the environment.
 *
 * Two modes:
 *   1. EXCEL MODE  (EXCEL_FILE set): walks every category in the "Upload" sheet of antarixs_upload.xlsx (columns
 *      Collection, Category, Design Name, Photo File, Photo Path, Gross Wt (g)), creates the ones that are missing and adds
 *      their photos with the sheet's weights. Categories/photos that are already added are ignored.
 *   2. FOLDER MODE (PHOTOS_DIR + CATEGORY_NAME set): one folder of photos into one category, weights from
 *      <PHOTOS_DIR>/weights.json (or random ones for photos without a weight, unless REQUIRE_REAL_WEIGHTS=true).
 *
 * Required (both modes):  BASE_URL (e.g. https://bhakti.antarixs.com), ADMIN_EMAIL, ADMIN_PASSWORD
 * Folder mode also:       PHOTOS_DIR, CATEGORY_NAME
 *
 * Optional:
 *   TITLE_FROM_FILENAME  folder mode: name each design after its file, e.g. '4101-LNS   390.jpg' -> 'LNS 390' (the number
 *                        before the first '-' is dropped). Always on in Excel mode. Otherwise "<TITLE_PREFIX> 01", "02", ...
 *   TITLE_PREFIX         default: the category name
 *   REQUIRE_REAL_WEIGHTS "true": skip photos with no real weight instead of giving them a random one (always on in Excel mode)
 *   SKIP_DUPLICATE_TITLES  default on with TITLE_FROM_FILENAME: skip a photo when a design with the same name already exists
 *                        in the category or earlier in this run. "false" turns it off.
 *   SQUARE_PAD           "true": pad each photo with white to 1:1 before upload (nothing is cropped or scaled)
 *   CREATE_CATEGORY      default on: create a missing category. "false": stop (folder mode) / skip it (Excel mode).
 *   CATEGORY_TAG         tag for newly created categories. Default: the store tag named like the sheet's Collection (Excel mode),
 *                        else the store's first tag.
 *   LIMIT                add at most N photos in total this run (LIMIT=1 for a one-photo test)
 *   MAX_CATEGORIES       Excel mode: stop after N categories that had photos to add (e.g. 5 per run)
 *   PURITY               default "22K 916"
 *   WEIGHTS_FILE, USE_REAL_WEIGHTS, MIN_WEIGHT_G, MAX_WEIGHT_G   folder mode weight options
 *   BULK_IMPORT_KEY      the server's BULK_IMPORT_KEY secret: its import calls then skip the rate limit (see server/bulkImport.ts)
 *   REQUEST_DELAY_MS     minimum gap between API calls, default 1000 (the app allows ~66 calls a minute per IP; a 429 is waited out and retried)
 *   DRY_RUN              "true" to preview without creating anything
 *
 * Re-running is safe: each photo imported is recorded in import-ledger.json beside it and never imported twice.
 *
 * Usage (PowerShell), Excel mode:
 *   $env:BASE_URL="https://bhakti.antarixs.com"; $env:ADMIN_EMAIL="..."; $env:ADMIN_PASSWORD="...";
 *   $env:EXCEL_FILE="C:\Users\you\Desktop\pdm_downloader\antarixs_upload.xlsx"; $env:SQUARE_PAD="true";
 *   $env:LIMIT="1"; $env:DRY_RUN="true"; node scripts/bulk-import-products.mjs
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
const EXCEL_FILE = process.env.EXCEL_FILE?.trim();
const PHOTOS_DIR = EXCEL_FILE ? '' : requireEnv('PHOTOS_DIR');
const CATEGORY_NAME = EXCEL_FILE ? '' : requireEnv('CATEGORY_NAME');
const PURITY = process.env.PURITY?.trim() || '22K 916';
const MIN_WEIGHT_G = Number(process.env.MIN_WEIGHT_G ?? 1);
const MAX_WEIGHT_G = Number(process.env.MAX_WEIGHT_G ?? 6);
const DRY_RUN = process.env.DRY_RUN === 'true';
const TITLE_FROM_FILENAME = Boolean(EXCEL_FILE) || process.env.TITLE_FROM_FILENAME === 'true';
const REQUIRE_REAL_WEIGHTS = Boolean(EXCEL_FILE) || process.env.REQUIRE_REAL_WEIGHTS === 'true';
const SKIP_DUPLICATE_TITLES = TITLE_FROM_FILENAME && process.env.SKIP_DUPLICATE_TITLES !== 'false';
const CREATE_CATEGORY = process.env.CREATE_CATEGORY !== 'false';
const SQUARE_PAD = process.env.SQUARE_PAD === 'true';
const LIMIT = Number(process.env.LIMIT ?? 0); // 0 = no limit
const MAX_CATEGORIES = Number(process.env.MAX_CATEGORIES ?? 0); // 0 = no limit

// The app allows 1000 API calls per 15 minutes per IP (about 66 a minute) and answers 429 beyond that. So calls are
// spaced out (REQUEST_DELAY_MS, default 1000 = at most 60 a minute), and a 429 is waited out and retried, not failed.
// With BULK_IMPORT_KEY (the same secret the server has in its BULK_IMPORT_KEY setting) the server exempts these import
// calls from the limit, so the default gap drops to 150 ms.
const BULK_IMPORT_KEY = process.env.BULK_IMPORT_KEY?.trim();
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? (BULK_IMPORT_KEY ? 150 : 1000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function api(apiPath, options = {}, token) {
  for (let attempt = 1; ; attempt++) {
    const wait = lastCall + REQUEST_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res;
    try {
      res = await fetch(`${BASE_URL}${apiPath}`, {
        ...options,
        headers: { ...(options.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(BULK_IMPORT_KEY ? { 'X-Bulk-Import-Key': BULK_IMPORT_KEY } : {}) }
      });
    } catch (err) {
      if (attempt >= 4) throw err;
      console.log(`  network error (${err.message}); retrying in 5s (${attempt}/3)`);
      await sleep(5000);
      continue;
    }
    if ((res.status === 429 || res.status === 503) && attempt < 6) {
      const seconds = Number(res.headers.get('retry-after') ?? res.headers.get('ratelimit-reset')) || 60;
      console.log(`  ${res.status} too many requests: waiting ${seconds}s, then retrying (${attempt}/5)`);
      await sleep((seconds + 2) * 1000);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 'error') {
      throw new Error(json.message || `${apiPath} failed with ${res.status}`);
    }
    return json;
  }
}

const randomWeight = () => parseFloat((MIN_WEIGHT_G + Math.random() * (MAX_WEIGHT_G - MIN_WEIGHT_G)).toFixed(3));
const pad = (n, width) => String(n).padStart(width, '0');

async function squarePad(bytes) {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true }); // apply EXIF rotation first
  if (info.width === info.height) return bytes;
  const side = Math.max(info.width, info.height);
  const dx = side - info.width;
  const dy = side - info.height;
  return sharp(data)
    .extend({ left: Math.floor(dx / 2), right: Math.ceil(dx / 2), top: Math.floor(dy / 2), bottom: Math.ceil(dy / 2), background: '#ffffff' })
    .toFormat(info.format, { quality: 95 })
    .toBuffer();
}

// '4101-LNS   390.jpg' -> 'LNS 390': extra spaces collapsed, the number before the first '-' dropped.
const stemOf = (file) => {
  const stem = path.basename(file, path.extname(file)).split(/\s+/).filter(Boolean).join(' ');
  return stem.replace(/^\d+\s*-\s*/, '') || stem;
};

// Which photos were already imported to this store, by file name, kept beside the photos. Titles can't serve for that:
// after dropping the leading number, different photos can share a title ('2711-CLR 723' and '6667-CLR 723').
const host = new URL(BASE_URL).host;
const ledgerFile = (dir) => path.join(dir, 'import-ledger.json');
const ledgerKey = (category) => `${host}|${category.toLowerCase()}`;
const readLedger = (dir) => (fs.existsSync(ledgerFile(dir)) ? JSON.parse(fs.readFileSync(ledgerFile(dir), 'utf-8')) : {});
function markImported(dir, category, file) {
  const all = readLedger(dir);
  (all[ledgerKey(category)] ??= []).push(file);
  fs.writeFileSync(ledgerFile(dir), JSON.stringify(all, null, 1));
}

// ---- Excel mode: read the "Upload" sheet of an .xlsx with no extra install (fflate ships with the app's dependencies) ----
const XML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const unxml = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

async function readUploadSheet(file) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const text = (name) => (zip[name] ? strFromU8(zip[name]) : '');
  const sheetTag = [...text('xl/workbook.xml').matchAll(/<sheet\s[^>]*>/g)].map((m) => attrsOf(m[0])).find((a) => a.name === 'Upload');
  if (!sheetTag) throw new Error(`No "Upload" sheet in ${file}`);
  const rel = [...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)].map((m) => attrsOf(m[0])).find((a) => a.Id === sheetTag['r:id']);
  const sheetPath = rel.Target.replace(/^\/?(xl\/)?/, 'xl/');
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
  );
  const rows = [];
  for (const row of text(sheetPath).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrsOf(c[1]);
      const col = a.r.replace(/\d+/g, '');
      const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = c[2]?.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      cells[col] = a.t === 's' ? shared[Number(v)] : a.t === 'inlineStr' ? unxml(inline ?? '') : a.t === 'str' ? unxml(v ?? '') : v === undefined ? undefined : Number(v);
    }
    rows.push(cells);
  }
  const header = rows[0] ?? {};
  const col = (name) => Object.keys(header).find((k) => header[k] === name);
  const need = ['Collection', 'Category', 'Photo File', 'Photo Path', 'Gross Wt (g)'].map((n) => [n, col(n)]);
  const missing = need.filter(([, c]) => !c).map(([n]) => n);
  if (missing.length) throw new Error(`The Upload sheet is missing column(s): ${missing.join(', ')}`);
  const [cCollection, cCategory, cFile, cPath, cWt] = need.map(([, c]) => c);
  return rows
    .slice(1)
    .filter((r) => r[cCategory] && r[cPath])
    .map((r) => ({ collection: String(r[cCollection]), category: String(r[cCategory]).trim(), file: String(r[cFile]), abs: String(r[cPath]), weight: Number(r[cWt]) }));
}

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

/** The work list: [{ name, collection, items: [{ file, abs, weight? }] }], one entry per category. */
async function buildJobs() {
  if (EXCEL_FILE) {
    const rows = await readUploadSheet(EXCEL_FILE);
    const byCategory = new Map();
    for (const r of rows) {
      if (!byCategory.has(r.category.toLowerCase())) byCategory.set(r.category.toLowerCase(), { name: r.category, collection: r.collection, items: [] });
      byCategory.get(r.category.toLowerCase()).items.push({ file: r.file, abs: r.abs, weight: r.weight });
    }
    console.log(`${EXCEL_FILE}: ${rows.length} photo(s) in ${byCategory.size} categor${byCategory.size === 1 ? 'y' : 'ies'}.`);
    return [...byCategory.values()];
  }
  const files = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => CONTENT_TYPES[path.extname(f).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length === 0) {
    console.error(`No .jpg/.jpeg/.png/.webp files found in ${PHOTOS_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} photo(s) in ${PHOTOS_DIR}.`);
  const weights = loadWeightsManifest();
  return [{ name: CATEGORY_NAME, collection: '', items: files.map((f) => ({ file: f, abs: path.join(PHOTOS_DIR, f), weight: weights[f] })) }];
}

async function main() {
  const jobs = await buildJobs();

  console.log(`Signing in as ${ADMIN_EMAIL}...`);
  const login = await api('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const token = login.sessionToken;
  const { data: categories } = await api('/api/categories', {}, token);
  const { data: tags } = await api('/api/tags', {}, token);
  const uploadPhoto = async (item) => {
    const contentType = CONTENT_TYPES[path.extname(item.file).toLowerCase()];
    let bytes = fs.readFileSync(item.abs);
    if (SQUARE_PAD) bytes = await squarePad(bytes);
    return api('/api/admin/photos', { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes }, token);
  };

  let budget = LIMIT || Infinity; // photos still allowed this run
  let categoriesWorked = 0;
  let created = 0;
  const failed = [];

  for (const job of jobs) {
    if (budget <= 0 || (MAX_CATEGORIES && categoriesWorked >= MAX_CATEGORIES)) break;
    const dir = path.dirname(job.items[0].abs);
    let items = job.items.filter((it) => fs.existsSync(it.abs) && CONTENT_TYPES[path.extname(it.file).toLowerCase()]);
    const label = `"${job.name}"`;

    // 1. photos already imported earlier
    const done = new Set(readLedger(dir)[ledgerKey(job.name)] ?? []);
    items = items.filter((it) => !done.has(it.file));

    // 2. category: use the existing one, or create it (below) when it is missing
    const existingCategory = categories.find((c) => c.name.toLowerCase() === job.name.toLowerCase());
    const createCategory = !existingCategory;
    const categoryName = existingCategory?.name ?? job.name;
    let categoryTag;
    if (createCategory) {
      if (!CREATE_CATEGORY) {
        console.log(`Category ${label} does not exist and CREATE_CATEGORY=false: skipped.`);
        if (!EXCEL_FILE) {
          console.error(`Categories in this catalogue:\n - ${categories.map((c) => c.name).join('\n - ')}`);
          process.exit(1);
        }
        continue;
      }
      categoryTag = process.env.CATEGORY_TAG?.trim() || tags.find((t) => t.toLowerCase() === job.collection.toLowerCase()) || tags[0];
      if (!tags.includes(categoryTag)) {
        console.error(`Tag "${categoryTag}" is not one of this store's tags. Choose one with CATEGORY_TAG:\n - ${tags.join('\n - ')}`);
        process.exit(1);
      }
    }

    // 3. duplicate rule: skip a photo whose design name already exists in this category (or earlier in this run)
    if (SKIP_DUPLICATE_TITLES) {
      const taken = new Set();
      if (!createCategory) {
        for (let offset = 0; ; offset += 500) {
          const page = await api(`/api/products?category=${encodeURIComponent(categoryName)}&limit=500&offset=${offset}`, {}, token);
          page.data.forEach((p) => taken.add(String(p.title).trim().toLowerCase()));
          if (!page.hasMore) break;
        }
      }
      const before = items.length;
      items = items.filter((it) => {
        const key = stemOf(it.file).toLowerCase();
        if (taken.has(key)) return false;
        taken.add(key);
        return true;
      });
      if (before !== items.length) console.log(`  ${label}: ${before - items.length} photo(s) skipped, a design with the same name already exists.`);
    }

    // 4. a photo needs a real weight (always in Excel mode: the sheet only lists photos whose weight was read)
    if (REQUIRE_REAL_WEIGHTS) {
      const before = items.length;
      items = items.filter((it) => typeof it.weight === 'number' && Number.isFinite(it.weight));
      if (before !== items.length) console.log(`  ${label}: ${before - items.length} photo(s) have no real weight and are skipped.`);
    }

    if (items.length > budget) items = items.slice(0, budget);
    if (items.length === 0) {
      console.log(`${label}: nothing to add.`);
      continue;
    }
    categoriesWorked++;

    // 5. stop before starting if the plan's photo cap cannot fit this category
    const { data: ent } = await api('/api/entitlements');
    if (ent.limits.photos !== null && ent.usage.photos + items.length > ent.limits.photos) {
      console.error(`Plan "${ent.effectivePlan}" allows ${ent.limits.photos} photos; ${ent.usage.photos} are in use, so only ${ent.limits.photos - ent.usage.photos} more fit but ${items.length} were requested for ${label}. Lower LIMIT/MAX_CATEGORIES or free up space.`);
      process.exit(1);
    }

    const titleFor = (it, i) => (TITLE_FROM_FILENAME ? stemOf(it.file) : `${(process.env.TITLE_PREFIX?.trim() || job.name).replace(/\s+$/, '')} ${pad(i + 1, String(items.length).length)}`);
    const weightFor = (it) => (typeof it.weight === 'number' && Number.isFinite(it.weight) ? it.weight : randomWeight());
    const width = String(items.length).length;
    console.log(`\n${label}: ${createCategory ? `will be created under tag "${categoryTag}"` : `exists (${existingCategory.designCount} designs)`}; ${items.length} photo(s) to add. Photos in use: ${ent.usage.photos}${ent.limits.photos !== null ? ' of ' + ent.limits.photos : ''}.`);

    if (DRY_RUN) {
      items.slice(0, 5).forEach((it, i) => console.log(`  ${pad(i + 1, width)}. ${titleFor(it, i)}  <-  ${it.file}  ${typeof it.weight === 'number' ? it.weight.toFixed(3) + 'g (real)' : '(random)'}`));
      if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
      budget -= items.length;
      continue;
    }

    // A new category needs a cover photo: the first photo is uploaded once and shared by the cover and its own design,
    // so the cover does not use up a second slot of the plan's photo cap.
    const uploaded = new Map();
    if (createCategory) {
      try {
        const cover = await uploadPhoto(items[0]);
        await api('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: job.name, tag: categoryTag, image: cover.data.ref }) }, token);
        uploaded.set(items[0].file, cover);
        categories.push({ name: job.name, designCount: 0 });
        console.log(`  Created category ${label} (tag "${categoryTag}").`);
      } catch (err) {
        console.error(`  Could not create category ${label}: ${err.message}`);
        failed.push({ file: `(category ${job.name})`, message: err.message });
        continue;
      }
    }

    for (const [i, it] of items.entries()) {
      const tag = `${pad(i + 1, width)}/${items.length} ${it.file}`;
      try {
        const upload = uploaded.get(it.file) ?? (await uploadPhoto(it));
        const title = titleFor(it, i);
        const grossWt = weightFor(it);
        await api(
          '/api/products',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category: categoryName, purity: PURITY, grossWt, stoneWt: 0, images: [upload.data.ref] })
          },
          token
        );
        created++;
        budget--;
        markImported(dir, job.name, it.file);
        console.log(`  OK    ${tag}  ->  "${title}"  (${grossWt.toFixed(3)}g, ${typeof it.weight === 'number' ? 'real' : 'random'})`);
      } catch (err) {
        failed.push({ file: it.file, message: err.message });
        console.log(`  FAIL  ${tag}  ->  ${err.message}`);
      }
    }
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN: nothing was uploaded or created. ${categoriesWorked} categor${categoriesWorked === 1 ? 'y' : 'ies'} would be worked on.`);
    return;
  }
  console.log(`\nDone: ${created} created, ${failed.length} failed, ${categoriesWorked} categor${categoriesWorked === 1 ? 'y' : 'ies'} worked on.`);
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
