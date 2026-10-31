import { expect, request, test } from '@playwright/test';
import { BASE, STORE_ID, sessions } from './env';
import { seedRole, settle } from './screens';

// The Instagram and Facebook links the owner types in About us must show on Home as real links (they used to read "Coming soon").
test('Home links to the Instagram and Facebook pages from About us', async ({ page }) => {
  const api = await request.newContext({ baseURL: BASE(), extraHTTPHeaders: { 'X-Store': STORE_ID, Authorization: `Bearer ${sessions().owner.token}` } });
  const saved = await api.put('/api/v1/about', { data: { instagram: 'https://instagram.com/bhakti.jewels', facebook: 'https://facebook.com/bhaktijewels' } });
  expect(saved.ok(), await saved.text()).toBe(true);
  await api.dispose();

  await seedRole(page, 'buyer');
  await page.goto(`/?store=${STORE_ID}`);
  await page.getByTestId('home-collection').first().waitFor();
  await page.getByTestId('social-links').scrollIntoViewIfNeeded();
  await settle(page);
  await expect(page.getByTestId('social-links').getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://instagram.com/bhakti.jewels');
  await expect(page.getByTestId('social-links').getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/bhaktijewels');
  await expect(page.getByTestId('social-soon-instagram')).toHaveCount(0);
});
