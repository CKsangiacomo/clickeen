import { test, expect } from '@playwright/test';

// Basic smoke to ensure the main app renders and public routes work.
test.describe('App smoke', () => {
  test('homepage renders', async ({ page }) => {
    await page.goto('http://localhost:3001/');
    await expect(page).toHaveTitle(/CK|Clickeen|App/i);
  });

  test('/studio redirect resolves to static shell', async ({ page }) => {
    await page.goto('http://localhost:3001/studio');
    await expect(page).toHaveURL('http://localhost:3001/studio');
  });

  test('public auth pages load without envs', async ({ page }) => {
    for (const path of ['/auth/login', '/auth/confirm', '/invites/accept']) {
      await page.goto(`http://localhost:3001${path}`);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });
});
