import type { Page } from '@playwright/test';
import crypto from 'crypto';
import sharp from 'sharp';
import { STORE_ID, sessions } from './env';

export type Role = 'buyer' | 'owner' | 'guest';

export interface Screen {
  id: string;
  role: Role;
  /** Gets the page to the screen the way a person would (URL, then real clicks). Throws if it cannot. */
  open: (page: Page) => Promise<void>;
  /** Set when the screen cannot be reached at all yet; the tests for it are skipped with this reason. */
  fixme?: string;
}

/** Per role: what is in localStorage before the app starts (the session token, the store, and "tour already done" so the tour does not cover every buyer screen). */
export async function seedRole(page: Page, role: Role) {
  const s = sessions();
  const items: Record<string, string> =
    role === 'buyer' ? { catalogue_session: s.buyer.token, store: STORE_ID, [`tour-done:${s.buyer.phone}`]: '1' } : role === 'owner' ? { catalogue_session: s.owner.token, store: STORE_ID } : {};
  await page.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {
      // opaque origins (about:blank) have no storage
    }
  }, items);
}

/** Fonts loaded, photos decoded, entrance animations finished (the app slides and fades screens in for a few hundred ms). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
}

const store = (page: Page) => page.goto(`/?store=${STORE_ID}`);
const tab = (page: Page, name: string) => page.locator(`[data-tab="${name}"]`).click();
/** An 8-digit suffix makes a number the server has not seen (each number may ask for only 5 codes an hour). Must pass isRealMobile: starts 9, not 5 repeated digits. */
const freshPhone = () => `98${crypto.randomInt(10_000_000, 99_999_999)}`;

const buyerHome = async (page: Page) => {
  await store(page);
  await page.getByTestId('home-collection').first().waitFor();
};
const buyerCatalogue = async (page: Page) => {
  await buyerHome(page);
  await tab(page, 'catalogue');
  await page.getByTestId('product-card').first().waitFor();
};
const addToCart = async (page: Page) => {
  await buyerCatalogue(page);
  // A short landscape window: scroll the button to the middle first and let the sticky filters slide away (they do when the page scrolls down),
  // or Playwright's own scrolling leaves the button under the filters, the header or the tab bar and gives up.
  const add = page.getByTestId('card-add-to-cart').first();
  await add.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await add.click();
  await page.getByTestId('cart-sheet-close').waitFor();
};

export const SCREENS: Screen[] = [
  { id: 'home', role: 'buyer', open: buyerHome },
  { id: 'catalogue-grid', role: 'buyer', open: buyerCatalogue },
  {
    id: 'product-detail',
    role: 'buyer',
    open: async (page) => {
      await buyerCatalogue(page);
      await page.getByTestId('product-card').first().locator('button, a, img').first().click();
      await page.getByTestId('product-gallery').waitFor();
    }
  },
  { id: 'cart-sheet', role: 'buyer', open: addToCart },
  {
    id: 'orders-cart',
    role: 'buyer',
    open: async (page) => {
      await addToCart(page);
      await page.getByTestId('cart-confirm').click();
      await tab(page, 'orders');
      await page.getByTestId('place-order').waitFor();
    }
  },
  {
    id: 'profile-menu',
    role: 'buyer',
    open: async (page) => {
      await buyerHome(page);
      await page.getByRole('button', { name: 'Profile menu' }).click();
      await page.getByTestId('menu-tour').waitFor({ state: 'attached' });
    }
  },
  {
    // Real clicks: profile menu, "Take the app tour". The sign-up route also starts it, but it needs a brand-new number, which the OTP rate limit cannot afford 26 times.
    id: 'buyer-tour',
    role: 'buyer',
    open: async (page) => {
      await buyerHome(page);
      await page.getByRole('button', { name: 'Profile menu' }).click();
      await page.getByTestId('menu-tour').click().catch(() => {
        throw new Error('"Take the app tour" in the open profile menu cannot be clicked (not reachable at this size)');
      });
      await page.getByTestId('tour-next').waitFor();
    }
  },
  {
    id: 'owner-hub',
    role: 'owner',
    open: async (page) => {
      await store(page);
      await page.getByTestId('admin-today').waitFor();
    }
  },
  {
    id: 'new-product',
    role: 'owner',
    open: async (page) => {
      await store(page);
      await page.getByTestId('new-design-card').click();
      await page.getByTestId('np-save').waitFor();
    }
  },
  {
    // A landscape photo into the design picker: the app offers the crop step because it is not square.
    id: 'photo-cropper',
    role: 'owner',
    open: async (page) => {
      await store(page);
      await page.getByTestId('new-design-card').click();
      const photo = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#cc8844' } }).png().toBuffer();
      await page.getByTestId('photo-gallery-input').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: photo });
      await page.getByRole('button', { name: 'Use photo' }).waitFor();
    }
  },
  {
    // Signed-out buyer: the welcome page, "Enter the portal", a number, "Send code": the code boxes are the OTP step.
    id: 'otp-step',
    role: 'guest',
    open: async (page) => {
      await store(page);
      await page.getByRole('button', { name: /Enter the portal/ }).click();
      await page.locator('input[type=tel]').fill(freshPhone());
      await page.locator('form button[type=submit]').first().click();
      await page.getByLabel('6-digit code').waitFor({ state: 'attached' });
    }
  },
  {
    id: 'signup',
    role: 'guest',
    open: async (page) => {
      await page.goto('/signup');
      await page.getByTestId('signup-brand').waitFor();
    }
  },
  {
    // Platform sign-up through its three steps to the code box (a real code is sent through the static-OTP provider; the store is not created).
    id: 'signup-code',
    role: 'guest',
    open: async (page) => {
      await page.goto('/signup');
      await page.getByTestId('signup-brand').fill('Responsive Test Jewels');
      await page.getByTestId('signup-continue').click();
      await page.getByTestId('signup-phone').fill(freshPhone());
      await page.getByTestId('signup-email').fill(`rt${crypto.randomInt(1e6)}@example.com`);
      await page.getByTestId('signup-password').fill('LongPassword@2026');
      await page.getByTestId('signup-send-code').click();
      await page.getByLabel('6-digit code').waitFor({ state: 'attached' });
    }
  },
  {
    id: 'landing',
    role: 'guest',
    open: async (page) => {
      await page.goto('/welcome-antarixs');
      await page.locator('.ax').first().waitFor();
    }
  },
  {
    id: 'console',
    role: 'guest',
    open: async (page) => {
      await page.goto('/console');
      await page.locator('#root > *').first().waitFor();
    }
  },
  {
    id: 'offline',
    role: 'guest',
    open: async (page) => {
      await page.goto('/offline.html');
      await page.getByRole('button', { name: 'Try again' }).waitFor();
    }
  }
];
