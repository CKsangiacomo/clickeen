import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator, type Page } from '@playwright/test';
import { build, type Plugin } from 'esbuild';

const romaRoot = fileURLToPath(new URL('..', import.meta.url));

type MutationCall = {
  method: string;
  path: string;
  body?: unknown;
};

type ConfirmationFixture = {
  mutationCalls: () => MutationCall[];
  settleNextFailure: () => void;
};

type BrowserWindow = typeof window & {
  __confirmationFixture: ConfirmationFixture;
};

async function testSharedConfirmationBehavior(): Promise<void> {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { RomaCommandConfirmationDialog } from './components/roma-command-confirmation-dialog';

        const calls = { cancel: 0, confirm: 0 };
        function Harness() {
          const [open, setOpen] = useState(false);
          return (
            <>
              <span data-confirmation-harness-ready hidden />
              <button data-open-confirmation type="button" onClick={() => setOpen(true)}>Open</button>
              <RomaCommandConfirmationDialog
                open={open}
                title="Archive this record?"
                body="This is the exact selected record."
                confirmLabel="Archive record"
                onCancel={() => {
                  calls.cancel += 1;
                  setOpen(false);
                }}
                onConfirm={() => {
                  calls.confirm += 1;
                  setOpen(false);
                }}
              />
            </>
          );
        }

        window.__romaConfirmationHarness = {
          counts: () => ({ ...calls }),
        };

        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      loader: 'tsx',
      resolveDir: romaRoot,
      sourcefile: 'roma-command-confirmation-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'confirmation behavior harness must bundle');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.setDefaultTimeout(5_000);
    await page.setContent('<main><div id="root"></div></main>');
    await page.addScriptTag({ content: script });
    await page.locator('[data-confirmation-harness-ready]').waitFor({ state: 'attached' });

    const counts = () => page.evaluate(() => (
      window as typeof window & {
        __romaConfirmationHarness: { counts: () => { cancel: number; confirm: number } };
      }
    ).__romaConfirmationHarness.counts());
    const open = () => page.locator('[data-open-confirmation]').click();

    assert.equal(await page.locator('dialog').count(), 0, 'closed confirmation must not mount');
    assert.deepEqual(await counts(), { cancel: 0, confirm: 0 });

    await open();
    const openedDialog = page.locator('dialog');
    await openedDialog.waitFor({ state: 'attached' });
    assert.equal(await openedDialog.count(), 1, `opening must mount the dialog: ${pageErrors.join('; ')}`);
    assert.equal(await openedDialog.evaluate((dialog) => (dialog as HTMLDialogElement).open), true);
    await page.getByRole('heading', { name: 'Archive this record?' }).waitFor();
    await page.getByText('This is the exact selected record.').waitFor();
    assert.deepEqual(await counts(), { cancel: 0, confirm: 0 }, 'opening must invoke no decision');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 1, confirm: 0 }, 'Cancel must invoke no command');

    await open();
    const backdropDialog = page.locator('dialog');
    await backdropDialog.waitFor({ state: 'attached' });
    await backdropDialog.evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      dialog.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: bounds.right + 10,
        clientY: bounds.bottom + 10,
      }));
    });
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 2, confirm: 0 }, 'backdrop must invoke no command');

    await open();
    const confirmButton = page.getByRole('button', { name: 'Archive record' });
    await confirmButton.waitFor();
    await confirmButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 2, confirm: 1 }, 'Confirm must invoke the command exactly once');
    assert.deepEqual(pageErrors, [], 'confirmation behavior must not raise browser errors');
  } finally {
    await browser.close();
  }
}

function fixturePlugin(modules: Record<string, string>): Plugin {
  return {
    name: 'roma-confirmation-production-fixtures',
    setup(bundle) {
      bundle.onResolve({ filter: /.*/ }, (args) => (
        Object.prototype.hasOwnProperty.call(modules, args.path)
          ? { path: args.path, namespace: 'confirmation-fixture' }
          : null
      ));
      bundle.onLoad({ filter: /.*/, namespace: 'confirmation-fixture' }, (args) => ({
        contents: modules[args.path],
        loader: 'tsx',
        resolveDir: romaRoot,
      }));
    },
  };
}

async function buildFiveConsumerHarness(): Promise<string> {
  const modules: Record<string, string> = {
    'next/image': `
      import React from 'react';
      export default function Image({ priority, ...props }) {
        return <img {...props} />;
      }
    `,
    'next/link': `
      import React from 'react';
      export default function Link({ href, ...props }) {
        return <a href={typeof href === 'string' ? href : '#'} {...props} />;
      }
    `,
    'next/navigation': `
      const router = { push() {}, replace() {}, refresh() {}, back() {} };
      const searchParams = { get() { return null; } };
      export function useRouter() { return router; }
      export function useSearchParams() { return searchParams; }
      export function usePathname() { return '/widgets'; }
    `,
    './account-api': `
      const mutationCalls = [];
      const pendingFailures = [];

      function jsonResponse(payload, status = 200) {
        return new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      }

      function record(path, init) {
        const method = String(init?.method || 'GET').toUpperCase();
        if (method !== 'GET') {
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
          mutationCalls.push({ method, path, ...(typeof body === 'undefined' ? {} : { body }) });
        }
        return method;
      }

      function pendingResponseFailure() {
        return new Promise((resolve) => {
          pendingFailures.push(() => resolve(jsonResponse({
            error: { reasonKey: 'coreui.errors.db.writeFailed' },
          }, 500)));
        });
      }

      function pendingThrownFailure() {
        return new Promise((_resolve, reject) => {
          pendingFailures.push(() => reject(new Error('coreui.errors.db.writeFailed')));
        });
      }

      const api = {
        buildHeaders() { return {}; },
        async fetchJson(path, init) {
          const method = record(path, init);
          if (method === 'DELETE') return pendingThrownFailure();
          throw new Error('unexpected fetchJson: ' + method + ' ' + path);
        },
        async fetchRaw(path, init) {
          const method = record(path, init);
          if (method !== 'GET') return pendingResponseFailure();
          if (path === '/api/account/assets') {
            return jsonResponse({
              accountId: 'acct-test',
              storageBytesUsed: 128,
              assets: [{
                assetRef: 'asset-1',
                assetType: 'image',
                filename: 'hero.png',
                contentType: 'image/png',
                sizeBytes: 128,
                createdAt: '2026-08-20T12:00:00.000Z',
              }],
            });
          }
          if (path === '/api/account/team/members/member-2') {
            return jsonResponse({
              accountId: 'acct-test',
              role: 'owner',
              member: {
                userId: 'member-2',
                role: 'editor',
                createdAt: '2026-08-20T12:00:00.000Z',
                profile: {
                  userId: 'member-2',
                  primaryEmail: 'ada@example.test',
                  givenName: 'Ada',
                  familyName: 'Lovelace',
                  primaryLanguage: 'en',
                  usePrimaryLanguageForUi: true,
                  country: 'GB',
                  timezone: 'Europe/London',
                },
              },
            });
          }
          if (path === '/api/account/team') {
            return jsonResponse({
              members: [
                {
                  userId: 'owner-1',
                  role: 'owner',
                  profile: {
                    givenName: 'Current',
                    familyName: 'Owner',
                    primaryEmail: 'owner@example.test',
                  },
                },
                {
                  userId: 'member-2',
                  role: 'admin',
                  profile: {
                    givenName: 'Ada',
                    familyName: 'Lovelace',
                    primaryEmail: 'ada@example.test',
                  },
                },
              ],
            });
          }
          throw new Error('unexpected fetchRaw: ' + method + ' ' + path);
        },
      };

      window.__confirmationFixture = {
        mutationCalls: () => mutationCalls.map((call) => ({ ...call })),
        settleNextFailure() {
          const settle = pendingFailures.shift();
          if (!settle) throw new Error('no pending command failure');
          settle();
        },
      };

      export function useRomaAccountApi() { return api; }
    `,
    './roma-account-context': `
      const value = {
        activeAccount: {
          accountId: 'account-internal-1',
          accountPublicId: 'acct-test',
          accountLabel: 'Test account',
          role: 'owner',
          tier: 'tier1',
          websiteUrl: 'https://example.test',
          activeLocales: ['en'],
        },
        accountContext: {
          accountId: 'account-internal-1',
          accountPublicId: 'acct-test',
          accountLabel: 'Test account',
        },
        accountPolicy: {
          role: 'owner',
          profile: 'tier1',
          limits: { 'l10n.locales.max': 2 },
        },
        data: {
          user: { id: 'owner-1' },
          authz: {
            entitlements: {
              limits: {
                'storage.bytes.max': 2048,
                'uploads.size.max': 1024,
              },
            },
          },
        },
        async reload() {},
      };
      export function useRomaAccountContext() { return value; }
    `,
    './use-roma-widgets': `
      const instance = {
        instanceId: 'instance-1',
        widgetType: 'faq',
        displayName: 'Support FAQ',
        status: 'published',
        publishedAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
      };
      const data = {
        instances: [instance],
        catalog: [{
          widgetType: 'faq',
          displayName: 'FAQ',
          description: 'Answers to common questions.',
        }],
      };
      export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
      export function readRomaWidgetsCache() { return { data, loadedAt: Date.now() }; }
      export function isRomaWidgetsCacheFresh() { return true; }
      export async function loadRomaWidgetsForAccount() { return data; }
      export function updateRomaWidgetsCache() {}
      export function upsertRomaWidgetInstanceCache() {}
      export function invalidateRomaWidgetsCache() {}
      export function buildBuilderRoute({ instanceId }) { return '/builder/' + instanceId; }
      export function buildNewBuilderRoute({ widgetType }) { return '/builder/new/' + widgetType; }
    `,
    './dieter-dropdown-actions': `
      import React from 'react';
      export function DieterDropdownActions({
        ariaLabel,
        label,
        value,
        onChange,
        options,
        disabled,
        className,
      }) {
        return (
          <label className={className}>
            {label ? <span>{label}</span> : null}
            <select
              aria-label={ariaLabel || label}
              value={value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
      }
    `,
    './dieter-textfield': `
      import React from 'react';
      export function DieterTextfield(props) {
        return <input aria-label={props.label} value={props.value} onChange={props.onChange} />;
      }
    `,
    './widget-editor-artifact': `
      export async function prefetchWidgetEditorArtifact() {}
    `,
    './roma-account-notice-modal': `
      export function RomaAccountNoticeModal() { return null; }
    `,
    './roma-domain-error-boundary': `
      export function RomaDomainErrorBoundary({ children }) { return children; }
    `,
    './roma-shell': `
      export function RomaShell({ children }) { return children; }
    `,
    './account-locale-settings-card': `
      export function AccountLocaleSettingsCard() { return null; }
    `,
    '../lib/public-widget-actions': `
      export function buildWidgetPublicActions({ accountPublicId, instanceId }) {
        return {
          publicUrl: 'https://clk.test/' + accountPublicId + '/' + instanceId,
          embedCode: '<iframe></iframe>',
        };
      }
    `,
  };

  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { WidgetsDomain } from './components/widgets-domain';
        import { AssetsDomain } from './components/assets-domain';
        import { WidgetPublicationState } from './components/widget-publication-controls';
        import { TeamMemberDomain } from './components/team-member-domain';
        import { SettingsDomain } from './components/settings-domain';

        const publicationInstance = {
          instanceId: 'instance-publication',
          widgetType: 'faq',
          displayName: 'Publication FAQ',
          status: 'published',
          publishedAt: '2026-08-20T12:00:00.000Z',
          updatedAt: '2026-08-20T12:00:00.000Z',
        };

        function Harness() {
          return (
            <>
              <span data-five-consumers-ready hidden />
              <section data-surface="widget-delete">
                <WidgetsDomain view="your-widgets" statusFilter="all" />
              </section>
              <section data-surface="asset-delete">
                <AssetsDomain assetFilter="all" />
              </section>
              <section data-surface="unpublish">
                <WidgetPublicationState
                  instance={publicationInstance}
                  onInstanceChange={() => {}}
                />
              </section>
              <section data-surface="member-remove">
                <TeamMemberDomain memberId="member-2" />
              </section>
              <section data-surface="owner-transfer">
                <SettingsDomain />
              </section>
            </>
          );
        }

        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      loader: 'tsx',
      resolveDir: romaRoot,
      sourcefile: 'roma-five-confirmation-consumers-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    plugins: [fixturePlugin(modules)],
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'five-consumer production harness must bundle');
  return script;
}

async function mutationCalls(page: Page): Promise<MutationCall[]> {
  return page.evaluate(() => (window as BrowserWindow).__confirmationFixture.mutationCalls());
}

async function settleNextFailure(page: Page): Promise<void> {
  await page.evaluate(() => (window as BrowserWindow).__confirmationFixture.settleNextFailure());
}

async function dismissByBackdrop(page: Page, title: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: bounds.right + 10,
      clientY: bounds.bottom + 10,
    }));
  });
  await dialog.waitFor({ state: 'detached' });
}

async function assertConfirmation(args: {
  page: Page;
  surface: Locator;
  open: () => Promise<void>;
  title: string;
  body: string;
  confirmLabel: string;
  expectedCall: MutationCall;
  failureText: string;
}): Promise<void> {
  const { page } = args;
  const before = await mutationCalls(page);

  await args.open();
  const dialog = page.getByRole('dialog', { name: args.title });
  await dialog.waitFor();
  await page.getByText(args.body, { exact: true }).waitFor();
  assert.deepEqual(await mutationCalls(page), before, `${args.title}: opening must invoke no command`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(await mutationCalls(page), before, `${args.title}: Cancel must invoke no command`);

  await args.open();
  await page.getByRole('dialog', { name: args.title }).waitFor();
  await dismissByBackdrop(page, args.title);
  assert.deepEqual(await mutationCalls(page), before, `${args.title}: backdrop must invoke no command`);

  await args.open();
  const confirmedDialog = page.getByRole('dialog', { name: args.title });
  const confirm = confirmedDialog.getByRole('button', { name: args.confirmLabel });
  await confirm.waitFor();
  await confirm.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  const afterConfirm = await mutationCalls(page);
  assert.equal(afterConfirm.length, before.length + 1, `${args.title}: Confirm must invoke one command`);
  assert.deepEqual(afterConfirm.at(-1), args.expectedCall, `${args.title}: command boundary must stay exact`);
  await confirmedDialog.waitFor();
  assert.equal(await confirm.getAttribute('aria-busy'), 'true', `${args.title}: exact Confirm control must own pending`);
  assert.equal(await confirm.locator('.diet-spinner').count(), 1, `${args.title}: exact Confirm control must show one Spinner`);
  assert.equal(await confirmedDialog.getByRole('button', { name: 'Cancel' }).isDisabled(), true, `${args.title}: pending confirmation cannot dismiss`);

  await settleNextFailure(page);
  await confirmedDialog.getByText(args.failureText, { exact: true }).waitFor();
  assert.equal(await confirm.getAttribute('aria-busy'), null, `${args.title}: failure must clear pending from Confirm`);
  assert.equal(await confirm.locator('.diet-spinner').count(), 0, `${args.title}: failure must clear the Confirm Spinner`);
  assert.equal(await confirm.isEnabled(), true, `${args.title}: failure must leave Confirm available for retry`);
  assert.equal((await mutationCalls(page)).length, before.length + 1, `${args.title}: failure must not retry the command`);
  await confirmedDialog.getByRole('button', { name: 'Cancel' }).click();
  await confirmedDialog.waitFor({ state: 'detached' });
}

async function testFiveProductionConsumers(): Promise<void> {
  const script = await buildFiveConsumerHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    page.setDefaultTimeout(5_000);
    await page.setContent('<style>.roma-widget-actions-popover{position:fixed}</style><main><div id="root"></div></main>');
    await page.addScriptTag({ content: script });
    await page.locator('[data-five-consumers-ready]').waitFor({ state: 'attached' }).catch((error) => {
      throw new Error(`${String(error)}\nBrowser errors: ${pageErrors.join('; ')}`);
    });
    await page.getByText('hero.png', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Ada Lovelace' }).waitFor();

    const widgetSurface = page.locator('[data-surface="widget-delete"]');
    await assertConfirmation({
      page,
      surface: widgetSurface,
      open: async () => {
        await page.getByRole('button', { name: 'More actions for Support FAQ' }).click();
        await page.locator('#roma-widget-actions-menu[data-positioned="true"]').waitFor();
        const deleteAction = page.getByRole('menuitem', { name: 'Delete' });
        await deleteAction.waitFor({ state: 'attached' });
        await deleteAction.evaluate((button) => {
          (button as HTMLButtonElement).click();
        });
      },
      title: 'Delete this widget?',
      body: 'Deleting “Support FAQ” removes its saved source and makes any published version unavailable. This cannot be undone.',
      confirmLabel: 'Delete widget',
      expectedCall: { method: 'DELETE', path: '/api/account/instances/instance-1' },
      failureText: 'Saving failed. Please try again.',
    });

    const rowPublicationSurface = widgetSurface.locator('.roma-widget-publication').first();
    await assertConfirmation({
      page,
      surface: rowPublicationSurface,
      open: () => rowPublicationSurface.getByRole('switch', { name: 'Published: Support FAQ' }).click(),
      title: 'Take this widget offline?',
      body: '“Support FAQ” will be taken offline. Its saved source remains, and it can be published again.',
      confirmLabel: 'Unpublish',
      expectedCall: { method: 'POST', path: '/api/account/instances/instance-1/unpublish' },
      failureText: 'Saving failed. Please try again.',
    });

    const assetSurface = page.locator('[data-surface="asset-delete"]');
    await assertConfirmation({
      page,
      surface: assetSurface,
      open: () => assetSurface.getByRole('button', { name: 'Delete' }).click(),
      title: 'Delete this asset?',
      body: 'Deleting “hero.png” removes the asset. Widgets that use it may stop displaying it. This cannot be undone.',
      confirmLabel: 'Delete asset',
      expectedCall: { method: 'DELETE', path: '/api/account/assets/asset-1' },
      failureText: 'Asset delete failed on the server. Please try again.',
    });

    const publicationSurface = page.locator('[data-surface="unpublish"]');
    await assertConfirmation({
      page,
      surface: publicationSurface,
      open: () => publicationSurface.getByRole('switch', { name: 'Published: Publication FAQ' }).click(),
      title: 'Take this widget offline?',
      body: '“Publication FAQ” will be taken offline. Its saved source remains, and it can be published again.',
      confirmLabel: 'Unpublish',
      expectedCall: { method: 'POST', path: '/api/account/instances/instance-publication/unpublish' },
      failureText: 'Saving failed. Please try again.',
    });

    const memberSurface = page.locator('[data-surface="member-remove"]');
    await assertConfirmation({
      page,
      surface: memberSurface,
      open: () => memberSurface.getByRole('button', { name: 'Remove member' }).click(),
      title: 'Remove this team member?',
      body: '“Ada Lovelace” will lose access to this account.',
      confirmLabel: 'Remove member',
      expectedCall: { method: 'DELETE', path: '/api/account/team/members/member-2' },
      failureText: 'Saving the membership failed. Please try again.',
    });

    const settingsSurface = page.locator('[data-surface="owner-transfer"]');
    await settingsSurface.getByRole('combobox', { name: 'Select next owner' }).selectOption('member-2');
    await assertConfirmation({
      page,
      surface: settingsSurface,
      open: () => settingsSurface.getByRole('button', { name: 'Transfer ownership' }).click(),
      title: 'Transfer account ownership?',
      body: '“Ada Lovelace” will become Owner of this account, and you will become Admin.',
      confirmLabel: 'Transfer ownership',
      expectedCall: {
        method: 'POST',
        path: '/api/account/owner-transfer',
        body: { nextOwnerUserId: 'member-2' },
      },
      failureText: 'Saving account settings failed. Please try again.',
    });

    assert.deepEqual(pageErrors, [], 'five real command consumers must not raise browser errors');
  } finally {
    await browser.close();
  }
}

async function run(): Promise<void> {
  await testSharedConfirmationBehavior();
  console.log('PASS shared Roma confirmation mounts only when open and resolves one click decision');
  await testFiveProductionConsumers();
  console.log('PASS five Roma commands and both Unpublish owners execute exact confirmation, pending, and visible-failure behavior in a browser');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
