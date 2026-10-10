// Prepares the Antarixs onboarding app (see scripts/platformApp.ts). After `npx cap add android`, run with --icons.
//   BASE_DOMAIN=antarixs.com npx tsx scripts/build-platform-app.ts --icons
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LAUNCHER_SIZES } from './storeApp.ts';
import { PLATFORM_APP_ID, PLATFORM_APP_NAME, platformIconSvg, platformUrl } from './platformApp.ts';

if (process.argv.includes('--icons')) {
  const res = path.resolve('android/app/src/main/res');
  fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true }); // Android 8+ would prefer this xml over our PNGs
  const src = Buffer.from(platformIconSvg());
  for (const [d, px] of Object.entries(LAUNCHER_SIZES))
    for (const n of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'])
      await sharp(src).resize(px, px).png().toFile(path.join(res, `mipmap-${d}`, `${n}.png`));
  console.log('Antarixs launcher icons written.');
  process.exit(0);
}

const url = platformUrl(process.env.BASE_DOMAIN ?? 'antarixs.com');
const lines = [`PLATFORM_APP=1`, `APP_ID=${PLATFORM_APP_ID}`, `APP_NAME=${PLATFORM_APP_NAME}`, `PLATFORM_URL=${url}`];
console.log(lines.join('\n'));
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, lines.join('\n') + '\n');
