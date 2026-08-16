import { expect, test, type Page } from '@playwright/test';

const ENTITLEMENT_MATRIX_PATH = '/api/entitlements/matrix';
const ENTITLEMENT_CELL_PATH = '/api/entitlements/matrix/cell';
const AI_RUNTIME_MATRIX_PATH = '/api/ai-runtime/matrix';
const AI_RUNTIME_CELL_PATH = '/api/ai-runtime/matrix/cell';
const ENTITLEMENT_RETURNED_MATRIX_PROOF = 'prd126a.returned.matrix';
const AI_RETURNED_MATRIX_PROOF_VALUE = 126123;

async function guardUnexpectedApiMutations(page: Page) {
  const unexpectedMutations: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
    unexpectedMutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    await route.abort('blockedbyclient');
  });
  return unexpectedMutations;
}

async function openPolicyEditor(page: Page) {
  const entitlements = page.waitForResponse(
    (response) =>
      response.url().endsWith(ENTITLEMENT_MATRIX_PATH) && response.request().method() === 'GET',
  );
  const aiRuntime = page.waitForResponse(
    (response) =>
      response.url().endsWith(AI_RUNTIME_MATRIX_PATH) && response.request().method() === 'GET',
  );

  await page.goto('/#/policy/entitlements');
  const [entitlementsResponse, aiRuntimeResponse] = await Promise.all([entitlements, aiRuntime]);
  expect(entitlementsResponse.status()).toBe(200);
  expect(aiRuntimeResponse.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer Copilots' })).toBeVisible();
  return {
    entitlements: await entitlementsResponse.json(),
    aiRuntime: await aiRuntimeResponse.json(),
  };
}

async function triggerTextInputSave(page: Page, sectionTitle: string) {
  const section = page.locator('section.entitlements-section').filter({
    has: page.getByRole('heading', { name: sectionTitle, exact: true }),
  });
  const input = section.locator('input[type="text"]:not([disabled])').first();
  await expect(input).toBeVisible();
  await input.focus();
  const value = await input.inputValue();
  await input.fill(value);
  await input.evaluate((element) => element.blur());
}

async function expectPolicyEditorBusy(page: Page) {
  await expect(page.getByRole('button', { name: 'Reload' })).toBeDisabled();
  await expect(
    page.locator(
      '#entitlements-root input:not([disabled]), #entitlements-root select:not([disabled])',
    ),
  ).toHaveCount(0);
}

const navGroups = [
  {
    title: 'Foundations',
    count: 5,
    routes: [
      { path: '/#/dieter/core-styles', title: 'Core styles' },
      { path: '/#/dieter/colors', title: 'Colors' },
      { path: '/#/dieter/icons', title: 'Icons' },
      { path: '/#/dieter/typography', title: 'Typography' },
      { path: '/#/dieter/layouts', title: 'Layouts' },
    ],
  },
  {
    title: 'Dieter Components',
    count: 29,
    routes: [
      { path: '/#/dieter/agent-activity', title: 'Agent Activity' },
      { path: '/#/dieter/badge', title: 'Badge' },
      { path: '/#/dieter/banner', title: 'Banner' },
      { path: '/#/dieter/bulk-edit', title: 'Bulk Edit' },
      { path: '/#/dieter/button', title: 'Button' },
      { path: '/#/dieter/choice-tiles', title: 'Choice Tiles' },
      { path: '/#/dieter/data-table', title: 'Data Table' },
      { path: '/#/dieter/date-range-picker', title: 'Date Range Picker' },
      { path: '/#/dieter/datefield', title: 'Datefield' },
      { path: '/#/dieter/dropdown-actions', title: 'Dropdown Actions' },
      { path: '/#/dieter/dropdown-border', title: 'Dropdown Border' },
      { path: '/#/dieter/dropdown-edit', title: 'Dropdown Edit' },
      { path: '/#/dieter/dropdown-fill', title: 'Dropdown Fill' },
      { path: '/#/dieter/dropdown-shadow', title: 'Dropdown Shadow' },
      { path: '/#/dieter/dropdown-upload', title: 'Dropdown Upload' },
      { path: '/#/dieter/menuactions', title: 'Menuactions' },
      { path: '/#/dieter/object-manager', title: 'Object Manager' },
      { path: '/#/dieter/popover', title: 'Popover' },
      { path: '/#/dieter/popup', title: 'Popup' },
      { path: '/#/dieter/repeater', title: 'Repeater' },
      { path: '/#/dieter/segmented', title: 'Segmented' },
      { path: '/#/dieter/slider', title: 'Slider' },
      { path: '/#/dieter/spinner', title: 'Spinner' },
      { path: '/#/dieter/table', title: 'Table' },
      { path: '/#/dieter/tabs', title: 'Tabs' },
      { path: '/#/dieter/textfield', title: 'Textfield' },
      { path: '/#/dieter/toggle', title: 'Toggle' },
      { path: '/#/dieter/tooltip', title: 'Tooltip' },
      { path: '/#/dieter/valuefield', title: 'Valuefield' },
    ],
  },
  {
    title: 'Policy',
    count: 2,
    routes: [
      { path: '/#/policy/entitlements', title: 'Policy Editor' },
      { path: '/#/policy/llm-management', title: 'LLM Management' },
    ],
  },
] as const;

const expectedRoutes = navGroups.flatMap((group) => group.routes);

test.describe('DevStudio route contract', () => {
  test('renders the three-section authenticated main-container', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'DevStudio' })).toBeVisible();
    await expect(page.locator('.main-container')).toHaveCount(1);
    await expect(page.locator('.main-container > .left-nav')).toHaveCount(1);
    await expect(page.locator('.main-container > .page')).toHaveCount(1);
    await expect(page.locator('.main-container').locator(':scope > *')).toHaveCount(2);
    await expect(page.locator('.page > [data-navigation-scrim]')).toHaveCount(1);

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

    const wideShell = await page.evaluate(() => {
      const navigation = document.querySelector<HTMLElement>('.main-container > .left-nav');
      const workspace = document.querySelector<HTMLElement>('.main-container > .page');
      if (!navigation || !workspace) throw new Error('Shared shell is missing');
      const navigationRect = navigation.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const navigationStyle = getComputedStyle(navigation);
      const workspaceStyle = getComputedStyle(workspace);
      const header = document.querySelector<HTMLElement>('.page__header');
      const content = document.querySelector<HTMLElement>('.page__content');
      const navigationLayout = document.querySelector<HTMLElement>('.devstudio-nav');
      const navigationContent = document.querySelector<HTMLElement>('.devstudio-nav__content');
      const navigationLink = document.querySelector<HTMLElement>('.nav-link');
      if (!header || !content || !navigationLayout || !navigationContent || !navigationLink) {
        throw new Error('DevStudio rhythm contract is missing');
      }
      return {
        navigation: {
          x: navigationRect.x,
          y: navigationRect.y,
          width: navigationRect.width,
          height: navigationRect.height,
          borderWidth: navigationStyle.borderWidth,
          borderRadius: navigationStyle.borderRadius,
          boxShadow: navigationStyle.boxShadow,
        },
        workspace: {
          x: workspaceRect.x,
          width: workspaceRect.width,
          paddingBlockStart: workspaceStyle.paddingBlockStart,
          headerSeparation: getComputedStyle(header).marginBlockEnd,
          contentGap: getComputedStyle(content).gap,
        },
        navigationRhythm: {
          rowHeight: navigationLink.getBoundingClientRect().height,
          brandGap: getComputedStyle(navigationLayout).gap,
          groupGap: getComputedStyle(navigationContent).gap,
        },
      };
    });
    expect(wideShell.navigation).toMatchObject({
      x: 8,
      y: 8,
      width: 256,
      height: 884,
      borderWidth: '0px',
      borderRadius: '20px',
    });
    expect(wideShell.navigation.boxShadow).not.toBe('none');
    expect(wideShell.workspace).toEqual({
      x: 272,
      width: 1168,
      paddingBlockStart: '24px',
      headerSeparation: '16px',
      contentGap: '16px',
    });
    expect(wideShell.navigationRhythm).toEqual({
      rowHeight: 28,
      brandGap: '16px',
      groupGap: '12px',
    });
  });

  test('actual DevStudio main-container uses the shared Compact navigation state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 560, height: 640 });
    await page.goto('/#/dieter/core-styles');

    const mainContainer = page.locator('.main-container');
    const navigation = page.locator('.main-container > .left-nav');
    const trigger = page.locator('[data-navigation-trigger]');
    const scrim = page.locator('.page > [data-navigation-scrim]');

    await expect(trigger).toBeVisible();
    await expect(navigation).toHaveJSProperty('inert', true);
    await expect(mainContainer).not.toHaveAttribute('data-navigation-open', 'true');
    await expect(page.locator('.devstudio-portrait-boundary')).toHaveCount(0);

    await trigger.click();
    await expect(mainContainer).toHaveAttribute('data-navigation-open', 'true');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toHaveJSProperty('inert', false);
    await expect(scrim).toBeVisible();
    await expect
      .poll(() => navigation.evaluate((element) => Math.round(element.getBoundingClientRect().x)))
      .toBe(8);

    const compactShell = await page.evaluate(() => {
      const navigationElement = document.querySelector<HTMLElement>('.main-container > .left-nav');
      const workspace = document.querySelector<HTMLElement>('.main-container > .page');
      if (!navigationElement || !workspace) throw new Error('Shared shell is missing');
      const navigationRect = navigationElement.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('.page__header');
      const content = document.querySelector<HTMLElement>('.page__content');
      if (!header || !content) throw new Error('Compact Page rhythm is missing');
      return {
        navigation: {
          x: navigationRect.x,
          y: navigationRect.y,
          width: navigationRect.width,
          height: navigationRect.height,
          borderRadius: getComputedStyle(navigationElement).borderRadius,
        },
        workspace: {
          x: workspaceRect.x,
          width: workspaceRect.width,
          paddingBlockStart: getComputedStyle(workspace).paddingBlockStart,
          headerGap: getComputedStyle(header).gap,
          headerSeparation: getComputedStyle(header).marginBlockEnd,
          contentGap: getComputedStyle(content).gap,
        },
      };
    });
    expect(compactShell.navigation).toEqual({
      x: 8,
      y: 8,
      width: 320,
      height: 624,
      borderRadius: '20px',
    });
    expect(compactShell.workspace).toEqual({
      x: 0,
      width: 560,
      paddingBlockStart: '16px',
      headerGap: '12px',
      headerSeparation: '12px',
      contentGap: '12px',
    });

    await scrim.click({ position: { x: 500, y: 300 } });
    await expect(mainContainer).not.toHaveAttribute('data-navigation-open', 'true');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation).toHaveJSProperty('inert', true);
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
      await expect(page.locator('.page__header')).toBeVisible();
      await expect(page.locator('.page__actions')).toHaveCount(1);
      await expect(page.locator('.page__content')).toBeVisible();
      await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible();
      await expect(page.locator('.nav-link[aria-current="page"]')).toHaveAttribute(
        'href',
        route.path.slice(1),
      );
      await expect(page.getByRole('heading', { name: 'Missing' })).toHaveCount(0);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  test('Policy exposes its real Reload action in the Page actions region', async ({ page }) => {
    await page.goto('/#/policy/entitlements');
    const actions = page.locator('.page__header > .page__actions');
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Reload' })).toHaveCount(1);
    await expect(
      page.locator('.page__content').getByRole('button', { name: 'Reload' }),
    ).toHaveCount(0);
  });

  test('new status, feedback, progress, tooltip, and operational-table contracts are source-backed', async ({
    page,
  }) => {
    await page.goto('/#/dieter/badge');
    await expect(page.locator('.diet-badge')).toHaveCount(5);
    for (const tone of ['neutral', 'info', 'positive', 'warning', 'critical']) {
      await expect(page.locator(`.diet-badge[data-tone="${tone}"]`)).toHaveCount(1);
    }

    await page.goto('/#/dieter/banner');
    await expect(page.locator('.diet-banner')).toHaveCount(4);
    await expect(page.locator('.diet-banner[data-tone="critical"][role="alert"]')).toHaveCount(1);
    await expect(page.locator('.diet-banner__dismiss[aria-label="Dismiss message"]')).toHaveCount(
      1,
    );
    const bannerPresentation = await page.locator('.diet-banner').evaluateAll((banners) => {
      const tokenProbe = document.createElement('span');
      document.body.append(tokenProbe);
      const tokenColor = (token: string) => {
        tokenProbe.style.backgroundColor = `var(${token})`;
        return getComputedStyle(tokenProbe).backgroundColor;
      };
      const tokenTextColor = (token: string) => {
        tokenProbe.style.color = `var(${token})`;
        return getComputedStyle(tokenProbe).color;
      };
      const expected = {
        default: tokenColor('--color-system-teal-4'),
        defaultAccent: tokenTextColor('--color-system-teal-contrast'),
        caution: tokenColor('--color-system-yellow-4'),
        cautionAccent: tokenTextColor('--color-system-yellow-contrast'),
        critical: tokenColor('--color-system-red-5'),
        criticalAccent: tokenTextColor('--color-system-red-contrast'),
      };
      tokenProbe.remove();
      return {
        actual: banners.map((banner) => {
          const style = getComputedStyle(banner);
          return {
            backgroundColor: style.backgroundColor,
            borderWidth: style.borderWidth,
            iconColor: banner.querySelector('.diet-banner__icon')
              ? getComputedStyle(banner.querySelector('.diet-banner__icon')!).color
              : null,
            tone: banner.getAttribute('data-tone'),
          };
        }),
        expected,
      };
    });
    expect(bannerPresentation.actual).toEqual([
      {
        tone: 'default',
        backgroundColor: bannerPresentation.expected.default,
        borderWidth: '0px',
        iconColor: bannerPresentation.expected.defaultAccent,
      },
      {
        tone: 'caution',
        backgroundColor: bannerPresentation.expected.caution,
        borderWidth: '0px',
        iconColor: bannerPresentation.expected.cautionAccent,
      },
      {
        tone: 'critical',
        backgroundColor: bannerPresentation.expected.critical,
        borderWidth: '0px',
        iconColor: bannerPresentation.expected.criticalAccent,
      },
      {
        tone: 'default',
        backgroundColor: bannerPresentation.expected.default,
        borderWidth: '0px',
        iconColor: null,
      },
    ]);

    await page.goto('/#/dieter/spinner');
    const standaloneSpinners = page.locator('.diet-spinner[role="status"]');
    await expect(standaloneSpinners).toHaveCount(3);
    for (const [index, size] of ['12px', '16px', '20px'].entries()) {
      await expect(standaloneSpinners.nth(index)).toHaveCSS('inline-size', size);
      await expect(standaloneSpinners.nth(index)).toHaveCSS('block-size', size);
    }

    await page.goto('/#/dieter/button');
    const loadingButtons = page.locator('.diet-button[data-loading="true"][aria-busy="true"]');
    await expect(loadingButtons).toHaveCount(12);
    await expect(loadingButtons.locator(':scope > .diet-spinner[aria-hidden="true"]')).toHaveCount(
      12,
    );
    for (const [size, expected] of Object.entries({
      small: '12px',
      medium: '16px',
      large: '20px',
    })) {
      const spinner = page
        .locator(
          `.diet-button[data-loading="true"][aria-busy="true"][data-size="${size}"]`,
        )
        .locator(':scope > .diet-spinner')
        .first();
      await expect(spinner).toHaveCSS('inline-size', expected);
      await expect(spinner).toHaveCSS('block-size', expected);
      await expect(spinner).toHaveCSS('animation-name', 'diet-spinner-rotate');
    }

    await page.goto('/#/dieter/tooltip');
    await expect(page.locator('.diet-tooltip')).toHaveCount(5);
    for (const [placement, count] of Object.entries({ top: 2, right: 1, bottom: 1, left: 1 })) {
      await expect(
        page.locator(`.diet-tooltip[data-tooltip-placement="${placement}"]`),
      ).toHaveCount(count);
    }
    const tooltip = page.locator('.diet-tooltip[data-tooltip-placement="top"]').first();
    await tooltip.hover();
    await expect
      .poll(() => tooltip.evaluate((element) => getComputedStyle(element, '::after').visibility))
      .toBe('visible');
    const tooltipSurface = await tooltip.evaluate((element) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor =
        'color-mix(in oklab, var(--color-system-blue-contrast) 85%, transparent)';
      document.body.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        actual: getComputedStyle(element, '::after').backgroundColor,
        expected,
      };
    });
    expect(tooltipSurface.actual).toBe(tooltipSurface.expected);
    await tooltip.locator(':scope > .diet-button').focus();
    await expect
      .poll(() => tooltip.evaluate((element) => getComputedStyle(element, '::after').visibility))
      .toBe('visible');

    await page.goto('/#/dieter/data-table');
    await expect(
      page.locator('.dieter-component-preview-full-wrapper .diet-data-table'),
    ).toHaveCount(7);
    const controlled = page.locator('.diet-data-table').first();
    await expect(controlled.locator('.diet-table')).toHaveCount(1);
    const selectedBadge = controlled.locator('.diet-badge');
    await expect(selectedBadge).toHaveText('1 selected');
    const badgePresentation = await selectedBadge.evaluate((element) => {
      const style = getComputedStyle(element);
      const tokenProbe = document.createElement('span');
      tokenProbe.style.backgroundColor = 'var(--role-surface-muted)';
      element.append(tokenProbe);
      const expectedBackgroundColor = getComputedStyle(tokenProbe).backgroundColor;
      tokenProbe.remove();
      return {
        paddingBlock: style.paddingBlock,
        paddingInline: style.paddingInline,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        expectedBackgroundColor,
      };
    });
    expect(badgePresentation.paddingBlock).toBe('4px');
    expect(badgePresentation.paddingInline).toBe('8px');
    expect(badgePresentation.borderRadius).toBe('4px');
    expect(badgePresentation.backgroundColor).toBe(badgePresentation.expectedBackgroundColor);
    await expect(controlled.locator('input[type="checkbox"]')).toHaveCount(3);
    const selectedCellColors = await controlled.evaluate((element) => {
      const cell = element.querySelector<HTMLElement>('.diet-data-table__row > *');
      if (!cell) throw new Error('Controlled DataTable is missing its selected row.');
      const tokenProbe = document.createElement('span');
      tokenProbe.style.color = 'var(--color-system-blue-5)';
      element.append(tokenProbe);
      const expected = getComputedStyle(tokenProbe).color;
      tokenProbe.remove();
      return { actual: getComputedStyle(cell).backgroundColor, expected };
    });
    expect(selectedCellColors.actual).toBe(selectedCellColors.expected);
    await expect(
      page.locator('.diet-data-table[data-state="loading"] [aria-busy="true"]'),
    ).toHaveCount(1);
    await expect(page.locator('.diet-data-table[data-state="empty"]')).toHaveCount(1);
    await expect(page.locator('.diet-data-table[data-state="filtered-empty"]')).toHaveCount(1);
  });

  test('Agent Activity uses the requested traveling conic highlight without changing its content surface', async ({
    page,
  }) => {
    await page.goto('/#/dieter/agent-activity');
    const active = page.locator('.diet-agent-activity[data-tone="active"]').first();
    const presentation = await active.evaluate((element) => {
      const style = getComputedStyle(element);
      const purpleProbe = document.createElement('span');
      purpleProbe.style.color = 'var(--color-system-purple)';
      document.body.append(purpleProbe);
      const purple = getComputedStyle(purpleProbe).color;
      purpleProbe.style.color = 'var(--color-system-indigo-3)';
      const indigo = getComputedStyle(purpleProbe).color;
      purpleProbe.style.color = 'transparent';
      const transparent = getComputedStyle(purpleProbe).color;
      purpleProbe.style.color = 'var(--color-system-purple-5)';
      const surface = getComputedStyle(purpleProbe).color;
      purpleProbe.remove();
      return {
        animationDuration: style.animationDuration,
        animationIterationCount: style.animationIterationCount,
        animationName: style.animationName,
        animationTimingFunction: style.animationTimingFunction,
        backgroundClip: style.backgroundClip,
        backgroundImage: style.backgroundImage,
        borderWidth: style.borderWidth,
        indigo,
        purple,
        surface,
        transparent,
      };
    });
    expect(presentation.borderWidth).toBe('1px');
    expect(presentation.animationName).toBe('diet-agent-activity-border-spin');
    expect(presentation.animationDuration).toBe('3s');
    expect(presentation.animationTimingFunction).toBe('linear');
    expect(presentation.animationIterationCount).toBe('infinite');
    expect(presentation.backgroundImage).toContain('conic-gradient');
    expect(presentation.backgroundImage).toContain(presentation.purple);
    expect(presentation.backgroundImage).toContain(`${presentation.indigo} 99%`);
    expect(presentation.backgroundImage).toContain(`${presentation.transparent} 25%`);
    expect(presentation.backgroundImage.match(/gradient/g)).toHaveLength(3);
    expect(presentation.backgroundImage.split(presentation.surface)).toHaveLength(5);
    expect(presentation.backgroundClip).toBe('padding-box, border-box, border-box');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(active).toHaveCSS('animation-name', 'none');
  });

  test('Table exposes the six governed compositions and exact shared presentation', async ({
    page,
  }) => {
    await page.goto('/#/dieter/table');
    const compositions = page.locator('[data-table-composition]');
    await expect(compositions).toHaveCount(6);
    await expect(page.getByText('Ordinary', { exact: true })).toBeVisible();
    await expect(page.getByText('Sortable columns — ascending', { exact: true })).toBeVisible();
    await expect(page.getByText('Sortable columns — descending', { exact: true })).toBeVisible();
    await expect(page.getByText('Horizontal overflow', { exact: true })).toBeVisible();
    await expect(page.getByText('Row action', { exact: true })).toBeVisible();
    await expect(page.getByText('Editable cell', { exact: true })).toBeVisible();
    const overflow = await page
      .locator('[data-table-composition="horizontal-overflow"]')
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(true);

    const ordinary = page.locator('[data-table-composition="ordinary"]');
    await expect(ordinary.locator('thead th:not(.label-s)')).toHaveCount(0);
    await expect(ordinary.locator('tbody :is(th, td):not(.body-s)')).toHaveCount(0);
    const ordinaryPresentation = await ordinary.evaluate((element) => {
      const header = element.querySelector<HTMLElement>('thead th');
      const rowHeader = element.querySelector<HTMLElement>('tbody th');
      const bodyCell = element.querySelector<HTMLElement>('tbody td');
      if (!header || !rowHeader || !bodyCell) throw new Error('Table example is incomplete.');
      const frameStyle = getComputedStyle(element);
      const headerStyle = getComputedStyle(header);
      const bodyStyle = getComputedStyle(bodyCell);
      const tokenProbe = document.createElement('span');
      tokenProbe.style.color = 'var(--color-system-gray-step3)';
      element.append(tokenProbe);
      const headerDivider = getComputedStyle(tokenProbe).color;
      tokenProbe.style.color = 'var(--color-system-gray-step5)';
      const bodyDivider = getComputedStyle(tokenProbe).color;
      tokenProbe.remove();
      return {
        frameBorderWidth: frameStyle.borderWidth,
        frameBorderRadius: frameStyle.borderRadius,
        frameBoxShadow: frameStyle.boxShadow,
        headerBackground: headerStyle.backgroundColor,
        headerDivider: headerStyle.borderBlockEndColor,
        expectedHeaderDivider: headerDivider,
        rowHeaderBackground: getComputedStyle(rowHeader).backgroundColor,
        bodyBackground: bodyStyle.backgroundColor,
        bodyDivider: bodyStyle.borderBlockEndColor,
        expectedBodyDivider: bodyDivider,
        bodyPaddingBlockStart: bodyStyle.paddingBlockStart,
        bodyPaddingInlineStart: bodyStyle.paddingInlineStart,
        bodyInlineStartBorder: bodyStyle.borderInlineStartWidth,
        bodyInlineEndBorder: bodyStyle.borderInlineEndWidth,
      };
    });
    expect(ordinaryPresentation.frameBorderWidth).toBe('0px');
    expect(ordinaryPresentation.frameBorderRadius).toBe('8px');
    expect(ordinaryPresentation.frameBoxShadow).toBe('none');
    expect(ordinaryPresentation.headerBackground).toBe(ordinaryPresentation.bodyBackground);
    expect(ordinaryPresentation.headerDivider).toBe(ordinaryPresentation.expectedHeaderDivider);
    expect(ordinaryPresentation.rowHeaderBackground).toBe(ordinaryPresentation.bodyBackground);
    expect(ordinaryPresentation.bodyDivider).toBe(ordinaryPresentation.expectedBodyDivider);
    expect(ordinaryPresentation.bodyPaddingBlockStart).toBe('12px');
    expect(ordinaryPresentation.bodyPaddingInlineStart).toBe('16px');
    expect(ordinaryPresentation.bodyInlineStartBorder).toBe('0px');
    expect(ordinaryPresentation.bodyInlineEndBorder).toBe('0px');

    const rowAction = page.locator('[data-table-composition="row-action"]');
    const actionCells = rowAction.locator('.diet-table__cell--action');
    await expect(actionCells).toHaveCount(3);
    for (const actionCell of await actionCells.all()) {
      await expect(actionCell).toHaveCSS('text-align', 'end');
    }

    const sortPresentation = await page.evaluate(() => {
      const readIcon = (selector: string) => {
        const icon = document.querySelector<HTMLElement>(selector);
        const path = icon?.querySelector('path');
        if (!icon || !path) throw new Error(`Missing Table sort Icon: ${selector}`);
        return {
          color: getComputedStyle(icon).color,
          height: icon.getBoundingClientRect().height,
          path: path.getAttribute('d'),
          width: icon.getBoundingClientRect().width,
        };
      };
      const tokenProbe = document.createElement('span');
      tokenProbe.style.color = 'var(--color-system-black)';
      document.body.append(tokenProbe);
      const activeColor = getComputedStyle(tokenProbe).color;
      tokenProbe.style.color = 'var(--color-system-gray)';
      const inactiveColor = getComputedStyle(tokenProbe).color;
      tokenProbe.remove();
      return {
        activeColor,
        ascending: readIcon(
          '[data-table-composition="sortable-ascending"] [aria-sort="ascending"] .diet-icon',
        ),
        ascendingInactive: readIcon(
          '[data-table-composition="sortable-ascending"] [aria-sort="none"] .diet-icon',
        ),
        descending: readIcon(
          '[data-table-composition="sortable-descending"] [aria-sort="descending"] .diet-icon',
        ),
        descendingInactive: readIcon(
          '[data-table-composition="sortable-descending"] [aria-sort="none"] .diet-icon',
        ),
        inactiveColor,
      };
    });
    expect(sortPresentation.ascending).toMatchObject({
      color: sortPresentation.activeColor,
      width: 12,
      height: 12,
    });
    expect(sortPresentation.descending).toMatchObject({
      color: sortPresentation.activeColor,
      width: 12,
      height: 12,
    });
    expect(sortPresentation.ascendingInactive).toMatchObject({
      color: sortPresentation.inactiveColor,
      width: 12,
      height: 12,
    });
    expect(sortPresentation.descendingInactive).toMatchObject({
      color: sortPresentation.inactiveColor,
      width: 12,
      height: 12,
    });
    expect(sortPresentation.ascending.path).not.toBe(sortPresentation.descending.path);
    expect(sortPresentation.ascending.path).not.toBe(sortPresentation.ascendingInactive.path);
    expect(sortPresentation.descending.path).not.toBe(sortPresentation.descendingInactive.path);
  });

  test('Popup exposes the seamless surface, optional title and caller-owned dismiss composition', async ({
    page,
  }) => {
    await page.goto('/#/dieter/popup');

    const dialogs = page.locator('.component-page .diet-popup');
    await expect(dialogs).toHaveCount(3);

    const small = dialogs.nth(0);
    const titleless = dialogs.nth(1);
    const large = dialogs.nth(2);

    await expect(small.getByRole('heading', { name: 'Popup title' })).toHaveCount(1);
    await expect(small.locator('.diet-popup__dismiss')).toHaveAttribute('aria-label', 'Close');
    await expect(titleless).toHaveAttribute('aria-label', 'Medium Popup');
    await expect(titleless.locator('.diet-popup__header h2')).toHaveCount(0);
    await expect(titleless.locator('.diet-popup__dismiss')).toHaveAttribute('aria-label', 'Close');
    await expect(large.getByRole('heading', { name: 'Popup title' })).toHaveCount(1);
    await expect(large.locator('.diet-popup__dismiss')).toHaveCount(0);

    const presentation = await small.evaluate((dialog) => {
      const header = dialog.querySelector<HTMLElement>('.diet-popup__header');
      const body = dialog.querySelector<HTMLElement>('.diet-popup__body');
      const footer = dialog.querySelector<HTMLElement>('.diet-popup__footer');
      const dismiss = dialog.querySelector<HTMLElement>('.diet-popup__dismiss');
      if (!header || !body || !footer || !dismiss) throw new Error('Popup reveal is incomplete.');
      const dialogStyle = getComputedStyle(dialog);
      return {
        borderWidth: dialogStyle.borderWidth,
        paddingBlockStart: dialogStyle.paddingBlockStart,
        paddingInlineStart: dialogStyle.paddingInlineStart,
        headerDivider: getComputedStyle(header).borderBlockEndWidth,
        footerDivider: getComputedStyle(footer).borderBlockStartWidth,
        bodyGap: getComputedStyle(body).marginBlockStart,
        footerGap: getComputedStyle(footer).marginBlockStart,
        dismissHeight: dismiss.getBoundingClientRect().height,
        dismissWidth: dismiss.getBoundingClientRect().width,
        dismissIconHeight: dismiss.querySelector<HTMLElement>('.diet-icon')?.getBoundingClientRect()
          .height,
      };
    });
    expect(presentation).toEqual({
      borderWidth: '0px',
      paddingBlockStart: '24px',
      paddingInlineStart: '24px',
      headerDivider: '0px',
      footerDivider: '0px',
      bodyGap: '24px',
      footerGap: '24px',
      dismissHeight: 28,
      dismissWidth: 28,
      dismissIconHeight: 16,
    });

    const largeScroll = await large.evaluate((dialog) => {
      const body = dialog.querySelector<HTMLElement>('.diet-popup__body');
      if (!body) throw new Error('Large Popup body is missing.');
      return {
        contained: dialog.scrollHeight <= dialog.clientHeight,
        bodyScrolls: body.scrollHeight > body.clientHeight,
      };
    });
    expect(largeScroll).toEqual({ contained: true, bodyScrolls: true });
  });

  test('Popup dismiss composition preserves Bulk Edit and Object Manager close policy', async ({
    page,
  }) => {
    await page.goto('/#/dieter/bulk-edit');
    const bulkEdit = page.locator('.diet-bulk-edit').first();
    const bulkDialog = bulkEdit.locator('[data-bulk-modal]');
    await bulkEdit.locator('[data-bulk-open]').click();
    await expect(bulkDialog).toHaveJSProperty('open', true);
    await bulkDialog.locator('.diet-popup__dismiss').click();
    await expect(bulkDialog).toHaveJSProperty('open', false);

    await bulkEdit.locator('[data-bulk-open]').click();
    await expect(bulkDialog).toHaveJSProperty('open', true);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.goto('/#/dieter/object-manager');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    const objectManager = page.locator('.diet-object-manager[data-allow-structure="true"]').first();
    const objectDialog = objectManager.locator('[data-objects-modal]');
    const manage = objectManager.locator('[data-objects-manage]');

    await manage.click();
    await expect(objectDialog).toHaveJSProperty('open', true);
    await objectDialog.locator('.diet-popup__dismiss').click();
    await expect(objectDialog).toHaveJSProperty('open', false);

    await manage.click();
    await objectDialog.locator('[data-objects-delete]').first().click();
    await objectDialog.locator('.diet-popup__dismiss').click();
    await expect(objectDialog).toHaveJSProperty('open', true);
    await expect(objectDialog.locator('[data-objects-discard-panel]')).toBeVisible();
    await expect(objectDialog.locator('[data-objects-editor]')).toBeHidden();
    await objectDialog.locator('[data-objects-keep-editing]').click();
    await expect(objectDialog.locator('[data-objects-editor]')).toBeVisible();
  });

  test('Collection controls and Segmented expose the compact aligned source geometry', async ({
    page,
  }) => {
    await page.goto('/#/dieter/object-manager');
    const objectManager = page.locator('.diet-object-manager[data-allow-structure="true"]').first();
    const objectAdd = objectManager.locator('[data-objects-add]');
    const objectManage = objectManager.locator('[data-objects-manage]');
    await expect(objectAdd.locator(':scope > .diet-icon')).toHaveCount(1);
    await expect(objectAdd.locator(':scope > .diet-button__label')).toHaveText('Add object');
    await expect(objectManage).toHaveAttribute('data-type', 'secondary');
    await expect(objectManage).not.toHaveClass(/diet-object-manager__add/);
    const objectAddSurface = await objectAdd.evaluate((element) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--color-system-indigo-5)';
      element.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        actual: getComputedStyle(element).backgroundColor,
        expected,
      };
    });
    expect(objectAddSurface.actual).toBe(objectAddSurface.expected);

    await page.goto('/#/dieter/repeater');
    const repeaters = page.locator('.diet-repeater');
    await expect(repeaters).toHaveCount(3);
    const collectionGeometry = await repeaters.evaluateAll((roots) =>
      roots.map((root) => {
        const item = root.querySelector<HTMLElement>('.diet-repeater__item');
        const add = root.querySelector<HTMLElement>('.diet-repeater__add');
        const plus = add?.querySelector<HTMLElement>('.diet-icon');
        if (!item || !add || !plus) throw new Error('Repeater reveal is incomplete.');
        return {
          addIconHeight: plus.getBoundingClientRect().height,
          itemPadding: getComputedStyle(item).paddingBlockStart,
          rootPadding: getComputedStyle(root).paddingBlockStart,
        };
      }),
    );
    expect(collectionGeometry).toEqual([
      { addIconHeight: 12, itemPadding: '0px', rootPadding: '2px' },
      { addIconHeight: 16, itemPadding: '2px', rootPadding: '4px' },
      { addIconHeight: 20, itemPadding: '4px', rootPadding: '8px' },
    ]);
    const mediumRepeater = repeaters.nth(1);
    await mediumRepeater.locator('.diet-repeater__reorder').click();
    await expect(mediumRepeater).toHaveAttribute('data-reorder', 'on');
    await expect(mediumRepeater.locator('.diet-repeater__reorder-icon--active')).toBeVisible();
    const headerAlignment = await mediumRepeater.evaluate((root) => {
      const header = root.querySelector<HTMLElement>('.diet-repeater__header-main');
      const action = root.querySelector<HTMLElement>('.diet-repeater__actions');
      if (!header || !action) throw new Error('Repeater header is incomplete.');
      return {
        actionTop: action.getBoundingClientRect().top,
        headerTop: header.getBoundingClientRect().top,
      };
    });
    expect(headerAlignment.actionTop).toBe(headerAlignment.headerTop);

    await page.goto('/#/dieter/segmented');
    const segment = page.locator('.diet-segmented').first().locator('.diet-segment').first();
    const selectedSurface = segment.locator('.diet-segment__surface');
    const selectedBackground = await selectedSurface.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await segment.hover();
    await expect
      .poll(() =>
        selectedSurface.evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe(selectedBackground);
    const selectedInset = await segment.evaluate((element) => {
      const rail = element.closest<HTMLElement>('.diet-segmented');
      const surface = element.querySelector<HTMLElement>('.diet-segment__surface');
      if (!rail || !surface) throw new Error('Segmented reveal is incomplete.');
      const railRect = rail.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      return {
        blockEnd: railRect.bottom - surfaceRect.bottom,
        blockStart: surfaceRect.top - railRect.top,
        padding: getComputedStyle(rail).paddingBlockStart,
      };
    });
    expect(selectedInset).toEqual({ blockEnd: 2, blockStart: 2, padding: '2px' });
  });

  test('Textfield and Valuefield expose the exact compact native-input geometry', async ({
    page,
  }) => {
    await page.goto('/#/dieter/textfield');
    const textfieldGeometry = await page.locator('.diet-textfield').evaluateAll((roots) =>
      roots.slice(0, 3).map((root) => {
        const control = root.querySelector<HTMLElement>('.diet-textfield__control');
        const field = root.querySelector<HTMLInputElement>('.diet-textfield__field');
        if (!control || !field) throw new Error('Textfield reveal is incomplete.');
        const controlStyle = getComputedStyle(control);
        return {
          fontSize: getComputedStyle(field).fontSize,
          height: control.getBoundingClientRect().height,
          radius: controlStyle.borderRadius,
        };
      }),
    );
    expect(textfieldGeometry).toEqual([
      { fontSize: '11px', height: 20, radius: '4px' },
      { fontSize: '13px', height: 24, radius: '6px' },
      { fontSize: '14px', height: 28, radius: '8px' },
    ]);
    const placeholderField = page.locator('#textfield-placeholder');
    await expect(placeholderField).toHaveAttribute('placeholder', 'Enter text');
    await expect(page.locator('input[placeholder="Hint text"]')).toHaveCount(0);
    await placeholderField.focus();
    await expect(
      placeholderField.locator('xpath=..').locator('.diet-textfield__display-label'),
    ).toBeHidden();
    await expect(placeholderField).toHaveCSS('text-align', 'start');
    await expect(page.locator('#textfield-disabled')).toBeDisabled();

    await page.goto('/#/dieter/valuefield');
    const valuefieldGeometry = await page.locator('.diet-valuefield').evaluateAll((roots) =>
      roots.slice(0, 3).map((root) => {
        const control = root.querySelector<HTMLElement>('.diet-valuefield__control');
        const slot = root.querySelector<HTMLElement>('.diet-valuefield__input');
        const field = root.querySelector<HTMLInputElement>('.diet-valuefield__field');
        if (!control || !slot || !field) throw new Error('Valuefield reveal is incomplete.');
        const controlStyle = getComputedStyle(control);
        const slotStyle = getComputedStyle(slot);
        return {
          fieldSizing: getComputedStyle(field).getPropertyValue('field-sizing'),
          fieldWidth: field.getBoundingClientRect().width,
          fontSize: getComputedStyle(field).fontSize,
          height: control.getBoundingClientRect().height,
          paddingEnd: slotStyle.paddingInlineEnd,
          paddingStart: slotStyle.paddingInlineStart,
          radius: controlStyle.borderRadius,
          slotWidth: slot.getBoundingClientRect().width,
        };
      }),
    );
    expect(valuefieldGeometry).toEqual([
      {
        fieldSizing: 'content',
        fieldWidth: expect.any(Number),
        fontSize: '11px',
        height: 20,
        paddingEnd: '8px',
        paddingStart: '8px',
        radius: '4px',
        slotWidth: expect.any(Number),
      },
      {
        fieldSizing: 'content',
        fieldWidth: expect.any(Number),
        fontSize: '13px',
        height: 24,
        paddingEnd: '8px',
        paddingStart: '8px',
        radius: '6px',
        slotWidth: expect.any(Number),
      },
      {
        fieldSizing: 'content',
        fieldWidth: expect.any(Number),
        fontSize: '14px',
        height: 28,
        paddingEnd: '8px',
        paddingStart: '8px',
        radius: '8px',
        slotWidth: expect.any(Number),
      },
    ]);
    for (const geometry of valuefieldGeometry) {
      expect(geometry.slotWidth - geometry.fieldWidth).toBeCloseTo(16, 3);
      expect(geometry.slotWidth).toBeLessThan(40);
    }

    const mediumValuefield = page.locator('.diet-valuefield').nth(1);
    const mediumControl = mediumValuefield.locator('.diet-valuefield__control');
    const mediumSlot = mediumValuefield.locator('.diet-valuefield__input');
    const mediumField = mediumValuefield.locator('.diet-valuefield__field');
    const restPresentation = await mediumControl.evaluate((control) => {
      const slot = control.querySelector<HTMLElement>('.diet-valuefield__input');
      if (!slot) throw new Error('Valuefield slot is missing.');
      return {
        rowBackground: getComputedStyle(control).backgroundColor,
        slotBackground: getComputedStyle(slot).backgroundColor,
      };
    });
    await mediumControl.hover();
    await page.waitForTimeout(250);
    const hoverPresentation = await mediumControl.evaluate((control) => {
      const slot = control.querySelector<HTMLElement>('.diet-valuefield__input');
      if (!slot) throw new Error('Valuefield slot is missing.');
      return {
        rowBackground: getComputedStyle(control).backgroundColor,
        slotBackground: getComputedStyle(slot).backgroundColor,
      };
    });
    expect(hoverPresentation.rowBackground).not.toBe(restPresentation.rowBackground);
    expect(hoverPresentation.slotBackground).toBe(restPresentation.slotBackground);

    await mediumField.focus();
    await page.mouse.move(0, 0);
    await expect
      .poll(() => mediumControl.evaluate((control) => getComputedStyle(control).backgroundColor))
      .toBe(hoverPresentation.rowBackground);
    const editPresentation = await mediumControl.evaluate((control) => {
      const slot = control.querySelector<HTMLElement>('.diet-valuefield__input');
      if (!slot) throw new Error('Valuefield slot is missing.');
      const controlStyle = getComputedStyle(control);
      const slotStyle = getComputedStyle(slot);
      return {
        borderColor: controlStyle.borderColor,
        boxShadow: slotStyle.boxShadow,
        rowBackground: controlStyle.backgroundColor,
        slotBackground: slotStyle.backgroundColor,
      };
    });
    expect(editPresentation.rowBackground).toBe(hoverPresentation.rowBackground);
    expect(editPresentation.slotBackground).not.toBe(editPresentation.rowBackground);
    expect(editPresentation.boxShadow).toBe('none');
    expect(editPresentation.borderColor).toBe('rgba(0, 0, 0, 0)');

    const shortSlotWidth = await mediumSlot.evaluate((slot) => slot.getBoundingClientRect().width);
    const shortRightInset = await mediumField.evaluate((field) => {
      const control = field.closest<HTMLElement>('.diet-valuefield__control');
      if (!control) throw new Error('Valuefield control is missing.');
      return control.getBoundingClientRect().right - field.getBoundingClientRect().right;
    });
    await mediumField.fill('100');
    const expandedGeometry = await mediumField.evaluate((field) => {
      const control = field.closest<HTMLElement>('.diet-valuefield__control');
      const slot = field.closest<HTMLElement>('.diet-valuefield__input');
      if (!control || !slot) throw new Error('Valuefield geometry is incomplete.');
      return {
        rightInset: control.getBoundingClientRect().right - field.getBoundingClientRect().right,
        slotWidth: slot.getBoundingClientRect().width,
      };
    });
    expect(expandedGeometry.slotWidth).toBeGreaterThan(shortSlotWidth);
    expect(shortRightInset).toBeCloseTo(9, 3);
    expect(expandedGeometry.rightInset).toBeCloseTo(shortRightInset, 3);

    const longSlotWidth = await page
      .locator('#valuefield-long')
      .locator('xpath=..')
      .evaluate((slot) => slot.getBoundingClientRect().width);
    expect(longSlotWidth).toBeGreaterThan(shortSlotWidth);
    await expect(page.locator('#valuefield-sm')).toHaveAttribute('min', '0');
    await expect(page.locator('#valuefield-negative')).toHaveValue('-0.25');
    await expect(page.locator('#valuefield-negative')).toHaveAttribute('min', '-2');
    await expect(page.locator('#valuefield-disabled')).toBeDisabled();
  });

  test('Datefield and Date Range Picker preserve exact civil-date commit boundaries', async ({
    page,
  }) => {
    await page.goto('/#/dieter/datefield');
    await expect(page.locator('.diet-datefield')).toHaveCount(7);
    const dateGeometry = await page.locator('.diet-datefield').evaluateAll((roots) =>
      roots.slice(0, 3).map((root) => {
        const control = root.querySelector<HTMLElement>('.diet-datefield__control');
        const day = root.querySelector<HTMLElement>('.diet-calendar__day');
        if (!control || !day) throw new Error('Datefield reveal is incomplete.');
        return {
          controlHeight: control.getBoundingClientRect().height,
          daySize: getComputedStyle(day).width,
          radius: getComputedStyle(control).borderRadius,
        };
      }),
    );
    expect(dateGeometry).toEqual([
      { controlHeight: 20, daySize: '28px', radius: '4px' },
      { controlHeight: 24, daySize: '32px', radius: '6px' },
      { controlHeight: 28, daySize: '36px', radius: '8px' },
    ]);
    const localizedDatefield = page.locator('#datefield-gregorian-locale').locator('xpath=..');
    await expect(localizedDatefield.locator('.diet-calendar__month-label')).toContainText('٢٠٢٦');
    await expect(localizedDatefield.locator('[data-date="2026-08-14"]')).toHaveText('١٤');

    const datefield = page.locator('#datefield-selected').locator('xpath=..');
    const dateInput = datefield.locator('.diet-datefield__field');
    await datefield.locator('.diet-datefield__control').dispatchEvent('click');
    await datefield.locator('[data-date="2026-08-20"]').dispatchEvent('click');
    await expect(dateInput).toHaveValue('2026-08-20');
    await expect(datefield).toHaveAttribute('data-state', 'closed');
    await dateInput.evaluate((input: HTMLInputElement) => {
      input.value = '2028-02-29';
      input.dispatchEvent(new CustomEvent('external-sync'));
    });
    await expect(datefield.locator('.diet-datefield__value')).toContainText('Feb 29, 2028');
    await datefield.locator('.diet-datefield__control').dispatchEvent('click');
    await datefield.locator('.diet-calendar__clear').dispatchEvent('click');
    await expect(dateInput).toHaveValue('');
    await dateInput.evaluate((input: HTMLInputElement) => {
      input.value = '0001-01-15';
      input.dispatchEvent(new CustomEvent('external-sync'));
    });
    await datefield.locator('.diet-datefield__control').dispatchEvent('click');
    await expect(datefield.locator('.diet-calendar__previous')).toBeDisabled();
    await page.keyboard.press('Escape');
    await dateInput.evaluate((input: HTMLInputElement) => {
      input.value = '9999-12-15';
      input.dispatchEvent(new CustomEvent('external-sync'));
    });
    await datefield.locator('.diet-datefield__control').dispatchEvent('click');
    await expect(datefield.locator('.diet-calendar__next')).toBeDisabled();
    await page.keyboard.press('Escape');

    const boundedDatefield = page.locator('#datefield-open-bounded').locator('xpath=..');
    await expect(boundedDatefield.locator('[data-date="2026-08-09"]')).toBeDisabled();
    await expect(boundedDatefield.locator('[data-date="2026-08-10"]')).toBeEnabled();

    await page.goto('/#/dieter/date-range-picker');
    await expect(page.locator('.diet-date-range-picker')).toHaveCount(6);
    const crossMonth = page.locator('#date-range-picker-open').locator('xpath=..');
    await expect(crossMonth.locator('.diet-calendar__day')).toHaveCount(42);
    const openGeometry = await crossMonth.evaluate((root) => {
      const row = root.getBoundingClientRect();
      const popover = root.querySelector<HTMLElement>('.diet-popover')!.getBoundingClientRect();
      return {
        leftDelta: popover.left - row.left,
        widthDelta: popover.width - row.width,
        top: popover.top,
        bottomInset: window.innerHeight - popover.bottom,
      };
    });
    expect(openGeometry.leftDelta).toBe(0);
    expect(openGeometry.widthDelta).toBe(80);
    expect(openGeometry.top).toBeGreaterThanOrEqual(8);
    expect(openGeometry.bottomInset).toBeGreaterThanOrEqual(8);
    await crossMonth.locator('[data-date="2026-08-30"]').dispatchEvent('click');
    await crossMonth.locator('.diet-calendar__next').dispatchEvent('click');
    await expect(crossMonth.locator('.diet-calendar__month-label')).toHaveText('September 2026');
    await crossMonth.locator('[data-date="2026-09-04"]').dispatchEvent('click');
    await expect(crossMonth.locator('.diet-date-range-picker__field')).toHaveValue(
      '{"start":"2026-08-30","end":"2026-09-04"}',
    );

    const range = page.locator('#date-range-picker-selected').locator('xpath=..');
    const rangeInput = range.locator('.diet-date-range-picker__field');
    const committed = await rangeInput.inputValue();
    await range.locator('.diet-date-range-picker__control').click({ force: true });
    await range.locator('[data-date="2026-08-25"]').dispatchEvent('click');
    await expect(rangeInput).toHaveValue(committed);
    await range.locator('[data-date="2026-08-27"]').dispatchEvent('pointerover');
    await expect(range.locator('[data-preview="true"]')).toHaveCount(3);
    await range.locator('[data-date="2026-08-27"]').dispatchEvent('click');
    await expect(rangeInput).toHaveValue('{"start":"2026-08-25","end":"2026-08-27"}');

    await range.locator('.diet-date-range-picker__control').click({ force: true });
    await range.locator('[data-date="2026-08-20"]').dispatchEvent('click');
    await range.locator('[data-date="2026-08-18"]').dispatchEvent('click');
    await expect(rangeInput).toHaveValue('{"start":"2026-08-25","end":"2026-08-27"}');
    await expect(range.locator('[data-range-start="true"]')).toHaveAttribute(
      'data-date',
      '2026-08-18',
    );
    await page.keyboard.press('Escape');
    await expect(rangeInput).toHaveValue('{"start":"2026-08-25","end":"2026-08-27"}');

    await range.locator('.diet-date-range-picker__control').click({ force: true });
    await range.locator('[data-date="2026-08-30"]').dispatchEvent('click');
    await range.locator('[data-date="2026-08-30"]').dispatchEvent('click');
    await expect(rangeInput).toHaveValue('{"start":"2026-08-30","end":"2026-08-30"}');
    await range.locator('.diet-date-range-picker__control').click({ force: true });
    await range.locator('.diet-calendar__clear').dispatchEvent('click');
    await expect(rangeInput).toHaveValue('null');

    await rangeInput.evaluate((input: HTMLInputElement) => {
      input.value = '{"start":"2026-09-01","end":"2026-09-04"}';
      input.dispatchEvent(new CustomEvent('external-sync'));
    });
    await expect(range.locator('.diet-date-range-picker__value')).toHaveText('Sep 1 – 4, 2026');
  });

  test('Layouts reveals the exact source contract and edits its four tokens through the foundation path', async ({
    page,
  }) => {
    await page.route('**/api/dieter/tokens/foundation', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          path: 'dieter/tokens/dieter-foundation-tokens.css',
          sha: 'test-sha',
          tokens: [
            { token: '--layout-left-nav-width', value: '16rem', editable: true },
            { token: '--layout-left-nav-padding', value: 'var(--space-6)', editable: true },
            { token: '--layout-page-padding', value: 'var(--space-6)', editable: true },
            { token: '--layout-compact-left-nav-width', value: '20rem', editable: true },
            { token: '--space-0', value: '0.125rem', editable: true },
          ],
        }),
      });
    });

    await page.goto('/#/dieter/layouts');
    await expect(
      page.locator('[data-layout-source="dieter/layouts/main-container"]'),
    ).toBeVisible();
    await expect(page.locator('[data-layout-example]')).toHaveCount(3);
    await expect(page.locator('[data-token-edit="foundation"]')).toHaveCount(4);
    const sectionOrder = await page
      .locator('.layouts-page > :is(p, details, section)')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          if (node.tagName === 'P') return 'explanation';
          if (node.tagName === 'DETAILS') return 'source';
          return node.id || node.querySelector('h2')?.id || '';
        }),
      );
    expect(sectionOrder).toEqual(['explanation', 'source', 'layout-examples', 'layout-properties']);

    for (const frame of await page.locator('[data-layout-example] iframe').all()) {
      const content = frame.contentFrame();
      await expect(content.locator('.main-container > .left-nav')).toHaveCount(1);
      await expect(content.locator('.main-container > .page')).toHaveCount(1);
      await expect(content.locator('.page__header')).toHaveCount(1);
      await expect(content.locator('.page__actions')).toHaveCount(1);
      await expect(content.locator('.page__content')).toHaveCount(1);
    }

    const fullFrame = page.locator('[data-layout-example="full"] iframe').contentFrame();
    await expect(fullFrame.locator('.main-container > .left-nav')).toHaveCSS('width', '256px');

    const openFrame = page.locator('[data-layout-example="compact-open"] iframe').contentFrame();
    await expect(openFrame.locator('.main-container')).toHaveAttribute(
      'data-navigation-open',
      'true',
    );
    await expect(openFrame.locator('.main-container > .left-nav')).toHaveCSS('width', '320px');

    await page.getByRole('button', { name: 'Edit --layout-page-padding' }).click();
    const layoutTokenSelect = page.getByRole('dialog').locator('select[name="token"]');
    await expect(layoutTokenSelect).toHaveValue('--layout-page-padding');
    await expect(layoutTokenSelect.locator('option')).toHaveCount(4);
  });

  test('Core styles uses an explicit edit action and one token-dialog state at a time', async ({
    page,
  }) => {
    const unexpectedMutations = await guardUnexpectedApiMutations(page);
    await page.route('**/api/dieter/tokens/foundation', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          path: 'dieter/tokens/dieter-foundation-tokens.css',
          sha: 'test-sha',
          tokens: [
            { token: '--space-0', value: '0.125rem', editable: true },
            { token: '--space-1', value: '0.25rem', editable: true },
            { token: '--layout-page-padding', value: 'var(--space-6)', editable: true },
          ],
        }),
      });
    });

    await page.goto('/#/dieter/core-styles');
    await expect(page.locator('.core-style-sample-frame')).toHaveCount(53);
    await expect(page.locator('.core-style-sample').first()).toHaveCSS('min-block-size', '24px');
    await expect(page.locator('.dieter-preview')).toHaveCSS('gap', '16px');
    await expect(page.locator('.foundation-section').first()).toHaveCSS('gap', '12px');
    await expect(page.locator('.core-style-sample-frame').first()).not.toHaveJSProperty(
      'tagName',
      'BUTTON',
    );
    await expect(page.locator('[data-token-edit="foundation"]')).toHaveCount(53);

    await page.getByRole('button', { name: 'Edit --space-0' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('select[name="token"] option')).toHaveCount(2);
    const editor = dialog.locator('[data-token-editor-work]');
    const discard = dialog.locator('[data-token-editor-discard-view]');
    await expect(dialog.getByRole('heading', { name: 'Edit token' })).toBeVisible();
    await expect(editor).toBeVisible();
    await expect(discard).toBeHidden();
    await expect(dialog.locator('.devstudio-token-editor__view:visible')).toHaveCount(1);
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();

    const primaryDisplay = await dialog
      .getByRole('button', { name: 'Confirm commit' })
      .evaluate((element) => getComputedStyle(element).display);
    expect(['flex', 'inline-flex']).toContain(primaryDisplay);

    const value = dialog.getByRole('textbox', { name: 'Value' });
    await value.fill('0.5rem');
    await expect(dialog.getByText('0.125rem → 0.5rem')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toBeHidden();
    await expect(discard).toBeVisible();
    await expect(dialog.locator('.devstudio-token-editor__view:visible')).toHaveCount(1);

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(editor).toBeVisible();
    await expect(discard).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
    await expect(discard).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor).toBeVisible();
    await expect(discard).toBeHidden();

    await value.fill('0.125rem');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });

  test('component pages use one generated-row spacing owner', async ({ page }) => {
    await page.goto('/#/dieter/button');
    const componentPage = page.locator('.component-page');
    const componentRow = componentPage.locator('.dieter-component-row').first();
    await expect(componentPage).toHaveCSS('gap', '12px');
    await expect(componentRow).toHaveCSS('margin-block-end', '0px');
    await expect(componentRow).not.toHaveAttribute('style');
  });

  test('Core styles keeps loading and commit states singular and truthful', async ({ page }) => {
    const mutations: Array<{ method: string; path: string; body: unknown }> = [];
    let releaseLoad: (() => void) | undefined;
    const loadReleased = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let releaseSave: (() => void) | undefined;
    const saveReleased = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });

    await page.route('**/api/dieter/tokens/foundation**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/dieter/tokens/foundation') {
        await loadReleased;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            path: 'dieter/tokens/dieter-foundation-tokens.css',
            sha: 'test-sha',
            tokens: [
              { token: '--space-0', value: '0.125rem', editable: true },
              { token: '--space-1', value: '0.25rem', editable: true },
            ],
          }),
        });
        return;
      }
      if (request.method() === 'POST' && path === '/api/dieter/tokens/foundation/value') {
        mutations.push({
          method: request.method(),
          path,
          body: request.postDataJSON(),
        });
        await saveReleased;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            path: 'dieter/tokens/dieter-foundation-tokens.css',
            sha: 'next-test-sha',
            tokens: [
              { token: '--space-0', value: '0.5rem', editable: true },
              { token: '--space-1', value: '0.25rem', editable: true },
            ],
          }),
        });
        return;
      }
      await route.abort('blockedbyclient');
    });

    await page.goto('/#/dieter/core-styles');
    await page.getByRole('button', { name: 'Edit --space-0' }).click();
    const dialog = page.getByRole('dialog');
    const form = dialog.locator('form');
    const editor = dialog.locator('[data-token-editor-work]');
    const discard = dialog.locator('[data-token-editor-discard-view]');
    const tokenSelect = dialog.getByRole('combobox', { name: 'Token' });
    const value = dialog.getByRole('textbox', { name: 'Value' });
    const close = dialog.getByRole('button', { name: 'Close' });
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const commit = dialog.getByRole('button', { name: 'Confirm commit' });

    await expect(dialog.getByText('Loading token source…')).toBeVisible();
    await expect(tokenSelect).toBeDisabled();
    await expect(value).toBeDisabled();
    releaseLoad?.();
    await expect(value).toHaveValue('0.125rem');
    await expect(tokenSelect).toBeEnabled();
    await expect(value).toBeEnabled();

    await value.fill('0.5rem');
    await commit.click();
    await expect.poll(() => mutations.length).toBe(1);
    await expect(dialog.getByText('Committing 0.125rem → 0.5rem…')).toBeVisible();
    await expect(tokenSelect).toBeDisabled();
    await expect(value).toBeDisabled();
    await expect(close).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(commit).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(editor).toBeVisible();
    await expect(discard).toBeHidden();
    await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
    expect(mutations).toHaveLength(1);

    releaseSave?.();
    await expect(dialog.getByText('Committed. CI will rebuild Dieter artifacts.')).toBeVisible();
    await expect(tokenSelect).toBeEnabled();
    await expect(value).toBeEnabled();
    await expect(close).toBeEnabled();
    await expect(cancel).toBeEnabled();
    await expect(commit).toBeDisabled();
    await expect(value).toHaveValue('0.5rem');
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    expect(mutations).toEqual([
      {
        method: 'POST',
        path: '/api/dieter/tokens/foundation/value',
        body: { token: '--space-0', value: '0.5rem' },
      },
    ]);
  });

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
      await expect(page).toHaveURL(/#\/dieter\/core-styles$/);
      await expect(page.getByRole('heading', { name: 'Core styles' })).toBeVisible();
      await expect(page.getByText('Bob UI Native')).toHaveCount(0);
    }
  });

  test('Policy Editor exposes initial and reload failure truth without raw detail', async ({
    page,
  }) => {
    const unexpectedMutations = await guardUnexpectedApiMutations(page);
    let readMode: 'initial-delayed-fail' | 'live' | 'delayed-fail' = 'initial-delayed-fail';
    let releaseInitial!: () => void;
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>((resolve) => {
      releaseReload = resolve;
    });
    const rawSentinel = 'RAW_POLICY_READ_SENTINEL';

    for (const path of [ENTITLEMENT_MATRIX_PATH, AI_RUNTIME_MATRIX_PATH]) {
      await page.route(`**${path}`, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        if (readMode === 'live') return route.fallback();
        if (readMode === 'initial-delayed-fail') await initialGate;
        if (readMode === 'delayed-fail') await reloadGate;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { reasonKey: 'coreui.errors.db.readFailed', detail: rawSentinel },
          }),
        });
      });
    }

    await page.goto('/#/policy/entitlements');
    await expect(page.getByRole('status')).toHaveText('Loading policy data...');
    await expectPolicyEditorBusy(page);
    releaseInitial();
    await expect(page.getByRole('alert')).toHaveText('Policy data could not be loaded. Try again.');
    await expect(page.getByText(rawSentinel)).toHaveCount(0);
    await expect(page.getByText('Loading policy data...')).toHaveCount(0);

    readMode = 'live';
    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    readMode = 'delayed-fail';
    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByRole('status')).toHaveText('Reloading policy data...');
    await expectPolicyEditorBusy(page);
    releaseReload();
    await expect(page.getByRole('alert')).toHaveText('Policy data could not be loaded. Try again.');
    await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();
    await expect(page.getByText(rawSentinel)).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });

  test('Policy Editor reports entitlement save failure, partial success, and saved state without mutation', async ({
    page,
  }) => {
    const unexpectedMutations = await guardUnexpectedApiMutations(page);
    const posts: string[] = [];
    let responseIndex = 0;
    let releaseFirstSave!: () => void;
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const rawSentinel = 'RAW_ENTITLEMENT_SAVE_SENTINEL';
    let entitlementMatrix: unknown = null;
    let entitlementPath: unknown = null;

    await page.route(`**${ENTITLEMENT_CELL_PATH}`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts.push(new URL(route.request().url()).pathname);
      const index = responseIndex++;
      if (index === 0) {
        await firstSaveGate;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { reasonKey: 'coreui.errors.db.writeFailed', detail: rawSentinel },
          }),
        });
        return;
      }
      if (index === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, path: entitlementPath }),
        });
        return;
      }
      const returnedMatrix = structuredClone(entitlementMatrix) as {
        tiers?: unknown;
        entitlements?: unknown;
      };
      if (
        !Array.isArray(returnedMatrix.tiers) ||
        !returnedMatrix.entitlements ||
        typeof returnedMatrix.entitlements !== 'object'
      ) {
        throw new Error('Entitlement matrix fixture is invalid');
      }
      (returnedMatrix.entitlements as Record<string, unknown>)[ENTITLEMENT_RETURNED_MATRIX_PROOF] =
        {
          kind: 'limit',
          values: Object.fromEntries(returnedMatrix.tiers.map((tier) => [String(tier), 126])),
        };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, path: entitlementPath, matrix: returnedMatrix }),
      });
    });

    let entitlementGets = 0;
    page.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === ENTITLEMENT_MATRIX_PATH)
        entitlementGets += 1;
    });
    const loaded = await openPolicyEditor(page);
    entitlementMatrix = loaded.entitlements.matrix;
    entitlementPath = loaded.entitlements.path;

    await triggerTextInputSave(page, 'Plan Limits');
    await expect(page.getByRole('status')).toHaveText('Saving policy changes...');
    await expectPolicyEditorBusy(page);
    const disabledPlanInput = page
      .locator('section.entitlements-section')
      .filter({ has: page.getByRole('heading', { name: 'Plan Limits', exact: true }) })
      .locator('input[type="text"][disabled]')
      .first();
    await disabledPlanInput.evaluate((element) => element.dispatchEvent(new Event('blur')));
    await expect.poll(() => posts.length).toBe(1);
    releaseFirstSave();
    await expect(page.getByRole('alert')).toHaveText(
      'Entitlement changes could not be saved. Try again.',
    );
    await expect(page.getByText(rawSentinel)).toHaveCount(0);

    await triggerTextInputSave(page, 'Plan Limits');
    await expect(page.getByRole('alert')).toHaveText(
      'Entitlement changes were saved, but the latest policy could not be shown. Reload policy data.',
    );
    await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();

    await triggerTextInputSave(page, 'Plan Limits');
    await expect(page.getByRole('status')).toHaveText('Policy changes saved.');
    await expect(page.getByRole('heading', { name: 'Plan Limits' })).toBeVisible();
    await expect(
      page.locator('.entitlements-table__token', { hasText: ENTITLEMENT_RETURNED_MATRIX_PROOF }),
    ).toHaveText(ENTITLEMENT_RETURNED_MATRIX_PROOF);

    expect(entitlementGets).toBe(1);
    expect(posts).toEqual([ENTITLEMENT_CELL_PATH, ENTITLEMENT_CELL_PATH, ENTITLEMENT_CELL_PATH]);
    expect(unexpectedMutations).toEqual([]);
  });

  test('Policy Editor reports AI save failure, partial success, and saved state without mutation', async ({
    page,
  }) => {
    const unexpectedMutations = await guardUnexpectedApiMutations(page);
    const posts: string[] = [];
    let responseIndex = 0;
    const rawSentinel = 'RAW_AI_POLICY_SAVE_SENTINEL';
    let aiRuntimeMatrix: unknown = null;
    let aiRuntimePath: unknown = null;
    let aiRuntimeGets = 0;
    let aiProofCoordinate: { agentId: string; tier: string; field: string } | null = null;

    page.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === AI_RUNTIME_MATRIX_PATH)
        aiRuntimeGets += 1;
    });

    await page.route(`**${AI_RUNTIME_CELL_PATH}`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts.push(new URL(route.request().url()).pathname);
      const index = responseIndex++;
      if (index === 0) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { reasonKey: 'coreui.errors.db.writeFailed', detail: rawSentinel },
          }),
        });
        return;
      }
      if (index === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'UNREADABLE_AI_POLICY_RESPONSE',
        });
        return;
      }
      const payload = route.request().postDataJSON() as {
        agentId?: unknown;
        tier?: unknown;
        field?: unknown;
      };
      const agentId = String(payload.agentId || '');
      const tier = String(payload.tier || '');
      const field = String(payload.field || '');
      const returnedMatrix = structuredClone(aiRuntimeMatrix) as { agents?: unknown };
      if (!returnedMatrix.agents || typeof returnedMatrix.agents !== 'object')
        throw new Error('AI runtime matrix fixture is invalid');
      const agentTiers = (returnedMatrix.agents as Record<string, unknown>)[agentId];
      if (!agentTiers || typeof agentTiers !== 'object')
        throw new Error('AI runtime agent fixture is invalid');
      const config = (agentTiers as Record<string, unknown>)[tier];
      if (!config || typeof config !== 'object')
        throw new Error('AI runtime tier fixture is invalid');
      const configRecord = config as Record<string, unknown>;
      if (field === 'maxTurnsPerThread') {
        configRecord.maxTurnsPerThread = AI_RETURNED_MATRIX_PROOF_VALUE;
      } else {
        const budget =
          configRecord.budget && typeof configRecord.budget === 'object'
            ? { ...(configRecord.budget as Record<string, unknown>) }
            : {};
        budget[field] = AI_RETURNED_MATRIX_PROOF_VALUE;
        configRecord.budget = budget;
      }
      aiProofCoordinate = { agentId, tier, field };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, path: aiRuntimePath, matrix: returnedMatrix }),
      });
    });

    const loaded = await openPolicyEditor(page);
    aiRuntimeMatrix = loaded.aiRuntime.matrix;
    aiRuntimePath = loaded.aiRuntime.path;

    await triggerTextInputSave(page, 'Customer Copilots');
    await expect(page.getByRole('alert')).toHaveText(
      'AI policy changes could not be saved. Try again.',
    );
    await expect(page.getByText(rawSentinel)).toHaveCount(0);

    await triggerTextInputSave(page, 'Customer Copilots');
    await expect(page.getByRole('alert')).toHaveText(
      'AI policy changes were saved, but the latest policy could not be shown. Reload policy data.',
    );
    await expect(page.getByRole('heading', { name: 'Customer Copilots' })).toBeVisible();

    await triggerTextInputSave(page, 'Customer Copilots');
    await expect(page.getByRole('status')).toHaveText('Policy changes saved.');
    await expect(page.getByRole('heading', { name: 'Customer Copilots' })).toBeVisible();
    expect(aiProofCoordinate).not.toBeNull();
    await expect(
      page.getByLabel(
        `${aiProofCoordinate!.agentId} ${aiProofCoordinate!.tier} ${aiProofCoordinate!.field}`,
      ),
    ).toHaveValue(String(AI_RETURNED_MATRIX_PROOF_VALUE));

    expect(posts).toEqual([AI_RUNTIME_CELL_PATH, AI_RUNTIME_CELL_PATH, AI_RUNTIME_CELL_PATH]);
    expect(aiRuntimeGets).toBe(1);
    await expect(page.getByText('UNREADABLE_AI_POLICY_RESPONSE')).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });
});
