import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
const stateKey = '__clickeenBuilderNewOpenTestState';
const entryPath = fileURLToPath(new URL('../lib/builder-open.ts', import.meta.url));

const bundle = await build({
  entryPoints: [entryPath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [
    {
      name: 'builder-new-open-owner-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /^@roma\/generated\/widget-materializer-artifacts$/ },
          () => ({ path: 'materializers', namespace: 'builder-new-open-test' }),
        );
        buildApi.onResolve(
          { filter: /account-widget-defaults-direct$/ },
          () => ({ path: 'defaults', namespace: 'builder-new-open-test' }),
        );
        buildApi.onResolve(
          { filter: /account-instance-direct$/ },
          () => ({ path: 'instances', namespace: 'builder-new-open-test' }),
        );
        buildApi.onLoad(
          { filter: /^materializers$/, namespace: 'builder-new-open-test' },
          () => ({
            loader: 'js',
            contents: `
              export function readWidgetMaterializerArtifact(widgetType) {
                return globalThis.${stateKey}.readMaterializer(widgetType);
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^defaults$/, namespace: 'builder-new-open-test' },
          () => ({
            loader: 'js',
            contents: `
              export function loadAccountWidgetDefaultsInTokyo(args) {
                return globalThis.${stateKey}.loadDefaults(args);
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^instances$/, namespace: 'builder-new-open-test' },
          () => ({
            loader: 'js',
            contents: `
              export function loadTokyoAccountInstanceDocument(args) {
                return globalThis.${stateKey}.loadInstance(args);
              }
            `,
          }),
        );
      },
    },
  ],
});

const module = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
) as {
  loadNewBuilderOpenEnvelope(args: {
    accountId: string;
    widgetType: string;
    baseLocale: string;
    accountCapsule: string;
    requestId: string;
  }): Promise<Record<string, unknown>>;
};

const common = {
  header: { title: 'Account title' },
  typography: { roles: { title: { family: 'Inter' } } },
};
const deployedCore = {
  content: { question: 'Deployed question', answer: 'Deployed answer' },
  typography: { roles: { question: { family: 'Inter' } } },
};
const storedCore = {
  content: { question: 'Account question' },
  typography: { roles: { question: { family: 'Orio' } } },
};
const fontLibrary = { fonts: { Inter: { source: 'google' } } };

function defaultsResult(widgets: Record<string, { core: Record<string, unknown> }> = {}) {
  return {
    ok: true,
    value: {
      accountId: 'ACCOUNT',
      widgetDefaults: {
        accountId: 'ACCOUNT',
        fontLibrary,
        common,
        widgets,
        seededAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
      },
    },
  };
}

function materializer(widgetType = 'future-widget') {
  return {
    widgetname: widgetType,
    coreDefaults: deployedCore,
  };
}

function installState(args?: {
  materializer?: unknown;
  defaults?: unknown;
}) {
  const calls: Array<{ owner: string; value: unknown }> = [];
  let resolveMaterializer!: (value: unknown) => void;
  let resolveDefaults!: (value: unknown) => void;
  const materializerPromise = new Promise((resolve) => {
    resolveMaterializer = resolve;
  });
  const defaultsPromise = new Promise((resolve) => {
    resolveDefaults = resolve;
  });
  (globalThis as Record<string, unknown>)[stateKey] = {
    readMaterializer(widgetType: string) {
      calls.push({ owner: 'materializer', value: widgetType });
      return materializerPromise;
    },
    loadDefaults(value: unknown) {
      calls.push({ owner: 'defaults', value });
      return defaultsPromise;
    },
    loadInstance() {
      throw new Error('New must not read a saved instance');
    },
  };
  return {
    calls,
    resolveMaterializer: (value: unknown = args?.materializer ?? materializer()) =>
      resolveMaterializer(value),
    resolveDefaults: (value: unknown = args?.defaults ?? defaultsResult()) => resolveDefaults(value),
  };
}

const request = {
  accountId: 'ACCOUNT',
  widgetType: 'future-widget',
  baseLocale: 'en',
  accountCapsule: 'capsule',
  requestId: 'request-1',
};

const absentOverride = installState();
const absentPromise = module.loadNewBuilderOpenEnvelope(request);
await Promise.resolve();
assert.deepEqual(
  absentOverride.calls.map((entry) => entry.owner),
  ['materializer', 'defaults'],
  'selected software and account defaults must start together',
);
absentOverride.resolveMaterializer();
absentOverride.resolveDefaults();
assert.deepEqual(await absentPromise, {
  ok: true,
  value: {
    instanceId: null,
    displayName: null,
    widgetType: 'future-widget',
    baseLocale: 'en',
    config: {
      header: { title: 'Account title' },
      typography: {
        roles: {
          title: { family: 'Inter' },
          question: { family: 'Inter' },
        },
      },
      content: { question: 'Deployed question', answer: 'Deployed answer' },
    },
    fontLibrary,
    publishStatus: null,
    publishedAt: null,
    sourceUpdatedAt: null,
  },
});

const exactOverride = installState();
const exactOverridePromise = module.loadNewBuilderOpenEnvelope(request);
exactOverride.resolveMaterializer();
exactOverride.resolveDefaults(defaultsResult({ 'future-widget': { core: storedCore } }));
const exactOverrideResult = await exactOverridePromise as {
  ok: boolean;
  value: { config: Record<string, unknown> };
};
assert.equal(exactOverrideResult.ok, true);
assert.deepEqual(exactOverrideResult.value.config, {
  header: { title: 'Account title' },
  typography: {
    roles: {
      title: { family: 'Inter' },
      question: { family: 'Orio' },
    },
  },
  content: { question: 'Account question' },
});
assert.equal(
  JSON.stringify(exactOverrideResult.value.config).includes('Deployed answer'),
  false,
  'a present complete override must not merge with the deployed Core baseline',
);

const unknown = installState();
const unknownPromise = module.loadNewBuilderOpenEnvelope({ ...request, widgetType: 'unknown' });
unknown.resolveMaterializer(null);
unknown.resolveDefaults();
assert.deepEqual(await unknownPromise, {
  ok: false,
  status: 404,
  error: {
    kind: 'NOT_FOUND',
    reasonKey: 'coreui.errors.instance.widgetMissing',
  },
});

for (const widgetType of ['big-bang', 'cards', 'countdown', 'faq', 'logoshowcase']) {
  const calls: string[] = [];
  (globalThis as Record<string, unknown>)[stateKey] = {
    readMaterializer(requestedWidgetType: string) {
      calls.push(`materializer:${requestedWidgetType}`);
      return Promise.resolve(materializer(requestedWidgetType));
    },
    loadDefaults() {
      calls.push('defaults');
      return Promise.resolve(defaultsResult());
    },
    loadInstance() {
      throw new Error('New must not read or write a saved instance');
    },
  };
  const result = await module.loadNewBuilderOpenEnvelope({
    ...request,
    widgetType,
  }) as { ok: boolean; value: { widgetType: string } };
  assert.equal(result.ok, true, widgetType);
  assert.equal(result.value.widgetType, widgetType);
  assert.deepEqual(calls, [`materializer:${widgetType}`, 'defaults']);
}

assert.equal(
  absentOverride.calls.some((entry) => entry.owner === 'definitions'),
  false,
  'New must not list Widget definitions',
);

console.log('PASS Builder New uses one selected deploy baseline and exact account overrides');
}

void main();
