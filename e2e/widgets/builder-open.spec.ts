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
    await expect(page.locator('.page__header')).toHaveCount(0);

    const bobIframe = page.locator('iframe[title="Bob Builder"]');
    const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
    await expect(bobFrame.locator('.topdrawer')).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByRole('button', { name: /Manual/i })).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByText('Content').first()).toBeVisible();
    await expect(bobFrame.locator('.topdrawer-instance-title')).toBeVisible({ timeout: 30_000 });
    await expect(bobFrame.locator('section.workspace[data-widget-ready="true"]')).toBeVisible({
      timeout: 30_000,
    });
    await bobFrame.getByRole('tab', { name: 'Appearance' }).click();
    await expect(bobFrame.getByText('Builder controls failed to load.')).toHaveCount(0);
    await expect(bobFrame.locator('.diet-dropdown-border').first()).toBeVisible();
    const iframeBox = await bobIframe.boundingBox();
    expect(iframeBox?.width ?? 0).toBeGreaterThan(900);
    expect(iframeBox?.height ?? 0).toBeGreaterThan(600);
    const outerCanvasBackground = await page
      .locator('.main-container')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const pageBackground = await page
      .locator('main.page')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const bobCanvasBackground = await bobFrame
      .locator('.builder-app')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const bobWorkspaceBackground = await bobFrame
      .locator('.workspace')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(pageBackground).toBe(outerCanvasBackground);
    expect(bobCanvasBackground).toBe(outerCanvasBackground);
    expect(bobWorkspaceBackground).toBe(outerCanvasBackground);

    await bobFrame.getByRole('button', { name: 'More' }).click();
    const copyCodeAction = bobFrame.getByRole('menuitem', { name: 'Copy code' });
    await expect(copyCodeAction).toBeVisible();
    await copyCodeAction.click();
    const copyCodeDialog = page.getByRole('dialog', { name: 'Copy code' });
    await expect(copyCodeDialog).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Widget URL' })).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Embed code' })).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Script code' })).toBeVisible();
    await copyCodeDialog.getByRole('button', { name: 'Close' }).click();
    await expect(copyCodeDialog).toBeHidden();

    await page.screenshot({ path: testInfo.outputPath('builder-open.png'), fullPage: true });
    await bobFrame.locator('.builder-app').screenshot({ path: testInfo.outputPath('bob-editor.png') });

    await page.setViewportSize({ width: 844, height: 390 });
    await bobFrame.getByRole('button', { name: 'Open Clickeen navigation' }).click();
    await expect(page.locator('aside.left-nav')).toBeVisible();
    await expect(page.locator('aside.left-nav a.roma-nav__link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('aside.left-nav')).toBeHidden();
  });
});
