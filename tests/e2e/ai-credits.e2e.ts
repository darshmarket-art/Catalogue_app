import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { STORE_ID, sessions } from './env';
import { seedRole, settle } from './screens';

/**
 * AI credits. Console section: the real dev server, seeded by tests/e2e/aiSeed.ts (run with AI_E2E_SEED=1). Owner side: the status and wallet
 * endpoints are mocked at the network (the real store here is the free founder store), with the same shapes the server returns.
 * Screenshots: docs/qa-maison/ai-credits/. Serial: the store's layout is shared server state.
 */
test.describe.configure({ mode: 'serial' });
test.skip(process.env.AI_E2E_SEED !== '1', 'needs AI_E2E_SEED=1 (see docs/AI_CREDITS.md)');

const OUT = path.resolve('docs/qa-maison/ai-credits');
const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
};
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const [w, h, vp] of [[1440, 900, 'd1440'], [390, 844, 'm390']] as const) {
  test(`console AI section ${vp}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/console#/ai');
    await expect(page.getByRole('heading', { name: 'AI', level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Render calls today')).toBeVisible();
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await settle(page);
    await shot(page, `console-${vp}-overview`);
    expect(await noSideScroll(page)).toBe(true);

    await page.goto('/console#/ai/stores');
    const row = page.getByTestId('ai-row-priya-jewels');
    await expect(row).toContainText(/Rs \d/);
    const balanceOf = async () => Number(((await row.locator('td').nth(2).innerText()).match(/Rs ([\d,]+)/) ?? [])[1]?.replace(/,/g, ''));
    const before = await balanceOf(); // the desktop run already topped up once: the server state is shared
    await expect(page.getByTestId('ai-row-bhakti')).toContainText('Free');
    await shot(page, `console-${vp}-stores`);

    // Top up through the dialog: amount + note, then the balance and the audit entry move.
    await row.getByRole('button', { name: 'Top up' }).click();
    await page.getByTestId('ai-amount').fill('250');
    await page.getByTestId('ai-note').fill('UPI ref e2e-1');
    await shot(page, `console-${vp}-topup`);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/Top-up done for Priya Jewels. New balance Rs/)).toBeVisible();
    await expect.poll(balanceOf).toBe(before + 250);

    await page.goto('/console#/ai/usage');
    await expect(page.locator('table.cn-t tbody tr').first()).toBeVisible();
    await page.getByLabel('Outcome').selectOption('provider_failed');
    await expect(page.locator('table.cn-t tbody tr').first().getByText('Failed, refunded')).toBeVisible();
    await expect(page.getByRole('link', { name: /Export CSV/ })).toHaveAttribute('href', /usage\.csv\?.*outcome=provider_failed/);
    await shot(page, `console-${vp}-usage`);

    await page.goto('/console#/ai/prices');
    await expect(page.getByLabel('CAD studio price')).toHaveValue('8');
    await expect(page.getByLabel('Worn on model price')).toHaveValue('12');
    await shot(page, `console-${vp}-prices`);

    await page.goto('/console#/ai/alerts');
    await expect(page.getByTestId('ai-row-shree-ornaments')).toBeVisible();
    await expect(page.getByTestId('ai-row-bhakti')).toHaveCount(0);
    await shot(page, `console-${vp}-alerts`);
    expect(await noSideScroll(page)).toBe(true);
  });
}

/** The element's rect must not intersect the fixed bottom tab bar (when there is one along the bottom) and must lie inside the window. */
async function expectClearOfBar(page: Page, el: ReturnType<Page['locator']>) {
  const r = await el.evaluate((node) => {
    const b = node.getBoundingClientRect();
    const bar = document.querySelector('.em-tabs')?.getBoundingClientRect();
    const barAtBottom = !!bar && bar.width > 0 && bar.top > window.innerHeight / 2;
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, vh: window.innerHeight, vw: window.innerWidth, barTop: barAtBottom ? bar!.top : null };
  });
  expect(r.bottom, 'inside the window').toBeLessThanOrEqual(r.vh + 0.5);
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(r.vw + 0.5);
  if (r.barTop !== null) expect(r.bottom, 'ends above the tab bar').toBeLessThanOrEqual(r.barTop + 0.5);
}

async function mockOwner(page: Page, balance: number) {
  const prices = { cad: 8, silk: 8, 'studio-dark': 8, editorial: 8, giftbox: 8, festive: 8, 'on-model': 12, macro: 8 };
  await page.route('**/api/v1/admin/photos/render', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { status: 'success', data: { enabled: true, offReason: null, styles: Object.keys(prices), cap: 100, used: 0, left: 100, credits: { balance, free: false, low: balance <= 24, prices } } } })
      : route.fulfill({ status: 402, json: { status: 'error', message: 'Not enough AI credits', code: 'credits', reason: 'credits' } })
  );
  await page.route('**/api/v1/admin/ai-credits', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: {
          balance, free: false, enabled: true, low: balance <= 24, prices, lastTopup: { at: Date.now() - 6 * 86400000, amount: 500 },
          recent: [
            { id: 'r1aaaaaa', ts: Date.now() - 3600_000, style: 'silk', outcome: 'ok', price: 8, refunded: 0, kept: true },
            { id: 'r2aaaaaa', ts: Date.now() - 7200_000, style: 'on-model', outcome: 'provider_failed', price: 0, refunded: 12, kept: null },
            { id: 'r3aaaaaa', ts: Date.now() - 86400_000, style: 'cad', outcome: 'ok', price: 8, refunded: 0, kept: false }
          ],
          topups: [{ ts: Date.now() - 6 * 86400000, amount: 500, kind: 'topup' }]
        }
      }
    })
  );
}

for (const layout of ['emergent', 'maison'] as const) {
  for (const [w, h, vp] of [[390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
    for (const balance of [120, 0]) {
      const tag = `${layout === 'maison' ? 'maison' : 'classic'}-${vp}-${balance ? 'funded' : 'zero'}`;
      test(`owner credits ${tag}`, async ({ page }) => {
        await mockOwner(page, balance);
        const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID }, data: { layout } });
        expect(put.ok()).toBe(true);
        await page.setViewportSize({ width: w, height: h });
        await seedRole(page, 'owner');
        await page.goto(`/?store=${STORE_ID}`);
        await page.getByTestId('admin-today').waitFor();

        // Store settings: the AI credits card
        await page.getByTestId('admin-menu').click();
        const card = page.getByTestId('ai-credits-card');
        await expect(card).toBeVisible();
        await expect(page.getByTestId('ai-balance')).toHaveText(`Rs ${balance}`);
        await expect(page.getByTestId('ai-recent').locator('li')).toHaveCount(3);
        if (!balance) await expect(card.getByTestId('add-credits')).toContainText('Add credits: contact Antarixs');
        await settle(page);
        await card.scrollIntoViewIfNeeded();
        await shot(page, `${tag}-settings`);

        // Style picker: price on each style, balance in the header
        await page.locator('.em-tabs [data-tab="admin-hub"]').click();
        await page.getByTestId('new-design-card').click();
        await page.getByTestId('np-save').waitFor();
        await expect(page.getByTestId('ai-render-price')).toContainText(balance ? 'Rs 120' : 'Add credits');
        const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#cc8844' } }).png().toBuffer();
        await page.getByTestId('photo-gallery-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo });
        if (balance) {
          const picker = page.getByTestId('style-picker');
          await expect(picker).toBeVisible({ timeout: 8000 });
          await expect(picker.getByTestId('price-cad')).toHaveText(/Rs 8/);
          await expect(picker.getByTestId('style-balance')).toContainText('Rs 120');
          await settle(page);
          await shot(page, `${tag}-picker`);
          await expectClearOfBar(page, picker.getByTestId('style-cancel'));
        } else {
          await expect(page.getByTestId('style-picker')).toHaveCount(0); // nothing can be afforded: no picker, just the way to add credits
          await expect(page.getByTestId('ai-render-price').getByTestId('add-credits')).toBeVisible();
          await settle(page);
          await shot(page, `${tag}-form`);
        }
      });
    }
  }
}

// The two render sheets against the bottom tab bar, at phone sizes (one of them short) and a desktop.
for (const layout of ['emergent', 'maison'] as const) {
  for (const [w, h, vp] of [[360, 640, 'm360'], [390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
    const tag = `${layout === 'maison' ? 'maison' : 'classic'}-${vp}`;
    test(`render sheets clear the bottom bar ${tag}`, async ({ page }) => {
      await mockOwner(page, 120);
      const after = await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 30, g: 30, b: 34 } } }).png().toBuffer();
      await page.route('**/mock/after.png', (r) => r.fulfill({ contentType: 'image/png', body: after }));
      await page.route('**/api/v1/admin/photos/render', async (route) => {
        if (route.request().method() === 'GET') return route.fallback();
        const b = route.request().postDataJSON();
        return route.fulfill({ status: 201, json: { status: 'success', data: { ref: `media:${'a'.repeat(32)}.png`, url: '/mock/after.png', style: b.style, original: { ref: b.ref, url: '/mock/before.png' }, renderId: b.renderId, credits: { balance: 112, charged: 8 } } } });
      });
      await page.route('**/api/v1/admin/ai-credits/keep', (r) => r.fulfill({ json: { status: 'success', data: {} } }));
      const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID }, data: { layout } });
      expect(put.ok()).toBe(true);
      await page.setViewportSize({ width: w, height: h });
      await seedRole(page, 'owner');
      await page.goto(`/?store=${STORE_ID}`);
      await page.getByTestId('admin-today').waitFor();
      await page.getByTestId('new-design-card').click();
      await page.getByTestId('np-save').waitFor();
      const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#cc8844' } }).png().toBuffer();
      await page.getByTestId('photo-gallery-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo });

      const picker = page.getByTestId('style-picker');
      await expect(picker).toBeVisible({ timeout: 8000 });
      // header and footer stay; the list scrolls inside; the page behind is locked
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await expectClearOfBar(page, picker.getByTestId('style-cancel'));
      await expectClearOfBar(page, picker.getByTestId('style-continue'));
      const sheetBox = await picker.locator('.stl-sheet').boundingBox();
      expect(sheetBox!.height).toBeLessThanOrEqual(h * 0.85 + 1);
      await picker.getByTestId('style-list').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await picker.getByTestId('style-placement').scrollIntoViewIfNeeded(); // "Worn on" is reachable
      await expect(picker.getByTestId('style-placement')).toBeVisible();
      await expectClearOfBar(page, picker.getByTestId('style-cancel'));
      await shot(page, `sheets-${tag}-picker-scrolled`);
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

      // enhance: pick, continue, compare sheet
      await page.getByTestId('photo-enhance').first().click();
      await expect(picker).toBeVisible();
      await picker.getByTestId('style-silk').click();
      await expectClearOfBar(page, picker.getByTestId('style-continue'));
      await picker.getByTestId('style-continue').click();
      const cmp = page.getByTestId('render-compare');
      await expect(cmp).toBeVisible({ timeout: 8000 });
      await cmp.getByTestId('render-keep').scrollIntoViewIfNeeded();
      for (const id of ['render-use', 'render-keep']) {
        await cmp.getByTestId(id).scrollIntoViewIfNeeded();
        await expectClearOfBar(page, cmp.getByTestId(id));
      }
      await shot(page, `sheets-${tag}-compare`);
      await page.keyboard.press('Escape');
      await expect(cmp).toBeHidden();
    });
  }
}
