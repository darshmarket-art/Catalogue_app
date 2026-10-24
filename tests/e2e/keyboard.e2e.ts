import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { HARD_FLOOR, MIN_TARGET, MIN_TEXT_PX, runAudits } from './audits';
import { STORE_ID, outDir } from './env';
import { SCREENS, seedRole, settle } from './screens';
import type { Role } from './screens';

/**
 * The on-screen keyboard, as far as Playwright can show it: the window is made shorter after the screen is open, which is what the Android app does
 * (adjustResize: the WebView shrinks above the keyboard). What it cannot show: a real IME, interactive-widget, Chrome's visual-viewport-only resize,
 * iOS. Every field on the screen is focused in the short window; none may sit under a bar or outside the window.
 */
const WINDOWS: Array<{ name: string; open: [number, number]; short: [number, number] }> = [
  { name: 'portrait', open: [360, 640], short: [360, 340] },
  { name: 'small-portrait', open: [320, 568], short: [320, 300] },
  { name: 'landscape', open: [844, 390], short: [844, 200] }
];

const enterPortal = async (page: Page) => {
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByRole('button', { name: /Enter the portal/ }).click();
};
const fromScreen = (id: string) => SCREENS.find((s) => s.id === id)!.open;
const SCREENS_UNDER_TEST: Array<{ id: string; role: Role; open: (page: Page) => Promise<void> }> = [
  { id: 'phone-step', role: 'guest', open: async (page) => { await enterPortal(page); await page.locator('input[type=tel]').waitFor(); } },
  { id: 'otp-step', role: 'guest', open: fromScreen('otp-step') },
  { id: 'admin-login', role: 'guest', open: async (page) => { await enterPortal(page); await page.getByTestId('buyer-admin-signin-link').click(); await page.getByTestId('admin-email-input').waitFor(); } },
  { id: 'signup', role: 'guest', open: fromScreen('signup') },
  { id: 'signup-code', role: 'guest', open: fromScreen('signup-code') },
  { id: 'new-product', role: 'owner', open: fromScreen('new-product') },
  { id: 'orders-cart', role: 'buyer', open: fromScreen('orders-cart') }
];

test.use({ isMobile: true, hasTouch: true });

for (const w of WINDOWS) {
  for (const screen of SCREENS_UNDER_TEST) {
    test(`keyboard-${screen.id}-${w.name}`, async ({ page }) => {
      await page.setViewportSize({ width: w.open[0], height: w.open[1] });
      await seedRole(page, screen.role);
      await screen.open(page);
      await settle(page);
      await page.setViewportSize({ width: w.short[0], height: w.short[1] });
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
      await page.waitForTimeout(200);
      const dir = path.join(outDir(), 'keyboard');
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${screen.id}-${w.name}.png`) });
      const audits = await page.evaluate(runAudits, { width: w.short[0], clip: false, minTarget: MIN_TARGET, hardFloor: HARD_FLOOR, minText: MIN_TEXT_PX });
      expect(audits.coveredInputs, `fields under a bar or outside the ${w.short.join('x')} window: ${audits.coveredInputs.map((o) => `${o.selector} (${o.coveredBy || 'off screen'})`).join(', ')}`).toEqual([]);
    });
  }
}

// What the bars do while typing, and that they come back.
test('keyboard-bars-step-aside-and-return', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seedRole(page, 'buyer');
  await fromScreen('orders-cart')(page);
  await settle(page);
  await expect(page.locator('.em-tabs')).toBeVisible();
  await page.locator('#em-order-note').focus();
  await expect(page.locator('html')).toHaveAttribute('data-typing', '');
  await expect(page.locator('.em-tabs')).toBeHidden();
  await expect(page.locator('.em-dock')).toBeHidden();
  await page.locator('#em-order-note').blur();
  await expect(page.locator('html')).not.toHaveAttribute('data-typing', '');
  await expect(page.locator('.em-tabs')).toBeVisible();
  await expect(page.locator('.em-dock')).toBeVisible();
});

// Landscape cut-outs cannot be emulated, so the insets are faked on :root: with 44 px each side nothing on the screens may reach into the 44 px strips.
test('insets-keep-content-out-of-the-cutout', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await seedRole(page, 'buyer');
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('home-collection').first().waitFor();
  await page.addStyleTag({ content: ':root{--sal:44px!important;--sar:44px!important}' });
  await settle(page);
  const intrusions = await page.evaluate(() => {
    const out: string[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('.em-top-in > *, .em-tab, .em-fab-btn, .em-page > .em-pad')) {
      const r = e.getBoundingClientRect();
      if (r.width && (r.left < 44 - 0.5 || r.right > window.innerWidth - 44 + 0.5)) out.push(`${e.className} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out;
  });
  expect(intrusions).toEqual([]);
});
