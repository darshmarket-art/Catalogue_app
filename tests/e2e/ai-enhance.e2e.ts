import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { STORE_ID } from './env';
import { sessions } from './env';
import { seedRole, settle } from './screens';

/**
 * "Enhance to CAD render" on an existing design photo, with the provider mocked at the network (no Google call is ever made):
 * rendering state, compare sheet, keep / use / revert / cancel, in both layouts at phone and desktop width. Screenshots: docs/qa-maison/ai/.
 * Runs one at a time because the store's layout is shared server state.
 */
test.describe.configure({ mode: 'serial' });

const OUT = path.resolve('docs/qa-maison/ai');
const RENDER_MS = 3500;
const AFTER = { ref: `media:${'a'.repeat(32)}.png`, url: '/mock/after.png', original: { ref: `media:${'b'.repeat(32)}.png`, url: '' } };

async function mock(page: Page, opts: { enabled?: boolean; left?: number; post?: { status: number; message: string } } = {}) {
  const png = (r: number, g: number, b: number) => sharp({ create: { width: 600, height: 600, channels: 3, background: { r, g, b } } }).png().toBuffer();
  const [before, after] = [await png(190, 150, 90), await png(225, 225, 230)];
  await page.route('**/mock/before.png', (r) => r.fulfill({ contentType: 'image/png', body: before }));
  await page.route('**/mock/after.png', (r) => r.fulfill({ contentType: 'image/png', body: after }));
  const posts: string[] = [];
  await page.route('**/api/v1/admin/photos/render', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { status: 'success', data: { enabled: opts.enabled ?? true, cap: 100, used: 100 - (opts.left ?? 50), left: opts.left ?? 50 } } });
    }
    posts.push(route.request().postData() ?? '');
    await new Promise((res) => setTimeout(res, RENDER_MS));
    if (opts.post) return route.fulfill({ status: opts.post.status, json: { status: 'error', message: opts.post.message } });
    return route.fulfill({ status: 201, json: { status: 'success', data: { ...AFTER, original: { ...AFTER.original, url: (await page.locator('.photo img').first().getAttribute('src')) ?? '' } } } });
  });
  return posts;
}

async function openEditDesign(page: Page, layout: 'emergent' | 'maison', w: number, h: number) {
  const s = sessions();
  const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${s.owner.token}`, 'X-Store': STORE_ID }, data: { layout } });
  expect(put.ok()).toBe(true);
  await page.setViewportSize({ width: w, height: h });
  await seedRole(page, 'owner');
  await page.goto(`/?store=${STORE_ID}`);
  await page.locator('[data-tab="catalogue"], [data-tab="designs"], [data-tab="admin-catalogue"]').first().click({ timeout: 8000 }).catch(async () => {
    await page.getByRole('button', { name: /^Catalogue$/i }).first().click();
  });
  await page.locator('button[aria-label^="Edit "]').first().click();
  await page.getByTestId('np-save').waitFor();
  await settle(page);
}

const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

for (const layout of ['emergent', 'maison'] as const) {
  for (const [w, h, vp] of [[390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
    const tag = `${layout === 'maison' ? 'maison' : 'classic'}-${vp}`;
    test(`enhance existing photo ${tag}`, async ({ page }) => {
      const posts = await mock(page);
      await openEditDesign(page, layout, w, h);
      const firstImg = page.locator('.photo img').first();
      const original = await firstImg.getAttribute('src');
      const enhance = page.getByTestId('photo-enhance').first();
      await expect(enhance).toBeVisible();
      await expect(enhance).toContainText('Enhance');

      // loading state: nothing changes, Save is held, the owner can cancel
      await enhance.click();
      await page.getByTestId('style-cad').click();
      const busy = page.getByTestId('photo-rendering');
      await expect(busy).toContainText('Rendering your design - about a minute');
      await expect(page.getByTestId('np-save')).toBeDisabled();
      await page.waitForTimeout(2200);
      await expect(busy.locator('.rnd-time')).not.toHaveText('0:00');
      await shot(page, `${tag}-rendering`);
      expect(await firstImg.getAttribute('src')).toBe(original);

      // compare sheet; keep original changes nothing
      const sheet = page.getByTestId('render-compare');
      await expect(sheet).toBeVisible({ timeout: 8000 });
      await expect(page.getByTestId('np-save')).toBeEnabled();
      await settle(page);
      await shot(page, `${tag}-compare`);
      if (w < 720) {
        await sheet.getByRole('button', { name: 'Original', exact: true }).click();
        await expect(sheet.locator('.rnd-a')).toBeVisible();
        await expect(sheet.locator('.rnd-b')).toBeHidden();
        await shot(page, `${tag}-compare-original`);
      } else {
        await expect(sheet.locator('.rnd-a')).toBeVisible();
        await expect(sheet.locator('.rnd-b')).toBeVisible();
      }
      await sheet.getByTestId('render-keep').click();
      await expect(sheet).toBeHidden();
      expect(await firstImg.getAttribute('src')).toBe(original);
      await expect(page.getByTestId('photo-swap-render')).toHaveCount(0);

      // accept: the form now points at the render, with Revert to original
      await page.getByTestId('photo-enhance').first().click();
      await page.getByTestId('style-cad').click();
      await expect(sheet).toBeVisible({ timeout: 8000 });
      await sheet.getByTestId('render-use').click();
      await expect(firstImg).toHaveAttribute('src', /mock\/after\.png/);
      await shot(page, `${tag}-accepted`);
      const swap = page.getByTestId('photo-swap-render');
      await expect(swap).toHaveText('Revert to original');
      await swap.click();
      await expect(firstImg).toHaveAttribute('src', original!);
      expect(posts.length).toBe(2);
    });
  }
}

test('cancel while rendering, and the failure, cap and off messages', async ({ page }) => {
  const posts = await mock(page);
  await openEditDesign(page, 'emergent', 390, 844);
  const firstImg = page.locator('.photo img').first();
  const original = await firstImg.getAttribute('src');
  await page.getByTestId('photo-enhance').first().click();
  await page.getByTestId('style-cad').click();
  await page.getByTestId('photo-rendering').getByRole('button', { name: 'Use original' }).click();
  await expect(page.getByTestId('photo-rendering')).toHaveCount(0);
  await page.waitForTimeout(RENDER_MS + 800); // the late answer must not open a sheet or change the photo
  await expect(page.getByTestId('render-compare')).toHaveCount(0);
  expect(await firstImg.getAttribute('src')).toBe(original);
  expect(posts.length).toBe(1);
});

for (const [name, post] of [
  ['failure', { status: 502, message: 'AI render did not work for this photo (the AI declined this photo). Your original photo is used.' }],
  ['cap', { status: 402, message: 'This store has used its 100 AI renders for this month. Your original photo is used.' }],
  ['off', { status: 503, message: 'AI render is switched off on this server. Your original photo is used.' }]
] as const) {
  test(`server says ${name}: the owner is told why and the photo is unchanged`, async ({ page }) => {
    await mock(page, { post });
    await openEditDesign(page, 'emergent', 390, 844);
    const firstImg = page.locator('.photo img').first();
    const original = await firstImg.getAttribute('src');
    await page.getByTestId('photo-enhance').first().click();
    await page.getByTestId('style-cad').click();
    await expect(page.getByRole('status').filter({ hasText: post.message })).toBeVisible({ timeout: 8000 });
    expect(await firstImg.getAttribute('src')).toBe(original);
    if (name !== 'failure') await expect(page.getByTestId('enhance-blocked')).toBeVisible();
    await shot(page, `classic-m390-${name}`);
  });
}

test('status off: the button is replaced by the reason', async ({ page }) => {
  await mock(page, { enabled: false });
  await openEditDesign(page, 'emergent', 390, 844);
  await expect(page.getByTestId('enhance-blocked')).toContainText('switched off');
  await expect(page.getByTestId('photo-enhance')).toHaveCount(0);
});
