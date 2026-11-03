import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { STORE_ID, sessions } from './env';
import { seedRole } from './screens';

/**
 * PDF catalogue ("Editorial grid"): 12 designs from two collections, exported in the browser, must give cover + 2 x (divider + one page of six) + contact = 6 pages.
 * Photos are served by page.route (a jewel-ish JPEG per design, none for one of them). PDFs land in PDF_OUT (default test-results/pdf) so they can be rendered and compared.
 * Serial: the store's layout and designs are shared server state.
 */
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1280, height: 900 } });
const OUT = path.resolve(process.env.PDF_OUT || path.join('test-results', 'pdf'));
const auth = () => ({ Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID });
const SKUS: string[] = [];
let cats: string[] = [];

/** Pages in a jsPDF file (page objects are plain, not in object streams). */
const pageCount = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

const jpeg = (i: number) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#efe9e1"/><ellipse cx="450" cy="500" rx="200" ry="220" fill="none" stroke="#c9a961" stroke-width="54"/><path d="M450 130l100 110-100 150-100-150z" fill="#f4f6f8" stroke="#c9a961" stroke-width="16"/><text x="450" y="860" font-size="40" text-anchor="middle" fill="#8a8277">${i}</text></svg>`)).jpeg().toBuffer();

async function servePhotos(page: Page, delayMs = 0) {
  await page.route('https://pdf-e2e.test/**', async (route) => {
    const m = /\/p(\d+)\.jpg/.exec(route.request().url());
    if (!m) return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' }); // the design with no photo
    const i = Number(m[1]);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: await jpeg(i) });
  });
}

async function openPdfScreen(page: Page, layout: 'emergent' | 'maison' = 'emergent') {
  await seedRole(page, 'owner', layout);
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('admin-today').waitFor();
  await page.getByTestId('tile-pdf').click();
  await page.getByTestId('pdf-grid').waitFor();
}

async function pickAll(page: Page) {
  for (const sku of SKUS) await page.getByTestId(`pdf-pick-${sku}`).click();
  await expect(page.getByTestId('pdf-selected')).toHaveText(`${SKUS.length} selected`);
}

test.beforeAll(async ({ request }) => {
  const list = await request.get('/api/categories', { headers: auth() });
  cats = ((await list.json()).data ?? []).map((c: { name: string }) => c.name).slice(0, 2);
  expect(cats.length).toBe(2);
  for (let i = 1; i <= 12; i++) {
    const res = await request.post('/api/products', {
      headers: auth(),
      data: {
        title: i === 3 ? 'Maharani Kundan Polki Bridal Choker Necklace with Emerald Drops and Pearl Fringe' : `Pdf Design ${i}`,
        category: cats[i <= 6 ? 0 : 1], purity: '22K 916', grossWt: String(10 + i), stoneWt: '1', images: [i === 5 ? 'https://pdf-e2e.test/missing5.jpg' : `https://pdf-e2e.test/p${i}.jpg`]
      }
    });
    expect(res.status(), await res.text()).toBe(201);
    SKUS.push((await res.json()).data.sku);
  }
});

for (const layout of ['emergent', 'maison']) {
  test(`${layout}: 12 designs from two collections make a 6-page PDF; options persist`, async ({ page, request }) => {
    expect((await request.put('/api/admin/layout', { headers: auth(), data: { layout } })).ok()).toBe(true);
    await servePhotos(page);
    await openPdfScreen(page, layout as 'emergent' | 'maison');
    await pickAll(page);
    await expect(page.getByTestId('pdf-page-preview')).toBeVisible();

    // options: landscape + midnight, and they survive a reload (localStorage)
    await page.getByRole('tab', { name: 'A4 landscape' }).click();
    await page.getByRole('tab', { name: 'Midnight' }).click();
    await page.getByTestId('pdf-title').fill('The Gold Edit');
    await page.getByTestId('pdf-subtitle').fill('Autumn / Winter 2026');
    fs.mkdirSync(OUT, { recursive: true });
    await page.getByTestId('pdf-page-preview').screenshot({ path: path.join(OUT, `preview-${layout}.png`) });
    await page.reload();
    await page.getByTestId('pdf-grid').waitFor();
    await expect(page.getByRole('tab', { name: 'A4 landscape' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('pdf-title')).toHaveValue('The Gold Edit');
    await page.getByRole('tab', { name: 'A4 portrait' }).click();
    await page.getByRole('tab', { name: 'Ivory / ink' }).click();
    await page.getByTestId('pdf-title').fill(layout === 'maison' ? 'The Gold Edit' : '');
    await page.getByTestId('pdf-subtitle').fill(layout === 'maison' ? 'Autumn / Winter 2026' : '');
    await pickAll(page);

    fs.mkdirSync(OUT, { recursive: true });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('pdf-export').click()]);
    const file = path.join(OUT, `catalogue-${layout}.pdf`);
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buf)).toBe(6);
    expect(buf.length).toBeLessThan(2_000_000);
  });
}

test('landscape, weights/SKU/watermark off still gives 6 pages; Cancel stops the build', async ({ page, request }) => {
  expect((await request.put('/api/admin/layout', { headers: auth(), data: { layout: 'emergent' } })).ok()).toBe(true);
  await servePhotos(page, 250);
  await openPdfScreen(page);
  await pickAll(page);
  await page.getByRole('tab', { name: 'A4 landscape' }).click();
  await page.getByRole('tab', { name: 'Midnight' }).click();
  for (const k of ['weights', 'sku', 'watermark']) await page.getByTestId(`pdf-opt-${k}`).getByRole('switch').click();

  // Cancel: no file arrives
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.getByTestId('pdf-export').click();
  await page.getByTestId('pdf-cancel').click();
  await expect(page.getByTestId('pdf-export')).toBeEnabled();
  await page.waitForTimeout(1500);
  expect(downloaded).toBe(false);

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('pdf-export').click()]);
  const file = path.join(OUT, 'catalogue-landscape-minimal.pdf');
  await dl.saveAs(file);
  expect(pageCount(fs.readFileSync(file))).toBe(6);
});
