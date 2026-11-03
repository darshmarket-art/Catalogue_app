import { expect, test } from '@playwright/test';
import { STORE_ID, sessions } from './env';
import { seedRole } from './screens';

/**
 * Maison buyer: the Shortlist lives in the profile panel (no header icon), the count badge sits on the profile icon, Order all empties the shortlist
 * in ONE step and lands on Orders, and placing the order plays the full-screen moment, which a tap skips.
 * Serial: the store's layout is shared server state.
 */
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('profile holds the shortlist; Order all leaves in one step; the placed moment plays and skips', async ({ page }) => {
  const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID }, data: { layout: 'maison' } });
  expect(put.ok()).toBe(true);
  await seedRole(page, 'buyer', 'maison');
  await page.request.put('/api/v1/shortlist', { headers: { Authorization: `Bearer ${sessions().buyer.token}`, 'X-Store': STORE_ID }, data: { skus: [] } });
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('mx-menu').click();
  await page.getByTestId('mx-all-designs').click();
  await page.locator('.mx-heart').first().waitFor();

  await expect(page.locator('.mx-top [data-tab="shortlist"]')).toHaveCount(0);
  const hearts = page.locator('.mx-heart');
  const n = Math.min(3, await hearts.count());
  for (let i = 0; i < n; i++) await hearts.nth(i).click();
  await expect(page.getByTestId('mx-profile-badge')).toHaveText(String(n));

  await page.getByTestId('mx-profile').click();
  await expect(page.getByTestId('mx-shortlist-row-count')).toHaveText(String(n));
  await page.getByTestId('mx-shortlist-row').click();
  await expect(page.getByTestId('shortlist-item')).toHaveCount(n);

  // every line leaves in one update: the count goes n -> 0 with nothing in between
  await page.evaluate(() => {
    const w = window as unknown as { __seen: number[] };
    w.__seen = [];
    setInterval(() => w.__seen.push(document.querySelectorAll('[data-testid="shortlist-item"]').length), 20);
  });
  await page.getByTestId('shortlist-order-all').click();
  await page.getByTestId('place-order').waitFor();
  const seen = await page.evaluate(() => (window as unknown as { __seen: number[] }).__seen.filter((v, i, a) => i === 0 || v !== a[i - 1]));
  expect(seen).toEqual([n, 0]);

  await page.getByTestId('place-order').click();
  const moment = page.getByTestId('order-placed-moment');
  await expect(moment).toBeVisible();
  await expect(page.getByTestId('order-placed-id')).toContainText('PO-');
  await moment.click(); // a tap skips it
  await expect(moment).toHaveCount(0);
  await expect(page.locator('.mx-booked')).toBeVisible();
});
