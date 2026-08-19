import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const stateKey = '__clickeenWidgetsRouteTestState';
const routePath = fileURLToPath(new URL('../app/api/account/widgets/route.ts', import.meta.url));

const bundle = await build({
  entryPoints: [routePath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [
    {
      name: 'widgets-route-owner-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-instance-direct$/ },
          () => ({ path: 'account-instance-direct', namespace: 'widgets-route-test' }),
        );
        buildApi.onResolve(
          { filter: /current-account-route$/ },
          () => ({ path: 'current-account-route', namespace: 'widgets-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^next\/server$/ },
          () => ({ path: 'next-server', namespace: 'widgets-route-test' }),
        );

        buildApi.onLoad(
          { filter: /^account-instance-direct$/, namespace: 'widgets-route-test' },
          () => ({
            loader: 'js',
            contents: `
              export function loadAccountWidgetInstanceFacts(args) {
                return globalThis.${stateKey}.loadInstances(args);
              }
              export function listTokyoWidgetDefinitions(args) {
                return globalThis.${stateKey}.loadDefinitions(args);
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^current-account-route$/, namespace: 'widgets-route-test' },
          () => ({
            loader: 'js',
            contents: `
              export function resolveCurrentAccountRouteContext(args) {
                return globalThis.${stateKey}.resolveCurrent(args);
              }
              export function withSession(request, response, setCookies) {
                globalThis.${stateKey}.sessionCookies.push(setCookies);
                return response;
              }
            `,
          }),
        );
        buildApi.onLoad(
          { filter: /^next-server$/, namespace: 'widgets-route-test' },
          () => ({
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
          }),
        );
      },
    },
  ],
});

const routeModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const currentValue = {
  authzPayload: { accountPublicId: 'ACCOUNT' },
  authzToken: 'account-capsule',
  requestId: 'request-1',
  setCookies: ['session-cookie'],
};

const instancesSuccess = {
  ok: true,
  value: {
    instances: [
      {
        instanceId: 'instance-1',
        widgetType: 'faq',
        displayName: null,
        publishStatus: 'unpublished',
        updatedAt: '2026-08-19T10:00:00.000Z',
        publishedAt: null,
      },
    ],
  },
};

const definitionsSuccess = {
  ok: true,
  value: {
    widgetDefinitions: [
      {
        widgetType: 'faq',
        displayName: 'FAQ',
        description: 'Answer common questions.',
      },
    ],
  },
};

function installState({ loadInstances, loadDefinitions }) {
  const calls = [];
  const sessionCookies = [];
  globalThis[stateKey] = {
    calls,
    sessionCookies,
    resolveCurrent: async () => ({ ok: true, value: currentValue }),
    loadInstances: (args) => {
      calls.push({ owner: 'instances', args });
      return loadInstances(args);
    },
    loadDefinitions: (args) => {
      calls.push({ owner: 'definitions', args });
      return loadDefinitions(args);
    },
  };
  return { calls, sessionCookies };
}

let resolveInstances;
let resolveDefinitions;
const concurrent = installState({
  loadInstances: () => new Promise((resolve) => {
    resolveInstances = resolve;
  }),
  loadDefinitions: () => new Promise((resolve) => {
    resolveDefinitions = resolve;
  }),
});

const successResponsePromise = routeModule.GET({});
await Promise.resolve();
assert.deepEqual(
  concurrent.calls.map((call) => call.owner),
  ['instances', 'definitions'],
  'both independent Tokyo reads must start before either result resolves',
);
for (const call of concurrent.calls) {
  assert.deepEqual(call.args, {
    accountId: 'ACCOUNT',
    accountCapsule: 'account-capsule',
    requestId: 'request-1',
  });
}
resolveDefinitions(definitionsSuccess);
resolveInstances(instancesSuccess);

const successResponse = await successResponsePromise;
assert.equal(successResponse.status, 200);
assert.deepEqual(await successResponse.json(), {
  accountId: 'ACCOUNT',
  catalog: [
    {
      widgetType: 'faq',
      displayName: 'FAQ',
      description: 'Answer common questions.',
    },
  ],
  instances: [
    {
      instanceId: 'instance-1',
      widgetType: 'faq',
      displayName: 'Untitled widget',
      status: 'unpublished',
      updatedAt: '2026-08-19T10:00:00.000Z',
      publishedAt: null,
    },
  ],
});
assert.deepEqual(concurrent.sessionCookies, [['session-cookie']]);

const instanceError = {
  ok: false,
  status: 401,
  error: { reasonKey: 'instances.failed', detail: 'instance owner failed' },
};
const definitionsError = {
  ok: false,
  status: 503,
  error: { reasonKey: 'definitions.failed', detail: 'definition owner failed' },
};

const bothFail = installState({
  loadInstances: async () => instanceError,
  loadDefinitions: async () => definitionsError,
});
const firstErrorResponse = await routeModule.GET({});
assert.deepEqual(
  bothFail.calls.map((call) => call.owner),
  ['instances', 'definitions'],
  'definitions must still start when the instance result fails',
);
assert.equal(firstErrorResponse.status, 401);
assert.deepEqual(await firstErrorResponse.json(), {
  error: {
    kind: 'AUTH',
    reasonKey: 'instances.failed',
    detail: 'instance owner failed',
  },
});

installState({
  loadInstances: async () => instancesSuccess,
  loadDefinitions: async () => definitionsError,
});
const secondErrorResponse = await routeModule.GET({});
assert.equal(secondErrorResponse.status, 503);
assert.deepEqual(await secondErrorResponse.json(), {
  error: {
    kind: 'UPSTREAM_UNAVAILABLE',
    reasonKey: 'definitions.failed',
    detail: 'definition owner failed',
  },
});

delete globalThis[stateKey];
console.log('Widgets route cold-path behavior passed.');
