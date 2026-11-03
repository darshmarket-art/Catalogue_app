import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORE_ID, sessions } from './env';
import { seedRole, settle } from './screens';

/**
 * The owner's bottom bar (Classic: bottom tab bar; Maison: bottom bar on phones, left sidebar on desktop) must be on
 * every owner screen from the first paint, after reloads, and under CPU / network throttling and a slow Maison chunk.
 * Runs one at a time because the store's layout is shared server state. Screenshots: docs/qa-maison/bottom-bar/.
 */
test.describe.configure({ mode: 'serial' });
const OUT = path.resolve('docs/qa-maison/bottom-bar');

/** Measures the bar the way a finger would: inside the viewport, painted, and the topmost thing at a tab's centre. */
async function barState(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('.em-tabs');
    if (!bar) return { ok: false, why: 'no bar', tabs: 0 };
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const inside = r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    const tab = bar.querySelector<HTMLElement>('[data-tab]');
    const t = tab?.getBoundingClientRect();
    const hit = t ? document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2) : null;
    const visible = cs.visibility === 'visible' && cs.display !== 'none' && Number(cs.opacity) > 0.99;
    return { ok: inside && visible && !!hit && bar.contains(hit), why: JSON.stringify({ inside, visible, hit: hit?.className, r: [r.left, r.top, r.right, r.bottom] }), tabs: bar.querySelectorAll('[data-tab]').length };
  });
}

const expectBar = async (page: Page, label: string) => {
  await expect.poll(async () => (await barState(page)).ok, { message: `bar on ${label}`, timeout: 4000 }).toBe(true);
  expect((await barState(page)).tabs, label).toBe(4);
};

/** Scrolled to the end, does the last piece of content end above a bottom bar (bottom padding)? A side bar needs nothing. */
const clearsBar = async (page: Page) => {
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const bar = document.querySelector('.em-tabs')!.getBoundingClientRect();
    if (bar.width < innerWidth / 2) return true;
    const main = document.querySelector('main')!;
    const last = Math.max(...[...main.querySelectorAll('*')].filter((e) => !e.firstElementChild).filter((e) => { for (let n: Element | null = e; n && n !== main; n = n.parentElement) if (['fixed', 'sticky', 'absolute'].includes(getComputedStyle(n).position)) return false; return true; }).map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0 && r.top < innerHeight).map((r) => r.bottom));
    return last <= bar.top + 1;
  });
};

async function setup(page: Page, layout: 'emergent' | 'maison', w: number, h: number) {
  const s = sessions();
  const put = await page.request.put('/api/admin/layout', { headers: { Authorization: `Bearer ${s.owner.token}`, 'X-Store': STORE_ID }, data: { layout } });
  expect(put.ok()).toBe(true);
  await page.setViewportSize({ width: w, height: h });
  await seedRole(page, 'owner', layout);
  // The first moment the bar is really painted, from navigation start.
  await page.addInitScript(() => {
    const win = window as unknown as { __bar?: number };
    const tick = () => {
      const b = document.querySelector<HTMLElement>('.em-tabs');
      if (b) {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && r.bottom <= innerHeight + 1 && getComputedStyle(b).opacity === '1') win.__bar = Math.round(performance.now());
      }
      if (win.__bar === undefined) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

for (const layout of ['emergent', 'maison'] as const) {
  for (const [w, h, vp] of [[390, 844, 'm390'], [1440, 900, 'd1440']] as const) {
    const tag = `${layout === 'maison' ? 'maison' : 'classic'}-${vp}`;
    test(`owner bar on every owner screen ${tag}`, async ({ page }) => {
      await setup(page, layout, w, h);
      await page.goto(`/?store=${STORE_ID}`);
      await page.getByTestId('admin-today').waitFor();
      await expectBar(page, 'Today');
      await shot(page, `${tag}-today`);

      // The four tabs, by clicking, in a loop (the bar must persist across navigation).
      for (const t of ['orders', 'catalogue', 'admin-buyers', 'admin-hub']) {
        await page.locator(`.em-tabs [data-tab="${t}"]`).click();
        await settle(page);
        await expectBar(page, t);
        const clear = await clearsBar(page);
        await shot(page, `${tag}-${t}`);
        expect(clear, `${t} content clears the bar`).toBe(true);
      }

      // Store (profile button), then the editor.
      await page.getByTestId('admin-menu').click();
      await page.getByTestId('admin-store').waitFor();
      await settle(page);
      await expectBar(page, 'Store');
      expect(await clearsBar(page), 'store clears the bar').toBe(true);
      await shot(page, `${tag}-store`);
      await page.locator('.em-tabs [data-tab="admin-hub"]').click();
      await page.getByTestId('new-design-card').click();
      await page.getByTestId('np-save').waitFor();
      await settle(page);
      await expectBar(page, 'new-product');
      expect(await clearsBar(page), 'new-product clears the bar').toBe(true);
      // The sticky Save button must sit above a bottom bar, not under it.
      const gap = await page.evaluate(() => {
        const bar = document.querySelector('.em-tabs')!.getBoundingClientRect();
        const save = document.querySelector('[data-testid="np-save"]')!.getBoundingClientRect();
        return bar.width < innerWidth / 2 ? 0 : bar.top - save.bottom;
      });
      expect(gap, 'Save button clears the bar').toBeGreaterThanOrEqual(-1);
      await shot(page, `${tag}-new-product`);

      // Reload: still there.
      await page.reload();
      await expectBar(page, 'after reload');
    });

    test(`owner bar first paint under throttling ${tag}`, async ({ page, context }) => {
      await setup(page, layout, w, h);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1600 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      // Maison's chunk arrives late.
      await page.route(/maison/, async (r) => {
        await new Promise((res) => setTimeout(res, 3000));
        await r.continue();
      });
      const t0 = Date.now();
      await page.goto(`/?store=${STORE_ID}`, { timeout: 60_000 });
      await page.getByTestId('admin-today').waitFor({ timeout: 60_000 });
      await expectBar(page, 'throttled first load');
      const first = await page.evaluate(() => (window as unknown as { __bar?: number }).__bar);
      console.log(`${tag} bar first visible at ${first} ms (page ready ${Date.now() - t0} ms wall)`);
      expect(first).toBeDefined();
      await shot(page, `${tag}-throttled`);
    });
  }
}

test('owner bar is there when the Maison chunk fails', async ({ page }) => {
  await setup(page, 'maison', 390, 844);
  await page.route(/maison/, (r) => r.abort());
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('admin-today').waitFor();
  await expectBar(page, 'chunk failed');
  await shot(page, 'maison-chunk-failed-m390');
});
