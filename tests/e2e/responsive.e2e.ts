import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { HARD_FLOOR, MIN_INPUT_PX, MIN_TARGET, MIN_TEXT_PX, PRIMARY_CONTROLS, runAudits } from './audits';
import { REPORT_ONLY, STRICT_TARGETS, STRICT_TEXT, outDir } from './env';
import { SCREENS, seedRole, settle } from './screens';
import type { ComboResult } from './teardown';

// CSS px. Phones, landscape phones, a foldable (344x882, Galaxy Fold cover screen), tablets and a laptop.
const SIZES: Array<[number, number]> = [[320, 568], [360, 640], [390, 844], [412, 915], [430, 932], [844, 390], [915, 412], [344, 882], [673, 841], [768, 1024], [1024, 768], [1024, 1366], [1280, 800]];
const SCALES = [100, 200];

/**
 * 200% text is emulated by scaling the root font size. This only moves what is sized in rem/em: the app is written mostly in px, so at
 * this stage 200% changes little. Real Android WebView font scale (Settings > Display > Font size) also reaches only rem/em text,
 * which is what Phase 3 adds; this run is the baseline for that.
 */
const scaleCss = (scale: number) => `html{font-size:${scale}%}`;

for (const [width, height] of SIZES) {
  test.describe(`${width}x${height}`, () => {
    // Touch and the mobile viewport rules for everything up to a tablet; only the laptop is a plain desktop window.
    test.use({ viewport: { width, height }, isMobile: width <= 1024, hasTouch: width <= 1024 });
    for (const scale of SCALES) {
      for (const screen of SCREENS) {
        const id = `${screen.role}-${screen.id}-${width}x${height}-${scale}`;
        test(id, async ({ page }) => {
          test.fixme(Boolean(screen.fixme), screen.fixme);
          const parts = path.join(outDir(), '.parts');
          fs.mkdirSync(parts, { recursive: true });
          const base = { id, role: screen.role, screen: screen.id, size: `${width}x${height}`, scale };
          const write = (r: ComboResult) => fs.writeFileSync(path.join(parts, `${id}.json`), JSON.stringify(r));

          await seedRole(page, screen.role);
          try {
            await screen.open(page);
          } catch (e) {
            // A screen that cannot be reached at some size is itself a finding; a broken harness is not hidden by it in strict runs.
            await page.screenshot({ path: path.join(outDir(), `${id}-UNREACHABLE.png`) }).catch(() => {});
            write({ ...base, status: 'unreachable', reason: String(e instanceof Error ? e.message : e).split('\n')[0] });
            if (!REPORT_ONLY()) throw e;
            return;
          }
          if (scale !== 100) await page.addStyleTag({ content: scaleCss(scale) });
          await settle(page);

          await page.screenshot({ path: path.join(outDir(), `${screen.role}-${screen.id}-${width}x${height}-${scale}.png`) });
          // The audit focuses every field in one go: bars that fade out for the keyboard must be in their end state by the time it looks (screenshot is already taken).
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
          const audits = await page.evaluate(runAudits, { width, clip: scale >= 200, minTarget: MIN_TARGET, hardFloor: HARD_FLOOR, minText: MIN_TEXT_PX, minInput: MIN_INPUT_PX, primary: PRIMARY_CONTROLS });
          write({ ...base, status: 'ok', audits });

          const short = (list: Array<{ selector: string }>) => list.slice(0, 5).map((o) => o.selector).join(', ');
          if (!REPORT_ONLY()) {
            expect.soft(audits.overflow.over || audits.overflow.cutOff, `horizontal overflow: scrollWidth ${audits.overflow.scrollWidth} vs ${width}; ${short(audits.overflow.offenders)}`).toBe(false);
            expect.soft(audits.coveredInputs, `inputs covered by a fixed or sticky bar, or off screen: ${short(audits.coveredInputs)}`).toEqual([]);
            // Phase 3a: text fields are at least 16px (iOS zoom), and the main controls have a 44px target.
            expect.soft(audits.smallInputs, `fields under ${MIN_INPUT_PX}px: ${short(audits.smallInputs)}`).toEqual([]);
            const mainTargets = audits.tapTargets.offenders.filter((o) => o.primary);
            expect.soft(mainTargets, `main controls under ${MIN_TARGET}x${MIN_TARGET}: ${short(mainTargets)}`).toEqual([]);
          }
          if (STRICT_TARGETS()) expect.soft(audits.tapTargets.offenders, `tap targets under ${MIN_TARGET}x${MIN_TARGET}: ${short(audits.tapTargets.offenders)}`).toEqual([]);
          if (STRICT_TEXT()) {
            expect.soft(audits.smallText, `text under ${MIN_TEXT_PX}px: ${short(audits.smallText)}`).toEqual([]);
            expect.soft(audits.clippedText, `clipped text: ${short(audits.clippedText)}`).toEqual([]);
          }
        });
      }
    }
  });
}
