import { expect, test, type Page, type Route } from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

type BootstrapPayload = {
  authz?: {
    accountId?: unknown;
    accountPublicId?: unknown;
    role?: unknown;
    profile?: unknown;
    issuedAt?: string | null;
    expiresAt?: string | null;
  } | null;
  activeAccount?: {
    accountId?: unknown;
    accountPublicId?: unknown;
    role?: unknown;
    tier?: unknown;
  } | null;
  [key: string]: unknown;
};

let baselineBootstrap: BootstrapPayload | null = null;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function loadBilling(page: Page) {
  await page.goto('/billing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
}

function accountUnavailable(page: Page) {
  return page.getByRole('alert').filter({ hasText: 'This account is unavailable right now. Please try again.' });
}

function createBootstrap(expiresInMs = 10 * 60_000): BootstrapPayload {
  if (!baselineBootstrap) throw new Error('Roma bootstrap fixture is unavailable');
  const payload = structuredClone(baselineBootstrap);
  const now = Date.now();
  payload.authz = {
    ...payload.authz,
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + expiresInMs).toISOString(),
  };
  return payload;
}

async function mockProfileSave(page: Page) {
  await page.route('**/api/me', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await fulfillJson(route, 200, {
      profile: {
        userId: 'account-context-e2e',
        primaryEmail: 'account-context@example.test',
        givenName: 'Account',
        familyName: 'Context',
        primaryLanguage: 'en',
        country: 'US',
        timezone: 'America/Los_Angeles',
      },
    });
  });
}

test.describe('Roma account context lifecycle', () => {
  test.beforeAll(async ({ request }) => {
    if (!hasAuthCookies()) return;
    const response = await request.get('/api/bootstrap');
    expect(response.ok()).toBeTruthy();
    baselineBootstrap = (await response.json()) as BootstrapPayload;
  });

  test.beforeEach(() => {
    test.skip(!hasAuthCookies(), 'No Roma cloud-dev auth state found.');
  });

  test('keeps the authenticated shell visible during the first bootstrap', async ({ page }) => {
    const releaseBootstrap = deferred();
    let requests = 0;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests > 1) return route.fallback();
      await releaseBootstrap.promise;
      await fulfillJson(route, 200, createBootstrap());
    });

    await loadBilling(page);
    await expect(page.locator('.main-container')).toBeVisible();
    await expect(page.locator('.left-nav')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading page' })).toBeVisible();
    await expect(page.getByText('Loading account context...', { exact: true })).toHaveCount(0);

    releaseBootstrap.resolve();
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading page' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Usage', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading page' })).toHaveCount(0);
    expect(requests).toBe(1);
  });

  test('preserves the mounted page while an account mutation reconciles bootstrap truth', async ({ page }) => {
    const releaseBootstrap = deferred();
    const refreshStarted = deferred();
    let requests = 0;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) return fulfillJson(route, 200, createBootstrap());
      refreshStarted.resolve();
      await releaseBootstrap.promise;
      await fulfillJson(route, 200, createBootstrap());
    });
    await mockProfileSave(page);

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'User Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
    await page.locator('.main-container').evaluate((element) => {
      element.setAttribute('data-e2e-shell', 'persistent');
    });

    await page.getByRole('button', { name: 'Save settings' }).click();
    await refreshStarted.promise;
    await expect(page.locator('.main-container')).toHaveAttribute('data-e2e-shell', 'persistent');
    await expect(page.getByRole('button', { name: 'Saving...' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading page' })).toHaveCount(0);
    await expect(page.getByText('Loading account context...', { exact: true })).toHaveCount(0);

    releaseBootstrap.resolve();
    await expect(page.getByText('User settings saved.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
  });

  test('retries a transient background failure and applies the recovered policy', async ({ page }) => {
    const transientRefresh = deferred();
    const recoveredRefresh = deferred();
    let requests = 0;
    let bootstrapPayload: BootstrapPayload | null = null;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) {
        bootstrapPayload = createBootstrap(60_000);
        return fulfillJson(route, 200, bootstrapPayload);
      }
      if (requests === 2) {
        transientRefresh.resolve();
        return fulfillJson(route, 503, { error: { reasonKey: 'coreui.errors.service.unavailable' } });
      }
      if (requests === 3) {
        recoveredRefresh.resolve();
        const now = Date.now();
        const nextProfile = bootstrapPayload?.authz?.profile === 'free' ? 'tier4' : 'free';
        return fulfillJson(route, 200, {
          ...bootstrapPayload,
          activeAccount: {
            ...bootstrapPayload?.activeAccount,
            tier: nextProfile,
          },
          authz: {
            ...bootstrapPayload?.authz,
            profile: nextProfile,
            issuedAt: new Date(now - 1_000).toISOString(),
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
          },
        });
      }
      return fulfillJson(route, 401, { error: { reasonKey: 'coreui.errors.auth.required' } });
    });

    await loadBilling(page);
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await transientRefresh.promise;
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading page' })).toHaveCount(0);
    await recoveredRefresh.promise;
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    const expectedPlan = bootstrapPayload?.authz?.profile === 'free' ? 'Tier 4' : 'Free';
    await expect(page.getByRole('heading', { name: 'Current plan' }).locator('..').getByText(expectedPlan)).toBeVisible();
  });

  test('does not preserve a terminal auth result from a background refresh', async ({ page }) => {
    const refreshStarted = deferred();
    const releaseTerminal = deferred();
    let requests = 0;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) {
        return fulfillJson(route, 200, createBootstrap(60_000));
      }
      refreshStarted.resolve();
      await releaseTerminal.promise;
      return fulfillJson(route, 503, { error: { reasonKey: 'coreui.errors.auth.required' } });
    });

    await loadBilling(page);
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await refreshStarted.promise;
    releaseTerminal.resolve();
    await expect(page).toHaveURL(/\/login\?error=coreui\.errors\.auth\.required/);
  });

  test('stops transient preservation before the authz safety boundary', async ({ page }) => {
    const refreshStarted = deferred();
    const releaseFailure = deferred();
    let requests = 0;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) {
        return fulfillJson(route, 200, createBootstrap(38_000));
      }
      refreshStarted.resolve();
      await releaseFailure.promise;
      return fulfillJson(route, 503, { error: { reasonKey: 'coreui.errors.service.unavailable' } });
    });

    await loadBilling(page);
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await refreshStarted.promise;
    releaseFailure.resolve();
    await expect(accountUnavailable(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Current plan' })).toHaveCount(0);
  });

  test('does not let an explicit reconciliation inherit background preservation', async ({ page }) => {
    const backgroundStarted = deferred();
    const releaseFailure = deferred();
    let requests = 0;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) {
        return fulfillJson(route, 200, createBootstrap(60_000));
      }
      backgroundStarted.resolve();
      await releaseFailure.promise;
      return fulfillJson(route, 503, { error: { reasonKey: 'coreui.errors.service.unavailable' } });
    });
    await mockProfileSave(page);

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
    await backgroundStarted.promise;
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('button', { name: 'Saving...' })).toBeVisible();
    releaseFailure.resolve();
    await expect(accountUnavailable(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saving...' })).toHaveCount(0);
  });

  test('starts explicit reconciliation after an older background success', async ({ page }) => {
    const backgroundStarted = deferred();
    const releaseOldBootstrap = deferred();
    const freshBootstrapStarted = deferred();
    let requests = 0;
    let bootstrapPayload: BootstrapPayload | null = null;
    await page.route('**/api/bootstrap', async (route) => {
      requests += 1;
      if (requests === 1) {
        bootstrapPayload = createBootstrap(60_000);
        return fulfillJson(route, 200, bootstrapPayload);
      }
      if (requests === 2) {
        backgroundStarted.resolve();
        await releaseOldBootstrap.promise;
        return fulfillJson(route, 200, bootstrapPayload);
      }

      freshBootstrapStarted.resolve();
      const now = Date.now();
      return fulfillJson(route, 200, {
        ...bootstrapPayload,
        profile: {
          ...((bootstrapPayload?.profile as Record<string, unknown> | null) ?? {}),
          givenName: 'Reconciled',
        },
        authz: {
          ...bootstrapPayload?.authz,
          issuedAt: new Date(now - 1_000).toISOString(),
          expiresAt: new Date(now + 10 * 60_000).toISOString(),
        },
      });
    });
    await mockProfileSave(page);

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
    await backgroundStarted.promise;
    await page.getByRole('button', { name: 'Save settings' }).click();
    releaseOldBootstrap.resolve();
    await freshBootstrapStarted.promise;
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
    await expect(page.getByLabel('First name')).toHaveValue('Reconciled');
    expect(requests).toBe(3);
  });

  test('rejects malformed or internally inconsistent bootstrap authority', async ({ page }) => {
    const cases: Array<{ name: string; mutate: (payload: BootstrapPayload) => void }> = [
      { name: 'missing authz', mutate: (payload) => { payload.authz = null; } },
      { name: 'coerced account id', mutate: (payload) => { if (payload.authz) payload.authz.accountId = 12345678; } },
      { name: 'split account coordinates', mutate: (payload) => { if (payload.authz) payload.authz.accountId = 'ABCDEFGH'; } },
      { name: 'role mismatch', mutate: (payload) => { if (payload.activeAccount) payload.activeAccount.role = payload.authz?.role === 'owner' ? 'viewer' : 'owner'; } },
      { name: 'near expiry', mutate: (payload) => { if (payload.authz) payload.authz.expiresAt = new Date(Date.now() + 20_000).toISOString(); } },
      { name: 'future issued', mutate: (payload) => { if (payload.authz) payload.authz.issuedAt = new Date(Date.now() + 60_000).toISOString(); } },
    ];
    let currentCase = cases[0];
    await page.route('**/api/bootstrap', async (route) => {
      const payload = createBootstrap();
      currentCase.mutate(payload);
      await fulfillJson(route, 200, payload);
    });

    for (const [index, invalidCase] of cases.entries()) {
      currentCase = invalidCase;
      if (index === 0) await loadBilling(page);
      else await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(accountUnavailable(page), invalidCase.name).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Current plan' }), invalidCase.name).toHaveCount(0);
    }
  });
});
