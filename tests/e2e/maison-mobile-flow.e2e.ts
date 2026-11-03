import { expect, test, type Page } from '@playwright/test';
import { STORE_ID, sessions } from './env';
import { seedRole, settle } from './screens';

/**
 * Maison on phones (docs/swarovski-flow/v0-mobile.html): the banner fills the first screen under a floating masthead, Shop by tag cards, a tag page,
 * the collection page and the design page; the masthead's search and menu. At 1440 the desktop page is the one it was (no phone pieces).
 * Screenshots: docs/qa-maison/mobile-flow/. Serial: the store's layout is shared server state.
 */
test.describe.configure({ mode: 'serial' });
const OUT = 'docs/qa-maison/mobile-flow';

const open = async (page: Page, w: number, h: number) => {
  await page.setViewportSize({ width: w, height: h });
  const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID }, data: { layout: 'maison' } });
  expect(put.ok()).toBe(true);
  await seedRole(page, 'buyer', 'maison');
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('mx-hero').waitFor();
};
const floating = (page: Page) => page.locator('.mx-top').evaluate((el) => el.hasAttribute('data-float'));

test('phone 390: home -> tag -> collection -> design, Back, search, menu', async ({ page }) => {
  await open(page, 390, 844);
  await page.getByTestId('mx-tag-card').first().waitFor();

  for (const theme of ['ivory', 'midnight', 'garnet']) {
    await page.evaluate((th) => (th === 'ivory' ? delete document.documentElement.dataset.mxTheme : (document.documentElement.dataset.mxTheme = th)), theme);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await page.screenshot({ path: `${OUT}/m390-home-${theme}.png` });
    await page.getByTestId('mx-shop-by').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/m390-shopby-${theme}.png` });
  }
  await page.evaluate(() => delete document.documentElement.dataset.mxTheme);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // the banner fills the first screen and starts under the masthead; the masthead floats over it, the Maison fonts are in
  const hero = await page.locator('.mx-hero-media').first().boundingBox();
  expect(hero!.y).toBeLessThanOrEqual(1);
  expect(Math.abs(hero!.height - 844)).toBeLessThan(2);
  expect(await floating(page)).toBe(true);
  // the wide banner is cropped to the screen, so it asks for a photo about twice the screen height wide (sharp, not a 480px one stretched)
  const heroSrc = await page.locator('.mx-hero img').first().evaluate((i: HTMLImageElement) => (i.srcset ? i.currentSrc : 'no-srcset'));
  if (heroSrc !== 'no-srcset') expect(heroSrc).toMatch(/[?&]w=1440/);
  expect(await page.evaluate(() => document.fonts.check('500 16px Jost') && document.fonts.check('500 16px "Cormorant Garamond"'))).toBe(true);
  // no intro, no split banners, no 3-bar tag index on phones
  await expect(page.locator('.mx-intro, .mx-split, [data-testid="mx-menu"]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => floating(page)).toBe(false);

  // Shop by: one card per tag with collections, 3:4, two across
  const api = await page.request.get('/api/v1/categories', { headers: { Authorization: `Bearer ${sessions().buyer.token}`, 'X-Store': STORE_ID } });
  const cats = ((await api.json()).data ?? []) as Array<{ tag: string; designCount: number }>;
  const tags = new Set(cats.filter((c) => c.designCount > 0).map((c) => c.tag));
  await expect(page.getByTestId('mx-tag-card')).toHaveCount(tags.size);
  const card = await page.getByTestId('mx-tag-card').first().locator('.mx-card-im').boundingBox();
  expect(Math.abs(card!.width / card!.height - 0.75)).toBeLessThan(0.02);
  expect(card!.width).toBeGreaterThan(180);

  // tag page
  const tagName = (await page.getByTestId('mx-tag-card').first().locator('.mx-card-nm').textContent())!.trim();
  await page.getByTestId('mx-tag-card').first().click();
  await expect(page.getByTestId('mx-tag-page')).toBeVisible();
  await expect(page.getByTestId('mx-back')).toBeVisible();
  expect(await floating(page)).toBe(true);
  await settle(page);
  await page.screenshot({ path: `${OUT}/m390-tag.png` });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/m390-tag-scrolled.png` });

  // collection page (offset sizes: the tiles may still be in their entrance animation)
  const colName = (await page.getByTestId('mx-col-card').first().locator('.mx-card-nm').textContent())!.trim();
  await page.getByTestId('mx-col-card').first().click();
  await expect(page.getByTestId('mx-col-bar')).toBeVisible();
  await expect(page.getByTestId('collection-current')).toHaveText(colName);
  await page.locator('.mx-ptile').first().waitFor();
  await settle(page);
  const tiles = await page.locator('.mx-ptile').evaluateAll((els) => els.slice(0, 2).map((el) => { const f = el.querySelector('.mx-pframe') as HTMLElement; const t = el as HTMLElement; return { x: t.offsetLeft, r: t.offsetLeft + t.offsetWidth, ratio: f.offsetWidth / f.offsetHeight }; }));
  expect(Math.abs(tiles[0].ratio - 1)).toBeLessThan(0.05);
  if (tiles[1]) expect(Math.round(tiles[1].x - tiles[0].r)).toBe(6);
  await page.screenshot({ path: `${OUT}/m390-collection.png` });

  // design page
  const sku = await page.locator('.mx-ptile').first().getAttribute('data-sku');
  await page.locator('.mx-ptile .mx-hit').first().click();
  await expect(page.locator('.mx-pd')).toBeVisible();
  await expect(page.getByTestId('mx-pd-eyebrow')).toContainText('/');
  await expect(page.locator('.mx-pd .mx-acc')).toContainText(sku!);
  await settle(page);
  await page.screenshot({ path: `${OUT}/m390-design.png` });

  // Back walks out the way we came: design -> collection -> tag page -> Home
  await page.getByTestId('mx-back').click();
  await expect(page.locator('.mx-pd')).toHaveCount(0);
  await page.getByTestId('mx-back').click();
  await expect(page.getByTestId('mx-tag-page')).toBeVisible();
  await expect(page.locator('.mx-tagp-intro h1')).toHaveText(new RegExp(tagName, 'i'));
  await page.getByTestId('mx-back').click();
  await expect(page.getByTestId('mx-shop-by')).toBeVisible();
  await expect(page.getByTestId('mx-tag-page')).toHaveCount(0);

  // search slides down under the masthead and searches the designs
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId('mx-search').click();
  await expect(page.getByTestId('mx-search-input')).toBeFocused();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/m390-search-open.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('.mx-srch.on')).toHaveCount(0);
  await page.getByTestId('mx-search').click();
  await page.getByTestId('mx-search-input').fill(sku!);
  await page.getByTestId('mx-search-input').press('Enter');
  await expect(page.getByTestId('collection-current')).toContainText(sku!);
  await expect(page.locator(`.mx-ptile[data-sku="${sku}"]`)).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/m390-search-results.png` });

  // the menu opens the profile panel from the left
  await page.getByTestId('mx-profile').click();
  await expect(page.getByTestId('mx-profile-panel')).toBeVisible();
  await expect(page.getByTestId('mx-shortlist-row')).toBeVisible();
  await page.waitForTimeout(500);
  const panel = await page.locator('.mx-drawer').boundingBox();
  expect(panel!.x).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${OUT}/m390-menu.png` });
});

test('desktop 1440: the page is the desktop one, no phone pieces', async ({ page }) => {
  await open(page, 1440, 900);
  await settle(page);
  await page.screenshot({ path: `${OUT}/d1440-home.png` });
  await expect(page.getByTestId('mx-menu')).toBeVisible();
  await expect(page.locator('.mx-nav')).toBeVisible();
  await expect(page.locator('.mx-intro')).toHaveCount(1);
  await expect(page.locator('[data-testid="mx-shop-by"], [data-testid="mx-search"], .mx-srch')).toHaveCount(0);
  expect(await floating(page)).toBe(false);
  const hero = await page.locator('.mx-hero').boundingBox();
  expect(Math.abs(hero!.width / hero!.height - 2)).toBeLessThan(0.05);
  const head = await page.locator('.mx-top').boundingBox();
  expect(hero!.y).toBeGreaterThanOrEqual(head!.height - 1);
  await page.getByTestId('mx-menu').click();
  await page.getByTestId('mx-all-designs').click();
  await page.locator('.mx-ptile').first().waitFor();
  await expect(page.locator('.mx-cat-head, .mx-fbar, [data-testid="layout-switch"]')).toHaveCount(3);
  await expect(page.getByTestId('mx-col-bar')).toHaveCount(0);
  await settle(page);
  await page.screenshot({ path: `${OUT}/d1440-catalogue.png` });
});
