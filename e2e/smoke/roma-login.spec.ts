import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('Roma login page is reachable without auth', async ({ page }, testInfo) => {
  await page.goto('/login');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('roma-login.png'), fullPage: true });
});
