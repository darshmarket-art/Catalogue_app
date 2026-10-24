import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { expect, test, type Page } from '@playwright/test';
import { STORE_ID, outDir } from './env';
import { SCREENS, seedRole, settle } from './screens';

/**
 * State across rotation and resize (Phase 5 items 3 and 4). Each state is set up through the real UI, the window is resized with
 * page.setViewportSize (what a rotation or an unfold does to a web view: the size changes, nothing reloads) and the state must still be there.
 * Every check is also written to <out>/state-results.jsonl (state, pair, survived, evidence) for the report table.
 * apple-design layout.md "Design a layout that adapts gracefully" / iphone-duo "Keep functionality and the state of elements the same between displays".
 */
const PAIRS = [
  { id: 'phone', a: [390, 844], b: [844, 390] },
  { id: 'fold', a: [673, 841], b: [344, 882] }
] as const;

const record = (state: string, pair: string, survived: boolean, evidence: unknown) => {
  fs.mkdirSync(outDir(), { recursive: true });
  fs.appendFileSync(path.join(outDir(), 'state-results.jsonl'), JSON.stringify({ state, pair, survived, evidence }) + '\n');
};
const fromScreen = (id: string) => SCREENS.find((s) => s.id === id)!.open;
const size = (p: Page, w: number, h: number) => p.setViewportSize({ width: w, height: h });
const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const TOTAL = 60;
const PAGE = 24;

/** The catalogue is faked at 60 designs (as catalogue-swipe.e2e.ts does) so there is something to scroll and to swipe through. */
async function fakeCatalogue(page: Page) {
  let template: Record<string, unknown> | undefined;
  await page.route(/\/api\/v1\/products\?/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('limit') !== String(PAGE)) return route.continue();
    if (!template) template = (await (await route.fetch({ url: `${url.origin}${url.pathname}?limit=1&offset=0` })).json()).data[0];
    const from = Number(url.searchParams.get('cursor') ?? 0);
    const to = Math.min(from + PAGE, TOTAL);
    const data = Array.from({ length: to - from }, (_, i) => ({ ...template, id: `st-${from + i}`, sku: `ST-${from + i}`, title: `Design ${from + i + 1}` }));
    await route.fulfill({ json: { data, total: TOTAL, hasMore: to < TOTAL, cursor: String(to), cursorAfter: 'after' } });
  });
}
async function fakeCatalogueGrid(page: Page) {
  await seedRole(page, 'buyer');
  await fakeCatalogue(page);
  await page.goto(`/?store=${STORE_ID}`);
  await page.locator('[data-tab="catalogue"]').click();
  await page.getByTestId('product-card').first().waitFor();
  await settle(page);
}

test.use({ isMobile: true, hasTouch: true });

for (const pair of PAIRS) {
  const [aw, ah] = pair.a;
  const [bw, bh] = pair.b;
  const there = `${aw}x${ah}->${bw}x${bh}->${aw}x${ah}`;
  const rotate = async (page: Page, check: () => Promise<unknown>) => {
    await size(page, bw, bh);
    await page.waitForTimeout(700);
    await check();
    await size(page, aw, ah);
    await page.waitForTimeout(700);
    await check();
  };

  test.describe(`state across ${pair.id} ${there}`, () => {
    test('a. cart contents and order note', async ({ page }) => {
      await size(page, aw, ah);
      await seedRole(page, 'buyer');
      await page.goto(`/?store=${STORE_ID}`);
      await page.locator('[data-tab="catalogue"]').click();
      await page.getByTestId('product-card').first().waitFor();
      for (const n of [0, 1]) {
        await page.getByTestId('card-add-to-cart').nth(n).click();
        await page.getByTestId('cart-confirm').click();
        await page.getByTestId('cart-sheet-close').waitFor({ state: 'detached' });
      }
      await page.locator('[data-tab="orders"]').click();
      await page.getByTestId('place-order').waitFor();
      await page.getByTestId('order-note-input').fill('Matte finish, size 14');
      await settle(page);
      const snap = async () => ({
        lines: await page.locator('.em-li').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim())),
        note: await page.getByTestId('order-note-input').inputValue()
      });
      const before = await snap();
      expect(before.lines.length).toBe(2);
      let ok = true;
      await rotate(page, async () => {
        const after = await snap();
        ok = ok && JSON.stringify(after) === JSON.stringify(before);
        expect.soft(after, 'cart lines and note').toEqual(before);
      });
      record('cart', pair.id, ok, { lines: before.lines.length, note: before.note });
    });

    test('b. open product (3rd design)', async ({ page }) => {
      await size(page, aw, ah);
      await fakeCatalogueGrid(page);
      await page.getByTestId('product-card').first().locator('button').first().click();
      await page.getByTestId('product-gallery').waitFor();
      await page.getByTestId('design-next').click();
      await page.getByTestId('design-next').click();
      await expect(page.getByText(`Design 3 of ${TOTAL}`)).toBeVisible();
      await settle(page);
      const wrap = page.locator('.em-pd-wrap');
      const name = await wrap.getAttribute('aria-label');
      const roles = [await wrap.getAttribute('role')];
      let ok = true;
      await rotate(page, async () => {
        roles.push(await wrap.getAttribute('role'));
        ok = ok && (await wrap.getAttribute('aria-label')) === name && (await page.getByText(`Design 3 of ${TOTAL}`).isVisible());
        expect.soft(await wrap.getAttribute('aria-label'), 'same design open').toBe(name);
        await expect.soft(page.getByText(`Design 3 of ${TOTAL}`)).toBeVisible();
        expect.soft(await noOverflow(page)).toBe(true);
      });
      record('open product', pair.id, ok, { name, roles });
    });

    test('c. filled sign-up form and its step', async ({ page }) => {
      await size(page, aw, ah);
      await page.goto('/signup');
      await page.getByTestId('signup-brand').fill('Rotation Test Jewels');
      await page.getByTestId('signup-continue').click();
      const vals = { phone: '9812345678', email: 'rotate@example.com', password: 'LongPassword@2026' };
      await page.getByTestId('signup-phone').fill(vals.phone);
      await page.getByTestId('signup-email').fill(vals.email);
      await page.getByTestId('signup-password').fill(vals.password);
      await settle(page);
      const snap = async () => ({
        phone: await page.getByTestId('signup-phone').inputValue().catch(() => null),
        email: await page.getByTestId('signup-email').inputValue().catch(() => null),
        password: await page.getByTestId('signup-password').inputValue().catch(() => null),
        brandVisible: await page.getByTestId('signup-brand').isVisible()
      });
      let ok = true;
      await rotate(page, async () => {
        const s = await snap();
        ok = ok && JSON.stringify(s) === JSON.stringify({ ...vals, brandVisible: false });
        expect.soft(s).toEqual({ ...vals, brandVisible: false });
      });
      // back to step 1: the brand name is still there too
      await page.getByRole('button', { name: 'Back' }).click();
      const brand = await page.getByTestId('signup-brand').inputValue();
      expect.soft(brand).toBe('Rotation Test Jewels');
      record('sign-up form', pair.id, ok && brand === 'Rotation Test Jewels', { step: 'contact (step 2)', ...vals, brand });
    });

    for (const which of ['buyer-otp', 'signup-otp'] as const) {
      test(`d. OTP step: ${which}`, async ({ page }) => {
        await size(page, aw, ah);
        const phone = `98${crypto.randomInt(10_000_000, 99_999_999)}`;
        if (which === 'buyer-otp') {
          await fromScreen('otp-step')(page);
        } else {
          await fromScreen('signup-code')(page);
        }
        const code = page.getByLabel('6-digit code');
        await code.fill('1234');
        await settle(page);
        let ok = true;
        const stepGone = which === 'buyer-otp' ? page.locator('input[type=tel]') : page.getByTestId('signup-phone');
        await rotate(page, async () => {
          const v = await code.inputValue();
          const gone = (await stepGone.count()) === 0 || !(await stepGone.isVisible());
          ok = ok && v === '1234' && gone;
          expect.soft(v, 'typed digits').toBe('1234');
          expect.soft(gone, 'still on the code step').toBe(true);
        });
        record(`OTP step (${which})`, pair.id, ok, { typed: '1234', unusedPhone: phone });
      });
    }

    test('e. crop position', async ({ page }) => {
      await size(page, aw, ah);
      await seedRole(page, 'owner');
      await fromScreen('photo-cropper')(page);
      await settle(page);
      const frame = page.getByTestId('crop-frame');
      await page.getByLabel('Zoom').fill('2');
      const fb = (await frame.boundingBox())!;
      await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
      await page.mouse.down();
      await page.mouse.move(fb.x + fb.width / 2 - 40, fb.y + fb.height / 2 - 15, { steps: 5 });
      await page.mouse.up();
      const frac = () =>
        page.evaluate(() => {
          const f = document.querySelector('[data-testid="crop-frame"]')!.getBoundingClientRect();
          const i = document.querySelector('[data-testid="crop-frame"] img')!.getBoundingClientRect();
          return { w: f.width, expectedW: Math.min(320, window.innerWidth - 64), left: (i.left - f.left) / f.width, top: (i.top - f.top) / f.width, iw: i.width / f.width, ih: i.height / f.width };
        });
      const before = await frac();
      expect(before.w).toBeCloseTo(before.expectedW, 0);
      expect(before.left, 'the pan moved the photo').toBeLessThan(0);
      let worst = 0;
      await rotate(page, async () => {
        const a = await frac();
        expect.soft(a.w).toBeCloseTo(a.expectedW, 0);
        for (const k of ['left', 'top', 'iw', 'ih'] as const) {
          const px = Math.abs(a[k] - before[k]) * a.w;
          worst = Math.max(worst, px);
          expect.soft(px, `${k} drift in px at frame ${a.w}`).toBeLessThanOrEqual(0.5);
        }
      });
      record('crop position', pair.id, worst <= 0.5, { before, worstDriftPx: Number(worst.toFixed(3)) });
    });

    test('f. buyer tour step', async ({ page }) => {
      await size(page, aw, ah);
      await seedRole(page, 'buyer');
      await fromScreen('buyer-tour')(page);
      const card = page.locator('.em-tour-card');
      for (const from of ['hello', 'lang']) {
        await expect(card).toHaveAttribute('data-step', from);
        await page.getByTestId('tour-next').click();
      }
      await expect(card).toHaveAttribute('data-step', 'search');
      await page.waitForTimeout(800);
      const step = await card.getAttribute('data-step');
      const label = await page.getByTestId('buyer-tour').getAttribute('aria-label');
      expect(label).toMatch(/step 3 of \d+/);
      let ok = true;
      let worst = 0;
      await rotate(page, async () => {
        await page.waitForTimeout(700);
        const holeVsTarget = await page.evaluate(() => {
          const h = document.querySelector('.em-tour-hole')!.getBoundingClientRect();
          const t = (document.querySelector('[data-testid="home-search"]')!.closest('.em-srch') ?? document.querySelector('[data-testid="home-search"]'))!.getBoundingClientRect();
          return [h.left - (t.left - 8), h.top - (t.top - 8), h.width - (t.width + 16), h.height - (t.height + 16)].map((d) => Math.abs(d));
        });
        const w = Math.max(...holeVsTarget);
        worst = Math.max(worst, w);
        const same = (await card.getAttribute('data-step')) === step && (await page.getByTestId('buyer-tour').getAttribute('aria-label')) === label;
        ok = ok && same && w <= 2;
        expect.soft(same, 'step and aria-label unchanged').toBe(true);
        expect.soft(w, 'hole vs target+8px, px').toBeLessThanOrEqual(2);
      });
      record('tour step', pair.id, ok, { step, label, worstHoleDiffPx: Number(worst.toFixed(2)) });
    });

    test('g. catalogue grid scroll position', async ({ page }) => {
      await size(page, aw, ah);
      await fakeCatalogueGrid(page);
      const title = page.locator('.em-card-t').nth(14);
      const name = (await title.textContent())!;
      // the card's top edge just under the top bar (60px): a card cut by the bar is the usual place to stop scrolling
      await title.evaluate((el) => (el.closest('.em-cardwrap') as HTMLElement).scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -80));
      await page.waitForTimeout(300);
      const read = () =>
        page.evaluate((n) => {
          const el = [...document.querySelectorAll('.em-card-t')].find((e) => e.textContent === n)!.closest('.em-cardwrap')!;
          const r = el.getBoundingClientRect();
          return { scrollY: Math.round(window.scrollY), cardTop: Math.round(r.top), inView: r.top < window.innerHeight && r.bottom > 0, vh: window.innerHeight };
        }, name);
      const before = await read();
      expect(before.scrollY).toBeGreaterThan(500);
      const legs: unknown[] = [];
      let allIn = true;
      await rotate(page, async () => {
        const r = await read();
        legs.push(r);
        allIn = allIn && r.inView;
        expect.soft(r.inView, `${name} stays in view`).toBe(true);
      });
      // The grid keeps the first card under the bar where it was; the next rows move with the card height, which changes with the width. Back at the first size the card is where it was.
      const drift = (legs as { cardTop: number }[]).map((l) => Math.abs(l.cardTop - before.cardTop));
      expect.soft(drift[1], 'back at the first size: card top drift, px').toBeLessThanOrEqual(24);
      record('grid scroll', pair.id, allIn && drift[1] <= 24, { card: name, before, legs, cardTopDriftPx: drift });
    });
  });
}

// The two resizes the Phase 2 JS agent named for the crop: fractions of the frame equal at 340x700 and 1200x800.
test('e2. crop position at 340x700 and 1200x800', async ({ page }) => {
  await size(page, 390, 844);
  await seedRole(page, 'owner');
  await fromScreen('photo-cropper')(page);
  await settle(page);
  await page.getByLabel('Zoom').fill('2.2');
  const fb = (await page.getByTestId('crop-frame').boundingBox())!;
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width / 2 - 50, fb.y + fb.height / 2 - 20, { steps: 5 });
  await page.mouse.up();
  const frac = () =>
    page.evaluate(() => {
      const f = document.querySelector('[data-testid="crop-frame"]')!.getBoundingClientRect();
      const i = document.querySelector('[data-testid="crop-frame"] img')!.getBoundingClientRect();
      return { w: f.width, left: (i.left - f.left) / f.width, top: (i.top - f.top) / f.width, iw: i.width / f.width, ih: i.height / f.width };
    });
  const before = await frac();
  let worst = 0;
  const widths: number[] = [];
  for (const [w, h] of [[340, 700], [1200, 800], [390, 844]]) {
    await size(page, w, h);
    await page.waitForTimeout(400);
    const a = await frac();
    widths.push(a.w);
    expect.soft(a.w).toBeCloseTo(Math.min(320, w - 64), 0);
    for (const k of ['left', 'top', 'iw', 'ih'] as const) {
      const px = Math.abs(a[k] - before[k]) * a.w;
      worst = Math.max(worst, px);
      expect.soft(px, `${k} drift at ${w}x${h}`).toBeLessThanOrEqual(0.5);
    }
  }
  record('crop position', '340x700, 1200x800, back', worst <= 0.5, { frameWidths: widths, worstDriftPx: Number(worst.toFixed(3)) });
});

// Foldable (item 4). Capacitor has no fold-posture API: only the window width changes, so width is all the app can react to.
test.describe('foldable 344x882 <-> 673x841', () => {
  const cols = (page: Page) => page.locator('.em-grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

  // TABLET_MIN is 640 (useDesktop.ts and the min-width: 640px queries in emergent.css) so an unfolded 673px foldable gets the tablet tier.
  test('unfolded 673x841 is the tablet tier (four columns, two-pane)', async ({ page }) => {
    await size(page, 673, 841);
    await fakeCatalogueGrid(page);
    expect(await cols(page), 'unfolded: four photo columns').toBe(4);
    await page.getByTestId('product-card').nth(1).locator('button').first().click();
    await page.getByTestId('product-gallery').waitFor();
    expect(await page.locator('.em-pd-wrap').getAttribute('role'), 'unfolded: two-pane').toBe('region');
  });

  test('what 673x841 and 344x882 actually are today', async ({ page }) => {
    await size(page, 673, 841);
    await fakeCatalogueGrid(page);
    const unfolded = { cols: await cols(page), noOverflow: await noOverflow(page) };
    await page.getByTestId('product-card').nth(1).locator('button').first().click();
    await page.getByTestId('product-gallery').waitFor();
    await settle(page);
    const role = await page.locator('.em-pd-wrap').getAttribute('role');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(role === 'dialog' ? 'hidden' : '');
    record('fold: 673x841 static', 'static', unfolded.cols === 4 && role === 'region', { ...unfolded, productRole: role, note: 'tablet tier expected at 673 (TABLET_MIN=640)' });

    await size(page, 344, 882);
    await expect(page.locator('.em-pd-wrap')).toHaveAttribute('role', 'dialog');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.goBack();
    await page.getByTestId('product-gallery').waitFor({ state: 'detached' });
    const folded = await cols(page);
    expect(folded, 'folded: phone grid').toBe(2);
    expect(await noOverflow(page)).toBe(true);
    record('fold: 344x882 static', 'static', true, { cols: folded, productRole: 'dialog' });
  });

  test('live resize 344 -> 673 -> 344 with a product open and a scrolled grid', async ({ page }) => {
    await size(page, 344, 882);
    await fakeCatalogueGrid(page);
    await page.locator('.em-card-t').nth(10).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    await page.getByTestId('product-card').nth(10).locator('button').first().click();
    await page.getByTestId('product-gallery').waitFor();
    await settle(page);
    const wrap = page.locator('.em-pd-wrap');
    const name = await wrap.getAttribute('aria-label');
    const steps: unknown[] = [];
    for (const [w, h] of [[344, 882], [673, 841], [344, 882]] as const) {
      await size(page, w, h);
      await page.waitForTimeout(500);
      const role = (await wrap.getAttribute('role'))!;
      const lock = role === 'dialog' ? 'hidden' : '';
      const s = {
        w,
        role,
        sameDesign: (await wrap.getAttribute('aria-label')) === name,
        noOverflow: await noOverflow(page),
        bodyLock: await page.evaluate(() => document.body.style.overflow),
        scrollY: await page.evaluate(() => Math.round(window.scrollY))
      };
      steps.push(s);
      expect.soft(s.sameDesign, `design kept at ${w}`).toBe(true);
      expect.soft(s.noOverflow, `no overflow at ${w}`).toBe(true);
      expect.soft(s.bodyLock, `scroll-lock matches the layout at ${w}`).toBe(lock);
    }
    record('fold: live resize with product + scrolled grid', '344->673->344', steps.every((s) => (s as { sameDesign: boolean; noOverflow: boolean }).sameDesign && (s as { noOverflow: boolean }).noOverflow), steps);
  });
});
