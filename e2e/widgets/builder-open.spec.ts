import { expect, test } from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

test.describe('Roma Builder authenticated smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCookies(), 'No e2e auth state found. Configure E2E_USER_EMAIL and E2E_AUTH_SECRET.');
  });

  test('opens Widgets and loads the first editable instance in Builder', async ({ page }, testInfo) => {
    await page.goto('/widgets');

    await expect(page).toHaveURL(/\/widgets/);
    await expect(page.getByRole('heading', { name: 'Widgets' })).toBeVisible();

    const editButtons = page.getByRole('link', { name: 'Edit' });
    const editCount = await editButtons.count();
    test.skip(editCount === 0, 'The e2e account has no editable widget instances.');

    await editButtons.first().click();
    await expect(page).toHaveURL(/\/builder\/[A-Z0-9]+/);
    await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible();

    const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
    await expect(bobFrame.getByRole('button', { name: /Manual/i })).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByRole('heading', { name: /Content|Translations|Appearance|Layout|Typography|Settings/ })).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('builder-open.png'), fullPage: true });
  });
});
