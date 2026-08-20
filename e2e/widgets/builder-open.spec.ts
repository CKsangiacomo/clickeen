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
    // The ordinary shell page header is omitted on the full-canvas Builder;
    // exactly one .page__header remains — Roma's publication header.
    await expect(page.locator('.page__header')).toHaveCount(1);

    const bobIframe = page.locator('iframe[title="Bob Builder"]');
    const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
    await expect(bobFrame.locator('.tooldrawer')).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByRole('radio', { name: 'Manual' })).toBeVisible({ timeout: 20_000 });
    await expect(bobFrame.getByText('Content').first()).toBeVisible();
    const builderHeader = page.locator('header.page__header[data-width="full"]');
    await expect(builderHeader).toBeVisible({ timeout: 30_000 });
    await expect(builderHeader.locator(':scope > .page__heading > h1.heading-2')).toBeVisible();
    await expect(builderHeader.locator(':scope > .page__heading .diet-badge')).toBeVisible();
    await expect(builderHeader.locator(':scope > .page__heading .diet-toggle')).toBeVisible();
    const [builderHeadingBox, builderActionsBox, builderPageBox, builderHeaderBox] = await Promise.all([
      builderHeader.locator(':scope > .page__heading').boundingBox(),
      builderHeader.locator(':scope > .page__actions').boundingBox(),
      page.locator('main.page').boundingBox(),
      builderHeader.boundingBox(),
    ]);
    expect(builderHeadingBox).not.toBeNull();
    expect(builderActionsBox).not.toBeNull();
    expect(builderPageBox).not.toBeNull();
    expect(builderHeaderBox).not.toBeNull();
    expect(
      Math.abs(
        (builderHeadingBox?.y ?? 0) + (builderHeadingBox?.height ?? 0) / 2
          - ((builderActionsBox?.y ?? 0) + (builderActionsBox?.height ?? 0) / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(builderHeaderBox?.x).toBe(builderPageBox?.x);
    expect(builderHeaderBox?.width).toBe(builderPageBox?.width);
    await expect(bobFrame.locator('section.workspace[data-widget-ready="true"]')).toBeVisible({
      timeout: 30_000,
    });
    await bobFrame.getByRole('tab', { name: 'Appearance' }).click();
    await expect(bobFrame.getByText('Builder controls failed to load.')).toHaveCount(0);
    const borderCluster = bobFrame.locator('.tdmenucontent__cluster:has(.diet-dropdown-border)').first();
    const borderClusterToggle = borderCluster.locator('.tdmenucontent__cluster-toggle');
    await expect(borderClusterToggle).toHaveAttribute('aria-expanded', 'false');
    await borderClusterToggle.click();
    await expect(borderCluster.locator('.diet-dropdown-border').first()).toBeVisible();
    const [iframeBox, toolDrawerBox, workspaceBox] = await Promise.all([
      bobIframe.boundingBox(),
      bobFrame.locator('.tooldrawer').boundingBox(),
      bobFrame.locator('.workspace').boundingBox(),
    ]);
    expect(iframeBox?.width ?? 0).toBeGreaterThan(900);
    expect(iframeBox?.height ?? 0).toBeGreaterThan(600);
    expect(toolDrawerBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    const builderHeaderBottom =
      (builderHeaderBox?.y ?? 0) + (builderHeaderBox?.height ?? 0);
    expect(
      Math.abs((iframeBox?.y ?? 0) - builderHeaderBottom - 16),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((toolDrawerBox?.y ?? 0) - builderHeaderBottom - 16),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((workspaceBox?.y ?? 0) - builderHeaderBottom - 16),
    ).toBeLessThanOrEqual(1);
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

    const copyCodeAction = page.locator('header.page__header').getByRole('button', { name: 'Copy code' });
    await expect(copyCodeAction).toBeVisible();
    await copyCodeAction.click();
    const copyCodeDialog = page.getByRole('dialog', { name: 'Copy code' });
    await expect(copyCodeDialog).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Widget URL' })).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Embed code' })).toBeVisible();
    await expect(copyCodeDialog.getByRole('heading', { name: 'Script code' })).toHaveCount(0);
    await expect(copyCodeDialog.locator('.diet-popup__dismiss')).toHaveAttribute('aria-label', 'Close');
    await copyCodeDialog.locator('.diet-popup__footer').getByRole('button', { name: 'Close' }).click();
    await expect(copyCodeDialog).toBeHidden();

    await page.screenshot({ path: testInfo.outputPath('builder-open.png'), fullPage: true });
    await bobFrame.locator('.builder-app').screenshot({ path: testInfo.outputPath('bob-editor.png') });

    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.locator('aside.left-nav')).toBeVisible();
    await expect(page.locator('aside.left-nav a.roma-nav__link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('aside.left-nav')).toBeHidden();
  });

  test('uses the same centered contained header grammar on an ordinary Roma domain', async ({ page }) => {
    await page.goto('/profile');

    const header = page.locator('header.page__header[data-width="contained"]');
    const heading = header.locator(':scope > .page__heading');
    const actions = header.locator(':scope > .page__actions');
    await expect(header).toBeVisible();
    await expect(heading.getByRole('heading', { name: 'User Settings' })).toBeVisible();
    await expect(actions.locator('.diet-button')).toHaveCount(2);
    expect(await actions.locator('.diet-button').evaluateAll((buttons) => (
      buttons.map((button) => button.getAttribute('data-size'))
    ))).toEqual(['large', 'large']);

    const [headingBox, actionsBox, contentBox, headerBox] = await Promise.all([
      heading.boundingBox(),
      actions.boundingBox(),
      page.locator('main.page > .page__content').boundingBox(),
      header.boundingBox(),
    ]);
    expect(headingBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(
      Math.abs(
        (headingBox?.y ?? 0) + (headingBox?.height ?? 0) / 2
          - ((actionsBox?.y ?? 0) + (actionsBox?.height ?? 0) / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(headerBox?.x).toBe(contentBox?.x);
    expect(headerBox?.width).toBe(contentBox?.width);
    expect(
      Math.abs(
        (contentBox?.y ?? 0)
          - ((headerBox?.y ?? 0) + (headerBox?.height ?? 0))
          - 16,
      ),
    ).toBeLessThanOrEqual(1);
  });
});
