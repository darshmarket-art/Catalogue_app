import { expect, test } from '@playwright/test';
import { STORE_ID } from './env';
import { seedRole, settle } from './screens';

// Buyer catalogue: the open design can be stepped through ALL designs (not only the first loaded page), and the whole card opens it.
// The catalogue is faked at 60 designs (one real design as the template) so the shared harness store, and its screenshots, stay as they are.
const TOTAL = 60;
const PAGE = 24;

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('swiping steps through every design, loading more pages on the way', async ({ page }) => {
  await seedRole(page, 'buyer');
  let template: Record<string, unknown> | undefined;
  const asked: number[] = [];

  // Only the catalogue's own page-sized query is faked; everything else (home, sessions, shortlist) is real.
  await page.route(/\/api\/v1\/products\?/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('limit') !== String(PAGE)) return route.continue();
    if (!template) {
      const real = await route.fetch({ url: `${url.origin}${url.pathname}?limit=1&offset=0` });
      template = (await real.json()).data[0];
    }
    // The client sends no cursor for the first page, then the cursor this handler returned.
    const from = Number(url.searchParams.get('cursor') ?? 0);
    asked.push(from);
    const to = Math.min(from + PAGE, TOTAL);
    const data = Array.from({ length: to - from }, (_, i) => ({ ...template, id: `swipe-${from + i}`, sku: `SWP-${from + i}`, title: `Design ${from + i + 1}` }));
    await route.fulfill({ json: { data, total: TOTAL, hasMore: to < TOTAL, cursor: String(to), cursorAfter: 'after' } });
  });

  await page.goto(`/?store=${STORE_ID}`);
  await page.locator('[data-tab="catalogue"]').click();
  await page.getByTestId('product-card').first().waitFor();
  await settle(page);
  await page.getByTestId('product-card').first().locator('button').first().click();
  await expect(page.getByText(`Design 1 of ${TOTAL}`)).toBeVisible();

  // The 24th design is where it used to stop. Walk to the 50th, so a second page has to arrive too.
  for (let n = 2; n <= 50; n++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(`Design ${n} of ${TOTAL}`)).toBeVisible();
  }
  expect(asked.length).toBeGreaterThanOrEqual(3); // 0, 24, 48

  // And back again.
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText(`Design 49 of ${TOTAL}`)).toBeVisible();
});

test('the title under a photo opens the design, not only the photo', async ({ page }) => {
  await seedRole(page, 'buyer');
  await page.goto(`/?store=${STORE_ID}`);
  await page.locator('[data-tab="catalogue"]').click();
  await page.getByTestId('product-card').first().waitFor();
  await settle(page);
  await page.locator('.em-card-t').first().click();
  await page.getByTestId('product-gallery').waitFor();
});
