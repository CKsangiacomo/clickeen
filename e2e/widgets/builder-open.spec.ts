import { expect, test } from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

test.describe('Roma Builder authenticated smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCookies(), 'No e2e auth state found. Create an ignored storage state file before running authenticated specs.');
  });

  test('opens Widgets and loads the first editable instance in Builder', async ({ page }, testInfo) => {
    await page.goto('/widgets');

    await expect(page).toHaveURL(/\/widgets/);
    await expect(page.getByRole('heading', { name: 'Widgets' })).toBeVisible();

    const editLink = page.getByRole('link', { name: 'Edit' }).first();
    await expect(editLink).toBeVisible({ timeout: 20_000 });
    await editLink.click();
    await expect(page).toHaveURL(/\/builder\/[A-Z0-9]+/);
    await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible();

    const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
    await expect(bobFrame.getByRole('button', { name: /Manual/i })).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByText('Content').first()).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('builder-open.png'), fullPage: true });
  });
});
