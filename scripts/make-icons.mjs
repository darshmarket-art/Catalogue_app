// Makes the app icons for one merchant: node scripts/make-icons.mjs <merchantId>
//
// Output goes to merchants/<id>/icons/. The icons are the brand's first letter on the merchant's own colour, so a
// new merchant gets something sensible straight away. To use a real logo instead, drop your own PNGs in that folder
// with the same names (icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png) and do not run this again.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const id = process.argv[2];
if (!id || !/^[a-z0-9-]{2,40}$/.test(id)) {
  console.error('Usage: node scripts/make-icons.mjs <merchantId>');
  process.exit(1);
}

const dir = path.resolve('merchants', id);
const config = JSON.parse(fs.readFileSync(path.join(dir, 'merchant.json'), 'utf8'));
const colours = config.theme?.colors ?? {};
const background = colours['on-surface'] ?? colours['brown-darkest'] ?? '#1d1511';
const letterColour = colours['primary-fixed-dim'] ?? '#d98c7a';
const display = config.theme?.fonts?.display ?? 'DM Serif Display';
const letter = config.brand.name.trim().charAt(0).toUpperCase();

// "Maskable" icons are cropped to a circle or squircle by Android, so the letter stays in the middle 60%.
const svg = (size, { rounded, letterScale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${background}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="${display}, Georgia, 'Times New Roman', serif"
        font-size="${size * letterScale}" font-weight="700" fill="${letterColour}">${letter}</text>
</svg>`;

const jobs = [
  ['icon-192.png', 192, { rounded: true, letterScale: 0.62 }],
  ['icon-512.png', 512, { rounded: true, letterScale: 0.62 }],
  ['icon-maskable-512.png', 512, { rounded: false, letterScale: 0.42 }],
  ['apple-touch-icon.png', 180, { rounded: false, letterScale: 0.55 }]
];

fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
for (const [name, size, opts] of jobs) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(path.join(dir, 'icons', name));
  console.log(`merchants/${id}/icons/${name}`);
}
