import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const componentPath = fileURLToPath(
  new URL('../components/widget-defaults-builder-controls.tsx', import.meta.url),
);

const bundle = await build({
  stdin: {
    contents: `
      import { buildPanelHtml } from ${JSON.stringify(componentPath)};
      globalThis.__buildWidgetDefaultsPanelHtml = buildPanelHtml;
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'widget-defaults-panel-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  platform: 'browser',
  target: 'es2022',
  treeShaking: true,
  write: false,
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => {
    const cluster = (label, path, marker) => `
      <div class="tdmenucontent__cluster">
        <div class="tdmenucontent__cluster-header">
          <div class="overline-small tdmenucontent__cluster-label">${label}</div>
        </div>
        <div class="tdmenucontent__cluster-body">
          <input data-bob-path="${path}" data-marker="${marker}">
        </div>
      </div>
    `;

    const payload = {
      panels: [
        {
          id: 'appearance',
          label: 'Appearance <strong> & "tone"',
          html: [
            cluster('Locale switcher', 'appearance.locale.background', 'appearance-first'),
            cluster('Other', 'appearance.unselected', 'must-be-filtered'),
            cluster('Locale switcher', 'appearance.locale.text', 'appearance-second'),
          ].join(''),
        },
        {
          id: 'typography',
          label: 'Typography',
          html: cluster('Locale switcher', 'typography.locale.family', 'typography'),
        },
        {
          id: 'settings',
          label: 'Settings',
          html: cluster('Locale switcher', 'settings.locale.enabled', 'must-be-absent'),
        },
      ],
    };
    const controls = [
      { panelId: 'appearance', path: 'appearance.locale.background' },
      { panelId: 'appearance', path: 'appearance.locale.text' },
      { panelId: 'typography', path: 'typography.locale.family' },
      { panelId: 'settings', path: 'settings.missing' },
    ];

    const html = globalThis.__buildWidgetDefaultsPanelHtml(payload, controls);
    const host = document.createElement('div');
    host.className = 'tdmenucontent__fields';
    host.innerHTML = html;
    document.body.appendChild(host);

    const panels = Array.from(host.children);
    return {
      panelTags: panels.map((panel) => panel.tagName),
      panelClasses: panels.map((panel) => panel.className),
      labels: panels.map(
        (panel) => panel.querySelector(':scope > .tdmenucontent__cluster-header > h3')?.textContent,
      ),
      labelChildCounts: panels.map(
        (panel) => panel.querySelector(':scope > .tdmenucontent__cluster-header > h3')?.children.length,
      ),
      markers: panels.map((panel) =>
        Array.from(panel.querySelectorAll('[data-marker]')).map((node) =>
          node.getAttribute('data-marker'),
        ),
      ),
      clusterLabels: panels.map((panel) =>
        Array.from(
          panel.querySelectorAll(
            ':scope > .tdmenucontent__cluster-body > .tdmenucontent__cluster .tdmenucontent__cluster-label',
          ),
        ).map((node) => node.textContent),
      ),
    };
  });

  assert.deepEqual(result.panelTags, ['SECTION', 'SECTION']);
  assert.deepEqual(result.panelClasses, ['tdmenucontent__cluster', 'tdmenucontent__cluster']);
  assert.deepEqual(result.labels, ['Appearance <strong> & "tone"', 'Typography']);
  assert.deepEqual(
    result.labelChildCounts,
    [0, 0],
    'trusted labels must be assigned as text rather than interpreted as markup',
  );
  assert.deepEqual(result.markers, [
    ['appearance-first', 'appearance-second'],
    ['typography'],
  ]);
  assert.deepEqual(result.clusterLabels, [
    ['Locale switcher', 'Locale switcher'],
    ['Locale switcher'],
  ]);
} finally {
  await browser.close();
}

console.log('Widget Defaults panel projection behavior passed.');

const domainPath = fileURLToPath(
  new URL('../components/widget-defaults-domain.tsx', import.meta.url),
);
const domainBundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { WidgetDefaultsDomain } from ${JSON.stringify(domainPath)};
      globalThis.__renderWidgetDefaultsDomain = (host) => {
        const root = createRoot(host);
        root.render(React.createElement(WidgetDefaultsDomain));
        return () => root.unmount();
      };
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'widget-defaults-domain-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  platform: 'browser',
  target: 'es2022',
  write: false,
  plugins: [
    {
      name: 'widget-defaults-domain-owner-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /account-api$/ },
          () => ({ path: 'account-api', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onResolve(
          { filter: /widget-editor-artifact$/ },
          () => ({ path: 'widget-editor-artifact', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onResolve(
          { filter: /widget-defaults-builder-controls$/ },
          () => ({ path: 'widget-defaults-builder-controls', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onResolve(
          { filter: /dieter-dropdown-actions$/ },
          () => ({ path: 'dieter-dropdown-actions', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onResolve(
          { filter: /roma-unsaved-changes-dialog$/ },
          () => ({ path: 'roma-unsaved-changes-dialog', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onResolve(
          { filter: /roma-system-state$/ },
          () => ({ path: 'roma-system-state', namespace: 'widget-defaults-domain-test' }),
        );
        buildApi.onLoad(
          { filter: /^account-api$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'js',
            contents: `
              export function useRomaAccountApi() {
                return globalThis.__widgetDefaultsDomainState.accountApi;
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^widget-editor-artifact$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'js',
            contents: `
              export function getWidgetEditorArtifact(widgetType) {
                return globalThis.__widgetDefaultsDomainState.loadArtifact(widgetType);
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^widget-defaults-builder-controls$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'jsx',
            resolveDir: fileURLToPath(new URL('..', import.meta.url)),
            contents: `
              import React, { useEffect } from 'react';
              export function WidgetDefaultsBuilderControls(props) {
                useEffect(() => {
                  props.onReadyChange(true);
                  return () => props.onReadyChange(false);
                }, [props.onReadyChange, props.payload, props.hostId]);
                const firstPath = props.controls[0]?.path ?? '';
                return <div data-control-host={props.hostId} data-values={JSON.stringify(props.values)}>
                  <button data-edit-host={props.hostId} onClick={() => props.onOps([{ path: firstPath, value: globalThis.__widgetDefaultsDomainState.nextEditValue(props.hostId) }])}>Edit</button>
                </div>;
              }
              export function readValuefieldInput(value) { return value; }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^dieter-dropdown-actions$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'jsx',
            resolveDir: fileURLToPath(new URL('..', import.meta.url)),
            contents: `
              import React from 'react';
              export function DieterDropdownActions(props) {
                return <select data-widget-selector aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
                  {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>;
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^roma-unsaved-changes-dialog$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'jsx',
            resolveDir: fileURLToPath(new URL('..', import.meta.url)),
            contents: `
              import React from 'react';
              export function RomaUnsavedChangesDialog(props) {
                return props.open ? <div data-unsaved-dialog="open" /> : null;
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^roma-system-state$/, namespace: 'widget-defaults-domain-test' },
          () => ({
            loader: 'jsx',
            resolveDir: fileURLToPath(new URL('..', import.meta.url)),
            contents: `
              import React from 'react';
              export function RomaLoadingState() { return <div data-loading-state />; }
            `,
          }),
        );
      },
    },
  ],
});

const domainBrowser = await chromium.launch({ headless: true });
try {
  const page = await domainBrowser.newPage();
  page.on('pageerror', (error) => console.error(error));
  await page.addScriptTag({ content: domainBundle.outputFiles[0].text });
  await page.evaluate(() => {
    const common = { coreSize: { mode: 'auto' } };
    const initialDocument = {
      accountId: 'ACCOUNT',
      fontLibrary: { fonts: {} },
      common,
      widgets: {},
      seededAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    };
    const artifacts = {
      zeta: {
        widgetname: 'zeta',
        displayName: 'Zulu Widget',
        coreDefaults: { zeta: { value: 'deployed-zeta' }, untouched: { value: true } },
        controls: [
          { path: 'coreSize.mode', panelId: 'common' },
          { path: 'zeta.value', panelId: 'core' },
        ],
        panels: [], limits: {}, upsell: {}, editableFields: {}, widgetSoftware: {}, defaults: {}, toolDrawerLabels: {},
      },
      alpha: {
        widgetname: 'alpha',
        displayName: 'Alpha Widget',
        coreDefaults: { alpha: { value: 'deployed-alpha' }, mustNotMerge: true },
        controls: [
          { path: 'coreSize.mode', panelId: 'common' },
          { path: 'alpha.value', panelId: 'core' },
        ],
        panels: [], limits: {}, upsell: {}, editableFields: {}, widgetSoftware: {}, defaults: {}, toolDrawerLabels: {},
      },
    };
    const pending = new Map();
    const artifactCalls = [];
    const writes = [];
    const editCounts = new Map();
    const state = {
      artifactCalls,
      writes,
      pending,
      initialDocument,
      nextEditValue(hostId) {
        const count = (editCounts.get(hostId) ?? 0) + 1;
        editCounts.set(hostId, count);
        return count === 1 ? 'edited' : `edited-${count}`;
      },
      accountApi: {
        async fetchJson(path, init) {
          if (init.method === 'GET') {
            return {
              accountId: 'ACCOUNT',
              widgetDefaults: structuredClone(initialDocument),
              widgetDefinitions: [
                { widgetType: 'zeta', displayName: 'Zulu Widget', description: '' },
                { widgetType: 'alpha', displayName: 'Alpha Widget', description: '' },
              ],
            };
          }
          const submitted = JSON.parse(init.body).widgetDefaults;
          writes.push(structuredClone(submitted));
          return { accountId: 'ACCOUNT', widgetDefaults: submitted };
        },
      },
      loadArtifact(widgetType) {
        artifactCalls.push(widgetType);
        return new Promise((resolve) => pending.set(widgetType, () => resolve(artifacts[widgetType])));
      },
    };
    globalThis.__widgetDefaultsDomainState = state;
    const host = document.createElement('div');
    host.id = 'domain-root';
    document.body.appendChild(host);
    const link = document.createElement('a');
    link.id = 'outside-link';
    link.href = '/elsewhere';
    link.textContent = 'Elsewhere';
    document.body.appendChild(link);
    globalThis.__unmountWidgetDefaultsDomain = globalThis.__renderWidgetDefaultsDomain(host);
  });

  await page.waitForFunction(() => globalThis.__widgetDefaultsDomainState.pending.has('zeta'));
  await page.evaluate(() => globalThis.__widgetDefaultsDomainState.pending.get('zeta')());
  await page.waitForSelector('[data-control-host="widget-defaults-core-zeta"]');

  assert.deepEqual(
    await page.locator('[data-widget-selector] option').allTextContents(),
    ['Zulu Widget', 'Alpha Widget'],
    'the selector must preserve exact compact-Catalog order',
  );
  assert.equal(await page.locator('[data-widget-selector]').inputValue(), 'zeta');
  assert.equal(await page.locator('[data-control-host^="widget-defaults-core-"]').count(), 1);
  assert.deepEqual(
    JSON.parse(await page.locator('[data-control-host="widget-defaults-core-zeta"]').getAttribute('data-values')),
    { zeta: { value: 'deployed-zeta' }, untouched: { value: true } },
    'an absent override must use the exact deployed baseline',
  );
  assert.deepEqual(
    await page.evaluate(() => globalThis.__widgetDefaultsDomainState.writes),
    [],
    'selection and initial hydration must not write defaults',
  );

  await page.locator('[data-edit-host="widget-defaults-common"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('button[data-state="success"]');
  assert.deepEqual(
    await page.evaluate(() => globalThis.__widgetDefaultsDomainState.writes[0].widgets),
    {},
    'a common-only Save must not create any Widget Core override',
  );
  await page.waitForTimeout(1100);

  await page.locator('[data-widget-selector]').selectOption('alpha');
  assert.equal(
    await page.locator('[data-control-host^="widget-defaults-core-"]').count(),
    0,
    'a new selection must never render the previous Widget artifact under the new coordinate',
  );
  await page.evaluate(() => globalThis.__widgetDefaultsDomainState.pending.get('alpha')());
  await page.waitForSelector('[data-control-host="widget-defaults-core-alpha"]');
  assert.deepEqual(
    JSON.parse(await page.locator('[data-control-host="widget-defaults-core-alpha"]').getAttribute('data-values')),
    { alpha: { value: 'deployed-alpha' }, mustNotMerge: true },
    'an absent Alpha override must use its exact deployed baseline',
  );

  await page.locator('[data-edit-host="widget-defaults-core-alpha"]').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-control-host="widget-defaults-core-alpha"]')?.getAttribute('data-values')?.includes('edited'),
  );
  await page.locator('[data-widget-selector]').selectOption('zeta');
  await page.waitForFunction(() => globalThis.__widgetDefaultsDomainState.artifactCalls.filter((value) => value === 'zeta').length === 2);
  await page.evaluate(() => globalThis.__widgetDefaultsDomainState.pending.get('zeta')());
  await page.waitForSelector('[data-control-host="widget-defaults-core-zeta"]');
  await page.locator('[data-widget-selector]').selectOption('alpha');
  await page.waitForFunction(() => globalThis.__widgetDefaultsDomainState.artifactCalls.filter((value) => value === 'alpha').length === 2);
  await page.evaluate(() => globalThis.__widgetDefaultsDomainState.pending.get('alpha')());
  await page.waitForSelector('[data-control-host="widget-defaults-core-alpha"]');
  assert.deepEqual(
    JSON.parse(await page.locator('[data-control-host="widget-defaults-core-alpha"]').getAttribute('data-values')),
    { alpha: { value: 'edited' }, mustNotMerge: true },
    'switching selection must preserve the one coherent unsaved draft',
  );
  assert.equal(await page.locator('[data-control-host^="widget-defaults-core-"]').count(), 1);

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('button[data-state="success"]');
  const savedDocument = await page.evaluate(() => globalThis.__widgetDefaultsDomainState.writes[1]);
  assert.deepEqual(Object.keys(savedDocument.widgets), ['alpha']);
  assert.deepEqual(savedDocument.widgets.alpha.core, {
    alpha: { value: 'edited' },
    mustNotMerge: true,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(savedDocument.widgets, 'zeta'), false);

  await page.waitForTimeout(1100);
  await page.locator('[data-edit-host="widget-defaults-core-alpha"]').click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-control-host="widget-defaults-core-alpha"]')?.getAttribute('data-values') === JSON.stringify({ alpha: { value: 'edited' }, mustNotMerge: true }),
  );

  await page.locator('[data-edit-host="widget-defaults-core-alpha"]').click();
  await page.locator('#outside-link').click();
  await page.waitForSelector('[data-unsaved-dialog="open"]', { state: 'attached' });

  assert.deepEqual(
    await page.evaluate(() => globalThis.__widgetDefaultsDomainState.artifactCalls),
    ['zeta', 'alpha', 'zeta', 'alpha'],
    'each selection must fetch only its one selected editor artifact',
  );
} finally {
  await domainBrowser.close();
}

console.log('Widget Defaults selected-artifact and coherent-draft behavior passed.');

const defaultsRouteStateKey = '__clickeenWidgetDefaultsRouteTestState';
const defaultsRoutePath = fileURLToPath(
  new URL('../app/api/account/widget-defaults/route.ts', import.meta.url),
);
const defaultsRouteBundle = await build({
  entryPoints: [defaultsRoutePath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [
    {
      name: 'widget-defaults-route-owner-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-widget-defaults-direct$/ },
          () => ({ path: 'defaults-owner', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-instance-direct$/ },
          () => ({ path: 'definitions-owner', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-widget-defaults-contract$/ },
          () => ({ path: 'contract', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@roma\/lib\/route-helpers$/ },
          () => ({ path: 'route-helpers', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /current-account-route$/ },
          () => ({ path: 'account', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@clickeen\/ck-contracts$/ },
          () => ({ path: 'contracts', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^next\/server$/ },
          () => ({ path: 'next', namespace: 'widget-defaults-route-test' }),
        );
        buildApi.onLoad({ filter: /^defaults-owner$/, namespace: 'widget-defaults-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function loadAccountWidgetDefaultsInTokyo(args) {
              return globalThis.${defaultsRouteStateKey}.loadDefaults(args);
            }
            export function saveAccountWidgetDefaultsInTokyo() {
              throw new Error('PUT is outside this GET test');
            }
          `,
        }));
        buildApi.onLoad({ filter: /^definitions-owner$/, namespace: 'widget-defaults-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function listTokyoWidgetDefinitions(args) {
              return globalThis.${defaultsRouteStateKey}.loadDefinitions(args);
            }
          `,
        }));
        buildApi.onLoad({ filter: /^(contract|route-helpers|contracts)$/, namespace: 'widget-defaults-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function validateAccountWidgetDefaultsTypography() { return { ok: true }; }
            export function readJsonPayloadOrValidation() { throw new Error('PUT is outside this GET test'); }
            export function isRecord(value) { return Boolean(value) && typeof value === 'object'; }
          `,
        }));
        buildApi.onLoad({ filter: /^account$/, namespace: 'widget-defaults-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function resolveCurrentAccountRouteContext() {
              return Promise.resolve({ ok: true, value: globalThis.${defaultsRouteStateKey}.current });
            }
            export function withSession(_request, response) { return response; }
          `,
        }));
        buildApi.onLoad({ filter: /^next$/, namespace: 'widget-defaults-route-test' }, () => ({
          loader: 'js',
          contents: `
            export class NextRequest {}
            export class NextResponse extends Response {
              static json(body, init = {}) {
                const headers = new Headers(init.headers);
                headers.set('content-type', 'application/json');
                return new Response(JSON.stringify(body), { ...init, headers });
              }
            }
          `,
        }));
      },
    },
  ],
});
const defaultsRoute = await import(
  `data:text/javascript;base64,${Buffer.from(defaultsRouteBundle.outputFiles[0].text).toString('base64')}`,
);

let resolveDefaults;
let resolveDefinitions;
const routeCalls = [];
globalThis[defaultsRouteStateKey] = {
  current: {
    authzPayload: { accountPublicId: 'ACCOUNT' },
    authzToken: 'capsule',
    requestId: 'request-1',
    setCookies: [],
  },
  loadDefaults(args) {
    routeCalls.push({ owner: 'defaults', args });
    return new Promise((resolve) => { resolveDefaults = resolve; });
  },
  loadDefinitions(args) {
    routeCalls.push({ owner: 'definitions', args });
    return new Promise((resolve) => { resolveDefinitions = resolve; });
  },
};
const routeResponsePromise = defaultsRoute.GET({});
await Promise.resolve();
assert.deepEqual(routeCalls.map((call) => call.owner), ['defaults', 'definitions']);
for (const call of routeCalls) {
  assert.deepEqual(call.args, {
    accountId: 'ACCOUNT',
    accountCapsule: 'capsule',
    requestId: 'request-1',
  });
}
const exactRouteDocument = {
  accountId: 'ACCOUNT',
  fontLibrary: { fonts: {} },
  common: { coreSize: { mode: 'auto' } },
  widgets: {},
  seededAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z',
};
const exactDefinitions = [
  { widgetType: 'zeta', displayName: 'Zulu Widget', description: '' },
  { widgetType: 'alpha', displayName: 'Alpha Widget', description: '' },
];
resolveDefinitions({ ok: true, value: { widgetDefinitions: exactDefinitions } });
resolveDefaults({
  ok: true,
  value: { accountId: 'ACCOUNT', widgetDefaults: exactRouteDocument },
});
const defaultsRouteResponse = await routeResponsePromise;
assert.equal(defaultsRouteResponse.status, 200);
assert.deepEqual(await defaultsRouteResponse.json(), {
  accountId: 'ACCOUNT',
  widgetDefaults: exactRouteDocument,
  widgetDefinitions: exactDefinitions,
});

console.log('Widget Defaults route joins exact stored defaults and compact selector truth.');
