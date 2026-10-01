#!/usr/bin/env node
/**
 * Reads the printed weight off a folder of supplier catalogue photos (top-left corner, e.g. "WT : 4.300"
 * or a bare "11.200") using OCR, and writes a JSON manifest {filename: grossWt} for bulk-import-products.mjs
 * to consume. Nothing is uploaded here; this only reads photos and writes a manifest for you to check.
 *
 * Required:
 *   PHOTOS_DIR   folder of .jpg/.jpeg/.png/.webp files
 *
 * Optional:
 *   OUT_FILE     default: <PHOTOS_DIR>/weights.json
 *   CROP_WIDTH_PCT   default: 30 (left % of the image width to OCR)
 *   CROP_HEIGHT_PCT  default: 28 (top % of the image height to OCR)
 *
 * Usage:
 *   $env:PHOTOS_DIR="C:\Users\you\Desktop\design"; node scripts/extract-weights.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const CONTENT_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const PHOTOS_DIR = requireEnv('PHOTOS_DIR');
const OUT_FILE = process.env.OUT_FILE?.trim() || path.join(PHOTOS_DIR, 'weights.json');
const CROP_WIDTH_PCT = Number(process.env.CROP_WIDTH_PCT ?? 30);
const CROP_HEIGHT_PCT = Number(process.env.CROP_HEIGHT_PCT ?? 28);

// A weight always has a decimal point (e.g. 4.300, 11.20); reference codes like "LR 1512" or "PS 694" do not,
// so requiring one tells the two apart without needing to understand the surrounding words. OCR sometimes
// reads a small printed "." as ":", "," or just a gap, so those are accepted and normalised below. The gap
// form is only accepted when the second group is exactly 3 digits (the usual gram precision), so a bare
// reference code like "PS 632" is never mistaken for a weight. (?<!\d)/(?!\d) stop a match from starting or
// ending mid-number, so the tail of one printed number (e.g. the "000" in "16000") can never be stitched
// together with a different number OCR found on the next line.
const WEIGHT_PATTERN = /(?<!\d)(\d{1,3})[.:,](\d{1,3})(?!\d)|(?<!\d)(\d{1,3})[ \t](\d{3})(?!\d)/g;
function normaliseWeight(match) {
  const [, a, b, c, d] = match;
  return a !== undefined ? parseFloat(`${a}.${b}`) : parseFloat(`${c}.${d}`);
}

async function ocrWeight(worker, file) {
  const meta = await sharp(file).metadata();
  const width = Math.round((meta.width ?? 700) * (CROP_WIDTH_PCT / 100));
  const height = Math.round((meta.height ?? 500) * (CROP_HEIGHT_PCT / 100));
  const crop = await sharp(file)
    .extract({ left: 0, top: 0, width: Math.min(width, meta.width ?? width), height: Math.min(height, meta.height ?? height) })
    .greyscale()
    .normalise()
    .resize({ width: width * 3 }) // upscaling small printed text improves OCR accuracy
    .png()
    .toBuffer();

  const {
    data: { text }
  } = await worker.recognize(crop);

  const matches = [...text.matchAll(WEIGHT_PATTERN)];
  return { raw: text.trim().replace(/\s+/g, ' '), candidates: matches };
}

async function main() {
  const files = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => CONTENT_EXTS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.error(`No .jpg/.jpeg/.png/.webp files found in ${PHOTOS_DIR}`);
    process.exit(1);
  }
  console.log(`Reading the weight off ${files.length} photo(s) in ${PHOTOS_DIR}...\n`);

  const worker = await createWorker('eng');
  const manifest = {};
  const unclear = [];

  for (const [i, file] of files.entries()) {
    const { raw, candidates } = await ocrWeight(worker, path.join(PHOTOS_DIR, file));
    const weight = candidates.length > 0 ? normaliseWeight(candidates[0]) : null;
    const ok = weight !== null && weight > 0 && weight < 1000;

    if (ok) {
      manifest[file] = weight;
      console.log(`  ${String(i + 1).padStart(3, '0')}/${files.length}  ${weight.toFixed(3).padStart(8)} g   ${file}`);
    } else {
      unclear.push({ file, raw });
      console.log(`  ${String(i + 1).padStart(3, '0')}/${files.length}  ${'?'.padStart(8)}     ${file}   (read: "${raw.slice(0, 40)}")`);
    }
  }
  await worker.terminate();

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${Object.keys(manifest).length} weight(s) to ${OUT_FILE}.`);

  if (unclear.length > 0) {
    console.log(`\n${unclear.length} photo(s) had no clear weight and are NOT in the manifest:`);
    unclear.forEach((u) => console.log(` - ${u.file}`));
    console.log('bulk-import-products.mjs will assign these a random weight instead, unless you fill them in by hand in the manifest file.');
  }
}

main().catch((err) => {
  console.error('Weight extraction failed:', err.message);
  process.exit(1);
});
