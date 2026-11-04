import { expect, test } from '@playwright/test';

/** Desktop design page: photos stack down the left and the page scroll moves them, wherever the pointer is; the details never scroll on their own. */
import { STORE_ID } from './env';
import { seedRole } from './screens';
test('desktop design page: one page scroll moves the photos, details stay', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedRole(page, 'buyer', 'maison');
  await page.route('**/api/v1/products**', async (route) => { const r = await route.fetch(); const j = await r.json(); const fix = (p: any) => { const im = p.images?.[0] ?? p.image; if (im) p.images = [im, im, im]; return p; }; if (Array.isArray(j.data)) j.data = j.data.map(fix); else if (j.data?.items) j.data.items = j.data.items.map(fix); else if (j.data) fix(j.data); await route.fulfill({ response: r, json: j }); });
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('mx-menu').click();
  await page.getByTestId('mx-all-designs').click();
  await page.locator('.mx-hit').first().click();
  await page.locator('.mx-pd').waitFor();
  await page.waitForTimeout(800);
  const m = () => page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const r = (el: HTMLElement | null) => el && { st: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight, sl: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth };
    return { scroll: r(q('.mx-pd-scroll')), info: r(q('.mx-pd-info')), gal: r(q('.mx-gal')), imgs: document.querySelectorAll('.mx-gal > button').length, rail: !!q('.mx-rail') };
  });
  const s0 = await m();
  expect(s0.imgs).toBe(3);
  await page.mouse.move(400, 500); await page.mouse.wheel(0, 600); await page.waitForTimeout(500);
  const s1 = await m();
  expect(s1.scroll!.st).toBeGreaterThan(s0.scroll!.st);
  await page.mouse.move(1200, 500); await page.mouse.wheel(0, 600); await page.waitForTimeout(500);
  const s2 = await m();
  expect(s2.scroll!.st).toBeGreaterThan(s1.scroll!.st); // wheel over the details scrolls the page (photos), not the details
  expect(s2.info!.st).toBe(0);
  await page.locator('.mx-rail button').nth(2).click(); await page.waitForTimeout(900);
  await expect(page.locator('.mx-rail button.on')).toHaveAttribute('aria-label', 'Photo 3');
  await page.mouse.move(1200, 400); await page.mouse.wheel(0, -3000); await page.waitForTimeout(700);
  expect((await m()).scroll!.st).toBe(0);
  await expect(page.locator('.mx-rail button.on')).toHaveAttribute('aria-label', 'Photo 1');
});
