import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { settle } from './screens';

/**
 * Console Billing section. Run twice against the e2e dev server:
 *   BILLING_E2E=off        (BILLING_EXPORT_TABLE unset: the Not connected state)
 *   BILLING_E2E=connected  (fake export from tests/e2e/billingSeed.ts)
 * Screenshots: docs/qa-maison/billing/.
 */
const MODE = process.env.BILLING_E2E;
test.skip(!MODE, 'needs BILLING_E2E=off or connected (see docs/BILLING_CONSOLE.md)');

const OUT = path.resolve('docs/qa-maison/billing');
for (const [w, h, vp] of [[1440, 900, 'd1440'], [390, 844, 'm390']] as const) {
  test(`console Billing ${MODE} ${vp}`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/console#/billing');
    await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible({ timeout: 30_000 });
    if (MODE === 'off') {
      await expect(page.getByRole('heading', { name: 'Not connected' })).toBeVisible();
      await expect(page.getByText('roles/bigquery.jobUser')).toBeVisible();
    } else {
      await expect(page.getByText('Month to date, net')).toBeVisible();
      await expect(page.locator('svg[role="img"]').first()).toBeVisible();
      await page.getByTestId('bill-svc').first().click();
      await expect(page.getByText('Cloud Run CPU Allocation Time asia-south1')).toBeVisible();
    }
    await settle(page);
    await page.screenshot({ path: path.join(OUT, `${MODE}-${vp}-overview.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (MODE === 'connected') {
      await page.goto('/console#/billing/ai');
      await expect(page.getByText('Estimate vs actual')).toBeVisible();
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `${MODE}-${vp}-ai.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
}
