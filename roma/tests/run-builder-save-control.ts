import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, type FrameLocator, type Page } from '@playwright/test';
import { build, type Plugin } from 'esbuild';
import {
  createHostSaveRequestMessage,
  readBobSaveControlPhase,
} from '../lib/builder-host-protocol';

const romaRoot = fileURLToPath(new URL('..', import.meta.url));
const bobRoot = fileURLToPath(new URL('../../bob/', import.meta.url));

type SaveCall = {
  method: string;
  path: string;
  body: Record<string, unknown>;
};

type RomaSaveFixture = {
  copilotAborts: () => number;
  copilotStarts: () => number;
  dispatchStaleIframePhase: () => void;
  dispatchWrongOriginPhase: () => void;
  dispatchWrongSourcePhase: () => void;
  openCalls: () => number;
  resolveBuilderOpen: () => void;
  resolveNextSave: () => void;
  saveCalls: () => SaveCall[];
};

type RomaHarnessWindow = typeof window & {
  __romaSaveFixture: RomaSaveFixture;
};

function testBobPhaseAdmission(): void {
  const iframeWindow = {} as Window;
  const otherWindow = {} as Window;
  const base = {
    data: { type: 'bob:save-control-state', phase: 'save' },
    eventOrigin: 'https://bob.dev.clickeen.com',
    bobOrigin: 'https://bob.dev.clickeen.com',
    eventSource: iframeWindow,
    iframeWindow,
  };
  assert.equal(readBobSaveControlPhase(base), 'save');
  for (const phase of ['hidden', 'save', 'saving', 'saved'] as const) {
    assert.equal(readBobSaveControlPhase({ ...base, data: { ...base.data, phase } }), phase);
  }
  assert.equal(readBobSaveControlPhase({ ...base, eventOrigin: 'https://example.com' }), null);
  assert.equal(readBobSaveControlPhase({ ...base, eventSource: otherWindow }), null);
  assert.equal(readBobSaveControlPhase({ ...base, data: { ...base.data, phase: 'done' } }), null);
  assert.equal(
    readBobSaveControlPhase({ ...base, data: { type: 'bob:dirty-state-changed' } }),
    null,
  );
  assert.deepEqual(createHostSaveRequestMessage(), { type: 'host:save-request' });
}

function fixturePlugin(name: string, modules: Record<string, string>): Plugin {
  return {
    name,
    setup(bundle) {
      bundle.onResolve({ filter: /.*/ }, (args) =>
        Object.prototype.hasOwnProperty.call(modules, args.path)
          ? { path: args.path, namespace: name }
          : null,
      );
      bundle.onLoad({ filter: /.*/, namespace: name }, (args) => ({
        contents: modules[args.path],
        loader: 'tsx',
        resolveDir: romaRoot,
      }));
    },
  };
}

async function buildBobHarness(): Promise<string> {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useEffect, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import {
          WidgetDocumentSessionProvider,
          useWidgetSession,
          useWidgetSessionTransport,
        } from './lib/session/WidgetDocumentSession';
        import {
          WidgetSessionChromeProvider,
          useWidgetSessionChrome,
        } from './lib/session/WidgetSessionChrome';

        function SessionProbe() {
          const session = useWidgetSession();
          const transport = useWidgetSessionTransport();
          const chrome = useWidgetSessionChrome();
          const [activeCopilotRequestId, setActiveCopilotRequestId] = useState('');
          const [cancelResultCount, setCancelResultCount] = useState(0);
          const error = session.error ? JSON.stringify(session.error) : '';

          useEffect(() => {
            const onMessage = (event) => {
              const message = event.data;
              if (
                event.origin === new URL(document.referrer).origin
                && event.source === window.parent
                && message?.type === 'host:account-command-result'
                && message.command === 'cancel-copilot'
              ) {
                setCancelResultCount((count) => count + 1);
              }
            };
            window.addEventListener('message', onMessage);
            return () => window.removeEventListener('message', onMessage);
          }, []);

          return (
            <>
              <output
                data-bob-session-probe
                data-instance-data={JSON.stringify(session.instanceData)}
                data-dirty={String(session.isDirty)}
                data-saving={String(session.isSaving)}
                data-error={error}
                data-active-copilot-request-id={activeCopilotRequestId}
                data-cancel-result-count={String(cancelResultCount)}
                data-base-locale={chrome.meta?.baseLocale ?? ''}
                data-translation-base-locale={chrome.meta?.translationSetup?.baseLocale ?? ''}
              />
              <button
                data-edit-newer-draft
                type="button"
                onClick={() => session.applyOps([{ op: 'set', path: 'title', value: 'After first Save began' }])}
              >
                Edit while saving
              </button>
              <button
                data-edit-after-save
                type="button"
                onClick={() => session.applyOps([{ op: 'set', path: 'title', value: 'After Save completed' }])}
              >
                Edit after saving
              </button>
              <button
                data-spoof-wrong-host-origin
                type="button"
                onClick={() => window.dispatchEvent(new MessageEvent('message', {
                  data: { type: 'host:save-request' },
                  origin: 'https://attacker.example',
                  source: window.parent,
                }))}
              >
                Spoof wrong host origin
              </button>
              <button
                data-spoof-wrong-host-source
                type="button"
                onClick={() => window.dispatchEvent(new MessageEvent('message', {
                  data: { type: 'host:save-request' },
                  origin: new URL(document.referrer).origin,
                  source: window,
                }))}
              >
                Spoof wrong host source
              </button>
              <button
                data-start-copilot-request
                type="button"
                onClick={() => {
                  const handle = transport.runCopilot({
                    instanceId: 'created-instance-1',
                    body: { kind: 'cancellation-proof' },
                  });
                  setActiveCopilotRequestId(handle.requestId);
                  void handle.completed.catch(() => {});
                }}
              >
                Start Copilot request
              </button>
              <button
                data-cancel-copilot-request
                type="button"
                onClick={() => {
                  if (activeCopilotRequestId) transport.cancelCopilot(activeCopilotRequestId);
                }}
              >
                Cancel Copilot request
              </button>
            </>
          );
        }

        function Harness() {
          return (
            <WidgetSessionChromeProvider>
              <WidgetDocumentSessionProvider>
                <SessionProbe />
              </WidgetDocumentSessionProvider>
            </WidgetSessionChromeProvider>
          );
        }

        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      loader: 'tsx',
      resolveDir: bobRoot,
      sourcefile: 'bob-save-bridge-production-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'Bob production Save harness must bundle');
  return script;
}

async function buildRomaHarness(bobOrigin: string): Promise<string> {
  const modules: Record<string, string> = {
    'next/image': `
      import React from 'react';
      export default function Image({ priority, ...props }) { return <img {...props} />; }
    `,
    'next/link': `
      import React from 'react';
      export default function Link({ href, ...props }) {
        return <a href={typeof href === 'string' ? href : '#'} {...props} />;
      }
    `,
    'next/navigation': `
      const router = { push() {}, replace() {}, refresh() {}, back() {} };
      export function usePathname() { return '/builder/new/behavior-test'; }
      export function useRouter() { return router; }
    `,
    '../lib/env/bob': `
      export function resolveBobBaseUrl() { return ${JSON.stringify(bobOrigin)}; }
    `,
    './widget-editor-artifact': `
      const compiled = {
        widgetname: 'behavior-test',
        displayName: 'Behavior test',
        defaults: { title: 'Before' },
        toolDrawerLabels: {},
        panels: [{ id: 'content', label: 'Content', html: '<div></div>' }],
        controls: [{
          panelId: 'content',
          type: 'text',
          path: 'title',
          label: 'Title',
          kind: 'string',
        }],
        limits: { limits: [] },
        upsell: { widgetType: 'behavior-test', locale: 'en', messages: {} },
        editableFields: { version: 1, fields: [] },
        widgetSoftware: {},
      };
      export async function getWidgetEditorArtifact() { return compiled; }
    `,
    './roma-account-context': `
      const value = {
        activeAccount: {
          accountId: 'account-internal-1',
          accountPublicId: 'ACCOUNT',
          accountLabel: 'Save bridge account',
          activeLocales: ['en'],
          role: 'owner',
          tier: 'free',
        },
        accountContext: {
          accountId: 'account-internal-1',
          accountPublicId: 'ACCOUNT',
          accountLabel: 'Save bridge account',
        },
        accountPolicy: {
          profile: 'free',
          role: 'owner',
          flags: {},
          limits: { 'l10n.locales.max': null },
        },
      };
      export function useRomaAccountContext() { return value; }
    `,
    './account-api': `
      const saveCalls = [];
      const pendingSaves = [];
      let builderOpenCalls = 0;
      let resolveBuilderOpenRequest;
      let copilotAbortCount = 0;
      let copilotStartCount = 0;
      let resolvedSaveCount = 0;
      const builderOpenRequest = new Promise((resolve) => {
        resolveBuilderOpenRequest = resolve;
      });
      const builderOpenResult = {
        displayName: 'Untitled behavior test',
        widgetType: 'behavior-test',
        baseLocale: 'en',
        config: { title: 'Before' },
        fontLibrary: { version: 1, fonts: {} },
        copilot: null,
        instanceId: null,
        publishStatus: null,
        publishedAt: null,
        sourceUpdatedAt: null,
      };

      function jsonResponse(payload, status) {
        return new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      }

      const api = {
        buildHeaders() { return {}; },
        async fetchJson(path) {
          if (path !== '/api/builder/new/behavior-test/open') {
            throw new Error('unexpected Builder open: ' + path);
          }
          builderOpenCalls += 1;
          return builderOpenRequest;
        },
        async fetchRaw(path, init) {
          if (path === '/api/account/instances/created-instance-1/copilot') {
            copilotStartCount += 1;
            let streamController;
            const stream = new ReadableStream({
              start(controller) {
                streamController = controller;
              },
            });
            init?.signal?.addEventListener('abort', () => {
              copilotAbortCount += 1;
              streamController.error(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
            return new Response(stream, {
              status: 200,
              headers: { 'content-type': 'text/event-stream' },
            });
          }
          const method = String(init?.method || 'GET').toUpperCase();
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
          saveCalls.push({ method, path, body });
          return new Promise((resolve) => pendingSaves.push(resolve));
        },
      };

      function dispatchPhase(origin, source) {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'bob:save-control-state', phase: 'hidden' },
          origin,
          source,
        }));
      }

      window.__romaSaveFixture = {
        copilotAborts: () => copilotAbortCount,
        copilotStarts: () => copilotStartCount,
        openCalls: () => builderOpenCalls,
        saveCalls: () => structuredClone(saveCalls),
        resolveBuilderOpen() {
          const resolve = resolveBuilderOpenRequest;
          if (!resolve) throw new Error('no pending Builder open response');
          resolveBuilderOpenRequest = null;
          resolve(builderOpenResult);
        },
        resolveNextSave() {
          const resolve = pendingSaves.shift();
          if (!resolve) throw new Error('no pending Save response');
          const firstSave = resolvedSaveCount === 0;
          resolvedSaveCount += 1;
          resolve(firstSave
            ? jsonResponse({
                instanceId: 'created-instance-1',
                widgetType: 'behavior-test',
                displayName: 'Saved behavior test',
                status: 'unpublished',
                publishedAt: null,
                updatedAt: '2026-08-20T12:00:00.001Z',
                baseLocale: 'fr',
              }, 201)
            : jsonResponse({
                instanceId: 'created-instance-1',
                updatedAt: '2026-08-20T12:00:00.002Z',
              }, 200));
        },
        dispatchWrongOriginPhase() {
          const frame = document.querySelector('iframe[title="Bob Builder"]');
          dispatchPhase('https://attacker.example', frame?.contentWindow ?? null);
        },
        dispatchWrongSourcePhase() {
          dispatchPhase(${JSON.stringify(bobOrigin)}, window);
        },
        dispatchStaleIframePhase() {
          const staleFrame = document.createElement('iframe');
          staleFrame.src = 'about:blank';
          document.body.append(staleFrame);
          const staleWindow = staleFrame.contentWindow;
          staleFrame.remove();
          if (!staleWindow) throw new Error('stale iframe window unavailable');
          dispatchPhase(${JSON.stringify(bobOrigin)}, staleWindow);
        },
      };

      export function useRomaAccountApi() { return api; }
    `,
    './roma-shell': `
      const actions = { openNavigation() {} };
      export function useRomaShellActions() { return actions; }
    `,
    './widget-publication-controls': `
      export function WidgetPublicationState() { return <span data-publication-state>Unpublished</span>; }
      export function WidgetPublicationControls() { return <span data-publication-controls />; }
    `,
    './use-roma-widgets': `
      export function upsertRomaWidgetInstanceCache() {}
    `,
    './roma-unsaved-changes-dialog': `
      export function RomaUnsavedChangesDialog() { return null; }
    `,
    './roma-upsell-dialog': `
      export function resolveTargetPlan() { return null; }
      export function RomaUpsellDialog() { return null; }
    `,
  };

  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { BuilderDomain } from './components/builder-domain';

        createRoot(document.getElementById('root')).render(
          <BuilderDomain initialWidgetType="behavior-test" />,
        );
      `,
      loader: 'tsx',
      resolveDir: romaRoot,
      sourcefile: 'roma-save-bridge-production-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    plugins: [fixturePlugin('roma-save-bridge-fixtures', modules)],
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'Roma production Save harness must bundle');
  return script;
}

async function startHarnessServer(script: string): Promise<{
  close: () => Promise<void>;
  origin: string;
}> {
  const server = createServer((request, response) => {
    if (request.url === '/bundle.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(script);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(
      '<!doctype html><html><body><main id="root"></main><script src="/bundle.js"></script></body></html>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function waitForSaveCallCount(page: Page, count: number): Promise<SaveCall[]> {
  await page.waitForFunction(
    (expected) => (window as RomaHarnessWindow).__romaSaveFixture.saveCalls().length === expected,
    count,
  );
  return page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.saveCalls());
}

async function resolveNextSave(page: Page): Promise<void> {
  await page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.resolveNextSave());
}

async function assertBorrowedSaveVisible(page: Page): Promise<void> {
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await save.waitFor();
  assert.equal(await save.isEnabled(), true);
  assert.equal(await save.getAttribute('data-tone'), 'save');
  assert.equal(await page.getByRole('button', { name: 'Saving…' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Saved' }).count(), 0);
}

async function bobProbeAttribute(frame: FrameLocator, attribute: string): Promise<string | null> {
  return frame.locator('[data-bob-session-probe]').getAttribute(attribute);
}

async function testProductionRomaBobSaveBridge(): Promise<void> {
  const bobScript = await buildBobHarness();
  const bobServer = await startHarnessServer(bobScript);
  let romaServer: Awaited<ReturnType<typeof startHarnessServer>> | null = null;
  try {
    const romaScript = await buildRomaHarness(bobServer.origin);
    romaServer = await startHarnessServer(romaScript);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.setDefaultTimeout(8_000);
      await page.goto(`${romaServer.origin}/`);

      const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
      await bobFrame.locator('[data-bob-session-probe]').waitFor({ state: 'attached' });
      await page.waitForFunction(
        () => (window as RomaHarnessWindow).__romaSaveFixture.openCalls() === 1,
      );
      const builderHeader = page.locator('.page__header');
      const headerLoading = builderHeader.getByRole('status', { name: 'Loading' });
      await headerLoading.waitFor({ state: 'attached' });
      assert.equal(await builderHeader.locator('h1').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 0);
      await page.evaluate(() =>
        (window as RomaHarnessWindow).__romaSaveFixture.resolveBuilderOpen(),
      );
      await assertBorrowedSaveVisible(page);
      assert.equal(await headerLoading.count(), 0);
      assert.equal(await bobProbeAttribute(bobFrame, 'data-instance-data'), '{"title":"Before"}');
      assert.equal(await bobProbeAttribute(bobFrame, 'data-dirty'), 'true');
      assert.equal(await bobProbeAttribute(bobFrame, 'data-base-locale'), 'en');
      assert.equal(await bobProbeAttribute(bobFrame, 'data-translation-base-locale'), 'en');
      assert.equal(
        await page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.openCalls()),
        1,
        'the New target must open in Bob once',
      );

      for (const dispatch of [
        'dispatchWrongOriginPhase',
        'dispatchWrongSourcePhase',
        'dispatchStaleIframePhase',
      ] as const) {
        await page.evaluate((method) => {
          (window as RomaHarnessWindow).__romaSaveFixture[method]();
        }, dispatch);
        await assertBorrowedSaveVisible(page);
      }

      for (const selector of ['[data-spoof-wrong-host-origin]', '[data-spoof-wrong-host-source]']) {
        await bobFrame.locator(selector).click();
        await page.waitForTimeout(50);
        assert.equal(
          (await waitForSaveCallCount(page, 0)).length,
          0,
          'Bob must reject host Save unless both the parent source and exact Roma origin match',
        );
      }

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const firstSaving = page.getByRole('button', { name: 'Saving…' });
      await firstSaving.waitFor();
      assert.equal(await firstSaving.getAttribute('data-tone'), 'save');
      assert.equal(await firstSaving.getAttribute('aria-busy'), 'true');
      const firstSaveCalls = await waitForSaveCallCount(page, 1);
      assert.deepEqual(firstSaveCalls[0], {
        method: 'POST',
        path: '/api/account/instances',
        body: {
          config: { title: 'Before' },
          widgetType: 'behavior-test',
        },
      });
      assert.equal(await bobProbeAttribute(bobFrame, 'data-saving'), 'true');

      await bobFrame.locator('[data-edit-newer-draft]').click();
      assert.equal(
        await bobProbeAttribute(bobFrame, 'data-instance-data'),
        '{"title":"After first Save began"}',
      );
      await page.getByRole('button', { name: 'Saving…' }).waitFor();

      const activeBobFrame = page.locator('iframe[title="Bob Builder"]');
      await activeBobFrame.evaluate((iframe, targetOrigin) => {
        const target = (iframe as HTMLIFrameElement).contentWindow;
        target?.postMessage({ type: 'host:save-request' }, targetOrigin as string);
        target?.postMessage({ type: 'host:save-request' }, targetOrigin as string);
      }, bobServer.origin);
      await page.waitForTimeout(50);
      assert.equal(
        (await waitForSaveCallCount(page, 1)).length,
        1,
        'Bob must absorb duplicate host Save requests while saving',
      );

      await resolveNextSave(page);
      await assertBorrowedSaveVisible(page);
      assert.equal(
        await page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.openCalls()),
        1,
        'first Save must adopt the created ID without reopening Bob',
      );
      assert.equal(
        await bobProbeAttribute(bobFrame, 'data-dirty'),
        'true',
        'newer draft truth must survive first Save',
      );
      assert.equal(
        await bobProbeAttribute(bobFrame, 'data-base-locale'),
        'fr',
        'first Save must adopt the exact persisted base locale',
      );
      assert.equal(
        await bobProbeAttribute(bobFrame, 'data-translation-base-locale'),
        'fr',
        'first Save must adopt the exact persisted translation base locale',
      );

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: 'Saving…' }).waitFor();
      const secondSaveCalls = await waitForSaveCallCount(page, 2);
      assert.deepEqual(secondSaveCalls[1], {
        method: 'PUT',
        path: '/api/account/instances/created-instance-1',
        body: {
          config: { title: 'After first Save began' },
        },
      });

      await resolveNextSave(page);
      const saved = page.getByRole('button', { name: 'Saved' });
      await saved.waitFor();
      assert.equal(await saved.getAttribute('data-state'), 'success');
      assert.equal(await saved.getAttribute('data-tone'), 'save');
      assert.equal(await saved.getAttribute('aria-busy'), null);
      assert.equal(await saved.locator('.diet-icon-mask').count(), 1);
      assert.match(
        String(await saved.locator('.diet-icon-mask').getAttribute('style')),
        /checkmark\.svg/,
      );
      assert.equal(await saved.isDisabled(), true);
      assert.equal(await bobProbeAttribute(bobFrame, 'data-dirty'), 'false');
      assert.equal(await bobProbeAttribute(bobFrame, 'data-saving'), 'false');
      await bobFrame.locator('[data-edit-after-save]').click();
      await assertBorrowedSaveVisible(page);
      assert.equal(await bobProbeAttribute(bobFrame, 'data-dirty'), 'true');
      assert.equal(
        await page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.openCalls()),
        1,
        'existing Save after first Save must continue in the same Bob session',
      );

      await bobFrame.locator('[data-start-copilot-request]').click();
      await page.waitForFunction(
        () => (window as RomaHarnessWindow).__romaSaveFixture.copilotStarts() === 1,
      );
      const activeCopilotRequestId = await bobProbeAttribute(
        bobFrame,
        'data-active-copilot-request-id',
      );
      assert.ok(activeCopilotRequestId, 'Bob must expose the active stream request coordinate');
      await bobFrame.locator('[data-cancel-copilot-request]').click();
      await page.waitForFunction(
        () => (window as RomaHarnessWindow).__romaSaveFixture.copilotAborts() === 1,
      );
      await bobFrame
        .locator('[data-bob-session-probe][data-cancel-result-count="1"]')
        .waitFor({ state: 'attached' });
      assert.equal(
        await page.evaluate(() => (window as RomaHarnessWindow).__romaSaveFixture.copilotAborts()),
        1,
        "Roma must abort the controller keyed by Bob's target stream request ID",
      );
      assert.deepEqual(
        pageErrors,
        [],
        'the production Roma/Bob Save bridge must raise no browser errors',
      );
    } finally {
      await browser.close();
    }
  } finally {
    if (romaServer) await romaServer.close();
    await bobServer.close();
  }
}

async function main(): Promise<void> {
  testBobPhaseAdmission();
  await testProductionRomaBobSaveBridge();
  console.log(
    'PASS production Roma/Bob Save bridge, exact frame admission, and targeted Copilot cancellation',
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
