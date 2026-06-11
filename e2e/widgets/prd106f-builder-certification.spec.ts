import {
  expect,
  test,
  type ConsoleMessage,
  type Frame,
  type FrameLocator,
  type Locator,
  type Page,
} from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

const PRD106F_INSTANCES = [
  {
    widgetType: 'calltoaction',
    instanceId: 'SZBSB5HHFJ',
    corePath: 'calltoaction.action.label',
    coreKind: 'text',
  },
  {
    widgetType: 'big-bang',
    instanceId: 'QD1G068MX7',
    corePath: 'bigBang.statement',
    coreKind: 'text',
  },
  {
    widgetType: 'cards',
    instanceId: 'U37WRSMY7J',
    corePath: 'cards.items',
    coreKind: 'cards-json',
  },
  {
    widgetType: 'countdown',
    instanceId: 'H7IF9M2K9B',
    corePath: 'countdown.timer.labels.days',
    coreKind: 'text',
  },
  { widgetType: 'faq', instanceId: 'UZ3JEJSHII', corePath: 'faq.sections', coreKind: 'faq-json' },
  {
    widgetType: 'logoshowcase',
    instanceId: '8FMVZFFPJV',
    corePath: 'logoshowcase.strips',
    coreKind: 'logos-json',
  },
  {
    widgetType: 'split-media',
    instanceId: 'KUGYTX2ZMQ',
    corePath: 'splitMedia.alt',
    coreKind: 'text',
  },
  {
    widgetType: 'split-carousel-media',
    instanceId: 'P10U6N7Y2X',
    corePath: 'splitCarouselMedia.items',
    coreKind: 'visuals-json',
  },
] as const;

const MIXED_BUILDER_PANELS = ['Content', 'Layout', 'Appearance', 'Typography', 'Settings'] as const;
const CONTENT_PANEL_TEXT_CONTROL_COVERAGE: readonly ContentPanelTextControlCoverage[] = [
  {
    widgetType: 'faq',
    controls: [
      { path: 'faq.sections.0.title', label: 'FAQ section title' },
      { path: 'faq.sections.0.faqs.0.question', label: 'FAQ question' },
      { path: 'faq.sections.0.faqs.0.answer', label: 'FAQ answer' },
    ],
  },
  {
    widgetType: 'cards',
    controls: [
      { path: 'cards.items.0.title', label: 'Cards title' },
      { path: 'cards.items.0.copy', label: 'Cards copy' },
    ],
  },
  {
    widgetType: 'countdown',
    controls: [
      { path: 'countdown.timer.labels.days', label: 'Countdown days label' },
      { path: 'countdown.timer.labels.hours', label: 'Countdown hours label' },
      { path: 'countdown.actions.during.text', label: 'Countdown action label' },
    ],
  },
  {
    widgetType: 'logoshowcase',
    controls: [
      { path: 'logoshowcase.strips.0.logos.0.name', label: 'Logo Showcase logo name' },
      { path: 'logoshowcase.strips.0.logos.0.caption', label: 'Logo Showcase logo caption' },
    ],
  },
  {
    widgetType: 'split-carousel-media',
    controls: [
      { path: 'splitCarouselMedia.items.0.alt', label: 'Split Carousel Media first alt text' },
      { path: 'splitCarouselMedia.items.1.alt', label: 'Split Carousel Media second alt text' },
    ],
  },
] as const;
const VISIBLE_PANEL_CONTROL_SELECTOR = [
  '.tdmenucontent__fields [data-bob-path]:visible',
  '.tdmenucontent__fields button:visible',
  '.tdmenucontent__fields input:visible',
  '.tdmenucontent__fields textarea:visible',
  '.tdmenucontent__fields select:visible',
  '.tdmenucontent__fields [role="button"]:visible',
  '.tdmenucontent__fields .tdmenucontent__cluster-label:visible',
  '.tdmenucontent__fields .tdmenucontent__group-label:visible',
].join(', ');
const TEXT_CONTROL_CONTAINER_XPATH = [
  'xpath=ancestor-or-self::*[',
  'contains(concat(" ", normalize-space(@class), " "), " diet-dropdown-edit ")',
  ' or contains(concat(" ", normalize-space(@class), " "), " diet-dropdown-upload ")',
  ' or contains(concat(" ", normalize-space(@class), " "), " diet-textfield ")',
  ' or contains(concat(" ", normalize-space(@class), " "), " diet-textedit ")',
  ' or contains(concat(" ", normalize-space(@class), " "), " diet-valuefield ")',
  '][1]',
].join('');

type Prd106fWidgetType = (typeof PRD106F_INSTANCES)[number]['widgetType'];
type ContentPanelTextControl = {
  path: string;
  label: string;
};
type ContentPanelTextControlCoverage = {
  widgetType: Prd106fWidgetType;
  controls: readonly ContentPanelTextControl[];
};

type ErrorCollector = {
  consoleErrors: string[];
  pageErrors: string[];
};

function collectPageErrors(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    consoleErrors: [],
    pageErrors: [],
  };

  attachPageErrors(page, collector);
  return collector;
}

function attachPageErrors(page: Page, collector: ErrorCollector) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (
      message.text().includes("Blocked attempt to show multiple 'beforeunload' confirmation panels")
    )
      return;
    collector.consoleErrors.push(formatConsoleMessage(message));
  });

  page.on('pageerror', (error) => {
    collector.pageErrors.push(error.stack || error.message);
  });
}

function formatConsoleMessage(message: ConsoleMessage): string {
  const location = message.location();
  const source = location.url
    ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})`
    : '';
  return `${message.text()}${source}`;
}

function bobPathSelector(path: string): string {
  return `[data-bob-path="${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function nearestClassLocator(locator: Locator, className: string): Locator {
  return locator.locator(
    `xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " ${className} ")][1]`,
  );
}

async function expectNearestUploadOpenIfPresent(field: Locator) {
  const uploadRoot = nearestClassLocator(field, 'diet-dropdown-upload');
  if ((await uploadRoot.count()) === 0) return;

  await expect(uploadRoot).toBeVisible({ timeout: 20_000 });
  const trigger = uploadRoot.locator('.diet-dropdown-upload__control').first();
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await expect(trigger).toHaveAttribute('role', 'button');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }
  await expect(uploadRoot.locator('.diet-dropdown-upload__popover').first()).toBeVisible({
    timeout: 10_000,
  });
}

async function expectDropdownEditUsable(
  field: Locator,
  control: ContentPanelTextControl,
): Promise<boolean> {
  const dropdownRoot = nearestClassLocator(field, 'diet-dropdown-edit');
  if ((await dropdownRoot.count()) === 0) return false;

  await expect(dropdownRoot, `${control.label} container should be visible`).toBeVisible({
    timeout: 20_000,
  });
  const trigger = dropdownRoot.locator('.diet-dropdown-edit__control').first();
  await expect(trigger, `${control.label} dropdown trigger should be visible`).toBeVisible({
    timeout: 20_000,
  });
  await expect(trigger).toHaveAttribute('role', 'button');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }

  const editor = dropdownRoot.locator('.diet-dropdown-edit__editor').first();
  await expect(editor, `${control.label} editor should open`).toBeVisible({ timeout: 10_000 });
  await expect(editor, `${control.label} editor should be editable`).toBeEditable();
  await editor.press('Escape');
  return true;
}

async function expectContentTextControlUsable(bobFrame: Frame, control: ContentPanelTextControl) {
  const field = bobFrame.locator(`.tdmenucontent__fields ${bobPathSelector(control.path)}`).first();
  await expect(field, `${control.label} should be mounted at ${control.path}`).toBeAttached({
    timeout: 20_000,
  });

  await expectNearestUploadOpenIfPresent(field);
  if (await expectDropdownEditUsable(field, control)) return;

  const container = field.locator(TEXT_CONTROL_CONTAINER_XPATH).first();
  await expect(
    container,
    `${control.label} visible control container should be rendered`,
  ).toBeVisible({
    timeout: 20_000,
  });

  const editable = container
    .locator(
      `${bobPathSelector(control.path)}:not([type="hidden"]), textarea${bobPathSelector(control.path)}`,
    )
    .first();
  await expect(editable, `${control.label} should expose a visible text input`).toBeVisible({
    timeout: 20_000,
  });
  await expect(editable, `${control.label} should be editable`).toBeEditable();
}

function getPrd106fInstance(widgetType: Prd106fWidgetType): (typeof PRD106F_INSTANCES)[number] {
  const instance = PRD106F_INSTANCES.find((candidate) => candidate.widgetType === widgetType);
  if (!instance) throw new Error(`Missing PRD106F instance for ${widgetType}`);
  return instance;
}

async function expectBuilderPanelReady(
  bobFrame: FrameLocator,
  panelName: (typeof MIXED_BUILDER_PANELS)[number],
) {
  const tab = bobFrame.getByRole('tab', { name: panelName });
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(bobFrame.locator('.tdmenucontent__header .heading-3')).toHaveText(panelName);
  await expect(
    bobFrame.locator(VISIBLE_PANEL_CONTROL_SELECTOR).first(),
    `${panelName} panel should render visible ToolDrawer controls`,
  ).toBeVisible({ timeout: 20_000 });
}

async function expectPreviewNonblank(bobFrame: FrameLocator) {
  await expect(bobFrame.locator('section.workspace[data-widget-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });

  const previewBody = bobFrame.frameLocator('iframe[title="Widget preview"]').locator('body');
  await expect(previewBody).toBeAttached({ timeout: 20_000 });

  await expect
    .poll(
      async () =>
        previewBody.evaluate(() => {
          const body = document.body;
          const visibleNodes = Array.from(body.querySelectorAll('*')).filter((node) => {
            const element = node as HTMLElement;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width >= 2 &&
              rect.height >= 2
            );
          });

          return body.scrollWidth > 10 && body.scrollHeight > 10 && visibleNodes.length > 0;
        }),
      {
        timeout: 20_000,
        message: 'preview iframe should contain visible rendered widget content',
      },
    )
    .toBe(true);
}

function expectNoCollectedErrors(instanceLabel: string, collector: ErrorCollector) {
  const errors = [
    ...collector.consoleErrors.map((error) => `console error: ${error}`),
    ...collector.pageErrors.map((error) => `page error: ${error}`),
  ];

  expect(errors, `${instanceLabel} should not emit console/page errors`).toEqual([]);
}

async function waitForSelectedInstance(bobFrame: Frame, timeout = 30_000): Promise<boolean> {
  return bobFrame
    .waitForFunction(() => !document.body.innerText.includes('No instance selected yet'), null, {
      timeout,
    })
    .then(() => true)
    .catch(() => false);
}

async function openBuilderFrame(page: Page, instanceId: string): Promise<Frame> {
  const openResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes(`/api/builder/${instanceId}/open`),
  );

  await page.goto(`/builder/${instanceId}`, { waitUntil: 'domcontentloaded' });

  const openResponse = await openResponsePromise;
  expect(
    openResponse.ok(),
    `builder-open API returned ${openResponse.status()} for ${instanceId}`,
  ).toBe(true);

  await expect(page).toHaveURL(new RegExp(`/builder/${instanceId}`));
  const frameHandle = await page
    .locator('iframe[title="Bob Builder"]')
    .elementHandle({ timeout: 30_000 });
  const bobFrame = await frameHandle.contentFrame();
  expect(bobFrame, `Bob frame should exist for ${instanceId}`).not.toBeNull();

  await bobFrame!.getByRole('button', { name: /Manual/i }).waitFor({ timeout: 30_000 });
  const instanceSelected = await waitForSelectedInstance(bobFrame!);
  if (!instanceSelected) {
    const retryButton = page.getByRole('button', { name: 'Retry' });
    await expect(retryButton, `builder retry should be available for ${instanceId}`).toBeVisible({
      timeout: 5_000,
    });
    const retryResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes(`/api/builder/${instanceId}/open`),
    );
    await retryButton.click();
    const retryResponse = await retryResponsePromise;
    expect(
      retryResponse.ok(),
      `builder-open retry returned ${retryResponse.status()} for ${instanceId}`,
    ).toBe(true);
    await expect
      .poll(() => waitForSelectedInstance(bobFrame!, 5_000), {
        timeout: 45_000,
        message: `Bob should select instance ${instanceId} after retry`,
      })
      .toBe(true);
  }
  await expect(bobFrame!.getByRole('button', { name: 'Save' }).first()).toBeDisabled({
    timeout: 20_000,
  });
  return bobFrame!;
}

async function readFieldValue(bobFrame: Frame, path: string): Promise<string> {
  return bobFrame.locator(`[data-bob-path="${path}"]`).first().inputValue({ timeout: 10_000 });
}

async function setFieldValue(bobFrame: Frame, path: string, value: string) {
  const field = bobFrame.locator(`[data-bob-path="${path}"]`).first();
  await field.waitFor({ state: 'attached', timeout: 10_000 });
  await field.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function saveWidget(page: Page, bobFrame: Frame, instanceId: string) {
  const saveButton = bobFrame.getByRole('button', { name: 'Save' }).first();
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/account/instances/${instanceId}`),
  );
  await saveButton.click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok(), `save API returned ${saveResponse.status()} for ${instanceId}`).toBe(
    true,
  );
}

function buildCoreMutation(
  instance: (typeof PRD106F_INSTANCES)[number],
  rawOriginal: string,
  stamp: string,
): string {
  if (instance.coreKind === 'text') return `E2E ${instance.widgetType} core ${stamp}`;

  if (instance.coreKind === 'cards-json') {
    const cards = JSON.parse(rawOriginal) as Array<Record<string, unknown>>;
    expect(
      Array.isArray(cards) && cards.length > 0,
      'Cards repeater must have at least one item',
    ).toBe(true);
    cards[0] = { ...cards[0], title: `E2E cards core ${stamp}` };
    return JSON.stringify(cards);
  }

  if (instance.coreKind === 'faq-json') {
    const sections = JSON.parse(rawOriginal) as Array<{ faqs?: Array<Record<string, unknown>> }>;
    expect(
      Array.isArray(sections) && Array.isArray(sections[0]?.faqs) && sections[0].faqs.length > 0,
    ).toBe(true);
    sections[0] = {
      ...sections[0],
      faqs: [
        { ...sections[0].faqs![0], question: `E2E faq core ${stamp}` },
        ...sections[0].faqs!.slice(1),
      ],
    };
    return JSON.stringify(sections);
  }

  if (instance.coreKind === 'logos-json') {
    const strips = JSON.parse(rawOriginal) as Array<{ logos?: Array<Record<string, unknown>> }>;
    expect(
      Array.isArray(strips) && Array.isArray(strips[0]?.logos) && strips[0].logos.length > 0,
    ).toBe(true);
    strips[0] = {
      ...strips[0],
      logos: [
        { ...strips[0].logos![0], name: `E2E logoshowcase core ${stamp}` },
        ...strips[0].logos!.slice(1),
      ],
    };
    return JSON.stringify(strips);
  }

  const visuals = JSON.parse(rawOriginal) as Array<Record<string, unknown>>;
  expect(
    Array.isArray(visuals) && visuals.length > 0,
    'Split carousel media repeater must have at least one item',
  ).toBe(true);
  visuals[0] = { ...visuals[0], alt: `E2E split-carousel-media core ${stamp}` };
  return JSON.stringify(visuals);
}

async function expectSavedFieldValue(
  bobFrame: Frame,
  path: string,
  expectedValue: string,
  isJson: boolean,
) {
  const field = bobFrame.locator(`[data-bob-path="${path}"]`).first();
  if (!isJson) {
    await expect(field).toHaveValue(expectedValue, { timeout: 20_000 });
    return;
  }

  await expect
    .poll(
      async () => {
        const currentValue = await field.inputValue();
        return JSON.parse(currentValue);
      },
      { timeout: 20_000, message: `${path} should persist structurally equivalent JSON` },
    )
    .toEqual(JSON.parse(expectedValue));
}

test.describe('PRD106F authenticated Builder browser certification', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    test.skip(
      !hasAuthCookies(),
      'No e2e auth state found. Configure E2E_USER_EMAIL and E2E_AUTH_SECRET.',
    );
  });

  for (const instance of PRD106F_INSTANCES) {
    test(`${instance.widgetType} Builder opens cleanly for ${instance.instanceId}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);

      const collector = collectPageErrors(page);
      await openBuilderFrame(page, instance.instanceId);
      await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible();
      await expect(
        page.getByText('Builder could not open this widget. Please try again.'),
      ).toHaveCount(0);

      const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');

      for (const panelName of MIXED_BUILDER_PANELS) {
        await expectBuilderPanelReady(bobFrame, panelName);
      }

      await expectPreviewNonblank(bobFrame);
      expectNoCollectedErrors(`${instance.widgetType}/${instance.instanceId}`, collector);
    });
  }

  for (const instance of PRD106F_INSTANCES) {
    test(`${instance.widgetType} saves and reloads Shell and Core edits for ${instance.instanceId}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);

      const collector = collectPageErrors(page);
      const openedPages: Page[] = [page];
      const stamp = `${Date.now()}`.slice(-6);
      let originalHeader = '';
      let originalCore = '';

      try {
        let bobFrame = await openBuilderFrame(page, instance.instanceId);
        await bobFrame.getByRole('tab', { name: 'Content' }).click();

        originalHeader = await readFieldValue(bobFrame, 'header.title');
        originalCore = await readFieldValue(bobFrame, instance.corePath);

        const headerValue = `E2E ${instance.widgetType} shell ${stamp}`;
        const coreValue = buildCoreMutation(instance, originalCore, stamp);

        await setFieldValue(bobFrame, 'header.title', headerValue);
        await setFieldValue(bobFrame, instance.corePath, coreValue);

        const previewBody = bobFrame.frameLocator('iframe[title="Widget preview"]').locator('body');
        await expect(previewBody).toContainText(headerValue, { timeout: 20_000 });

        await saveWidget(page, bobFrame, instance.instanceId);

        const verifyPage = await page.context().newPage();
        attachPageErrors(verifyPage, collector);
        openedPages.push(verifyPage);
        bobFrame = await openBuilderFrame(verifyPage, instance.instanceId);
        await bobFrame.getByRole('tab', { name: 'Content' }).click();
        await expect(bobFrame.locator(`[data-bob-path="header.title"]`).first()).toHaveValue(
          headerValue,
          {
            timeout: 20_000,
          },
        );
        await expectSavedFieldValue(
          bobFrame,
          instance.corePath,
          coreValue,
          instance.coreKind !== 'text',
        );
      } finally {
        if (originalHeader && originalCore) {
          const restorePage = await page.context().newPage();
          attachPageErrors(restorePage, collector);
          openedPages.push(restorePage);
          const restoreFrame = await openBuilderFrame(restorePage, instance.instanceId);
          await restoreFrame.getByRole('tab', { name: 'Content' }).click();
          await setFieldValue(restoreFrame, 'header.title', originalHeader);
          await setFieldValue(restoreFrame, instance.corePath, originalCore);
          const saveButton = restoreFrame.getByRole('button', { name: 'Save' }).first();
          if (await saveButton.isEnabled()) {
            await saveWidget(restorePage, restoreFrame, instance.instanceId);
          }
        }

        await Promise.all(
          openedPages
            .slice(1)
            .map((openedPage) => openedPage.close({ runBeforeUnload: false }).catch(() => {})),
        );
      }

      expectNoCollectedErrors(`${instance.widgetType}/${instance.instanceId}`, collector);
    });
  }

  test('Content panel exposes hydrated widget text controls without saving', async ({ page }) => {
    test.setTimeout(300_000);

    const collector = collectPageErrors(page);

    for (const coverage of CONTENT_PANEL_TEXT_CONTROL_COVERAGE) {
      const instance = getPrd106fInstance(coverage.widgetType);
      const bobFrame = await openBuilderFrame(page, instance.instanceId);
      await expectBuilderPanelReady(page.frameLocator('iframe[title="Bob Builder"]'), 'Content');

      for (const control of coverage.controls) {
        await expectContentTextControlUsable(bobFrame, control);
      }

      await expect(
        bobFrame.getByRole('button', { name: 'Save' }).first(),
        `${coverage.widgetType} text-control checks should not dirty the instance`,
      ).toBeDisabled({ timeout: 10_000 });
    }

    expectNoCollectedErrors('Content panel text controls', collector);
  });
});
