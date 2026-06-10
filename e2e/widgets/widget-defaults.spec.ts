import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

type ErrorCollector = {
  consoleErrors: string[];
  pageErrors: string[];
};

function formatConsoleMessage(message: ConsoleMessage): string {
  const location = message.location();
  const source = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : '';
  return `${message.text()}${source}`;
}

function collectPageErrors(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    collector.consoleErrors.push(formatConsoleMessage(message));
  });

  page.on('pageerror', (error) => {
    collector.pageErrors.push(error.stack || error.message);
  });

  return collector;
}

function expectNoCollectedErrors(label: string, collector: ErrorCollector) {
  const errors = [
    ...collector.consoleErrors.map((error) => `console error: ${error}`),
    ...collector.pageErrors.map((error) => `page error: ${error}`),
  ];

  expect(errors, `${label} should not emit console/page errors`).toEqual([]);
}

test.describe('Widget Defaults', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCookies(), 'No e2e auth state found. Configure E2E_USER_EMAIL and E2E_AUTH_SECRET.');
  });

  test('loads editable account defaults without unmapped paths', async ({ page }) => {
    test.setTimeout(90_000);
    const collector = collectPageErrors(page);
    const defaultsResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/account/widget-defaults'),
    );

    await page.goto('/settings/widget-defaults', { waitUntil: 'domcontentloaded' });
    const response = await defaultsResponse;
    expect(response.ok(), `widget-defaults API returned ${response.status()}`).toBe(true);

    await expect(page.getByRole('heading', { name: 'Widget Defaults' })).toBeVisible();
    await expect(page.getByText('Widget Defaults Contract Error')).toHaveCount(0);
    await expect(page.getByText(/tokyo\.widgetDefaults\.unmappedPaths/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Global Shell Defaults' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Call to Action' })).toBeVisible();

    expectNoCollectedErrors('Widget Defaults', collector);
  });
});
