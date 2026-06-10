import { expect, test } from '@playwright/test';

const navGroups = [
  {
    title: 'Foundations',
    count: 3,
    routes: [
      { path: '/#/dieter/colors', title: 'Colors' },
      { path: '/#/dieter/icons', title: 'Icons' },
      { path: '/#/dieter/typography', title: 'Typography' },
    ],
  },
  {
    title: 'Dieter Components',
    count: 20,
    routes: [
      { path: '/#/dieter/bulk-edit', title: 'Bulk Edit' },
      { path: '/#/dieter/button', title: 'Button' },
      { path: '/#/dieter/choice-tiles', title: 'Choice Tiles' },
      { path: '/#/dieter/dropdown-actions', title: 'Dropdown Actions' },
      { path: '/#/dieter/dropdown-border', title: 'Dropdown Border' },
      { path: '/#/dieter/dropdown-edit', title: 'Dropdown Edit' },
      { path: '/#/dieter/dropdown-fill', title: 'Dropdown Fill' },
      { path: '/#/dieter/dropdown-shadow', title: 'Dropdown Shadow' },
      { path: '/#/dieter/dropdown-upload', title: 'Dropdown Upload' },
      { path: '/#/dieter/menuactions', title: 'Menuactions' },
      { path: '/#/dieter/object-manager', title: 'Object Manager' },
      { path: '/#/dieter/popaddlink', title: 'Popaddlink' },
      { path: '/#/dieter/popover', title: 'Popover' },
      { path: '/#/dieter/repeater', title: 'Repeater' },
      { path: '/#/dieter/segmented', title: 'Segmented' },
      { path: '/#/dieter/slider', title: 'Slider' },
      { path: '/#/dieter/tabs', title: 'Tabs' },
      { path: '/#/dieter/textfield', title: 'Textfield' },
      { path: '/#/dieter/toggle', title: 'Toggle' },
      { path: '/#/dieter/valuefield', title: 'Valuefield' },
    ],
  },
  {
    title: 'Policy',
    count: 1,
    routes: [{ path: '/#/policy/entitlements', title: 'Policy Editor' }],
  },
] as const;

const expectedRoutes = navGroups.flatMap((group) => group.routes);

test.describe('DevStudio route contract', () => {
  test('renders the three-section authenticated shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'DevStudio' })).toBeVisible();

    const groups = page.locator('.nav-group');
    await expect(groups).toHaveCount(navGroups.length);

    for (const [index, group] of navGroups.entries()) {
      const section = groups.nth(index);
      await expect(section.locator('.nav-group__title')).toHaveText(group.title);
      await expect(section.locator('.nav-link')).toHaveCount(group.count);
    }

    await expect(page.locator('.nav-link', { hasText: 'Bob UI Native' })).toHaveCount(0);
    await expect(page.locator('.nav-link[href^="#/tools/"]')).toHaveCount(0);
    await expect(page.locator('.nav-link[href="#/policy/entitlements"]')).toHaveCount(1);
  });

  for (const route of expectedRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto(route.path);
      await expect(page.locator('.devstudio-page')).toBeVisible();
      await expect(page.getByRole('heading', { name: route.title })).toBeVisible();
      await expect(page.locator('.nav-link[aria-current="page"]')).toHaveAttribute(
        'href',
        route.path.slice(1),
      );
      await expect(page.getByRole('heading', { name: 'Missing' })).toHaveCount(0);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  test('renders the policy read lane without mutating policy', async ({ page }) => {
    const entitlements = page.waitForResponse(
      (response) =>
        response.url().includes('/api/entitlements/matrix') &&
        response.request().method() === 'GET',
    );
    const aiRuntime = page.waitForResponse(
      (response) =>
        response.url().includes('/api/ai-runtime/matrix') && response.request().method() === 'GET',
    );

    await page.goto('/#/policy/entitlements');

    const [entitlementsResponse, aiRuntimeResponse] = await Promise.all([entitlements, aiRuntime]);
    expect(entitlementsResponse.status()).toBe(200);
    expect(aiRuntimeResponse.status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Policy Editor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Model Catalog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Customer Copilots' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System Agents' })).toBeVisible();
    for (const tier of ['Free', 'Tier1', 'Tier2', 'Tier3', 'Tier4']) {
      await expect(
        page.getByRole('columnheader', { name: tier, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test('deleted tool routes fall back to the first live page', async ({ page }) => {
    for (const deletedRoute of ['/#/tools/bob-ui-native', '/#/tools/entitlements']) {
      await page.goto(deletedRoute);
      await expect(page).toHaveURL(/#\/dieter\/colors$/);
      await expect(page.getByRole('heading', { name: 'Colors' })).toBeVisible();
      await expect(page.getByText('Bob UI Native')).toHaveCount(0);
    }
  });
});
