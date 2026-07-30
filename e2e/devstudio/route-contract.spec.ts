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
    (response) => response.url().endsWith(ENTITLEMENT_MATRIX_PATH) && response.request().method() === 'GET',
  );
  const aiRuntime = page.waitForResponse(
    (response) => response.url().endsWith(AI_RUNTIME_MATRIX_PATH) && response.request().method() === 'GET',
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
  await expect(page.locator('#entitlements-root input:not([disabled]), #entitlements-root select:not([disabled])')).toHaveCount(0);
}

const navGroups = [
  {
    title: 'Foundations',
    count: 4,
    routes: [
      { path: '/#/dieter/core-styles', title: 'Core styles' },
      { path: '/#/dieter/colors', title: 'Colors' },
      { path: '/#/dieter/icons', title: 'Icons' },
      { path: '/#/dieter/typography', title: 'Typography' },
    ],
  },
  {
    title: 'Dieter Components',
    count: 22,
    routes: [
      { path: '/#/dieter/agent-activity', title: 'Agent Activity' },
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
      { path: '/#/dieter/textedit', title: 'Textedit' },
      { path: '/#/dieter/textfield', title: 'Textfield' },
      { path: '/#/dieter/toggle', title: 'Toggle' },
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

  test('Core styles uses an explicit edit action and one token-dialog state at a time', async ({ page }) => {
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
          ],
        }),
      });
    });

    await page.goto('/#/dieter/core-styles');
    await expect(page.locator('.core-style-sample-frame')).toHaveCount(53);
    await expect(page.locator('.core-style-sample-frame').first()).not.toHaveJSProperty(
      'tagName',
      'BUTTON',
    );
    await expect(page.locator('[data-token-edit="foundation"]')).toHaveCount(53);

    await page.getByRole('button', { name: 'Edit --space-0' }).click();
    const dialog = page.getByRole('dialog');
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

  test('Policy Editor exposes initial and reload failure truth without raw detail', async ({ page }) => {
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
          body: JSON.stringify({ error: { reasonKey: 'coreui.errors.db.readFailed', detail: rawSentinel } }),
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

  test('Policy Editor reports entitlement save failure, partial success, and saved state without mutation', async ({ page }) => {
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
          body: JSON.stringify({ error: { reasonKey: 'coreui.errors.db.writeFailed', detail: rawSentinel } }),
        });
        return;
      }
      if (index === 1) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: entitlementPath }) });
        return;
      }
      const returnedMatrix = structuredClone(entitlementMatrix) as { tiers?: unknown; entitlements?: unknown };
      if (!Array.isArray(returnedMatrix.tiers) || !returnedMatrix.entitlements || typeof returnedMatrix.entitlements !== 'object') {
        throw new Error('Entitlement matrix fixture is invalid');
      }
      (returnedMatrix.entitlements as Record<string, unknown>)[ENTITLEMENT_RETURNED_MATRIX_PROOF] = {
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
      if (request.method() === 'GET' && new URL(request.url()).pathname === ENTITLEMENT_MATRIX_PATH) entitlementGets += 1;
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
    await expect(page.getByRole('alert')).toHaveText('Entitlement changes could not be saved. Try again.');
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

  test('Policy Editor reports AI save failure, partial success, and saved state without mutation', async ({ page }) => {
    const unexpectedMutations = await guardUnexpectedApiMutations(page);
    const posts: string[] = [];
    let responseIndex = 0;
    const rawSentinel = 'RAW_AI_POLICY_SAVE_SENTINEL';
    let aiRuntimeMatrix: unknown = null;
    let aiRuntimePath: unknown = null;
    let aiRuntimeGets = 0;
    let aiProofCoordinate: { agentId: string; tier: string; field: string } | null = null;

    page.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === AI_RUNTIME_MATRIX_PATH) aiRuntimeGets += 1;
    });

    await page.route(`**${AI_RUNTIME_CELL_PATH}`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts.push(new URL(route.request().url()).pathname);
      const index = responseIndex++;
      if (index === 0) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { reasonKey: 'coreui.errors.db.writeFailed', detail: rawSentinel } }),
        });
        return;
      }
      if (index === 1) {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'UNREADABLE_AI_POLICY_RESPONSE' });
        return;
      }
      const payload = route.request().postDataJSON() as { agentId?: unknown; tier?: unknown; field?: unknown };
      const agentId = String(payload.agentId || '');
      const tier = String(payload.tier || '');
      const field = String(payload.field || '');
      const returnedMatrix = structuredClone(aiRuntimeMatrix) as { agents?: unknown };
      if (!returnedMatrix.agents || typeof returnedMatrix.agents !== 'object') throw new Error('AI runtime matrix fixture is invalid');
      const agentTiers = (returnedMatrix.agents as Record<string, unknown>)[agentId];
      if (!agentTiers || typeof agentTiers !== 'object') throw new Error('AI runtime agent fixture is invalid');
      const config = (agentTiers as Record<string, unknown>)[tier];
      if (!config || typeof config !== 'object') throw new Error('AI runtime tier fixture is invalid');
      const configRecord = config as Record<string, unknown>;
      if (field === 'maxTurnsPerThread') {
        configRecord.maxTurnsPerThread = AI_RETURNED_MATRIX_PROOF_VALUE;
      } else if (field === 'rawSamplePercent') {
        const learningCapture = configRecord.learningCapture && typeof configRecord.learningCapture === 'object'
          ? { ...(configRecord.learningCapture as Record<string, unknown>) }
          : {};
        learningCapture.rawSamplePercent = AI_RETURNED_MATRIX_PROOF_VALUE;
        configRecord.learningCapture = learningCapture;
      } else {
        const budget = configRecord.budget && typeof configRecord.budget === 'object'
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
    await expect(page.getByRole('alert')).toHaveText('AI policy changes could not be saved. Try again.');
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
      page.getByLabel(`${aiProofCoordinate!.agentId} ${aiProofCoordinate!.tier} ${aiProofCoordinate!.field}`),
    ).toHaveValue(String(AI_RETURNED_MATRIX_PROOF_VALUE));

    expect(posts).toEqual([AI_RUNTIME_CELL_PATH, AI_RUNTIME_CELL_PATH, AI_RUNTIME_CELL_PATH]);
    expect(aiRuntimeGets).toBe(1);
    await expect(page.getByText('UNREADABLE_AI_POLICY_RESPONSE')).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });
});
