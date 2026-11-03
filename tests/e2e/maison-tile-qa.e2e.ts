import { expect, test } from '@playwright/test';
import { STORE_ID, sessions } from './env';
import { seedRole } from './screens';

// Maison tile QA: square photo, bold weight, no SKU on the card, Add to cart under the details and inside the card, SKU still in detail.
test.describe.configure({ mode: 'serial' });
const OUT = 'docs/qa-maison/tile';

for (const [w, h, tag] of [[390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
  test(`tile at ${tag}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const auth = { Authorization: `Bearer ${sessions().owner.token}`, 'X-Store': STORE_ID };
    await page.request.put('/api/admin/layout', { headers: auth, data: { layout: 'maison' } });
    await seedRole(page, 'buyer');
    await page.request.put('/api/v1/shortlist', { headers: { Authorization: `Bearer ${sessions().buyer.token}`, 'X-Store': STORE_ID }, data: { skus: [] } });
    await page.goto(`/?store=${STORE_ID}`);
    await page.screenshot({ path: `${OUT}/${tag}-home-first.png` });
    await page.getByTestId('mx-menu').click();
    await page.getByTestId('mx-all-designs').click();
    await page.locator('.mx-heart').first().waitFor();

    const check = async (view: string, shot: string) => {
      if (view) await page.getByTestId(`view-${view}`).click();
      await page.waitForTimeout(600);
      const m = await page.locator('.mx-ptile').evaluateAll((els) => els.slice(0, 6).map((el) => {
        const f = el.querySelector('.mx-pframe')!.getBoundingClientRect();
        const t = el.getBoundingClientRect();
        const c = el.querySelector('[data-testid="card-add-to-cart"]')?.getBoundingClientRect();
        const n = el.querySelector('.mx-pt')!.getBoundingClientRect();
        const wt = el.querySelector('.mx-wt') as HTMLElement | null;
        return { ratio: +(f.width / f.height).toFixed(2), sku: (el.textContent || '').includes((el as HTMLElement).dataset.sku!), wt: wt ? getComputedStyle(wt).fontWeight : null,
          cta: c ? { below: c.top >= n.bottom - 1, inside: c.bottom <= t.bottom + 1 && c.right <= t.right + 1 && c.left >= t.left - 1 } : null };
      }));
      console.log(`${tag} ${view || 'grid2'}`, JSON.stringify(m));
      await page.screenshot({ path: `${OUT}/${tag}-catalogue-${shot}.png` });
      return m;
    };
    const large = await check('', 'large');
    for (const r of large) { expect(Math.abs(r.ratio - 1)).toBeLessThan(0.05); expect(r.sku).toBe(false); expect(r.wt).toBe('700'); expect(r.cta?.below).toBe(true); expect(r.cta?.inside).toBe(true); }
    await check('grid3', 'compact');
    await check('list', 'list');
    await page.getByTestId('view-grid2').click();

    const hearts = page.locator('.mx-heart');
    for (let i = 0; i < 3; i++) await hearts.nth(i).click();
    const sku = await page.locator('.mx-ptile').first().getAttribute('data-sku');
    await page.locator('.mx-ptile .mx-hit').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-detail.png` });
    console.log(tag, 'detail has SKU', await page.getByText(sku!).count());
    await page.keyboard.press('Escape');

    const skus = await page.locator('.mx-ptile').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.sku));
    await page.evaluate((v) => localStorage.setItem('recent-skus', JSON.stringify(v)), skus);
    await page.waitForTimeout(1000); await page.goto(`/?store=${STORE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Home', exact: true }).first().click().catch(() => page.locator('.mx-top .mx-word').first().click());
    await page.getByTestId('recently-viewed').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    const rv = page.getByTestId('recently-viewed');
    console.log(tag, 'recent count', await rv.count());
    if (await rv.count()) { await rv.screenshot({ path: `${OUT}/${tag}-home-recent.png` }); console.log(tag, 'recent', JSON.stringify(await rv.locator('.mx-ptile').evaluateAll((els) => els.map((el) => { const f = el.querySelector('.mx-pframe')!.getBoundingClientRect(); return +(f.width / f.height).toFixed(2); })))); }
    await page.screenshot({ path: `${OUT}/${tag}-home-full.png`, fullPage: true });

    await page.getByTestId('mx-profile').click();
    await page.getByTestId('mx-shortlist-row').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-shortlist.png`, fullPage: true });
    console.log(tag, 'shortlist tiles', await page.locator('.mx-ptile').evaluateAll((els) => els.map((el) => { const f = el.querySelector('.mx-pframe')!.getBoundingClientRect(); return [+(f.width / f.height).toFixed(2), (el.textContent || '').includes((el as HTMLElement).dataset.sku!)]; })));
  });
}
