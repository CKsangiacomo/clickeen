import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

const ACCOUNT_ROLE_LABELS = ['Viewer', 'Editor', 'Admin', 'Owner'];
const PLAN_LABEL = /^(Free|Tier [1-4])$/;
const RAW_ACCOUNT_LABEL = /^(free|tier[1-4]|viewer|editor|admin|owner)$/;

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

async function openSurface(page: Page, path: string, title: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Account: CLICKEEN', { exact: true })).toBeVisible();
}

async function guardAccountMutations(page: Page): Promise<string[]> {
  const mutations: string[] = [];
  await page.route('**/api/account/**', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
    mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    await route.abort('blockedbyclient');
  });
  return mutations;
}

function teamMemberPayload(memberId: string, role: string) {
  return {
    accountId: 'prd126a-account',
    role: 'owner',
    member: {
      userId: memberId,
      role,
      createdAt: '2026-07-22T00:00:00.000Z',
      profile: {
        userId: memberId,
        primaryEmail: `${memberId}@example.test`,
        givenName: 'PRD',
        familyName: '126A',
        primaryLanguage: 'en',
        country: 'US',
        timezone: 'UTC',
      },
    },
  };
}

test.describe('PRD 126A.3 Roma account labels', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCookies(), 'No Roma cloud-dev auth state found.');
  });

  test('uses readable plan and role labels across the real account surfaces', async ({ page }, testInfo) => {
    const mutations = await guardAccountMutations(page);

    await openSurface(page, '/ai', 'AI');
    await expect(page.getByRole('heading', { name: 'Current plan' }).locator('..').getByText(PLAN_LABEL)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI profile' }).locator('..').getByText(PLAN_LABEL)).toBeVisible();
    await capture(page, testInfo, 'ai');

    await openSurface(page, '/billing', 'Billing');
    await expect(page.getByRole('heading', { name: 'Current plan' }).locator('..').getByText(PLAN_LABEL)).toBeVisible();
    await capture(page, testInfo, 'billing');

    await openSurface(page, '/usage', 'Usage');
    await expect(page.getByRole('heading', { name: 'Current plan' }).locator('..').getByText(PLAN_LABEL)).toBeVisible();
    await capture(page, testInfo, 'usage');

    await openSurface(page, '/settings', 'Account');
    await expect(page.getByText(/Plan: (Free|Tier [1-4]) \| Your role: (Viewer|Editor|Admin|Owner)/)).toBeVisible();
    await expect(page.getByText(/Current plan: (Free|Tier [1-4])/)).toBeVisible();
    await capture(page, testInfo, 'settings');

    await page.route('**/api/account/team/invitations', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accountId: 'prd126a-account',
          role: 'owner',
          invitations: [
            {
              invitationId: 'prd126a-invitation',
              email: 'pending@example.test',
              role: 'editor',
              expiresAt: '2026-08-22T00:00:00.000Z',
            },
          ],
        }),
      });
    });
    await openSurface(page, '/team', 'Team');
    const inviteRole = page.getByLabel('Role');
    await expect(inviteRole.locator('option')).toHaveText(ACCOUNT_ROLE_LABELS.slice(0, 3));
    await expect(page.getByRole('row').filter({ hasText: 'pending@example.test' })).toContainText('Editor');
    await expect(page.getByText(RAW_ACCOUNT_LABEL, { exact: true })).toHaveCount(0);
    await capture(page, testInfo, 'team');

    const realMemberLink = page.locator('a[href^="/team/"]').first();
    await expect(realMemberLink).toBeVisible();
    const memberHref = await realMemberLink.getAttribute('href');
    expect(memberHref).toBeTruthy();
    await openSurface(page, memberHref!, 'Team');
    await expect(page.getByText(RAW_ACCOUNT_LABEL, { exact: true })).toHaveCount(0);
    await capture(page, testInfo, 'team-member');

    expect(mutations).toEqual([]);
  });

  test('keeps owner immutable and visibly selected without writing', async ({ page }) => {
    const memberId = '126a-owner-role';
    await page.route(`**/api/account/team/members/${memberId}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teamMemberPayload(memberId, 'owner')) });
    });
    const mutations = await guardAccountMutations(page);

    await openSurface(page, `/team/${memberId}`, 'Team');
    const roleSelect = page.getByLabel('Role');
    await expect(roleSelect).toBeDisabled();
    await expect(roleSelect.locator('option:checked')).toHaveText('Owner');
    await expect(roleSelect.locator('option:checked')).toHaveAttribute('disabled', '');
    await expect(page.getByRole('button', { name: 'Save role' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Remove member' })).toBeDisabled();
    await expect(page.getByText('owner', { exact: true })).toHaveCount(0);
    expect(mutations).toEqual([]);
  });

  test('preserves a malformed role until deliberate valid selection without writing', async ({ page }) => {
    const memberId = '126a-invalid-role';
    const malformedRole = 'superadmin';
    await page.route(`**/api/account/team/members/${memberId}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teamMemberPayload(memberId, malformedRole)) });
    });
    const mutations = await guardAccountMutations(page);

    await openSurface(page, `/team/${memberId}`, 'Team');
    const roleSelect = page.getByLabel('Role');
    const saveRole = page.getByRole('button', { name: 'Save role' });
    await expect(roleSelect).toBeEnabled();
    await expect(roleSelect.locator('option:checked')).toHaveText('Invalid role');
    await expect(roleSelect.locator('option:checked')).toHaveAttribute('disabled', '');
    await expect(page.getByRole('paragraph').filter({ hasText: /^Invalid role$/ })).toBeVisible();
    await expect(page.getByText(malformedRole, { exact: true })).toHaveCount(0);
    await expect(saveRole).toBeDisabled();

    await roleSelect.selectOption('viewer');
    await expect(roleSelect.locator('option:checked')).toHaveText('Viewer');
    await expect(saveRole).toBeEnabled();
    expect(mutations).toEqual([]);
  });
});
