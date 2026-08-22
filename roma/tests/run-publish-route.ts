import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
const stateKey = '__clickeenPublishRouteTestState';
const routePath = fileURLToPath(
  new URL('../app/api/account/instances/[instanceId]/publish/route.ts', import.meta.url),
);

const bundle = await build({
  entryPoints: [routePath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [
    {
      name: 'publish-route-owner-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-instance-direct$/ },
          () => ({ path: 'instances', namespace: 'publish-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@roma\/lib\/account-instance-public-package$/ },
          () => ({ path: 'package', namespace: 'publish-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^@roma\/lib\/route-helpers$/ },
          () => ({ path: 'helpers', namespace: 'publish-route-test' }),
        );
        buildApi.onResolve(
          { filter: /current-account-route$/ },
          () => ({ path: 'account', namespace: 'publish-route-test' }),
        );
        buildApi.onResolve(
          { filter: /^next\/server$/ },
          () => ({ path: 'next', namespace: 'publish-route-test' }),
        );
        buildApi.onLoad({ filter: /^instances$/, namespace: 'publish-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function loadAccountWidgetInstanceFacts(args) {
              return globalThis.${stateKey}.call('facts', args);
            }
            export function loadTokyoAccountInstanceDocument(args) {
              return globalThis.${stateKey}.call('source', args);
            }
            export function publishAccountInstanceInTokyo(args) {
              return globalThis.${stateKey}.call('publish', args);
            }
          `,
        }));
        buildApi.onLoad({ filter: /^package$/, namespace: 'publish-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function readWidgetForInstancePackage(widgetType) {
              return globalThis.${stateKey}.call('artifact', widgetType);
            }
            export function materializeAccountInstancePublicPackage(args) {
              return globalThis.${stateKey}.call('materialize', args);
            }
          `,
        }));
        buildApi.onLoad({ filter: /^helpers$/, namespace: 'publish-route-test' }, () => ({
          loader: 'js',
          contents: `
            export async function requireInstanceIdParam(context) {
              return (await context.params).instanceId;
            }
          `,
        }));
        buildApi.onLoad({ filter: /^account$/, namespace: 'publish-route-test' }, () => ({
          loader: 'js',
          contents: `
            export function resolveCurrentAccountRouteContext() {
              return Promise.resolve({ ok: true, value: globalThis.${stateKey}.current });
            }
            export function withSession(_request, response) { return response; }
          `,
        }));
        buildApi.onLoad({ filter: /^next$/, namespace: 'publish-route-test' }, () => ({
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

const route = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
) as { POST(request: Request, context: { params: Promise<{ instanceId: string }> }): Promise<Response> };

const current = {
  authzPayload: {
    accountPublicId: 'ACCOUNT',
    profile: 'free',
    role: 'owner',
    entitlements: {
      flags: { 'embed.seoGeo.enabled': true },
      limits: { 'instances.published.max': 1 },
    },
  },
  authzToken: 'capsule',
  requestId: 'request-1',
  setCookies: [],
};

function install(results: Record<string, unknown>) {
  const calls: string[] = [];
  (globalThis as Record<string, unknown>)[stateKey] = {
    current,
    call(owner: string) {
      calls.push(owner);
      if (!Object.prototype.hasOwnProperty.call(results, owner)) {
        throw new Error(`unexpected ${owner} call`);
      }
      return results[owner];
    },
  };
  return calls;
}

const fullAccountCalls = install({
  facts: {
    ok: true,
    value: {
      instances: [
        {
          instanceId: 'TARGET',
          widgetType: 'faq',
          displayName: null,
          publishStatus: 'unpublished',
          updatedAt: '2026-08-22T00:00:00.000Z',
          publishedAt: null,
        },
        {
          instanceId: 'OTHER',
          widgetType: 'cards',
          displayName: null,
          publishStatus: 'published',
          updatedAt: '2026-08-22T00:00:00.000Z',
          publishedAt: '2026-08-22T00:00:00.000Z',
        },
      ],
    },
  },
});
const fullResponse = await route.POST(new Request('https://roma.test/publish'), {
  params: Promise.resolve({ instanceId: 'TARGET' }),
});
assert.equal(fullResponse.status, 402);
assert.deepEqual(await fullResponse.json(), {
  ok: false,
  kind: 'UPGRADE_REQUIRED',
  upgrade: {
    gate: 'instances.published.max',
    action: 'publish_instance',
    current: 1,
    limit: 1,
  },
});
assert.deepEqual(
  fullAccountCalls,
  ['facts'],
  'Roma must return the fast capacity result before source, asset, or materializer work',
);

const finalCapacityCalls = install({
  facts: {
    ok: true,
    value: {
      instances: [{
        instanceId: 'TARGET',
        widgetType: 'faq',
        displayName: null,
        publishStatus: 'unpublished',
        updatedAt: '2026-08-22T00:00:00.000Z',
        publishedAt: null,
      }],
    },
  },
  source: {
    ok: true,
    value: {
      row: {
        instanceId: 'TARGET',
        widgetType: 'faq',
        baseLocale: 'en',
        updatedAt: '2026-08-22T00:00:00.000Z',
      },
      config: {},
    },
  },
  artifact: { widgetname: 'faq' },
  materialize: {
    ok: true,
    value: { indexHtml: '<main></main>', stylesCss: '', runtimeJs: '' },
  },
  publish: {
    ok: false,
    status: 402,
    error: { current: 1, limit: 1 },
  },
});
const finalCapacityResponse = await route.POST(new Request('https://roma.test/publish'), {
  params: Promise.resolve({ instanceId: 'TARGET' }),
});
assert.equal(finalCapacityResponse.status, 402);
assert.deepEqual(await finalCapacityResponse.json(), {
  ok: false,
  kind: 'UPGRADE_REQUIRED',
  upgrade: {
    gate: 'instances.published.max',
    action: 'publish_instance',
    current: 1,
    limit: 1,
  },
});
assert.deepEqual(finalCapacityCalls, ['facts', 'source', 'artifact', 'materialize', 'publish']);

console.log('PASS Roma preserves fast and final atomic publication-capacity boundaries');
}

void main();
