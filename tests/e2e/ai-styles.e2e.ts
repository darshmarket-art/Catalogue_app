import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { STORE_ID, sessions } from './env';
import { seedRole, settle } from './screens';

/**
 * The AI render style picker, provider mocked at the network (no Google call). Screenshots: docs/qa-maison/ai-styles/.
 * Serial: the store's layout is shared server state.
 */
test.describe.configure({ mode: 'serial' });

const OUT = path.resolve('docs/qa-maison/ai-styles');
const AFTER = { ref: `media:${'a'.repeat(32)}.png`, url: '/mock/after.png' };

async function mock(page: Page) {
  const after = await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 30, g: 30, b: 34 } } }).png().toBuffer();
  await page.route('**/mock/after.png', (r) => r.fulfill({ contentType: 'image/png', body: after }));
  const posts: Array<{ ref: string; style?: string; placement?: string }> = [];
  await page.route('**/api/v1/admin/photos/render', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { status: 'success', data: { enabled: true, styles: ['cad', 'silk', 'studio-dark', 'editorial', 'giftbox', 'festive', 'on-model', 'macro'], cap: 100, used: 0, left: 100 } } });
    const body = route.request().postDataJSON();
    posts.push(body);
    await new Promise((res) => setTimeout(res, 1200));
    return route.fulfill({ status: 201, json: { status: 'success', data: { ...AFTER, style: body.style, original: { ref: body.ref, url: '/mock/before.png' } } } });
  });
  return posts;
}

async function setLayout(page: Page, layout: 'emergent' | 'maison', w: number, h: number) {
  const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID }, data: { layout } });
  expect(put.ok()).toBe(true);
  await page.setViewportSize({ width: w, height: h });
  await seedRole(page, 'owner', layout);
  await page.goto(`/?store=${STORE_ID}`);
}

const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

for (const layout of ['emergent', 'maison'] as const) {
  for (const [w, h, vp] of [[390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
    const tag = `${layout === 'maison' ? 'maison' : 'classic'}-${vp}`;
    test(`style picker ${tag}`, async ({ page }) => {
      const posts = await mock(page);
      await setLayout(page, layout, w, h);
      await page.getByTestId('new-design-card').click();
      await page.getByTestId('np-save').waitFor();
      await settle(page);
      const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#cc8844' } }).png().toBuffer();

      // new upload with the render switch on: the picker opens first; cancel renders nothing and keeps the photo
      await page.getByTestId('photo-gallery-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo });
      const picker = page.getByTestId('style-picker');
      await expect(picker).toBeVisible({ timeout: 8000 });
      await expect(picker.locator('.stl-card')).toHaveCount(8);
      await expect(picker.getByTestId('style-on-model')).toContainText('Not available'); // no collection chosen yet: no body part
      await expect(picker.getByTestId('style-on-model')).toBeDisabled();
      await settle(page);
      await shot(page, `${tag}-picker`);
      await picker.getByTestId('style-cancel').click();
      await expect(picker).toBeHidden();
      expect(posts.length).toBe(0);
      await expect(page.locator('.photo img')).toHaveCount(1);

      // enhance the same photo: picker opens again; choosing silk starts a render with that style id
      await page.getByTestId('photo-enhance').first().click();
      await expect(picker).toBeVisible();
      await picker.getByTestId('style-silk').click();
      await page.getByTestId('style-continue').click();
      await expect(picker).toBeHidden();
      await expect(page.getByTestId('photo-rendering')).toBeVisible();
      const sheet = page.getByTestId('render-compare');
      await expect(sheet).toBeVisible({ timeout: 8000 });
      await expect(sheet.getByTestId('render-style-tag')).toHaveText('Silk cloth');
      await shot(page, `${tag}-compare`);
      await sheet.getByTestId('render-keep').click();
      expect(posts.map((p) => p.style)).toEqual(['silk']);

      // the last choice is the highlighted default
      await page.getByTestId('photo-enhance').first().click();
      await expect(picker.locator('.stl-card.on')).toHaveAttribute('data-style', 'silk');
      await picker.getByTestId('style-cancel').click();
    });
  }
}
