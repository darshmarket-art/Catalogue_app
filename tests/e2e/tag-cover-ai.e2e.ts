import { expect, test } from '@playwright/test';
import { STORE_ID } from './env';
import { seedRole } from './screens';

/** The owner's tag photo picker offers the AI render switch (new upload) like Add collection. Render status is mocked; no Google call. */
test('tag cover picker offers AI render', async ({ page }) => {
  await page.route('**/api/v1/admin/photos/render', (route) =>
    route.fulfill({ json: { status: 'success', data: { enabled: true, cap: 100, used: 0, left: 100 } } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRole(page, 'owner');
  await page.goto(`/?store=${STORE_ID}`);
  await page.locator('[data-tab="catalogue"]').click();
  await page.getByRole('button', { name: 'Collections', exact: true }).click(); // the tag manager lives in the Collections section
  await page.getByRole('button', { name: /^Tags/ }).click();
  await page.getByTestId('tag-cover-set').first().click();
  await expect(page.getByTestId('tag-cover-picker')).toBeVisible();
  await expect(page.getByTestId('tag-cover-picker').getByTestId('ai-render-toggle')).toBeVisible();
});
