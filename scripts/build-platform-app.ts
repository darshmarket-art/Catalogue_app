// Prepares the Antarixs onboarding app (see scripts/platformApp.ts). After `npx cap add android`, run with --icons:
// it patches the generated Android shell (keyboard, edge to edge, splash colour) and writes the launcher icons.
//   BASE_DOMAIN=antarixs.com npx tsx scripts/build-platform-app.ts --icons
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LAUNCHER_SIZES, patchAndroidShell, writeAdaptiveIcon } from './storeApp.ts';
import { PLATFORM_APP_ID, PLATFORM_APP_NAME, PLATFORM_GROUND, PLATFORM_ICON_BOX_DP, PLATFORM_ICON_TILE, platformForegroundSvg, platformIconSvg, platformUrl } from './platformApp.ts';

if (process.argv.includes('--icons')) {
  patchAndroidShell(path.resolve('android'), PLATFORM_GROUND.light, PLATFORM_GROUND.night);
  const res = path.resolve('android/app/src/main/res');
  const src = Buffer.from(platformIconSvg());
  // Android 7 and older, and launchers that ignore the adaptive layers, use these full tiles.
  for (const [d, px] of Object.entries(LAUNCHER_SIZES))
    for (const n of ['ic_launcher', 'ic_launcher_round'])
      await sharp(src).resize(px, px).png().toFile(path.join(res, `mipmap-${d}`, `${n}.png`));
  // Android 8+: the template's mipmap-anydpi-v26 xml, with the tile as background and the mark as foreground inside the safe zone.
  await writeAdaptiveIcon(res, Buffer.from(platformForegroundSvg()), PLATFORM_ICON_TILE, PLATFORM_ICON_BOX_DP);
  console.log('Antarixs Android shell patched and launcher icons written.');
  process.exit(0);
}

const url = platformUrl(process.env.BASE_DOMAIN ?? 'antarixs.com');
const lines = [`PLATFORM_APP=1`, `APP_ID=${PLATFORM_APP_ID}`, `APP_NAME=${PLATFORM_APP_NAME}`, `PLATFORM_URL=${url}`];
console.log(lines.join('\n'));
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, lines.join('\n') + '\n');
