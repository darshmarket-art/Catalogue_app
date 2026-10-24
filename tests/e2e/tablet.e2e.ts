import { expect, test, type Page } from '@playwright/test';
import { SCREENS, seedRole, settle } from './screens';

/**
 * The tablet tier (700px to 1023px: TABLET_MIN and DESKTOP_MIN in src/layouts/emergent/useDesktop.ts) and the phone layout beside it.
 * Cheap structural checks on the computed layout, not screenshots: the grid has four columns, the open design sits in a pane beside the grid,
 * the owner's shell is wider than the phone column, and a live resize keeps the open design. The full-matrix run (responsive.e2e.ts) covers the rest.
 */
const open = (id: string) => SCREENS.find((s) => s.id === id)!.open;
const columns = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe('tablet 768x1024', () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });

  test('buyer: four photo columns, and an open design shows in a pane beside the grid', async ({ page }) => {
    await seedRole(page, 'buyer');
    await open('catalogue-grid')(page);
    await settle(page);
    expect(await columns(page, '.em-grid')).toBe(4);

    await page.getByTestId('product-card').nth(1).locator('button').first().click();
    await page.getByTestId('product-gallery').waitFor();
    await settle(page);
    const grid = await box(page, '.em-grid');
    const detail = await box(page, '.em-pd');
    expect(detail.x, 'the design is to the right of the grid').toBeGreaterThanOrEqual(grid.x + grid.width);
    expect(detail.width).toBeLessThan(768 / 2 + 40);
    expect(await columns(page, '.em-grid'), 'the grid gives way: fewer columns beside the pane').toBeLessThan(4);
    expect(await page.locator('.em-pd-wrap').getAttribute('role'), 'a pane is not modal').toBe('region');
    expect(await page.evaluate(() => document.body.style.overflow), 'the list keeps scrolling').toBe('');
    expect(await page.locator('.em-sq.current').count(), 'the open design is marked in the grid').toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);

    // Back closes the design and the grid has its four columns again.
    await page.goBack();
    await page.getByTestId('product-gallery').waitFor({ state: 'detached' });
    await expect.poll(() => columns(page, '.em-grid')).toBe(4);
  });

  test('owner: a wide shell, tiles four across', async ({ page }) => {
    await seedRole(page, 'owner');
    await open('owner-hub')(page);
    await settle(page);
    expect((await box(page, '.em-page')).width).toBeGreaterThan(640);
    expect(await columns(page, '.em-tiles')).toBe(4);
  });
});

test.describe('phone 390x844 stays the phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('buyer: two columns, the design is an overlay', async ({ page }) => {
    await seedRole(page, 'buyer');
    await open('product-detail')(page);
    await settle(page);
    expect(await columns(page, '.em-grid')).toBe(2);
    expect((await box(page, '.em-pd')).width).toBe(390);
    expect(await page.locator('.em-pd-wrap').getAttribute('role')).toBe('dialog');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  });

  test('owner: the shell is the 640px column at most, tiles two across', async ({ page }) => {
    await seedRole(page, 'owner');
    await open('owner-hub')(page);
    await settle(page);
    expect((await box(page, '.em-page')).width).toBeLessThanOrEqual(390);
    expect(await columns(page, '.em-tiles')).toBe(2);
  });
});

test.describe('live resize', () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });

  test('an open design survives a resize between the pane and the overlay, in both directions', async ({ page }) => {
    await seedRole(page, 'buyer');
    await open('product-detail')(page);
    await settle(page);
    const name = await page.locator('.em-pd-wrap').getAttribute('aria-label');
    expect(await page.locator('.em-pd-wrap').getAttribute('role')).toBe('region');

    await page.setViewportSize({ width: 344, height: 882 });
    await expect(page.locator('.em-pd-wrap')).toHaveAttribute('role', 'dialog');
    expect(await page.locator('.em-pd-wrap').getAttribute('aria-label'), 'the same design is still open').toBe(name);
    expect((await box(page, '.em-pd')).width).toBe(344);
    expect(await page.evaluate(() => document.body.style.overflow), 'the overlay locks the page').toBe('hidden');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.em-pd-wrap')).toHaveAttribute('role', 'region');
    expect(await page.locator('.em-pd-wrap').getAttribute('aria-label')).toBe(name);
    expect(await page.evaluate(() => document.body.style.overflow), 'the pane releases the lock').toBe('');
  });
});
